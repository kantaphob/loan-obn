import sharp from 'sharp'
import { maxLineQrBytes } from './borrower-social'

/** Validate raster bytes, strip metadata and store as PNG. SVG/animated files are not accepted. */
export async function prepareLineQr(value: unknown): Promise<string> {
  if (value === '') return ''
  if (typeof value !== 'string' || value.length > Math.ceil(maxLineQrBytes / 3) * 4 + 64) throw new Error('รูป QR ต้องมีขนาดไม่เกิน 2 MB')
  const match = /^data:image\/(png|jpeg|webp);base64,([A-Za-z0-9+/]+={0,2})$/.exec(value)
  if (!match) throw new Error('กรุณาอัปโหลดรูป QR เป็น PNG, JPG หรือ WebP')
  const bytes = Buffer.from(match[2], 'base64')
  if (!bytes.length || bytes.length > maxLineQrBytes || bytes.toString('base64') !== match[2]) throw new Error('ไฟล์ QR ไม่ถูกต้องหรือมีขนาดเกิน 2 MB')
  try {
    const image = sharp(bytes, { limitInputPixels: 4096 * 4096, failOn: 'warning' })
    const metadata = await image.metadata()
    if (!['png', 'jpeg', 'webp'].includes(metadata.format || '') || (metadata.pages || 1) > 1 || !metadata.width || !metadata.height || metadata.width > 4096 || metadata.height > 4096) throw new Error()
    const png = await image.rotate().png().toBuffer()
    if (png.length > maxLineQrBytes) throw new Error()
    return 'data:image/png;base64,' + png.toString('base64')
  } catch { throw new Error('อ่านรูป QR ไม่สำเร็จ กรุณาใช้รูปภาพไม่เคลื่อนไหว ขนาดไม่เกิน 4096 × 4096 พิกเซล และ 2 MB') }
}
