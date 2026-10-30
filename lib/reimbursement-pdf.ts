import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { PDFDocument, rgb, degrees, type PDFFont } from 'pdf-lib'
import fontkit from '@pdf-lib/fontkit'
export type ReimbursementDocument = { kind: 'CLAIM' | 'VOUCHER'; code: string; date: string; payer: string; payee: string; title: string; lines: { label: string; amountSatang: number }[]; total: number; note: string; channel?: string; reference?: string }
const baht = (n: number) => (n / 100).toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
async function thaiFont(pdf: PDFDocument) { pdf.registerFontkit(fontkit); return pdf.embedFont(await readFile(path.join(process.cwd(), 'assets/fonts/Sarabun-Regular.ttf')), { subset: true }) }
function wrap(font: PDFFont, text: string, size: number, width: number) {
  const result: string[] = []; let line = ''
  for (const { segment } of new Intl.Segmenter('th', { granularity: 'grapheme' }).segment(text.replace(/[\r\n\t]+/g, ' '))) {
    if (line && font.widthOfTextAtSize(line + segment, size) > width) { result.push(line); line = '' }
    line += segment
  }
  if (line) result.push(line)
  return result
}
export async function createReimbursementPdf(data: ReimbursementDocument) {
  const pdf = await PDFDocument.create(), font = await thaiFont(pdf)
  pdf.setTitle(`${data.kind === 'CLAIM' ? 'ใบเบิกเงินสำรองจ่าย' : 'ใบสำคัญจ่ายคืน'} ${data.code}`)
  const width = 595.28, height = 841.89, margin = 42, ink = rgb(.15, .22, .3), muted = rgb(.43, .5, .57)
  let page = pdf.addPage([width, height]), y = height - 48
  const draw = (text: string, x: number, yy: number, size = 11, color = ink) => page.drawText(text, { x, y: yy, size, font, color })
  function ensure(space: number) { if (y - space < 95) { page = pdf.addPage([width, height]); y = height - 48; draw(`${data.code} · ต่อ`, margin, y, 11, muted); y -= 30 } }
  function paragraph(text: string, size = 11, color = ink) { for (const line of wrap(font, text, size, width - margin * 2)) { ensure(18); draw(line, margin, y, size, color); y -= 18 } y -= 6 }
  paragraph(data.kind === 'CLAIM' ? 'ใบเบิกเงินสำรองจ่าย' : 'ใบสำคัญจ่ายคืนเงินสำรองจ่าย', 20)
  paragraph(`เลขที่ ${data.code}     วันที่ ${data.date}`, 10, muted)
  page.drawLine({ start: { x: margin, y }, end: { x: width - margin, y }, thickness: 1, color: rgb(.8, .85, .9) }); y -= 28
  paragraph(`${data.kind === 'CLAIM' ? 'ผู้สำรองจ่าย / ผู้ขอเบิก' : 'ผู้รับเงินคืน'}: ${data.payee}`)
  paragraph(`ผู้มีหน้าที่คืนเงิน / ผู้จ่ายคืน: ${data.payer}`)
  paragraph(`เรื่อง: ${data.title}`)
  if (data.channel) paragraph(`ช่องทางจ่ายคืน: ${data.channel}     อ้างอิง: ${data.reference || 'ไม่ระบุ'}`, 10)
  y -= 6
  ensure(50); draw('รายการ / หลักฐานอ้างอิง', margin, y, 10, muted); draw('จำนวนเงิน (บาท)', width - margin - 100, y, 10, muted); y -= 16
  for (const [index, item] of data.lines.entries()) {
    const lines = wrap(font, `${index + 1}. ${item.label}`, 11, width - margin * 2 - 130)
    ensure(Math.min(lines.length * 18 + 16, 620))
    const amount = baht(item.amountSatang)
    draw(amount, width - margin - font.widthOfTextAtSize(amount, 11), y, 11)
    for (const line of lines) { ensure(18); draw(line, margin, y); y -= 18 }
    y -= 9; page.drawLine({ start: { x: margin, y: y + 4 }, end: { x: width - margin, y: y + 4 }, thickness: .4, color: rgb(.89, .92, .94) })
  }
  ensure(100); y -= 17; draw('รวมทั้งสิ้น', margin, y, 13)
  const total = `${baht(data.total)} บาท`; draw(total, width - margin - font.widthOfTextAtSize(total, 16), y, 16); y -= 30
  paragraph(data.kind === 'CLAIM' ? 'เอกสารนี้แสดงเงินที่สำรองจ่ายแล้ว ยังไม่ใช่หลักฐานว่าคืนเงินแล้ว' : 'รายการนี้เป็นการคืนเงินสำรองจ่าย ไม่บันทึกค่าใช้จ่ายต้นทางซ้ำ', 10, muted)
  if (data.note) paragraph(`หมายเหตุ: ${data.note}`, 10, muted)
  ensure(95); y -= 20; paragraph('ผู้บันทึก / ผู้ตรวจสอบ .....................................................', 11)
  paragraph('เอกสารจัดทำจากข้อมูลในระบบ ไม่มีการลงลายมือชื่ออัตโนมัติ', 9, muted)
  const pages = pdf.getPages()
  for (const [i, p] of pages.entries()) p.drawText(`${data.code}  |  ${i + 1} / ${pages.length}`, { x: margin, y: 30, size: 8, font, color: muted })
  return new Uint8Array(await pdf.save())
}
export async function canceledReimbursementPdf(bytes: Uint8Array) {
  const pdf = await PDFDocument.load(bytes), font = await thaiFont(pdf)
  for (const p of pdf.getPages()) p.drawText('ยกเลิกเอกสาร', { x: 100, y: p.getHeight() * .45, font, size: 54, color: rgb(.8, .15, .15), opacity: .3, rotate: degrees(25) })
  return new Uint8Array(await pdf.save())
}
