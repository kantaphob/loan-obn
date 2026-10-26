import 'dotenv/config'

import Database from 'better-sqlite3'
import { createPostgresArchive } from './postgres-backup.mjs'
import { chmod, copyFile, mkdir, rename, rm, stat } from 'node:fs/promises'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { randomBytes } from 'node:crypto'

const root = process.cwd()
const backupDirectory = path.join(root, 'private', 'backups', 'automatic')
const driveDirectory = process.env.LOAN_DRIVE_BACKUP_DIR?.trim()
let currentBackup = null
let backupRequested = false

function databasePath() {
  const url = process.env.DATABASE_URL ?? 'file:./private/database/ProgressSQL.db'
  if (!url.startsWith('file:')) throw new Error('Automatic backups currently require a local SQLite database')
  return path.resolve(root, url.slice('file:'.length).split('?')[0])
}

function borrowerImagePath(reference) {
  const match = /^borrower-file:([a-f0-9-]{36}\.png)$/.exec(reference ?? '')
  return match ? path.join(root, 'private', 'borrower', match[1]) : null
}

function embeddedDataUrl(reference) {
  if (typeof reference !== 'string') return reference
  const file = borrowerImagePath(reference)
  if (!file) return reference
  // Sync read is intentional while updating the isolated backup snapshot.
  return `data:image/png;base64,${readFileSync(file).toString('base64')}`
}

async function embedBorrowerImages(snapshotPath) {
  const snapshot = new Database(snapshotPath)
  try {
    const exists = snapshot.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='borrower'").get()
    if (!exists) return
    const rows = snapshot.prepare('SELECT id, lineQrImage, cardData FROM borrower').all()
    const update = snapshot.prepare('UPDATE borrower SET lineQrImage=?, cardData=? WHERE id=?')
    const transaction = snapshot.transaction((items) => {
      for (const row of items) {
        const qr = embeddedDataUrl(row.lineQrImage)
        let cardData = row.cardData
        if (cardData) {
          const card = JSON.parse(cardData)
          if (typeof card.photo === 'string') card.photo = embeddedDataUrl(card.photo)
          cardData = JSON.stringify(card)
        }
        if (qr !== row.lineQrImage || cardData !== row.cardData) update.run(qr, cardData, row.id)
      }
    })
    transaction(rows)
  } finally {
    snapshot.close()
  }
}

async function makeAutomaticBackup() {
  await mkdir(backupDirectory, { recursive: true, mode: 0o700 })
  await chmod(backupDirectory, 0o700)

  const day = new Date().toISOString().slice(0, 10)
  const extension = /^postgres(?:ql)?:/.test(process.env.DATABASE_URL ?? '') ? 'tar' : 'db'
  const latestPath = path.join(backupDirectory, `ProgressSQL-latest.${extension}`)
  const dailyPath = path.join(backupDirectory, `ProgressSQL-${day}.${extension}`)
  const tempPath = path.join(backupDirectory, `.backup-${randomBytes(8).toString('hex')}.tmp`)
  if (extension === 'tar') {
    await createPostgresArchive(tempPath)
  } else {
  const database = new Database(databasePath(), { readonly: true, fileMustExist: true })
  try {
    await database.backup(tempPath)
  } catch (error) {
    await rm(tempPath, { force: true })
    throw error
  } finally {
    database.close()
  }

  }

  try {
    if (extension === 'db') {
    await embedBorrowerImages(tempPath)
    const verification = new Database(tempPath, { readonly: true, fileMustExist: true })
    try {
      const integrity = verification.pragma('integrity_check')
      if (integrity[0]?.integrity_check !== 'ok') throw new Error('Automatic backup failed integrity check')
    } finally {
      verification.close()
    }
    }
    await chmod(tempPath, 0o600)
    await rename(tempPath, latestPath)
    try {
      const dailyTemp = `${dailyPath}.${randomBytes(4).toString('hex')}.tmp`
      await copyFile(latestPath, dailyTemp)
      await chmod(dailyTemp, 0o600)
      await rename(dailyTemp, dailyPath)
      await chmod(dailyPath, 0o600)
    } catch (error) { throw error }

    if (driveDirectory) {
      const driveTemp = path.join(driveDirectory, `.ProgressSQL-${day}-${randomBytes(4).toString('hex')}.tmp`)
      const driveLatestTemp = path.join(driveDirectory, '.ProgressSQL-latest.tmp')
      try {
        const driveStats = await stat(driveDirectory)
        if (!driveStats.isDirectory()) throw new Error('Google Drive backup destination is not a folder')
        await copyFile(dailyPath, driveTemp)
        await rename(driveTemp, path.join(driveDirectory, `ProgressSQL-${day}.${extension}`))
        await copyFile(latestPath, driveLatestTemp)
        await rename(driveLatestTemp, path.join(driveDirectory, `ProgressSQL-latest.${extension}`))
      } catch (error) {
        await rm(driveTemp, { force: true }).catch(() => {})
        await rm(driveLatestTemp, { force: true }).catch(() => {})
        console.error('Google Drive backup copy failed; local automatic backup is available:', error?.code ?? error?.name ?? 'Unknown error')
      }
    }
  } catch (error) {
    await rm(tempPath, { force: true })
    throw error
  }
}

export function createAutomaticBackup() {
  backupRequested = true
  if (currentBackup) return currentBackup
  currentBackup = (async () => {
    while (backupRequested) {
      backupRequested = false
      await makeAutomaticBackup()
    }
  })().finally(() => { currentBackup = null })
  return currentBackup
}
