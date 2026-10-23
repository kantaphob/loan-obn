import 'dotenv/config'
import { mkdirSync } from 'node:fs'
import path from 'node:path'

/** Shared by the application, Prisma CLI and seed scripts. Never serve this directory publicly. */
export function getDatabaseUrl() {
  const url = process.env.DATABASE_URL ?? 'file:./private/database/ProgressSQL.db'
  if (!url.startsWith('file:')) throw new Error('This installation requires a SQLite file DATABASE_URL')
  const filename = path.resolve(url.slice('file:'.length))
  mkdirSync(path.dirname(filename), { recursive: true, mode: 0o700 })
  // An absolute URL makes the CLI and runtime resolve the same database file.
  return `file:${filename}`
}
