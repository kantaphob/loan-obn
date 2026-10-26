import { withPersistence } from './persisted-client'
import { afterDatabaseCommit } from './after-database-commit'
import { getDatabaseUrl } from './database-config'
import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient as SQLiteClient } from '@/generated/prisma-sqlite/client'
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3'
import { PrismaClient } from '@/generated/prisma/client'

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient
  databaseUrl?: string
  schemaVersion?: string
}

const databaseUrl = getDatabaseUrl()

const sqlite = databaseUrl.startsWith('file:')
const adapter = sqlite ? new PrismaBetterSqlite3({ url: databaseUrl }) : new PrismaPg({ connectionString: databaseUrl })

// Recreate a cached development client when newly generated models are added.
const schemaVersion = 'postgresql-v2-trade-receivable'
const basePrisma = globalForPrisma.schemaVersion === schemaVersion && globalForPrisma.databaseUrl === databaseUrl && globalForPrisma.prisma && 'interestRate' in globalForPrisma.prisma && 'loanStatus' in globalForPrisma.prisma && 'borrower' in globalForPrisma.prisma && 'lender' in globalForPrisma.prisma && 'loanContract' in globalForPrisma.prisma && 'ledgerSlip' in globalForPrisma.prisma && 'contractRevision' in globalForPrisma.prisma && 'landDevelopment' in globalForPrisma.prisma && 'landDevelopmentCost' in globalForPrisma.prisma && 'buildingBoqItem' in globalForPrisma.prisma && 'tradeReceivable' in globalForPrisma.prisma
  ? globalForPrisma.prisma
  : (sqlite ? new SQLiteClient({ adapter }) as unknown as PrismaClient : new PrismaClient({ adapter }))

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = basePrisma
  globalForPrisma.databaseUrl = databaseUrl
  globalForPrisma.schemaVersion = schemaVersion
}

export const prisma = withPersistence(basePrisma, afterDatabaseCommit)
