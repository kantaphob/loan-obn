import { cashCarryforward, readCashMovements } from './cash-carryforward'
import { closingDocuments } from './closing-preparation'
import { createHash } from 'node:crypto'
import type { Prisma } from '@/generated/prisma/client'
import { bangkokToday, contractLedgerBalance } from './ledger'

import { monthRange } from './accounting-period'
export { monthRange, nextMonth, allocationAmount } from './accounting-period'

export async function monthSnapshot(tx: Prisma.TransactionClient, month: string, rangeStart?: string) {
  const range = monthRange(month)
  const startOn = rangeStart ?? range.startOn, endOn = range.endOn
  const today = bangkokToday()
  const asOf = endOn < today ? endOn : today
  const entries = await tx.ledgerEntry.findMany({
    where: { occurredOn: { lte: asOf }, voidedAt: null }, orderBy: [{ occurredOn: 'asc' }, { id: 'asc' }],
    select: { id: true, contractId: true, kind: true, direction: true, categoryCode: true, amountSatang: true, occurredOn: true, penaltyAssessed: true, penaltyWaivedSatang: true, settlementWaivedSatang: true, principalReceivedSatang: true, interestReceivedSatang: true, penaltyReceivedSatang: true, _count: { select: { revisions: true } } },
  })
  const contracts = await tx.loanContract.findMany({ orderBy: { id: 'asc' }, select: { id: true, borrowerName: true, principalSatang: true, interestSatang: true, interestMethod: true, netSatang: true, repaymentSatang: true, status: true, paidAt: true, repaymentDueDate: true, legacyReceivedSatang: true, legacySourceCode: true, penaltyMaxDays: true } })
  const balances = contracts.map(contract => {
    const timeline = entries.filter(e => e.contractId === contract.id)
    return { ...contract, ...contractLedgerBalance(contract, timeline, asOf) }
  }).filter(c => c.disbursed)
  const periodEntries = entries.filter(e => e.occurredOn >= startOn)
  const receipts = periodEntries.filter(e => e.kind === 'REPAYMENT').map(entry => {
    const contract = contracts.find(c => c.id === entry.contractId)
    const timeline = entries.filter(e => e.contractId === entry.contractId && (e.occurredOn < entry.occurredOn || e.occurredOn === entry.occurredOn && e.id < entry.id))
    const before = contract && contractLedgerBalance(contract, timeline, entry.occurredOn)
    const after = contract && contractLedgerBalance(contract, [...timeline, entry], entry.occurredOn)
    const penalty = before && after ? after.penaltyPaid - before.penaltyPaid : 0
    const validParts = [entry.principalReceivedSatang, entry.interestReceivedSatang, entry.penaltyReceivedSatang].every(value => value !== null && Number.isSafeInteger(value) && value >= 0)
    const allocated = validParts && entry.principalReceivedSatang !== null && entry.interestReceivedSatang !== null && entry.penaltyReceivedSatang !== null
      && entry.principalReceivedSatang + entry.interestReceivedSatang + entry.penaltyReceivedSatang === entry.amountSatang && entry.penaltyReceivedSatang === penalty
    return { ...entry, borrowerName: contract?.borrowerName ?? 'ไม่พบสัญญา', expectedPenaltySatang: penalty, allocated }
  })
  const sum = (direction: string, group = periodEntries) => group.filter(e => e.direction === direction).reduce((s, e) => s + e.amountSatang, 0)
  const preparation = await tx.accountingPreparation.findUnique({ where: { month } })
  const documents = await closingDocuments(tx, month)
  const historical = await tx.historicalCashEntry.findMany({ where: { occurredOn: { gte: startOn, lte: asOf } }, orderBy: [{ occurredOn: 'asc' }, { id: 'asc' }], select: { id: true, accountCode: true, occurredOn: true, direction: true, amountSatang: true, description: true, sourceFile: true, sourceHash: true, sourceRow: true } })
  const cashRows = await readCashMovements(tx, asOf)
  const cash = cashCarryforward(cashRows, startOn, asOf)
  const snapshot = {
    cash,
    preparation, documents, historical,
    historicalIncomingSatang: historical.filter(e => e.direction === 'IN').reduce((sum, e) => sum + e.amountSatang, 0),
    historicalOutgoingSatang: historical.filter(e => e.direction === 'OUT').reduce((sum, e) => sum + e.amountSatang, 0),
    month, startOn, endOn, asOf, entries: periodEntries, balances,
    openingCashMovementSatang: sum('IN', entries.filter(e => e.occurredOn < startOn)) - sum('OUT', entries.filter(e => e.occurredOn < startOn)),
    incomingSatang: sum('IN'), outgoingSatang: sum('OUT'),
    receipts, unallocatedCount: receipts.filter(e => !e.allocated).length,
    principalReceivedSatang: receipts.filter(e => e.allocated).reduce((s, e) => s + (e.principalReceivedSatang ?? 0), 0),
    interestReceivedSatang: receipts.filter(e => e.allocated).reduce((s, e) => s + (e.interestReceivedSatang ?? 0), 0),
    penaltyReceivedSatang: receipts.filter(e => e.allocated).reduce((s, e) => s + (e.penaltyReceivedSatang ?? 0), 0),
    outstandingSatang: balances.reduce((s, c) => s + c.remaining, 0),
    invalidCount: balances.filter(c => c.invalid).length,
    legacyCount: balances.filter(c => c.legacySourceCode || c.legacyReceivedSatang > 0).length,
  }
  const serialized = JSON.stringify(snapshot)
  return { snapshot: JSON.parse(serialized) as typeof snapshot, reviewToken: createHash('sha256').update(serialized).digest('hex') }
}

export async function assertAccountingDateOpen(tx: Prisma.TransactionClient, ...dates: string[]) {
  const oldest = [...dates].sort()[0]
  const [month, year] = await Promise.all([
    tx.accountingMonthLock.findFirst({ where: { endOn: { gte: oldest } }, select: { id: true } }),
    tx.accountingClose.findFirst({ where: { endOn: { gte: oldest } }, select: { id: true } }),
  ])
  if (month || year) throw new Error('งวดบัญชีถูกล็อกแล้ว ไม่สามารถเพิ่ม แก้ไข หรือยกเลิกรายการย้อนหลังได้')
}


/** Annual report keeps principal cash collections distinct from income and profit. */
export async function annualSnapshot(tx: Prisma.TransactionClient, year: string) {
  const today = bangkokToday()
  if (!/^(19|[2-9]\d)\d{2}$/.test(year) || year > today.slice(0, 4)) throw new Error('กรุณาเลือกปีให้ถูกต้อง')
  const { snapshot } = await monthSnapshot(tx, `${year}-12`, `${year}-01-01`)
  const locks = await tx.accountingMonthLock.findMany({ where: { month: { gte: `${year}-01`, lte: `${year}-12` } }, orderBy: { month: 'asc' } })
  const annualClose = await tx.accountingClose.findFirst({ where: { kind: 'YEAR_END', startOn: `${year}-01-01`, endOn: `${year}-12-31` }, select: { id: true, profitSatang: true } })
  const cashRows = await readCashMovements(tx, snapshot.asOf)
  const months = Array.from({ length: 12 }, (_, i) => {
    const month = `${year}-${String(i + 1).padStart(2, '0')}`
    const entries = snapshot.entries.filter(e => e.occurredOn.slice(0, 7) === month)
    const receipts = snapshot.receipts.filter(e => e.occurredOn.slice(0, 7) === month)
    return {
      cash: month > today.slice(0, 7) ? null : cashCarryforward(cashRows, `${month}-01`, monthRange(month).endOn < today ? monthRange(month).endOn : today),
      historicalIncoming: snapshot.historical.filter(e => e.occurredOn.startsWith(month) && e.direction === 'IN').reduce((sum, e) => sum + e.amountSatang, 0),
      historicalOutgoing: snapshot.historical.filter(e => e.occurredOn.startsWith(month) && e.direction === 'OUT').reduce((sum, e) => sum + e.amountSatang, 0),
      month, locked: locks.some(lock => lock.month === month), future: month > today.slice(0, 7),
      incoming: entries.filter(e => e.direction === 'IN').reduce((s, e) => s + e.amountSatang, 0),
      outgoing: entries.filter(e => e.direction === 'OUT').reduce((s, e) => s + e.amountSatang, 0),
      principal: receipts.filter(e => e.allocated).reduce((s, e) => s + (e.principalReceivedSatang ?? 0), 0),
      interest: receipts.filter(e => e.allocated).reduce((s, e) => s + (e.interestReceivedSatang ?? 0), 0),
      penalty: receipts.filter(e => e.allocated).reduce((s, e) => s + (e.penaltyReceivedSatang ?? 0), 0),
      unallocated: receipts.filter(e => !e.allocated).length,
    }
  })
  return { year, cash: snapshot.cash, asOf: snapshot.asOf, months, lockedCount: locks.length, annualClose,
    historicalIncoming: snapshot.historicalIncomingSatang, historicalOutgoing: snapshot.historicalOutgoingSatang,
    incoming: snapshot.incomingSatang, outgoing: snapshot.outgoingSatang,
    principal: snapshot.principalReceivedSatang, interest: snapshot.interestReceivedSatang, penalty: snapshot.penaltyReceivedSatang,
    unallocated: snapshot.unallocatedCount, outstanding: locks.find(m => m.month === `${year}-12`) ? (JSON.parse(locks.find(m => m.month === `${year}-12`)!.snapshotJson) as { outstandingSatang: number }).outstandingSatang : snapshot.outstandingSatang,
  }
}
