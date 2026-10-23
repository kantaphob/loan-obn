import 'server-only'

import { randomBytes } from 'node:crypto'
import { chmod, mkdir, readdir, rename, rm, stat } from 'node:fs/promises'
import path from 'node:path'
import Database from 'better-sqlite3'
import { isBorrowerFile, readBorrowerImage } from '@/lib/borrower-files'
import { getDatabaseUrl } from '@/lib/database-config'

const BACKUP_NAME = /^ProgressSQL-\d{8}T\d{6}Z-[a-f0-9]{8}\.db$/
const backupDirectory = path.join(process.cwd(), 'private', 'backups')
let currentBackup: Promise<DatabaseBackup> | null = null

export type DatabaseBackup = {
  filename: string
  sizeBytes: number
  createdAt: string
}

function databasePath() {
  const url = getDatabaseUrl()
  return url.slice('file:'.length)
}

function backupFilename() {
  const now = new Date()
  const stamp = now.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z')
  return `ProgressSQL-${stamp}-${randomBytes(4).toString('hex')}.db`
}

async function makeBackup(): Promise<DatabaseBackup> {
  const source = databasePath()
  await mkdir(backupDirectory, { recursive: true, mode: 0o700 })
  await chmod(backupDirectory, 0o700)

  const filename = backupFilename()
  const destination = path.join(backupDirectory, filename)
  const temporaryDestination = path.join(backupDirectory, `.backup-${randomBytes(8).toString('hex')}.tmp`)
  const database = new Database(source, { readonly: true, fileMustExist: true })

  try {
    await database.backup(temporaryDestination)
  } catch (error) {
    await rm(temporaryDestination, { force: true })
    throw error
  } finally {
    database.close()
  }

  try {
    // Keep downloadable .db backups self-contained even though live images are files.
    const snapshot = new Database(temporaryDestination, { fileMustExist: true })
    try {
      const exists = snapshot.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='borrower'").get()
      if (exists) {
        const rows = snapshot.prepare('SELECT id, lineQrImage, cardData FROM borrower').all() as Array<{ id: number; lineQrImage: string; cardData: string | null }>
        for (const row of rows) {
          let qr = row.lineQrImage, cardData = row.cardData
          if (isBorrowerFile(qr)) qr = 'data:image/png;base64,' + (await readBorrowerImage(qr)).toString('base64')
          if (cardData) {
            const card = JSON.parse(cardData)
            if (typeof card.photo === 'string' && isBorrowerFile(card.photo)) { card.photo = 'data:image/png;base64,' + (await readBorrowerImage(card.photo)).toString('base64'); cardData = JSON.stringify(card) }
          }
          if (qr !== row.lineQrImage || cardData !== row.cardData) snapshot.prepare('UPDATE borrower SET lineQrImage=?, cardData=? WHERE id=?').run(qr, cardData, row.id)
        }
      }
    } finally { snapshot.close() }
    await chmod(temporaryDestination, 0o600)
    const verification = new Database(temporaryDestination, { readonly: true, fileMustExist: true })
    try {
      const result = verification.pragma('integrity_check') as Array<{ integrity_check: string }>
      if (result[0]?.integrity_check !== 'ok') {
        throw new Error('ไฟล์สำรองไม่ผ่านการตรวจสอบความสมบูรณ์')
      }
    } finally {
      verification.close()
    }

    const details = await stat(temporaryDestination)
    await rename(temporaryDestination, destination)
    return {
      filename,
      sizeBytes: details.size,
      createdAt: details.mtime.toISOString(),
    }
  } catch (error) {
    await rm(temporaryDestination, { force: true })
    throw error
  }
}

export function createDatabaseBackup() {
  if (currentBackup) return currentBackup
  currentBackup = makeBackup().finally(() => {
    currentBackup = null
  })
  return currentBackup
}

export async function listDatabaseBackups(): Promise<DatabaseBackup[]> {
  await mkdir(backupDirectory, { recursive: true, mode: 0o700 })
  const entries = await readdir(backupDirectory, { withFileTypes: true })
  const backups = await Promise.all(entries
    .filter((entry) => entry.isFile() && BACKUP_NAME.test(entry.name))
    .map(async ({ name }) => {
      const filename = path.join(backupDirectory, name)
      const details = await stat(filename)
      return {
        filename: name,
        sizeBytes: details.size,
        createdAt: details.mtime.toISOString(),
      }
    }))

  return backups.sort((left, right) => right.createdAt.localeCompare(left.createdAt))
}

export function getDatabaseBackupPath(filename: string) {
  if (!BACKUP_NAME.test(filename) || path.basename(filename) !== filename) return null
  return path.join(backupDirectory, filename)
}

export async function getDatabaseBackup(filename: string) {
  const fullPath = getDatabaseBackupPath(filename)
  if (!fullPath) return null
  try {
    const details = await stat(fullPath)
    if (!details.isFile()) return null
    return { fullPath, sizeBytes: details.size }
  } catch {
    return null
  }
}
