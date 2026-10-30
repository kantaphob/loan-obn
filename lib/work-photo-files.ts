import { createHash } from 'node:crypto'
import path from 'node:path'

export function workPhotoPath(owner: string, id: string, extension: 'jpg' | 'png' | 'json') {
 if (!/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(id)) throw new Error('รหัสรูปไม่ถูกต้อง')
 return path.join(process.cwd(), 'private', 'work-photos', createHash('sha256').update(owner).digest('hex'), `${id}.${extension}`)
}
