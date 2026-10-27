import { randomUUID } from 'node:crypto'
import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { getCurrentUser } from '@/lib/auth/current-user'
import { contractDocumentPath } from '@/lib/contract-document-files'
export async function POST(request: Request) {
  const user = await getCurrentUser()
  if (!user || user.status !== 'ACTIVE' || user.role === 'REVIEWER') return Response.json({ error: 'ไม่มีสิทธิ์แนบเอกสาร' }, { status: 403 })
  if (request.headers.get('origin') && request.headers.get('origin') !== new URL(request.url).origin) return Response.json({ error: 'คำขอไม่ถูกต้อง' }, { status: 403 })
  try {
    const form = await request.formData(), file = form.get('file'), kind = form.get('kind'), contractCode = String(form.get('contractCode') ?? '').trim()
    if (!(file instanceof File) || !file.size || file.size > 15 * 1024 * 1024 || !['plan','bank_boq','quotation','other'].includes(String(kind))) return Response.json({ error: 'เลือก PDF / JPG / PNG ขนาดไม่เกิน 15 MB และประเภทเอกสาร' }, { status: 400 })
    if (!/^[A-Za-z0-9][A-Za-z0-9_-]{0,79}$/.test(contractCode)) return Response.json({ error: 'ระบุรหัสสัญญาก่อนแนบไฟล์ ใช้ตัวอักษรอังกฤษ ตัวเลข ขีดกลาง หรือขีดล่าง' }, { status: 400 })
    const bytes = Buffer.from(await file.arrayBuffer())
    const mimeType = bytes.subarray(0,5).toString() === '%PDF-' ? 'application/pdf' : bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])) ? 'image/png' : bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255 ? 'image/jpeg' : null
    if (!mimeType) return Response.json({ error: 'เนื้อหาไฟล์ไม่ใช่ PDF / JPG / PNG' }, { status: 400 })
    const id = randomUUID(), filename = contractDocumentPath(user.id, id, contractCode, mimeType)
    await mkdir(path.dirname(filename), { recursive: true, mode: 0o700 })
    await writeFile(filename, bytes, { flag: 'wx', mode: 0o600 })
    return Response.json({ id, kind, storageCode: contractCode, name: file.name.slice(0,240), mimeType, size: bytes.length }, { status: 201, headers: { 'Cache-Control': 'no-store' } })
  } catch { return Response.json({ error: 'แนบไฟล์ไม่สำเร็จ' }, { status: 400 }) }
}
