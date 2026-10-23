import { randomUUID } from 'node:crypto'
import { mkdir, writeFile, readFile, unlink } from 'node:fs/promises'
import path from 'node:path'
import { prepareLineQr } from './line-qr'

const root = path.join(process.cwd(), 'private', 'borrower')
const pattern = /^borrower-file:([a-f0-9-]{36}\.png)$/
export function isBorrowerFile(value: string) { return pattern.test(value) }
function filename(reference: string) {
  const match = pattern.exec(reference)
  if (!match) throw new Error('Invalid borrower image reference')
  return path.join(root, match[1])
}
export async function storeBorrowerImage(dataUrl: string) {
  const normalized = await prepareLineQr(dataUrl)
  if (!normalized) throw new Error('Empty borrower image')
  await mkdir(root, { recursive: true, mode: 0o700 })
  const reference = `borrower-file:${randomUUID()}.png`
  await writeFile(filename(reference), Buffer.from(normalized.split(',')[1], 'base64'), { mode: 0o600, flag: 'wx' })
  return reference
}
export async function readBorrowerImage(reference: string) {
  if (isBorrowerFile(reference)) return readFile(filename(reference))
  // Keep old database images readable during migration.
  const match = /^data:image\/(?:png|jpeg);base64,([A-Za-z0-9+/=]+)$/.exec(reference)
  if (match) return Buffer.from(match[1], 'base64')
  throw new Error('Invalid borrower image reference')
}
export async function removeBorrowerImage(reference: string) {
  if (!isBorrowerFile(reference)) return
  try { await unlink(filename(reference)) } catch (error) {
    if (!(error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT')) throw error
  }
}
export function cardPhotoReference(cardData: string | null) {
  try { const photo = JSON.parse(cardData || 'null')?.photo; return typeof photo === 'string' && isBorrowerFile(photo) ? photo : '' } catch { return '' }
}
