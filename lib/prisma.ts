import 'dotenv/config'
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3'
import { PrismaClient } from '@/generated/prisma/client'

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient
}

const adapter = new PrismaBetterSqlite3({
  url: process.env.DATABASE_URL ?? 'file:./ProgressSQL.db',
})

// Recreate a cached development client when newly generated models are added.
export const prisma = globalForPrisma.prisma && 'interestRate' in globalForPrisma.prisma && 'loanStatus' in globalForPrisma.prisma && 'borrower' in globalForPrisma.prisma
  ? globalForPrisma.prisma
  : new PrismaClient({ adapter })

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma
}
