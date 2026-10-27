import { createHash } from 'node:crypto'
import path from 'node:path'
export function contractDocumentPath(owner: string, id: string, contractCode?: string, mimeType?: string) {
  if (!/^[a-f0-9-]{36}$/i.test(id)) throw new Error('รหัสเอกสารไม่ถูกต้อง')
  if (contractCode !== undefined && !/^[A-Za-z0-9][A-Za-z0-9_-]{0,79}$/.test(contractCode)) throw new Error('รหัสสัญญาต้องเป็นตัวอักษรอังกฤษ ตัวเลข ขีดกลาง หรือขีดล่าง')
  const extension = mimeType === 'application/pdf' ? '.pdf' : mimeType === 'image/png' ? '.png' : mimeType === 'image/jpeg' ? '.jpg' : ''
  return path.join(process.cwd(), 'private', 'contract-documents', createHash('sha256').update(owner).digest('hex'), ...(contractCode ? [contractCode, `${id}${extension}`] : [id]))
}
