import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { PDFDocument, rgb } from 'pdf-lib'
import fontkit from '@pdf-lib/fontkit'
import { formatContractDate } from './contracts'

export type GuaranteeAgreementData = {
  code: string; createdAt: Date; borrowerName: string; lenderName: string; lenderAddress?: string | null
  guarantorName: string; guarantorAge: number; guarantorHouseNumber: string; guarantorSoi?: string | null
  guarantorRoad?: string | null; guarantorSubdistrict: string; guarantorDistrict: string; guarantorProvince: string; guarantorPostcode?: string | null
  guaranteeCollateralDescription?: string | null; principalSatang: number; interestPercent: number
  repaymentDueDate?: string | null; borrowerSignatureData?: string | null; borrowerSignedAt?: Date | null
  witnessCount?: number
  lenderSignatureData?: string | null; lenderSignedAt?: Date | null; guarantorSignatureData?: string | null; guarantorSignedAt?: Date | null
  witnesses?: { position: number; name: string; signatureData: string; signedAt: Date }[]
}
const blank = '............................'
const money = (satang: number) => new Intl.NumberFormat('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(satang / 100)

export async function createGuaranteeAgreementPdf(data: GuaranteeAgreementData) {
  const pdf = await PDFDocument.create(); pdf.registerFontkit(fontkit)
  const font = await pdf.embedFont(await readFile(path.join(process.cwd(), 'assets/fonts/Sarabun-Regular.ttf')), { subset: true })
  const pageSize: [number, number] = [612, 1008], margin = 48, size = 12, lineHeight = 18
  const ink = rgb(.08, .11, .16), segmenter = new Intl.Segmenter('th', { granularity: 'word' })
  let page = pdf.addPage(pageSize), y = pageSize[1] - margin
  function newPage() { page = pdf.addPage(pageSize); y = pageSize[1] - margin; page.drawText(`สัญญาค้ำประกันการกู้ยืมเงิน ${data.code} (ต่อ)`, { x: margin, y, size: 10, font, color: ink }); y -= 28 }
  function draw(text: string, x: number, baseline: number, fontSize = size) { page.drawText(text, { x, y: baseline, size: fontSize, font, color: ink }) }
  function paragraph(value: string, indent = 16, gap = 7) {
    let line = '', first = true
    const print = () => { if (y < margin + 24) newPage(); draw(line.trim(), margin + (first ? indent : 0), y); y -= lineHeight; line = ''; first = false }
    for (const part of segmenter.segment(value.replace(/[\r\n\t]+/g, ' '))) {
      if (font.widthOfTextAtSize(line + part.segment, size) > pageSize[0] - margin * 2 - (first ? indent : 0) && line) print()
      line += part.segment
    }
    if (line) print(); y -= gap
  }
  async function signature(label: string, name: string, imageData?: string | null, signedAt?: Date | null) {
    if (y < margin + 115) newPage()
    const labelText = `ลงชื่อ ${blank} ${label}`
    const textWidth = font.widthOfTextAtSize(labelText, size)
    const x = (pageSize[0] - textWidth) / 2
    draw(labelText, x, y)
    if (imageData) {
      const base64 = imageData.match(/^data:image\/png;base64,([A-Za-z0-9+/]+={0,2})$/)?.[1]
      if (base64) { const image = await pdf.embedPng(Buffer.from(base64, 'base64')); const scale = Math.min(100 / image.width, 28 / image.height); page.drawImage(image, { x: x + font.widthOfTextAtSize('ลงชื่อ ', size) + 2, y: y - 3, width: image.width * scale, height: image.height * scale }) }
    }
    y -= lineHeight
    const nameLine = `(${name})`; draw(nameLine, (pageSize[0] - font.widthOfTextAtSize(nameLine, size)) / 2, y); y -= lineHeight + 8
    if (signedAt) { const stamp = `ลงนามอิเล็กทรอนิกส์เมื่อ ${new Intl.DateTimeFormat('th-TH', { timeZone: 'Asia/Bangkok', dateStyle: 'medium', timeStyle: 'short' }).format(signedAt)}`; draw(stamp, (pageSize[0] - font.widthOfTextAtSize(stamp, 9)) / 2, y, 9); y -= lineHeight }
  }
  draw('สัญญาค้ำประกันการกู้ยืมเงิน', margin, y, 19); y -= 34
  draw(`ทำที่ ${data.lenderAddress || blank}`, margin, y); y -= lineHeight
  draw(`วันที่ ${formatContractDate(data.createdAt.toISOString().slice(0, 10))}`, margin, y); y -= lineHeight + 8
  paragraph(`สัญญาฉบับนี้ทำขึ้นระหว่าง ${data.guarantorName} อายุ ${data.guarantorAge} ปี อยู่บ้านเลขที่ ${data.guarantorHouseNumber} ตรอก/ซอย ${data.guarantorSoi || blank} ถนน ${data.guarantorRoad || blank} แขวง/ตำบล ${data.guarantorSubdistrict} เขต/อำเภอ ${data.guarantorDistrict} จังหวัด ${data.guarantorProvince} ซึ่งต่อไปในสัญญานี้เรียกว่า “ผู้ค้ำประกัน” ฝ่ายหนึ่ง กับ ${data.lenderName} อายุ ${blank} ปี อยู่บ้านเลขที่ ${data.lenderAddress || blank} ซึ่งต่อไปในสัญญานี้เรียกว่า “ผู้ให้กู้” อีกฝ่ายหนึ่ง`)
  paragraph('คู่สัญญาทั้งสองฝ่ายได้ตกลงกันดังต่อไปนี้')
  paragraph(`ข้อ 1 ตามที่ นาย/นาง/นางสาว ${data.borrowerName} (ซึ่งต่อไปนี้จะเรียกว่า “ผู้กู้”) ได้กู้เงินผู้ให้กู้ เป็นเงิน ${money(data.principalSatang)} บาท (${bahtWords(data.principalSatang)}) ตามสัญญากู้ยืมเงินฉบับลงวันที่ ${formatContractDate(data.createdAt.toISOString().slice(0, 10))} นั้น ผู้ค้ำประกันยอมเข้าค้ำประกันผู้กู้โดยขอสัญญาว่า ถ้าผู้กู้ผิดนัดไม่ใช้เงินให้แก่ผู้ให้กู้ หรือผู้กู้ผิดสัญญาข้อใดข้อหนึ่งจนเป็นเหตุให้ผู้ให้กู้บอกเลิกสัญญากู้ และเรียกให้ผู้กู้ชำระหนี้หรือมีกรณีอื่นใด อันกระทำให้ผู้ให้กู้ไม่ได้รับชำระหนี้ตามสัญญากู้ที่กล่าวแล้วก็ดี ผู้ค้ำประกันยอมรับผิดชำระเงินบรรดาที่ผู้กู้ค้างชำระแก่ผู้ให้กู้ รวมทั้งดอกเบี้ย ค่าฤชาธรรมเนียม ค่าภาระติดพันและค่าเสียหายใด ๆ ทั้งสิ้น ให้แก่ผู้ให้กู้จนครบถ้วนในทันที โดยผู้ให้กู้ไม่จำเป็นต้องเรียกร้องเอาจากผู้กู้โดยตรงก่อนก็ได้`)
  paragraph('ข้อ 2 ถ้าผู้ให้กู้ผ่อนเวลาการชำระหนี้ให้แก่ผู้กู้ โดยจะแจ้งหรือไม่แจ้งให้ผู้ค้ำประกันทราบก็ตาม ผู้ค้ำประกันเป็นอันยอมตกลงด้วยกับการให้ผ่อนเวลาเช่นนั้นทุกครั้งไป และมิให้ถือเอาการผ่อนเวลาเช่นว่านั้น เป็นเหตุปลดเปลื้องความรับผิดชอบของผู้ค้ำประกันเป็นอันขาด')
  paragraph(`ข้อ 3 เพื่อเป็นหลักประกันความรับผิดตามสัญญานี้ ผู้ค้ำประกันขอมอบ ${data.guaranteeCollateralDescription || blank} ซึ่งเป็นกรรมสิทธิ์ของผู้ค้ำประกันแต่ผู้เดียวให้ผู้ให้กู้ยึดถือไว้เป็นประกันจนกว่าผู้ให้กู้จะได้รับชำระหนี้ที่ค้างชำระเสร็จสิ้นเรียบร้อยแล้ว`)
  paragraph('ผู้ค้ำประกันได้อ่านและเข้าใจข้อความในสัญญานี้ตลอดแล้ว จึงลงลายมือชื่อไว้เป็นสำคัญต่อหน้าพยาน', 16, 14)
  await signature('ผู้ค้ำประกัน', data.guarantorName, data.guarantorSignatureData, data.guarantorSignedAt)
  await signature('ผู้ให้กู้', data.lenderName, data.lenderSignatureData, data.lenderSignedAt)
  for (let i = 1; i <= (data.witnessCount ?? 2); i++) { const witness = data.witnesses?.find(item => item.position === i); await signature('พยาน', witness?.name ?? blank, witness?.signatureData, witness?.signedAt) }
  pdf.getPages().forEach((current, i, all) => current.drawText(`${data.code}  |  สัญญาค้ำประกัน  |  หน้า ${i + 1}/${all.length}`, { x: margin, y: 25, size: 9, font, color: rgb(.4,.4,.4) }))
  pdf.setTitle(`สัญญาค้ำประกันการกู้ยืมเงิน ${data.code}`)
  return pdf.save()
}
function bahtWords(satang: number) {
  const digits = ['ศูนย์','หนึ่ง','สอง','สาม','สี่','ห้า','หก','เจ็ด','แปด','เก้า'], units = ['','สิบ','ร้อย','พัน','หมื่น','แสน']
  function words(n: number): string { if(n >= 1_000_000) return words(Math.floor(n/1_000_000))+'ล้าน'+(n%1_000_000?words(n%1_000_000):''); const raw=String(n); return [...raw].map((c,i)=>{const d=Number(c),p=raw.length-i-1;if(!d)return '';if(p===1)return(d===1?'':d===2?'ยี่':digits[d])+'สิบ';if(p===0&&d===1&&n>1)return'เอ็ด';return digits[d]+(units[p]??'')}).join('') }
  const baht=Math.floor(satang/100), cents=satang%100
  return (baht?words(baht):'ศูนย์')+(cents?'บาท'+words(cents)+'สตางค์':'บาทถ้วน')
}
