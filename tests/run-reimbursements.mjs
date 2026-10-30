import Database from 'better-sqlite3'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
const directory = mkdtempSync(path.join(tmpdir(), 'loan-reimbursements-test-'))
try {
  const filename = path.join(directory, 'test.db')
  const schema = spawnSync(process.execPath, ['node_modules/prisma/build/index.js', 'migrate', 'diff', '--from-empty', '--to-schema', 'prisma/schema.sqlite.prisma', '--script', '--config', 'prisma7.config.ts'], { encoding: 'utf8' })
  if (schema.status !== 0) throw new Error(schema.stderr || 'Cannot prepare test schema')
  const db = new Database(filename); db.exec(schema.stdout); db.close()
  const result = spawnSync(process.execPath, ['--import', './tests/ledger-register.mjs', '--import', 'tsx', '--test', 'tests/reimbursements.test.ts'], { env: { ...process.env, LOAN_DISABLE_SIDE_EFFECTS: '1', DATABASE_URL: `file:${filename}`, GOOGLE_APPS_SCRIPT_URL: '', GOOGLE_SYNC_TOKEN: '' }, stdio: 'inherit' })
  process.exitCode = result.status ?? 1
} finally { rmSync(directory, { recursive: true, force: true }) }
