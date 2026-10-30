import { readFile } from 'node:fs/promises'
import { getCurrentUser } from '@/lib/auth/current-user'
import { workPhotoPath } from '@/lib/work-photo-files'

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
 const user = await getCurrentUser()
 if (!user || user.status !== 'ACTIVE') return new Response(null, { status: 403 })
 const { id } = await params
 try {
  const photo = JSON.parse(await readFile(workPhotoPath(user.id, id, 'json'), 'utf8')) as { mimeType: string; name: string }
  if (!['image/png', 'image/jpeg'].includes(photo.mimeType)) return new Response(null, { status: 404 })
  const bytes = await readFile(workPhotoPath(user.id, id, photo.mimeType === 'image/png' ? 'png' : 'jpg'))
  return new Response(bytes, { headers: { 'Content-Type': photo.mimeType, 'Content-Disposition': `inline; filename="photo"; filename*=UTF-8''${encodeURIComponent(photo.name)}`, 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff', 'Content-Security-Policy': "default-src 'none'; sandbox" } })
 } catch { return new Response(null, { status: 404 }) }
}
