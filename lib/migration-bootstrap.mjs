import Database from 'better-sqlite3'
import { readdirSync, readFileSync } from 'node:fs'
import path from 'node:path'

/** Preserve migration names/checksums; repair only execution order on empty installs. */
export function bootstrapEmptyDatabase(filename, migrationDirectory) {
  const names = readdirSync(migrationDirectory).filter(name => /^\d/.test(name)).sort()
  const consent = '20261023123534_add_contract_signature_consent'
  const ordered = names.filter(name => name !== consent)
  if (names.includes(consent)) ordered.splice(ordered.indexOf('20261023193000_add_loan_contracts') + 1, 0, consent)
  const db = new Database(filename)
  try {
    if (db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'").get()) throw new Error('Bootstrap requires an empty database')
    db.transaction(() => {
      for (const name of ordered) db.exec(readFileSync(path.join(migrationDirectory, name, 'migration.sql'), 'utf8'))
    })()
    if (db.pragma('integrity_check')[0].integrity_check !== 'ok' || db.pragma('foreign_key_check').length) throw new Error('Bootstrap integrity check failed')
    return names
  } finally { db.close() }
}
