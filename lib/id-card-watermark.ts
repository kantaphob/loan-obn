import { readFile } from 'node:fs/promises'
import path from 'node:path'
import fontkit from '@pdf-lib/fontkit'
import { degrees, PDFDocument, rgb, type PDFPage } from 'pdf-lib'
import sharp from 'sharp'

const ink = rgb(0.65, 0.08, 0.1)

function watermarkPage(page: PDFPage, label: string, font: Awaited<ReturnType<PDFDocument['embedFont']>>) {
  const { width, height } = page.getSize()
  const size = Math.max(8, Math.min(24, (width - 36) / font.widthOfTextAtSize(label, 1)))
  const textWidth = font.widthOfTextAtSize(label, size)
  const angle = 25 * Math.PI / 180
  page.drawText(label, {
    x: width / 2 - textWidth / 2 * Math.cos(angle) + size / 2 * Math.sin(angle),
    y: height / 2 - textWidth / 2 * Math.sin(angle) - size / 2 * Math.cos(angle),
    size,
    font,
    color: ink,
    opacity: 0.25,
    rotate: degrees(25),
  })
}

export async function createWatermarkedIdCopy(bytes: Uint8Array, mimeType: string, contractCode: string, createdAt: Date) {
  const date = new Intl.DateTimeFormat('th-TH', { timeZone: 'Asia/Bangkok', dateStyle: 'short' }).format(createdAt)
  const label = `สำเนาบัตรประชาชน ใช้เพื่อประกอบสัญญา ${contractCode} เท่านั้น · ${date}`
  const pdf = await PDFDocument.create()
  pdf.registerFontkit(fontkit)
  const font = await pdf.embedFont(await readFile(path.join(process.cwd(), 'assets/fonts/Sarabun-Regular.ttf')), { subset: true })

  if (mimeType === 'application/pdf') {
    const source = await PDFDocument.load(bytes)
    const pages = await pdf.copyPages(source, source.getPageIndices())
    for (const page of pages) {
      pdf.addPage(page)
      watermarkPage(page, label, font)
    }
  } else {
    const normalized = await sharp(bytes).rotate().toBuffer()
    const metadata = await sharp(normalized).metadata()
    if (!metadata.width || !metadata.height) throw new Error('อ่านขนาดภาพบัตรประชาชนไม่สำเร็จ')
    const image = mimeType === 'image/jpeg' ? await pdf.embedJpg(normalized) : await pdf.embedPng(normalized)
    const margin = 36
    const scale = Math.min(1, 540 / image.width, 720 / image.height)
    const width = image.width * scale + margin * 2
    const height = image.height * scale + margin * 2
    const page = pdf.addPage([width, height])
    page.drawImage(image, { x: margin, y: margin, width: image.width * scale, height: image.height * scale })
    watermarkPage(page, label, font)
  }

  pdf.setTitle(`สำเนาบัตรประชาชนพร้อมลายน้ำ ${contractCode}`)
  pdf.setSubject(`สำเนาสำหรับประกอบสัญญา ${contractCode}`)
  return pdf.save()
}
