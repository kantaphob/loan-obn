import Database from 'better-sqlite3'
import pg from 'pg'
import { normalized, digest } from '../lib/postgres-data-verify.mjs'
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import path from 'node:path'

// The original source remains read-only. Target must be empty; no overwrite option.
pg.types.setTypeParser(1114, text => new Date(text.replace(' ', 'T') + 'Z'))
const filename = process.argv[2]
if (!filename) throw new Error('Pass a read-only SQLite backup path')
const url = process.env.POSTGRES_TARGET_URL || readFileSync('private/postgres/application.env', 'utf8').match(/DATABASE_URL="([^"]+)"/)[1]
const source = new Database(path.resolve(filename), { readonly: true, fileMustExist: true })
source.defaultSafeIntegers(true)
const target = new pg.Client({ connectionString: url })
const quote = value => '"' + value.replaceAll('"', '""') + '"'
await target.connect()
try {
  if (source.pragma('integrity_check')[0].integrity_check !== 'ok' || source.pragma('foreign_key_check').length) throw new Error('Source integrity checks failed')
  const tables = source.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name <> '_prisma_migrations' ORDER BY name").all().map(row => row.name)
  const columns = (await target.query("SELECT table_name, column_name, data_type, column_default FROM information_schema.columns WHERE table_schema='public' ORDER BY ordinal_position")).rows
  const report = { createdAt: new Date().toISOString(), source: path.basename(filename), target: new URL(url).pathname.slice(1), tables: [], verified: false }
  await target.query('BEGIN')
  await target.query('SET CONSTRAINTS ALL DEFERRED')
  // Audit/closing insert guards are bypassed only while preserving their historic
  // rows. Foreign keys, unique indexes and checks remain enforced throughout.
  for (const table of tables) {
    if (!columns.some(column => column.table_name === table)) throw new Error(`Missing target table ${table}`)
    if (Number((await target.query(`SELECT count(*) AS count FROM ${quote(table)}`)).rows[0].count)) throw new Error(`Target table ${table} is not empty`)
    await target.query(`ALTER TABLE ${quote(table)} DISABLE TRIGGER USER`)
  }
  for (const table of tables) {
    const metadata = columns.filter(column => column.table_name === table)
    const sourceColumns = source.prepare(`PRAGMA table_info(${quote(table)})`).all().map(column => column.name)
    if (metadata.length !== sourceColumns.length || metadata.some(column => !sourceColumns.includes(column.column_name))) throw new Error(`Schema mismatch: ${table}`)
    const rows = source.prepare(`SELECT * FROM ${quote(table)}`).all()
    const keys = metadata.map(column => column.column_name)
    const values = rows.map(row => metadata.map(column => {
      const value = row[column.column_name]
      if (value === null) return null
      if (column.data_type === 'bytea') return Buffer.from(value)
      if (column.data_type.startsWith('timestamp')) return timestamp(value)
      if (column.data_type === 'boolean') return Boolean(Number(value))
      if (column.data_type === 'jsonb' || column.data_type === 'json') return typeof value === 'string' ? value : JSON.stringify(value)
      return typeof value === 'bigint' ? value.toString() : value
    }))
    for (let offset = 0; offset < values.length; offset += 100) {
      const batch = values.slice(offset, offset + 100)
      let index = 0
      const placeholders = batch.map(row => '(' + row.map(() => '$' + ++index).join(',') + ')').join(',')
      await target.query(`INSERT INTO ${quote(table)} (${keys.map(quote).join(',')}) VALUES ${placeholders}`, batch.flat())
    }
    for (const column of metadata.filter(column => column.column_default?.startsWith('nextval('))) {
      await target.query(`SELECT setval(pg_get_serial_sequence($1,$2), COALESCE((SELECT MAX(${quote(column.column_name)}) FROM ${quote(table)}),1), EXISTS(SELECT 1 FROM ${quote(table)}))`, [quote(table), column.column_name])
    }
    const targetRows = (await target.query(`SELECT * FROM ${quote(table)}`)).rows
    const sourceHash = digest(rows.map(row => metadata.map(column => normalized(row[column.column_name], column))))
    const targetHash = digest(targetRows.map(row => metadata.map(column => normalized(row[column.column_name], column))))
    if (sourceHash !== targetHash || rows.length !== targetRows.length) throw new Error(`Data verification failed: ${table}`)
    report.tables.push({ table, rows: rows.length, sha256: sourceHash })
  }
  await target.query('SET CONSTRAINTS ALL IMMEDIATE')
  for (const table of tables) await target.query(`ALTER TABLE ${quote(table)} ENABLE TRIGGER USER`)
  await target.query('COMMIT')
  report.verified = true
  mkdirSync('private/postgres', { recursive: true, mode: 0o700 })
  writeFileSync('private/postgres/migration-report.json', JSON.stringify(report, null, 2), { mode: 0o600 })
  console.log(`Verified and migrated ${tables.length} tables, ${report.tables.reduce((sum, table) => sum + table.rows, 0)} rows. All column-level hashes match; foreign keys validated.`)
} catch (error) {
  await target.query('ROLLBACK').catch(() => {})
  // Error details from databases can include personal values. Keep them private.
  writeFileSync('private/postgres/migration-error.log', String(error.stack), { mode: 0o600 })
  throw new Error('Migration was rolled back. See private/postgres/migration-error.log for diagnostics.')
} finally { source.close(); await target.end() }
