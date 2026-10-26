import 'dotenv/config'
import { mkdirSync } from 'node:fs'
import path from 'node:path'

/** Shared by the application, Prisma CLI and seed scripts. Never serve this directory publicly. */
export function getDatabaseUrl() {
  const url = process.env.DATABASE_URL
  if (!url) throw new Error('DATABASE_URL must point to PostgreSQL')
  if (/^postgres(?:ql)?:/.test(url)) return url
  if (!url.startsWith('file:') || process.env.LOAN_DISABLE_SIDE_EFFECTS !== '1') throw new Error('This installation uses PostgreSQL; SQLite is supported only in isolated tests')
  const filename = path.resolve(url.slice('file:'.length))
  mkdirSync(path.dirname(filename), { recursive: true, mode: 0o700 })
  // An absolute URL makes the CLI and runtime resolve the same database file.
  return `file:${filename}`
}
