import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { PDFDocument, rgb } from 'pdf-lib'
import fontkit from '@pdf-lib/fontkit'
import { formatContractDate } from './contracts'

export type LoanAgreementData = {
  collateralDescription?: string | null; preview?: boolean; code: string; createdAt: Date; borrowerName: string; lenderName: string;
  address: string; houseNumber: string; subdistrict: string; district: string; province: string;
  birthDate: string; principalSatang: number; interestSatang: number;
  netSatang: number; repaymentSatang: number; interestPercent: number;
  scheduledDisbursementDate?: string | null; repaymentDueDate?: string | null;
  interestMethod: string; paidAt: Date | null;
  fundsReceived?: boolean;
  lenderAddress?: string; borrowerNationalId?: string | null; lenderNationalId?: string | null;
  witnesses?: { position: number; name: string; signatureData: string; signedAt: Date }[];
  witnessCount?: number; signingMethod?: string | null; borrowerSignatureData?: string | null; borrowerSignedAt?: Date | null;
  lenderSignatureData?: string | null; lenderSignedAt?: Date | null;
}
const money = (satang: number) => new Intl.NumberFormat('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(satang / 100)
const blank = '............................'

/** Text-based agreement derived from the supplied form, populated with stored loan terms. */
export async function createLoanAgreementPdf(data: LoanAgreementData) {
  const pdf = await PDFDocument.create()
  pdf.registerFontkit(fontkit)
  const font = await pdf.embedFont(await readFile(path.join(process.cwd(), 'assets/fonts/Sarabun-Regular.ttf')), { subset: true })
  const width = 612, height = 1008, margin = 48, bodySize = 13, lineHeight = 19
  const ink = rgb(0.08, 0.11, 0.16)
  let page = pdf.addPage([width, height])
  let y = height - margin
  const segmenter = new Intl.Segmenter('th', { granularity: 'word' })

  function newPage() {
    page = pdf.addPage([width, height])
    y = height - margin
    draw(`สัญญากู้ยืมเงิน เลขที่ ${data.code} (ต่อ)`, margin, y, 10)
    y -= 28
  }
  function draw(value: string, x: number, baseline: number, size = bodySize) {
    page.drawText(value, { x, y: baseline, size, font, color: ink })
  }
  function paragraph(value: string, { indent = 0, size = bodySize, gap = 6, keepTogether = '' } = {}) {
    const clean = value.replace(/[\r\n\t]+/g, ' ')
    let line = '', firstLine = true
    const printLine = () => {
      if (y < margin + 26) newPage()
      draw(line.trim(), margin + (firstLine ? indent : 0), y, size)
      y -= lineHeight
      firstLine = false
      line = ''
    }
    const segments = keepTogether
      ? clean.split(keepTogether).flatMap((part, index) => [...(index ? [keepTogether] : []), ...Array.from(segmenter.segment(part), item => item.segment)])
      : Array.from(segmenter.segment(clean), item => item.segment)
    for (const segment of segments) {
      const availableWidth = width - margin * 2 - (firstLine ? indent : 0)
      if (line && font.widthOfTextAtSize(line + segment, size) > availableWidth) printLine()
      // Also wrap unusually long names or identifiers without breaking Thai combining marks.
      if (font.widthOfTextAtSize(segment, size) > width - margin * 2) {
        for (const { segment: grapheme } of new Intl.Segmenter('th', { granularity: 'grapheme' }).segment(segment)) {
          if (line && font.widthOfTextAtSize(line + grapheme, size) > width - margin * 2 - (firstLine ? indent : 0)) printLine()
          line += grapheme
        }
      } else line += segment
    }
    if (line.trim()) printLine()
    y -= gap
  }
  const parts = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Bangkok', day: 'numeric', month: 'numeric', year: 'numeric' }).formatToParts(data.createdAt)
  const part = (key: string) => Number(parts.find(item => item.type === key)?.value)
  const year = part('year'), month = part('month'), day = part('day')
  const months = ['มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน', 'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม']
  let age = blank
  if (/^\d{4}-\d{2}-\d{2}$/.test(data.birthDate)) {
    const [by, bm, bd] = data.birthDate.split('-').map(Number)
    const computed = year - by - (month < bm || (month === bm && day < bd) ? 1 : 0)
    if (computed >= 0 && computed < 130) age = String(computed)
  }
  const heading = 'หนังสือสัญญาเงินกู้ตามกฎหมายใหม่'
  draw(heading, (width - font.widthOfTextAtSize(heading, 21)) / 2, y, 21)
  y -= 30
  if (data.preview) {
    const previewLabel = 'ร่างตรวจทาน · ยังไม่ลงนาม'
    draw(previewLabel, (width - font.widthOfTextAtSize(previewLabel, 11)) / 2, y, 11)
    y -= 22
  }
  draw(`ลำดับที่ ${data.code}`, margin, y, 11)
  const headerX = width / 2
  const headerWidth = width - margin - headerX
  const location = `ทำที่ ${data.lenderAddress || blank}`
  let locationLine = ''
  for (const { segment } of segmenter.segment(location)) {
    if (locationLine && font.widthOfTextAtSize(locationLine + segment, 11) > headerWidth) {
      draw(locationLine.trim(), headerX, y, 11)
      y -= lineHeight
      locationLine = ''
    }
    locationLine += segment
  }
  if (locationLine.trim()) draw(locationLine.trim(), headerX, y, 11)
  y -= lineHeight
  draw(`วันที่ ${day} เดือน ${months[month - 1]} พ.ศ. ${year + 543}`, headerX, y, 11)
  y -= lineHeight + 8
  paragraph(`ข้าพเจ้า ${data.borrowerName} อายุ ${age} ปี อยู่บ้านเลขที่ ${data.houseNumber || blank} ตำบล ${data.subdistrict || blank} อำเภอ ${data.district || blank} จังหวัด ${data.province || blank} ได้ทำหนังสือสัญญากู้เงินให้ไว้แก่ ${data.lenderName} มีข้อสัญญาดังแจ้งต่อไปนี้`, { indent: 22 })
  const principalLabel = `${bahtWords(data.principalSatang)} (${money(data.principalSatang)} บาท)`
  paragraph(`ข้อ ๑. ข้าพเจ้า ${data.borrowerName} ได้กู้เงินของ ${data.lenderName} เป็นจำนวนเงิน ${principalLabel}`, { indent: 22, keepTogether: principalLabel })
  paragraph(data.fundsReceived
    ? 'ข้าพเจ้าได้รับเงินไปครบถ้วนเสร็จแล้วตั้งแต่วันทำสัญญานี้'
    : 'ข้าพเจ้าจะลงลายมือชื่อรับเงินเมื่อได้รับเงินจริง', { indent: 22 })
  paragraph(`ข้อ ๒. เพื่อเป็นหลักฐานในเงินซึ่งข้าพเจ้ากู้ไปนี้ ข้าพเจ้าได้นำ ${data.collateralDescription?.trim() || `${blank} ${blank}`} ให้ท่านถือไว้เป็นประกันด้วย และข้าพเจ้าขอรับรองว่า ทรัพย์สินซึ่งข้าพเจ้านำมานี้ เป็นของข้าพเจ้าโดยแท้จริง และไม่มีภาระผูกพันใด ๆ ในหนี้สินรายอื่นนอกเหนือทรัพย์สินนี้เลย`, { indent: 22 })
  paragraph(`ข้อ ๓. ในจำนวนเงินซึ่งข้าพเจ้าได้กู้ไปนี้ ข้าพเจ้าจะนำมาใช้ให้ท่านเสร็จภายในวันที่ ${data.repaymentDueDate ? formatContractDate(data.repaymentDueDate) : '........ เดือน ........................ พ.ศ. ........'} นับตั้งแต่วันทำสัญญานี้เป็นต้นไป`, { indent: 22 })
  paragraph(`ข้อ ๔. ข้าพเจ้ายอมให้ดอกเบี้ย ${blank} แก่ท่าน ทุกเดือนไป จนกว่าข้าพเจ้าจะนำเงินต้นส่งให้แก่ท่านจนครบตามจำนวนที่ได้กู้ไป`, { indent: 22, keepTogether: blank })
  paragraph('ข้อ ๕. ข้าพเจ้าล้มตายเสียก็ดี หรือหลบหายไปเสียก็ดี ข้าพเจ้ายอมให้ท่านมีอำนาจเอาทรัพย์สมบัติของข้าพเจ้า ขายทอดตลาดเอาเงินต้น และดอกเบี้ยของท่านจนครบ', { indent: 22 })
  paragraph('ข้อ ๖. แม้ว่าข้าพเจ้าประพฤติผิดสัญญานี้แต่ข้อหนึ่งข้อใดก็ดี ยอมให้ท่านฟ้องร้องเรียกเงินต้นและดอกเบี้ยแก่ข้าพเจ้าตามกฎหมาย', { indent: 22 })
  paragraph('ข้อ ๗. ค่าธรรมเนียม ค่าพาหนะและค่าเสียหายต่าง ๆ ซึ่งท่านต้องเสียไปในการทวงถามฟ้องร้องข้าพเจ้านั้น ข้าพเจ้ายอมใช้ให้ท่านตามที่ได้เสียหายไปจนครบถ้วน', { indent: 22 })
  // Keep the signature section together so captured e-signatures stay beside the signer's name.
  const signatureBlockHeight = (data.signingMethod === 'E_SIGNATURE' ? 69 : 50) * (2 + (data.witnessCount ?? 2)) + 110
  if (y < margin + signatureBlockHeight) newPage()
  const electronic = data.signingMethod === 'E_SIGNATURE'
  const witnessCount = data.witnessCount ?? 2
  paragraph(electronic
    ? 'คู่สัญญายืนยันว่าลายมือชื่ออิเล็กทรอนิกส์ที่ปรากฏเป็นของตน ได้ตรวจสอบและยอมรับข้อความในหนังสือสัญญานี้ และประสงค์ลงลายมือชื่อไว้เป็นหลักฐาน'
    : `ทันใดนี้ผู้เขียนสัญญา ได้อ่านข้อสัญญาให้ข้าพเจ้าผู้กู้ฟังเข้าใจโดยละเอียดตลอดทุกข้อแล้ว ข้าพเจ้าได้ลงลายมือชื่อให้ไว้${witnessCount > 0 ? 'ต่อหน้าพยานผู้พร้อมกัน' : 'เป็นหลักฐาน'} ณ ที่นี้`, { indent: 22, gap: 12 })
  await signatureLine('ผู้กู้', data.borrowerName, data.borrowerSignatureData, data.borrowerSignedAt)
  await signatureLine('ผู้ให้กู้ (เจ้าของเงิน)', data.lenderName, data.lenderSignatureData, data.lenderSignedAt)
  if (witnessCount > 0) paragraph('ข้าพเจ้าพยาน ขอรับรองว่าข้าพเจ้าเข้าใจข้อความในหนังสือสัญญานี้ตลอดแล้ว และได้เห็นคู่สัญญาลงลายมือชื่อต่อหน้าข้าพเจ้า', { indent: 22, gap: 12 })
  for (let index = 0; index < witnessCount; index++) {
    const witness = data.witnesses?.find(item => item.position === index + 1)
    await signatureLine(`พยาน${witnessCount > 1 ? `คนที่ ${index + 1}` : ''}`, witness?.name || blank, witness?.signatureData, witness?.signedAt)
  }
  const pages = pdf.getPages()
  pages.forEach((current, index) => {
    current.drawText(`${data.code}${data.preview ? '  |  ร่างตรวจทาน · ยังไม่ลงนาม' : ''}  |  หน้า ${index + 1}/${pages.length}`, { x: margin, y: 25, size: 9, font, color: rgb(0.4, 0.4, 0.4) })
  })
  pdf.setTitle(`สัญญากู้ยืมเงิน ${data.code}`)
  pdf.setSubject('เอกสารสัญญาจากข้อความแม่แบบและข้อมูลเงินกู้สำหรับเตรียมลงนาม')
  return pdf.save()

  async function signatureLine(label: string, name: string, dataUrl?: string | null, signedAt?: Date | null) {
    const prefix = 'ลงลายมือชื่อ'
    const fieldWidth = electronic && dataUrl ? 112 : font.widthOfTextAtSize(blank, bodySize)
    const prefixWidth = font.widthOfTextAtSize(prefix, bodySize)
    const blockWidth = prefixWidth + 8 + fieldWidth + 8 + font.widthOfTextAtSize(label, bodySize)
    const startX = (width - blockWidth) / 2
    const imageX = startX + prefixWidth + 8
    draw(prefix, startX, y)
    if (electronic && dataUrl) {
      const base64 = dataUrl.match(/^data:image\/png;base64,([A-Za-z0-9+/]+={0,2})$/)?.[1]
      if (!base64) throw new Error(`ลายมือชื่อ${label}ไม่ใช่ PNG ที่ถูกต้อง`)
      const image = await pdf.embedPng(Buffer.from(base64, 'base64'))
      const scale = Math.min(112 / image.width, 30 / image.height)
      page.drawImage(image, { x: imageX + (fieldWidth - image.width * scale) / 2, y: y - 2, width: image.width * scale, height: image.height * scale })
      draw(label, imageX + fieldWidth + 8, y)
    } else {
      draw(blank, imageX, y)
      draw(label, imageX + fieldWidth + 8, y)
    }
    y -= lineHeight
    const nameLabel = `(${name})`
    const nameSize = Math.min(11, 11 * (width - margin * 2) / Math.max(1, font.widthOfTextAtSize(nameLabel, 11)))
    draw(nameLabel, (width - font.widthOfTextAtSize(nameLabel, nameSize)) / 2, y, nameSize)
    y -= lineHeight + (signedAt && electronic ? 2 : 10)
    if (signedAt && electronic) {
      const dateLabel = new Intl.DateTimeFormat('th-TH', { timeZone: 'Asia/Bangkok', dateStyle: 'medium', timeStyle: 'short' }).format(signedAt)
      const timestamp = `ลงนามอิเล็กทรอนิกส์เมื่อ ${dateLabel}`
      draw(timestamp, (width - font.widthOfTextAtSize(timestamp, 9)) / 2, y, 9)
      y -= lineHeight + 7
    }
  }
}

function bahtWords(satang: number) {
  const digits = ['ศูนย์', 'หนึ่ง', 'สอง', 'สาม', 'สี่', 'ห้า', 'หก', 'เจ็ด', 'แปด', 'เก้า']
  function words(number: number): string {
    if (number >= 1_000_000) return words(Math.floor(number / 1_000_000)) + 'ล้าน' + (number % 1_000_000 ? words(number % 1_000_000) : '')
    const raw = String(number), units = ['', 'สิบ', 'ร้อย', 'พัน', 'หมื่น', 'แสน']
    return [...raw].map((char, index) => {
      const digit = Number(char), place = raw.length - index - 1
      if (!digit) return ''
      if (place === 1) return (digit === 1 ? '' : digit === 2 ? 'ยี่' : digits[digit]) + 'สิบ'
      if (place === 0 && digit === 1 && number > 1) return 'เอ็ด'
      return digits[digit] + units[place]
    }).join('')
  }
  const baht = Math.floor(satang / 100), cents = satang % 100
  return (baht ? words(baht) : 'ศูนย์') + (cents ? 'บาท' + words(cents) + 'สตางค์' : 'บาทถ้วน')
}
