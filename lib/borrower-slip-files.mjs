import Database from 'better-sqlite3'
import pg from 'pg'
import { createHash, randomUUID } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync, unlinkSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'

const borrowerRoot = () => process.env.LOAN_BORROWER_FILES_DIR?.trim()
  || path.join(os.homedir(), 'Library', 'Mobile Documents', 'com~apple~CloudDocs', 'Loan OBN Co., Ltd')

const digest = bytes => createHash('sha256').update(bytes).digest('hex')

function atomicWrite(filename, bytes) {
  mkdirSync(path.dirname(filename), { recursive: true, mode: 0o700 })
  const temporary = `${filename}.${randomUUID()}.tmp`
  try {
    writeFileSync(temporary, bytes, { mode: 0o600, flag: 'wx' })
    renameSync(temporary, filename)
  } finally {
    if (existsSync(temporary)) unlinkSync(temporary)
  }
}

function safeSlipMetadata(record) {
  const borrower = /^BR-\d{5}$/.test(record.borrowerCode ?? '') ? record.borrowerCode : 'UNMATCHED'
  const folder = record.direction === 'IN' ? 'PAYIN' : record.direction === 'OUT' ? 'PAYOUT' : null
  if (!folder || !Number.isSafeInteger(Number(record.entryId)) || Number(record.entryId) < 1
    || !Number.isSafeInteger(Number(record.contractId)) || Number(record.contractId) < 1
    || !/^\d{4}-\d{2}-\d{2}$/.test(record.occurredOn ?? '')) {
    throw new Error('ข้อมูลผู้กู้หรือรายการไม่ถูกต้อง จึงไม่สามารถจัดเก็บสลิปได้')
  }
  const extension = record.mimeType === 'application/pdf' ? 'pdf' : record.mimeType === 'image/png' ? 'png' : record.mimeType === 'image/jpeg' ? 'jpg' : null
  if (!extension) throw new Error('ชนิดไฟล์สลิปไม่รองรับ')
  const transaction = `TX-${String(record.entryId).padStart(6, '0')}`
  const contract = `CT-${String(record.contractId).padStart(6, '0')}`
  const filename = `${transaction}_${record.occurredOn}_${contract}.${extension}`
  return { borrower, folder, filename, relativePath: path.posix.join(borrower, folder, filename) }
}

/** Write one committed database slip to the private borrower archive. */
export function writeBorrowerSlipFile(record, root = borrowerRoot()) {
  const metadata = safeSlipMetadata(record)
  const fileData = Buffer.from(record.fileData)
  const filename = path.join(root, metadata.borrower, metadata.folder, metadata.filename)
  const sha256 = digest(fileData)
  let written = false
  if (existsSync(filename)) {
    if (digest(readFileSync(filename)) !== sha256) throw new Error(`พบไฟล์ชื่อซ้ำแต่เนื้อหาไม่ตรง: ${metadata.filename}`)
  } else {
    atomicWrite(filename, fileData)
    if (digest(readFileSync(filename)) !== sha256) throw new Error(`ตรวจสอบไฟล์หลังบันทึกไม่ผ่าน: ${metadata.filename}`)
    written = true
  }
  return { ...metadata, sha256, sizeBytes: fileData.length, written }
}

/** Save a generated, non-preview agreement PDF in the borrower's DOC folder. */
export function writeBorrowerContractPdf(record, root = borrowerRoot()) {
  const borrower = /^BR-\d{5}$/.test(record.borrowerCode ?? '') ? record.borrowerCode : null
  const documentType = ['loan', 'guarantee', 'collateral'].includes(record.documentType) ? record.documentType : null
  if (!borrower || !Number.isSafeInteger(Number(record.contractId)) || Number(record.contractId) < 1 || !documentType) {
    throw new Error('ข้อมูลผู้กู้หรือเอกสารไม่ถูกต้อง จึงไม่สามารถจัดเก็บ PDF ได้')
  }
  const filename = `CT-${String(record.contractId).padStart(6, '0')}-${documentType}.pdf`
  const relativePath = path.posix.join(borrower, 'DOC', filename)
  const target = path.join(root, borrower, 'DOC', filename)
  const bytes = Buffer.from(record.fileData)
  const sha256 = digest(bytes)
  let written = false
  if (!existsSync(target) || digest(readFileSync(target)) !== sha256) {
    atomicWrite(target, bytes)
    if (digest(readFileSync(target)) !== sha256) throw new Error(`ตรวจสอบไฟล์หลังบันทึกไม่ผ่าน: ${filename}`)
    written = true
  }
  return { borrower, filename, relativePath, sha256, sizeBytes: bytes.length, written }
}

function csvCell(value) {
  return `"${String(value ?? '').replaceAll('"', '""')}"`
}

/** Rebuild a current index and repair any missing borrower slip copies from the DB. */
export async function syncBorrowerSlipFiles(databaseUrl, root = borrowerRoot()) {
  const postgres = /^postgres(?:ql)?:/.test(databaseUrl)
  const client = postgres ? new pg.Client({ connectionString: databaseUrl }) : null
  const database = postgres ? null : new Database(databaseUrl.replace(/^file:/, ''), { readonly: true, fileMustExist: true })
  if (client) await client.connect()
  const rootExists = existsSync(root)
  if (!rootExists) throw new Error(`ไม่พบโฟลเดอร์จัดเก็บสลิป: ${root}`)

  try {
    let rows
    if (client) {
      const tables = new Set((await client.query("SELECT table_name FROM information_schema.tables WHERE table_schema='public'")).rows.map(row => row.table_name))
      if (!tables.has('ledger_slip') || !tables.has('ledger_entry') || !tables.has('loan_contract')) return { records: 0, written: 0 }
      rows = (await client.query(`
        SELECT ls."entryId", ls."fileData", ls."mimeType", le."direction", le."occurredOn", le."contractId", lc."borrowerCode"
        FROM "ledger_slip" ls
        JOIN "ledger_entry" le ON le."id" = ls."entryId"
        LEFT JOIN "loan_contract" lc ON lc."id" = le."contractId"
        ORDER BY le."id"
      `)).rows
      rows = rows.map(row => ({ ...row, fileData: Buffer.from(row.fileData) }))
    } else {
      const tables = new Set(database.prepare("SELECT name FROM sqlite_master WHERE type='table'").all().map(row => row.name))
      if (!tables.has('ledger_slip') || !tables.has('ledger_entry') || !tables.has('loan_contract')) return { records: 0, written: 0 }
      rows = database.prepare(`
        SELECT ls."entryId", ls."fileData", ls."mimeType", le."direction", le."occurredOn", le."contractId", lc."borrowerCode"
        FROM "ledger_slip" ls
        JOIN "ledger_entry" le ON le."id" = ls."entryId"
        LEFT JOIN "loan_contract" lc ON lc."id" = le."contractId"
        ORDER BY le."id"
      `).all()
    }

    const header = ['Borrower', 'Folder', 'Record', 'Contract', 'Direction', 'Date', 'File', 'Bytes', 'SHA-256']
    const indexes = new Map()
    let written = 0
    for (const row of rows) {
      const metadata = writeBorrowerSlipFile(row, root)
      const relative = metadata.relativePath
      // The archive index is derived from the rows currently in PostgreSQL.
      const index = indexes.get(metadata.borrower) ?? [header]
      index.push([metadata.borrower, path.posix.dirname(relative), `TX-${String(row.entryId).padStart(6, '0')}`, `CT-${String(row.contractId).padStart(6, '0')}`, row.direction, row.occurredOn, metadata.filename, metadata.sizeBytes, metadata.sha256])
      indexes.set(metadata.borrower, index)
      if (metadata.written) written++
    }
    for (const [borrower, index] of indexes) {
      const indexPath = path.join(root, borrower, 'DOC', 'ledger-slips-index.csv')
      atomicWrite(indexPath, Buffer.from(index.map(row => row.map(csvCell).join(',')).join('\n') + '\n', 'utf8'))
    }
    return { records: rows.length, written }
  } finally {
    if (database) database.close()
    if (client) await client.end()
  }
}
