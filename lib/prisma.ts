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
const schemaVersion = 'contract-witnesses-v2'
export const prisma = globalForPrisma.schemaVersion === schemaVersion && globalForPrisma.databaseUrl === databaseUrl && globalForPrisma.prisma && 'interestRate' in globalForPrisma.prisma && 'loanStatus' in globalForPrisma.prisma && 'borrower' in globalForPrisma.prisma && 'lender' in globalForPrisma.prisma && 'loanContract' in globalForPrisma.prisma
  ? globalForPrisma.prisma
  : new PrismaClient({ adapter })

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma
  globalForPrisma.databaseUrl = databaseUrl
  globalForPrisma.schemaVersion = schemaVersion
}
