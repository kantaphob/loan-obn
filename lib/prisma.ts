import { withPersistence } from './persisted-client'
import { afterDatabaseCommit } from './after-database-commit'
import { getDatabaseUrl } from './database-config'
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3'
import { PrismaClient } from '@/generated/prisma/client'

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient
  databaseUrl?: string
  schemaVersion?: string
}

const databaseUrl = getDatabaseUrl()

const adapter = new PrismaBetterSqlite3({
  url: databaseUrl,
})

// Recreate a cached development client when newly generated models are added.
const schemaVersion = 'accounting-close-v12'
const basePrisma = globalForPrisma.schemaVersion === schemaVersion && globalForPrisma.databaseUrl === databaseUrl && globalForPrisma.prisma && 'interestRate' in globalForPrisma.prisma && 'loanStatus' in globalForPrisma.prisma && 'borrower' in globalForPrisma.prisma && 'lender' in globalForPrisma.prisma && 'loanContract' in globalForPrisma.prisma && 'ledgerSlip' in globalForPrisma.prisma && 'contractRevision' in globalForPrisma.prisma
  ? globalForPrisma.prisma
  : new PrismaClient({ adapter })

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = basePrisma
  globalForPrisma.databaseUrl = databaseUrl
  globalForPrisma.schemaVersion = schemaVersion
}

export const prisma = withPersistence(basePrisma, afterDatabaseCommit)
