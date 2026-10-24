import assert from 'node:assert/strict'
import { test } from 'node:test'
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import Database from 'better-sqlite3'
import { bootstrapEmptyDatabase } from '../lib/migration-bootstrap.mjs'

test('fresh installation replays all historical migrations without modifying them and enforces active reference uniqueness', () => {
  const directory = mkdtempSync(path.join(tmpdir(), 'loan-migrations-test-'))
  try {
    const filename = path.join(directory, 'fixture.db')
    const names = bootstrapEmptyDatabase(filename, path.resolve('prisma/migrations'))
    assert.ok(names.length >= 41)
    assert.throws(() => bootstrapEmptyDatabase(filename, path.resolve('prisma/migrations')), /empty/)
    const db = new Database(filename)
    try {
      assert.equal(db.pragma('integrity_check')[0].integrity_check, 'ok')
      assert.deepEqual(db.pragma('foreign_key_check'), [])
      const indexes = db.prepare("SELECT name FROM sqlite_master WHERE type='index'").all().map(row => row.name)
      assert.ok(indexes.includes('ledger_active_slip_hash'))
      assert.ok(indexes.includes('ledger_active_bank_reference'))
      const insert = db.prepare("INSERT INTO ledger_entry(requestKey,kind,direction,categoryCode,categoryName,amountSatang,occurredOn,channelCode,channelName,reference,note,createdBy) VALUES(?,'GENERAL','OUT','TEST','Test',100,'2026-01-01',?,'Bank',?,'','test')")
      insert.run('one', 'BANKING', 'Ref-1')
      assert.throws(() => insert.run('two', 'PROMPTPAY', ' ref-1 '), /UNIQUE/)
      db.prepare("UPDATE ledger_entry SET voidedAt=CURRENT_TIMESTAMP WHERE requestKey='one'").run()
      insert.run('three', 'PROMPTPAY', 'REF-1')
    } finally { db.close() }
  } finally { rmSync(directory, { recursive: true, force: true }) }
})

test('post-commit backup contains the committed data and passes integrity check in an isolated directory', () => {
  const directory = mkdtempSync(path.join(tmpdir(), 'loan-backup-test-'))
  try {
    const script = path.resolve('tests/backup-fixture.ts')
    const result = spawnSync(process.execPath, ['--import', 'tsx', script, directory], { env: { ...process.env, GOOGLE_APPS_SCRIPT_URL: '', GOOGLE_SYNC_TOKEN: '', LOAN_DRIVE_BACKUP_DIR: '', LOAN_DISABLE_SIDE_EFFECTS: '0' }, encoding: 'utf8' })
    assert.equal(result.status, 0, result.stderr)
    const snapshot = new Database(path.join(directory, 'private/backups/automatic/ProgressSQL-latest.db'), { readonly: true })
    try {
      assert.equal(snapshot.prepare('SELECT value FROM committed_record').get().value, 'committed')
      assert.equal(snapshot.pragma('integrity_check')[0].integrity_check, 'ok')
    } finally { snapshot.close() }
    assert.ok(readFileSync(path.join(directory, 'private/record-files-index.json')))
  } finally { rmSync(directory, { recursive: true, force: true }) }
})
