import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { PDFDocument, rgb, type PDFImage } from 'pdf-lib'
import fontkit from '@pdf-lib/fontkit'
import { formatContractDate } from './contracts'

type Values = Record<string, string>
type Signature = { name: string; signatureData?: string | null; signedAt?: Date | null }
export type CollateralAgreementPdfData = {
  code: string; createdAt: Date; borrowerName: string; borrowerId?: string | null; borrowerAddress?: string | null; borrowerPhone?: string | null
  lenderName: string; lenderId?: string | null; lenderAddress?: string | null; lenderPhone?: string | null
  guarantorName?: string | null; guarantorAddress?: string | null; principalSatang: number; interestPercent: number; repaymentDueDate?: string | null
  details: Values; borrowerSignature?: Signature; lenderSignature?: Signature; guarantorSignature?: Signature
  providerSignature?: Signature; custodianSignature?: Signature; loanWitnesses?: Signature[]; collateralWitnesses?: Signature[]
}

const blank = '................................................'
const money = (satang: number) => new Intl.NumberFormat('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(satang / 100)
const moneyWords = (satang: number) => `${bahtWords(Math.floor(satang / 100))}${satang % 100 ? `บาท${bahtWords(satang % 100)}สตางค์` : 'บาทถ้วน'}`

export async function createCollateralAgreementPdf(data: CollateralAgreementPdfData) {
  const pdf = await PDFDocument.create(); pdf.registerFontkit(fontkit)
  const font = await pdf.embedFont(await readFile(path.join(process.cwd(), 'assets/fonts/Sarabun-Regular.ttf')), { subset: true })
  const bold = font
  const pageSize: [number, number] = [612, 792], margin = 48, size = 10.5, lineHeight = 15
  const ink = rgb(.08, .11, .16), gray = rgb(.4, .44, .5), segmenter = new Intl.Segmenter('th', { granularity: 'word' })
  let page = pdf.addPage(pageSize), y = pageSize[1] - margin
  const details = data.details
  const value = (key: string) => details[key]?.trim() || blank
  function addPage() { page = pdf.addPage(pageSize); y = pageSize[1] - margin; draw(`สัญญาหลักประกัน ${data.code} (ต่อ)`, margin, y, 9, bold); y -= 26 }
  function draw(text: string, x: number, baseline: number, fontSize = size, face = font) { page.drawText(text, { x, y: baseline, size: fontSize, font: face, color: ink }) }
  function paragraph(text: string, options: { indent?: number; gap?: number; heading?: boolean } = {}) {
    const indent = options.indent ?? 0, gap = options.gap ?? 5, face = options.heading ? bold : font
    let line = '', first = true
    const print = () => { if (y < margin + 24) addPage(); draw(line.trim(), margin + (first ? indent : 0), y, size, face); y -= lineHeight; line = ''; first = false }
    for (const part of segmenter.segment(text.replace(/[\r\n\t]+/g, ' '))) {
      const available = pageSize[0] - margin * 2 - (first ? indent : 0)
      if (face.widthOfTextAtSize(line + part.segment, size) > available && line) print()
      line += part.segment
    }
    if (line) print(); y -= gap
  }
  function field(label: string, text: string) { paragraph(`${label}: ${text || blank}`, { gap: 1 }) }
  async function signature(role: string, signer: Signature, includeDate = false) {
    if (y < margin + (includeDate ? 105 : 90)) addPage()
    const line = `ลงชื่อ ${blank} ${role}`
    draw(line, margin + 16, y)
    const png = signer.signatureData?.match(/^data:image\/png;base64,([A-Za-z0-9+/]+={0,2})$/)?.[1]
    if (png) {
      const image: PDFImage = await pdf.embedPng(Buffer.from(png, 'base64'))
      const scale = Math.min(90 / image.width, 24 / image.height)
      page.drawImage(image, { x: margin + 62, y: y - 4, width: image.width * scale, height: image.height * scale })
    }
    y -= lineHeight
    paragraph(`(${signer.name || blank})`, { indent: 75, gap: 0 })
    if (signer.signedAt) { paragraph(`ลงนามอิเล็กทรอนิกส์เมื่อ ${new Intl.DateTimeFormat('th-TH', { timeZone: 'Asia/Bangkok', dateStyle: 'medium', timeStyle: 'short' }).format(signer.signedAt)}`, { indent: 45, gap: 2 }) }
    if (includeDate) paragraph(`วันที่ ${signer.signedAt ? new Intl.DateTimeFormat('th-TH', { timeZone: 'Asia/Bangkok', dateStyle: 'long' }).format(signer.signedAt) : blank}`, { indent: 75, gap: 2 })
  }

  draw('สัญญาค้ำประกันและข้อตกลงจัดให้มีทรัพย์สินเป็นหลักประกัน', margin, y, 16, bold); y -= 24
  draw('ครอบคลุมอสังหาริมทรัพย์และสังหาริมทรัพย์', margin, y, 12, bold); y -= 20
  paragraph(`เลขสัญญา ${data.code} · ทำที่ ${data.lenderAddress || blank} · วันที่ ${formatContractDate(data.createdAt.toISOString().slice(0, 10))}`)
  paragraph('1. คู่สัญญาและฐานะของแต่ละฝ่าย', { heading: true })
  field('เจ้าหนี้/ผู้ให้กู้', data.lenderName); field('เลขประจำตัว/ทะเบียนนิติบุคคลเจ้าหนี้', data.lenderId ?? ''); field('ที่อยู่เจ้าหนี้', data.lenderAddress ?? ''); field('โทรศัพท์เจ้าหนี้', data.lenderPhone ?? '')
  field('ลูกหนี้/ผู้กู้', data.borrowerName); field('เลขประจำตัว/ทะเบียนนิติบุคคลลูกหนี้', data.borrowerId ?? ''); field('ที่อยู่ลูกหนี้', data.borrowerAddress ?? ''); field('โทรศัพท์ลูกหนี้', data.borrowerPhone ?? '')
  if (data.guarantorName) {
    field('ผู้ค้ำประกัน', data.guarantorName)
    field('เลขประจำตัว/ทะเบียนนิติบุคคลผู้ค้ำประกัน', value('guarantorNationalId'))
    field('ที่อยู่ผู้ค้ำประกัน', data.guarantorAddress ?? '')
    field('โทรศัพท์ผู้ค้ำประกัน', value('guarantorPhone'))
  }
  field('ผู้ให้หลักประกัน', value('providerName') === blank ? (value('providerRole') === 'ลูกหนี้' ? data.borrowerName : '') : value('providerName'))
  const providerRole = details.providerRole || 'ลูกหนี้'
  const custodianName = details.custodianName?.trim() || (details.custodianRole === 'เจ้าหนี้ผู้รับจำนำ' ? data.lenderName : '')
  field('เลขประจำตัว/ทะเบียนนิติบุคคลผู้ให้หลักประกัน', details.providerNationalId || (providerRole === 'ลูกหนี้' ? data.borrowerId : '') || blank)
  field('ที่อยู่ผู้ให้หลักประกัน', details.providerAddress || (providerRole === 'ลูกหนี้' ? data.borrowerAddress : '') || blank)
  field('โทรศัพท์ผู้ให้หลักประกัน', details.providerPhone || (providerRole === 'ลูกหนี้' ? data.borrowerPhone : '') || blank)
  field('ฐานะผู้ให้หลักประกัน', providerRole)
  paragraph('กรอกเฉพาะฐานะที่ใช้จริง หากไม่มีผู้ค้ำประกัน ให้ระบุ “ไม่ใช้” และขีดฆ่าข้อ 3–4 ทั้งหมด ผู้จำนองซึ่งประกันหนี้ของผู้อื่นไม่ลงชื่อเป็นผู้ค้ำประกันหนี้เดียวกันในแบบร่างนี้')

  paragraph('2. หนี้ที่ประกันและขอบเขตจำนวนเงิน', { heading: true })
  field('หนี้ตามสัญญา', value('securedDebtType') === blank ? 'สัญญากู้ยืมเงิน' : value('securedDebtType')); field('เลขที่สัญญา', data.code); field('ลงวันที่', formatContractDate(data.createdAt.toISOString().slice(0, 10)))
  field('วัตถุประสงค์', value('debtPurpose')); field('เงินต้น', `${money(data.principalSatang)} บาท (${moneyWords(data.principalSatang)})`); field('กำหนดชำระวันที่', data.repaymentDueDate ? formatContractDate(data.repaymentDueDate) : '')
  field('ดอกเบี้ยตามสัญญาหลักต่อเดือน (%)', value('interestPercentPerMonth')); field('ดอกเบี้ยผิดนัดต่อปี (%)', value('defaultInterestPercent'))
  const maximumSecuredAmount = Number(details.maximumSecuredAmount)
  field('จำนวนสูงสุดที่ค้ำ/ประกัน', Number.isFinite(maximumSecuredAmount) && maximumSecuredAmount > 0
    ? `${money(Math.round(maximumSecuredAmount * 100))} บาท (${moneyWords(Math.round(maximumSecuredAmount * 100))})`
    : value('maximumSecuredAmount'))
  if (details.futureDebtType || details.futureDebtPurpose || details.futureDebtStart || details.futureDebtEnd) { field('ประเภทหนี้ในอนาคต', value('futureDebtType')); field('วัตถุประสงค์หนี้ในอนาคต', value('futureDebtPurpose')); field('ช่วงเวลาก่อหนี้', `${value('futureDebtStart')} ถึง ${value('futureDebtEnd')}`) }

  paragraph('เงื่อนไขการค้ำประกันและหลักประกัน', { heading: true })
  paragraph('3. การค้ำประกันส่วนบุคคล (ใช้เมื่อมีผู้ค้ำประกันเท่านั้น)', { heading: true })
  paragraph('ผู้ค้ำประกันตกลงชำระหนี้ตามข้อ 2 เมื่อลูกหนี้ไม่ชำระ โดยมีความรับผิดไม่เกินวงเงินและขอบเขตที่ระบุไว้ ผู้ค้ำประกันมิได้เข้าร่วมเป็นลูกหนี้ร่วม และไม่สละสิทธิหรือข้อต่อสู้ที่กฎหมายให้ไว้ รวมถึงสิทธิขอให้เรียกลูกหนี้หรือบังคับจากทรัพย์หลักประกันก่อน ในกรณีที่กฎหมายบัญญัติให้ใช้สิทธินั้นได้')
  paragraph('4. การผิดนัดและการแจ้งผู้ค้ำประกัน', { heading: true })
  paragraph('เมื่อลูกหนี้ผิดนัด เจ้าหนี้ต้องมีหนังสือบอกกล่าวไปยังผู้ค้ำประกันภายในหกสิบวันนับแต่วันที่ลูกหนี้ผิดนัด และยังเรียกให้ผู้ค้ำประกันชำระหนี้ก่อนหนังสือบอกกล่าวไปถึงมิได้ หากบอกกล่าวล่าช้า ความรับผิดในดอกเบี้ย ค่าสินไหมทดแทน และอุปกรณ์แห่งหนี้ภายหลังพ้นกำหนดดังกล่าว เป็นไปตามกฎหมาย')
  paragraph('การเพิ่มวงเงิน เปลี่ยนประเภทหนี้ หรือขยายขอบเขตการค้ำประกัน ต้องทำเป็นหนังสือโดยผู้ค้ำประกันยินยอมเฉพาะคราว ไม่มีการให้ความยินยอมล่วงหน้าให้เจ้าหนี้ผ่อนเวลาโดยไม่จำกัด และไม่ตัดสิทธิที่ผู้ค้ำประกันมีตามกฎหมายเมื่อมีการผ่อนเวลาหรือแก้ไขหนี้')

  if (details.assetAccount === 'MORTGAGE' || details.assetAccount === 'BOTH') {
    paragraph('5. อสังหาริมทรัพย์และทรัพย์ที่จดทะเบียนจำนองได้ · บัญชี ก', { heading: true })
    paragraph(`ผู้ให้หลักประกันตกลงนำทรัพย์ตามบัญชี ก ไปจดทะเบียนจำนอง ณ ${value('registrationOffice')} ภายในวันที่ ${value('mortgageDeadline')} จำนวนเงินจำนอง ${value('mortgageAmount')} บาท เงื่อนไขเป็นไปตามสัญญาจำนองที่จดทะเบียนและกฎหมาย แบบร่างนี้หรือการส่งมอบโฉนดเพียงอย่างเดียวไม่ทำให้เกิดสิทธิจำนอง`)
    paragraph('หากผู้จำนองเป็นบุคคลอื่นซึ่งนำทรัพย์ประกันหนี้ของลูกหนี้ ความรับผิดของผู้จำนองจำกัดอยู่ในทรัพย์จำนองตามกฎหมาย ไม่ให้ข้อความใดในเอกสารนี้มีผลให้ต้องรับผิดอย่างผู้ค้ำประกันหรือเกินราคาทรัพย์จำนองเมื่อบังคับจำนอง')
    for (const [label, key] of [['ประเภททรัพย์','propertyType'],['เจ้าของกรรมสิทธิ์','propertyOwner'],['สัดส่วนกรรมสิทธิ์','ownershipShare'],['โฉนด/หนังสือแสดงสิทธิเลขที่','titleDeedNumber'],['เลขที่ดิน','landNumber'],['หน้าสำรวจ','surveyNumber'],['ตำบล/แขวง','propertySubdistrict'],['อำเภอ/เขต','propertyDistrict'],['จังหวัด','propertyProvince'],['เนื้อที่ (ไร่/งาน/ตารางวา)',`${value('areaRai')} / ${value('areaNgan')} / ${value('areaSquareWa')}`],['สิ่งปลูกสร้างเลขที่','buildingNumber'],['อาคารชุด','condoBuilding'],['ห้องเลขที่','condoRoom'],['ชั้น','condoFloor'],['พื้นที่ห้องชุด (ตร.ม.)','condoArea'],['หนังสือกรรมสิทธิ์ห้องชุดเลขที่','condoTitleNumber'],['ราคาประเมิน (บาท)','propertyAppraisalValue'],['ภาระผูกพัน/ผู้รับจำนองเดิม/เจ้าของร่วม','propertyEncumbrances'],['คู่สมรส/ผู้มีอำนาจให้ความยินยอม','consentingPerson'],['หลักฐานแนบ','consentEvidence'],['จำนวนเงินจำนอง (บาท)','mortgageAmount'],['หน่วยงานจดทะเบียน','registrationOffice'],['กำหนดจดทะเบียน','mortgageDeadline'],['วันจดทะเบียนจริง','actualMortgageDate'],['ลำดับจำนอง','mortgagePriority']] as const) field(label, key.startsWith('เนื้อที่') ? key : value(key))
    paragraph('บัญชีนี้ไม่ใช้แทนการจดทะเบียนจำนอง ต้องตรวจกรรมสิทธิ์ ข้อจำกัด และความยินยอมที่กฎหมายกำหนดกับหน่วยงานทะเบียนก่อนดำเนินการ')
  }
  if (details.assetAccount === 'PLEDGE' || details.assetAccount === 'BOTH') {
    paragraph('6. สังหาริมทรัพย์ที่นำมาจำนำ · บัญชี ข', { heading: true })
    paragraph('ผู้ให้หลักประกันตกลงจำนำทรัพย์ตามบัญชี ข โดยส่งมอบทรัพย์ให้เจ้าหนี้ผู้รับจำนำ หรือบุคคลภายนอกที่ตกลงให้เก็บรักษาตามบัญชีนั้น และจัดทำหลักฐานรับมอบพร้อมกัน การระบุรายการทรัพย์หรือส่งมอบสำเนาทะเบียน โดยมิได้ส่งมอบทรัพย์ ไม่ทำให้การจำนำเสร็จสมบูรณ์')
    for (const [label, key] of [['รายการที่','pledgeItemNumber'],['ประเภททรัพย์','pledgedAssetType'],['เจ้าของกรรมสิทธิ์','movableOwner'],['หลักฐานการได้มา','acquisitionEvidence'],['ยี่ห้อ/รุ่น','brandModel'],['หมายเลขเครื่อง/ตัวถัง/ทะเบียน','serialOrRegistration'],['รายละเอียดทรัพย์/น้ำหนัก/ขนาด/จำนวน','assetDescription'],['สภาพทรัพย์และอุปกรณ์ที่ส่งมอบ','assetCondition'],['ราคาประเมินร่วมกัน (บาท)','movableAppraisalValue'],['วันที่ประเมิน/ผู้ประเมิน',`${value('movableAppraisalDate')} / ${value('appraiser')}`],['ภาระผูกพัน/ข้อจำกัด/สิทธิบุคคลอื่น','movableEncumbrances'],['ภาพถ่ายและเอกสารประกอบเลขที่','attachmentReferences'],['วันและเวลาส่งมอบ',`${value('handoverDate')} ${value('handoverTime')}`],['สถานที่ส่งมอบ','handoverPlace'],['ผู้รับมอบ/ผู้เก็บรักษา','custodianName'],['เลขประจำตัวผู้รับมอบ','custodianNationalId'],['ที่อยู่/โทรศัพท์ผู้รับมอบ',`${value('custodianAddress')} / ${value('custodianPhone')}`],['ฐานะผู้เก็บรักษา','custodianRole'],['สถานที่เก็บรักษา','storagePlace'],['รายการยกเว้นขณะรับมอบ','handoverExceptions'],['ค่าดูแล/ประกันภัยที่ตกลง','careAndInsurance'],['วันคืนทรัพย์/ผู้รับคืน/สภาพทรัพย์',`${value('returnDate')} / ${value('returnRecipient')} / ${value('returnCondition')}`]] as const) field(label, key === 'custodianName' ? custodianName : key.includes(' / ') || key.includes(' /') ? key : value(key))
  }

  paragraph('7. การดูแลและการบังคับหลักประกัน', { heading: true })
  paragraph('ผู้ให้หลักประกันรับรองสิทธิในทรัพย์และเปิดเผยเจ้าของร่วม คู่สมรส และภาระผูกพันทั้งหมดตามบัญชี ผู้ครอบครองทรัพย์ต้องดูแลตามสมควร ห้ามนำทรัพย์จำนำไปใช้โดยไม่มีสิทธิ เจ้าหนี้ต้องบอกกล่าวและบังคับหลักประกันตามขั้นตอนกฎหมาย ห้ามยึดเอาทรัพย์เป็นของตนโดยอัตโนมัติหรือขายเองโดยไม่ปฏิบัติตามกฎหมาย')
  paragraph('8. การชำระหนี้ การคืนทรัพย์ และข้อตกลงทั่วไป', { heading: true })
  paragraph('เงินที่ได้รับจากลูกหนี้ ผู้ค้ำประกัน หรือการบังคับหลักประกัน ต้องนำหักหนี้เดียวกันโดยไม่เรียกเก็บซ้ำ คืนเงินส่วนเกินแก่ผู้มีสิทธิ เมื่อหนี้ที่ประกันระงับ เจ้าหนี้ต้องคืนทรัพย์จำนำและเอกสาร พร้อมร่วมดำเนินการปลดจำนองโดยไม่ชักช้า ผู้ค้ำประกันที่ชำระหนี้ย่อมมีสิทธิไล่เบี้ยและรับช่วงสิทธิตามกฎหมาย')
  paragraph('การส่งหนังสือใช้ที่อยู่ที่ระบุไว้หรือที่แจ้งเปลี่ยนเป็นหนังสือ โดยต้องพิสูจน์การส่งและการถึงตามกฎหมาย ไม่ถือว่าได้รับทันทีเพียงส่ง เอกสารนี้ใช้กฎหมายไทยและไม่ตัดสิทธิตามกฎหมายบังคับ คู่สัญญาต้องกรอกช่องสาระสำคัญและลงนามกำกับการแก้ไขก่อนลงชื่อ')
  paragraph(`ใช้บัญชี ${details.assetAccount === 'BOTH' ? 'ก / ข / ทั้งสองบัญชี' : details.assetAccount === 'MORTGAGE' ? 'ก' : 'ข'} · ทำ ${value('copyCount')} ฉบับ มีข้อความตรงกัน ให้คู่สัญญาแต่ละฝ่ายเก็บไว้`)
  paragraph('9. การลงนามในสัญญา', { heading: true })
  paragraph('คู่สัญญาได้อ่านและเข้าใจข้อความรวมถึงบัญชีแนบท้ายที่เลือกใช้แล้ว จึงลงลายมือชื่อไว้เป็นหลักฐาน')
  await signature('เจ้าหนี้', data.lenderSignature ?? { name: data.lenderName })
  await signature('ลูกหนี้', data.borrowerSignature ?? { name: data.borrowerName })
  if (data.guarantorName) await signature('ผู้ค้ำประกัน', data.guarantorSignature ?? { name: data.guarantorName })
  const providerIsBorrower = providerRole === 'ลูกหนี้' || value('providerName') === data.borrowerName
  const providerIsGuarantor = value('providerName') === data.guarantorName
  const providerIsLender = value('providerName') === data.lenderName
  const providerSignature = providerIsBorrower ? data.borrowerSignature : providerIsGuarantor ? data.guarantorSignature : providerIsLender ? data.lenderSignature : data.providerSignature
  const custodianSignature = custodianName === data.lenderName ? data.lenderSignature : custodianName === data.borrowerName ? data.borrowerSignature : custodianName === data.guarantorName ? data.guarantorSignature : custodianName === value('providerName') ? providerSignature : data.custodianSignature
  const collateralWitnesses = data.collateralWitnesses ?? data.loanWitnesses ?? []
  await signature('ผู้ให้หลักประกัน/ผู้จำนอง/ผู้จำนำ', providerSignature ?? { name: value('providerName') === blank ? data.borrowerName : value('providerName') })
  for (const witness of collateralWitnesses) await signature('พยาน', witness)
  if (details.assetAccount === 'MORTGAGE' || details.assetAccount === 'BOTH') {
    paragraph('ลงชื่อกำกับบัญชี ก · ผู้ให้กู้และผู้จำนอง', { heading: true })
    await signature('เจ้าหนี้', data.lenderSignature ?? { name: data.lenderName })
    await signature('ผู้จำนอง', providerSignature ?? { name: value('providerName') === blank ? data.borrowerName : value('providerName') })
  }
  if (details.assetAccount === 'PLEDGE' || details.assetAccount === 'BOTH') {
    paragraph('หลักฐานส่งมอบและการเก็บรักษาทรัพย์จำนำ', { heading: true })
    await signature('ผู้ส่งมอบ/ผู้จำนำ', providerSignature ?? { name: value('providerName') === blank ? data.borrowerName : value('providerName') }, true)
    await signature('ผู้รับมอบ/ผู้เก็บรักษา', custodianSignature ?? { name: custodianName || blank }, true)
    await signature('เจ้าหนี้ผู้รับจำนำ', data.lenderSignature ?? { name: data.lenderName }, true)
    for (const witness of collateralWitnesses) await signature('พยาน', witness)
    paragraph(`บันทึกคืนทรัพย์: วันที่ ${value('returnDate')} · ผู้รับคืน ${value('returnRecipient')} · สภาพ/รายการ ${value('returnCondition')}`)
    await signature('ผู้คืน', { name: blank })
    await signature('ผู้รับคืน', { name: value('returnRecipient') })
  }

  pdf.getPages().forEach((current, index, all) => current.drawText(`${data.code}  |  สัญญาหลักประกัน  |  หน้า ${index + 1}/${all.length}`, { x: margin, y: 24, size: 8.5, font, color: gray }))
  pdf.setTitle(`สัญญาหลักประกัน ${data.code}`)
  return pdf.save()
}

function bahtWords(n: number): string {
  const digit = ['ศูนย์','หนึ่ง','สอง','สาม','สี่','ห้า','หก','เจ็ด','แปด','เก้า'], unit = ['','สิบ','ร้อย','พัน','หมื่น','แสน']
  if (n >= 1_000_000) return bahtWords(Math.floor(n / 1_000_000)) + 'ล้าน' + (n % 1_000_000 ? bahtWords(n % 1_000_000) : '')
  const raw = String(n)
  return [...raw].map((char, index) => { const number = Number(char), place = raw.length - index - 1; if (!number) return ''; if (place === 1) return (number === 1 ? '' : number === 2 ? 'ยี่' : digit[number]) + 'สิบ'; if (place === 0 && number === 1 && n > 1) return 'เอ็ด'; return digit[number] + (unit[place] ?? '') }).join('')
}
