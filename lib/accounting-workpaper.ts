import { createHash } from 'node:crypto'
import type { Prisma } from '@/generated/prisma/client'
import { calculateWorkpaper, type TrialAccount, type EquityMovement, type AdjustmentLine } from './accounting-workpaper-math'
export * from './accounting-workpaper-math'
export async function loadYearWorkpaper(tx: Prisma.TransactionClient, year: string) {
  const baseline = await tx.accountingYearWorkpaper.findUnique({ where: { year } })
  const adjustments = await tx.accountingAdjustment.findMany({ where: { year }, orderBy: [{ occurredOn: 'asc' }, { id: 'asc' }] })
  if (!baseline) return { baseline: null, adjustments, financials: null, reviewToken: '' }
  const accounts = JSON.parse(baseline.accountsJson) as TrialAccount[]
  const equity = JSON.parse(baseline.equityJson) as EquityMovement
  const financials = calculateWorkpaper(accounts, adjustments.map(a => JSON.parse(a.linesJson) as AdjustmentLine[]), equity)
  const reviewToken = createHash('sha256').update(JSON.stringify({ baseline, adjustments })).digest('hex')
  return { baseline: { ...baseline, accounts, equity }, adjustments, financials, reviewToken }
}
