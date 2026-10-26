import Database from 'better-sqlite3'
import { existsSync, mkdtempSync, renameSync, rmSync } from 'node:fs'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import { getDatabaseUrl } from '../lib/database-config'
import { bootstrapEmptyDatabase } from '../lib/migration-bootstrap.mjs'

const databaseUrl = getDatabaseUrl()
if (!databaseUrl.startsWith('file:')) {
  const result = spawnSync(process.execPath, ['node_modules/prisma/build/index.js', 'migrate', 'deploy', '--config', 'prisma7.config.ts'], { stdio: 'inherit' })
  process.exit(result.status ?? 1)
}
const filename = databaseUrl.slice(5)
const dev = process.argv.includes('--dev')
function prisma(args: string[], database = filename) {
  const result = spawnSync(process.execPath, ['node_modules/prisma/build/index.js', ...args, '--config', 'prisma7.config.ts'], { env: { ...process.env, DATABASE_URL: `file:${database}` }, encoding: 'utf8', ...(args[0] === 'migrate' && args[1] === 'dev' ? { stdio: 'inherit' as const } : {}) })
  if (result.status !== 0) throw new Error(result.stderr || result.stdout || 'Prisma migration failed')
  return result.stdout ?? ''
}
let empty = !existsSync(filename)
if (!empty) {
  const db = new Database(filename, { readonly: true })
  try { empty = !db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name <> '_prisma_migrations'").get() }
  finally { db.close() }
}
if (empty) {
  const directory = mkdtempSync(path.join(path.dirname(filename), '.bootstrap-'))
  try {
    const candidate = path.join(directory, 'database.db')
    const migrations = bootstrapEmptyDatabase(candidate, path.resolve('prisma/migrations'))
    // Let Prisma record its own migration history, keeping original names and hashes.
    for (const name of migrations) prisma(['migrate', 'resolve', '--applied', name], candidate)
    console.log(prisma(['migrate', 'deploy'], candidate))
    renameSync(candidate, filename)
    console.log(`Initialized database with ${migrations.length} migrations.`)
  } finally { rmSync(directory, { recursive: true, force: true }) }
}
console.log(prisma(['migrate', dev ? 'dev' : 'deploy']))
