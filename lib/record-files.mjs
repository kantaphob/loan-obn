import Database from 'better-sqlite3'
import { mkdirSync, readFileSync, renameSync, writeFileSync, unlinkSync, existsSync } from 'node:fs'
import { createHash, randomUUID } from 'node:crypto'
import path from 'node:path'

// Only these application-owned tables can determine filesystem destinations.
const sections = [
  ['lender', 'lenders', 'LN', 'id'], ['borrower', 'borrowers', 'BR', 'id'],
  ['User', 'users', 'US', 'id'], ['UserProfile', 'user-profiles', 'UP', 'id'],
  ['financial_category', 'masterdata/categories', 'CAT', 'code'],
  ['bank', 'masterdata/banks', 'BANK', 'code'],
  ['interest_rate', 'masterdata/interest-rates', 'IR', 'code'],
  ['loan_status', 'masterdata/loan-statuses', 'LS', 'code'],
  ['risk_rating', 'masterdata/risk-ratings', 'RR', 'code'],
  ['payment_channel', 'masterdata/payment-channels', 'PC', 'code'],
  ['province', 'masterdata/provinces', 'PV', 'province_id'],
  ['district', 'masterdata/districts', 'DT', 'district_id'],
  ['subdistrict', 'masterdata/subdistricts', 'SD', 'subdistrict_id'],
  ['postcode', 'masterdata/postcodes', 'ZIP', 'code'],
]
const digest = value => createHash('sha256').update(value).digest('hex')
function atomicWrite(filename, content) {
  mkdirSync(path.dirname(filename), { recursive: true, mode: 0o700 })
  const temporary = `${filename}.${randomUUID()}.tmp`
  try {
    writeFileSync(temporary, content, { mode: 0o600, flag: 'wx' })
    renameSync(temporary, filename)
  } finally { if (existsSync(temporary)) unlinkSync(temporary) }
}
export function recordCode(prefix, value) {
  const raw = String(value)
  // Preserve immutable database identities; never reuse IDs after deletion.
  const suffix = /^\d+$/.test(raw) ? raw.padStart(4, '0') : /^[a-zA-Z0-9_-]+$/.test(raw) ? raw : digest(raw).slice(0, 24)
  return `${prefix}-${suffix}`
}

/** Database remains authoritative. Regenerating files repairs interrupted writes. */
export function syncRecordFiles(databaseUrl, root = path.join(process.cwd(), 'private')) {
  const database = new Database(databaseUrl.replace(/^file:/, ''), { readonly: true, fileMustExist: true })
  const manifestPath = path.join(root, 'record-files-index.json')
  let previous = {}
  try { previous = JSON.parse(readFileSync(manifestPath, 'utf8')) } catch (error) { if (error.code !== 'ENOENT') throw error }
  const next = {}
  let records = 0, written = 0
  try {
    const tables = new Set(database.prepare("SELECT name FROM sqlite_master WHERE type='table'").all().map(row => row.name))
    // A single read transaction produces a consistent cross-table snapshot.
    const snapshot = database.transaction(() => sections.filter(([table]) => tables.has(table)).map(section => ({ section, rows: database.prepare(`SELECT * FROM "${section[0]}"`).all() })))()
    for (const { section: [, category, prefix, key], rows } of snapshot) {
      for (const original of rows) {
        const row = { ...original }
        // Password hashes stay exclusively in the protected database.
        delete row.password
        const code = recordCode(prefix, row[key])
        const relative = `${category}/${code}/${code}-profile.json`
        const content = JSON.stringify({ recordId: code, data: row }, null, 2) + '\n'
        const hash = digest(content)
        const filename = path.join(root, relative)
        if (previous[relative] !== hash || !existsSync(filename)) { atomicWrite(filename, content); written++ }
        next[relative] = hash
        records++
      }
    }
    // Remove only generated profiles; preserve any user attachments in the folder.
    for (const relative of Object.keys(previous)) {
      if (next[relative]) continue
      if (!sections.some(([, category]) => relative.startsWith(`${category}/`)) || !/^[a-zA-Z0-9_/-]+-profile\.json$/.test(relative) || relative.includes('..')) continue
      const filename = path.join(root, relative)
      if (existsSync(filename)) unlinkSync(filename)
    }
    atomicWrite(manifestPath, JSON.stringify(next, null, 2) + '\n')
    return { records, written }
  } finally { database.close() }
}
