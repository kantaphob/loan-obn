import type { Prisma } from '@/generated/prisma/client'
import { getDatabaseUrl } from './database-config'

/** Serialize classifications of the same cash entry across payroll and recurring plans. */
export async function lockCashForMatching(tx: Prisma.TransactionClient, source: 'LEDGER' | 'HISTORICAL', id: number) {
  if (getDatabaseUrl().startsWith('file:')) return // SQLite serializes writes to the transaction database.
  if (source === 'LEDGER') await tx.$queryRaw`SELECT "id" FROM "ledger_entry" WHERE "id" = ${id} FOR UPDATE`
  else await tx.$queryRaw`SELECT "id" FROM "historical_cash_entry" WHERE "id" = ${id} FOR UPDATE`
}
