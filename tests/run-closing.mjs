import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import { bootstrapEmptyDatabase } from '../lib/migration-bootstrap.mjs'
const directory = mkdtempSync(path.join(tmpdir(), 'loan-closing-test-'))
try {
  const filename = path.join(directory, 'test.db')
  bootstrapEmptyDatabase(filename, path.resolve('prisma/migrations'))
  const result = spawnSync(process.execPath, ['--import', './tests/ledger-register.mjs', '--import', 'tsx', '--test', 'tests/account-closing.test.ts', 'tests/account-closing-actions.test.ts'], {
    env: { ...process.env, LOAN_DISABLE_SIDE_EFFECTS: '1', DATABASE_URL: `file:${filename}` }, stdio: 'inherit',
  })
  process.exitCode = result.status ?? 1
} finally { rmSync(directory, { recursive: true, force: true }) }
