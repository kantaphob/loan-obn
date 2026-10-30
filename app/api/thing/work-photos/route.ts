import { randomUUID } from 'node:crypto'
import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { getCurrentUser } from '@/lib/auth/current-user'
import { workPhotoPath } from '@/lib/work-photo-files'

export async function POST(request: Request) {
 const user = await getCurrentUser()
 if (!user || user.status !== 'ACTIVE' || user.role === 'REVIEWER') return Response.json({ error: 'ไม่มีสิทธิ์แนบรูป' }, { status: 403 })
 try {
  const origin = request.headers.get('origin')
  if (!origin || new URL(origin).host !== request.headers.get('host')) return Response.json({ error: 'คำขอไม่ถูกต้อง' }, { status: 403 })
 } catch { return Response.json({ error: 'คำขอไม่ถูกต้อง' }, { status: 403 }) }
 try {
  const form = await request.formData(); const file = form.get('file')
  if (!(file instanceof File) || !file.size || file.size > 5 * 1024 * 1024) return Response.json({ error: 'เลือกรูป JPG / PNG ขนาดไม่เกิน 5 MB' }, { status: 400 })
  const bytes = Buffer.from(await file.arrayBuffer())
  const mimeType = bytes.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10])) ? 'image/png' : bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255 ? 'image/jpeg' : null
  if (!mimeType) return Response.json({ error: 'ไฟล์ต้องเป็นรูป JPG หรือ PNG' }, { status: 400 })
  const photo = { id: randomUUID(), name: file.name.slice(0, 240), mimeType, size: bytes.length }
  const filename = workPhotoPath(user.id, photo.id, mimeType === 'image/png' ? 'png' : 'jpg')
  await mkdir(path.dirname(filename), { recursive: true, mode: 0o700 })
  await writeFile(filename, bytes, { flag: 'wx', mode: 0o600 })
  await writeFile(workPhotoPath(user.id, photo.id, 'json'), JSON.stringify(photo), { flag: 'wx', mode: 0o600 })
  return Response.json(photo, { status: 201, headers: { 'Cache-Control': 'no-store' } })
 } catch { return Response.json({ error: 'แนบรูปไม่สำเร็จ กรุณาลองใหม่' }, { status: 400 }) }
}
