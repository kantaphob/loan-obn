import Database from 'better-sqlite3'
import { mkdtempSync, readdirSync, readFileSync, existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { spawnSync } from 'node:child_process'

const directory = mkdtempSync(path.join(tmpdir(), 'loan-contract-test-'))
const filename = path.join(directory, 'test.db')
const db = new Database(filename)
for (const name of readdirSync('prisma/migrations').sort()) {
  const migration = path.join('prisma/migrations', name, 'migration.sql')
  if (existsSync(migration)) db.exec(readFileSync(migration, 'utf8'))
}
db.close()
const result = spawnSync(process.execPath, ['--import', './tests/contracts-register.mjs', '--import', 'tsx', '--test', 'tests/contracts.test.ts'], {
  env: { ...process.env, DATABASE_URL: `file:${filename}` }, stdio: 'inherit',
})
process.exitCode = result.status ?? 1
