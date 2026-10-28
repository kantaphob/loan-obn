import type { Prisma } from '@/generated/prisma/client'

export type CashMovement = {
  source: 'LEDGER' | 'HISTORICAL'; accountScope?: string; kind?: string; contractId?: number | null; accountCode?: string; occurredOn: string;
  direction: string; amountSatang: number; categoryCode?: string; voidedAt?: unknown
}
/** Opening money is a balance, never a synthetic receipt or current-year income. */
export function cashCarryforward(rows: CashMovement[], startOn: string, asOf: string) {
  const active = rows.filter(row => !row.voidedAt && row.occurredOn <= asOf)
  const byMovement = new Map<string, Set<string>>()
  for (const row of active) {
    if (!['IN', 'OUT'].includes(row.direction) || !Number.isSafeInteger(row.amountSatang) || row.amountSatang <= 0) throw new Error('ข้อมูลรายการเงินสดไม่ถูกต้อง')
    // A shared year is not a duplicate. Only matching movements across sources
    // require reconciliation; separate entries within the ledger stay distinct.
    const key = `${row.occurredOn}|${row.direction}|${row.amountSatang}`
    const sources = byMovement.get(key) ?? new Set<string>()
    sources.add(row.source === 'LEDGER' ? 'LEDGER' : `HISTORICAL:${row.accountCode ?? 'DEFAULT'}`)
    byMovement.set(key, sources)
  }
  const overlappingYears = [...new Set([...byMovement].filter(([, sources]) => sources.size > 1).map(([key]) => key.slice(0,4)))].sort()
  const before = active.filter(row => row.occurredOn < startOn)
  const period = active.filter(row => row.occurredOn >= startOn)
  const total = (group: CashMovement[], direction: string) => group.filter(row => row.direction === direction).reduce((sum, row) => sum + row.amountSatang, 0)
  const sources = (['HISTORICAL', 'LEDGER'] as const).map(source => {
    const previous = before.filter(row => row.source === source), current = period.filter(row => row.source === source)
    return { source, opening: total(previous, 'IN') - total(previous, 'OUT'), incoming: total(current, 'IN'), outgoing: total(current, 'OUT'), previousCount: previous.length, periodCount: current.length }
  })
  const recordedOpeningCapital = total(period.filter(row => row.source === 'LEDGER' && row.categoryCode === 'OPENING_CAPITAL'), 'IN')
  const provisional = { startOn, asOf, sources, overlappingYears, recordedOpeningCapital, hasPriorHistory: before.length > 0 }
  if (overlappingYears.length) return { ...provisional, available: false as const, opening: null, incoming: null, outgoing: null, closing: null }
  const opening = total(before, 'IN') - total(before, 'OUT'), incoming = total(period, 'IN'), outgoing = total(period, 'OUT')
  const closing = opening + incoming - outgoing
  if (![opening, incoming, outgoing, closing].every(Number.isSafeInteger)) throw new Error('ยอดเงินสะสมเกินช่วงที่ระบบรองรับ')
  return { ...provisional, available: true as const, opening, incoming, outgoing, closing }
}
export async function readCashMovements(tx: Prisma.TransactionClient, asOf: string): Promise<CashMovement[]> {
  const [ledger, historical] = await Promise.all([
    tx.ledgerEntry.findMany({ where: { voidedAt: null, occurredOn: { lte: asOf } }, select: { accountScope: true, kind: true, contractId: true, occurredOn: true, direction: true, amountSatang: true, categoryCode: true } }),
    tx.historicalCashEntry.findMany({ where: { occurredOn: { lte: asOf } }, select: { occurredOn: true, direction: true, amountSatang: true, accountCode: true } }),
  ])
  return [...ledger.map(row => ({ ...row, source: 'LEDGER' as const })), ...historical.map(row => ({ ...row, source: 'HISTORICAL' as const }))]
}
