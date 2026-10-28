import Database from 'better-sqlite3'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { spawnSync } from 'node:child_process'

const directory = mkdtempSync(path.join(tmpdir(), 'loan-persuaders-test-'))
const filename = path.join(directory, 'test.db')
const db = new Database(filename)
// Build fixtures from the current schema, including migrations authored out of order.
const schema = spawnSync(process.execPath, ['node_modules/prisma/build/index.js', 'migrate', 'diff', '--from-empty', '--to-schema', 'prisma/schema.sqlite.prisma', '--script', '--config', 'prisma7.config.ts'], { encoding: 'utf8' })
if (schema.status !== 0) throw new Error(schema.stderr || 'Cannot prepare fixture schema')
db.exec(schema.stdout)
db.close()
const result = spawnSync(process.execPath, ['--import', './tests/ledger-register.mjs', '--import', 'tsx', '--test', 'tests/persuaders.test.ts'], {
  env: { ...process.env, LOAN_DISABLE_SIDE_EFFECTS: '1', GOOGLE_APPS_SCRIPT_URL: '', GOOGLE_SYNC_TOKEN: '', DATABASE_URL: `file:${filename}` }, stdio: 'inherit',
})
process.exitCode = result.status ?? 1
