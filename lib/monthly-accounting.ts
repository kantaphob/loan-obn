import { createHash } from 'node:crypto'
import type { Prisma } from '@/generated/prisma/client'
import { contractLedgerBalance } from './ledger'

export function monthRange(month: string) {
  if (typeof month !== 'string' || !/^(19|[2-9]\d)\d{2}-(0[1-9]|1[0-2])$/.test(month)) throw new Error('กรุณาเลือกเดือนให้ถูกต้อง')
  const [year, value] = month.split('-').map(Number)
  return { startOn: `${month}-01`, endOn: new Date(Date.UTC(year, value, 0)).toISOString().slice(0, 10) }
}
export function nextMonth(month: string) {
  const { endOn } = monthRange(month)
  return new Date(Date.parse(endOn) + 86400000).toISOString().slice(0, 7)
}
export function allocationAmount(value: string) {
  if (typeof value !== 'string' || !/^\d+(\.\d{1,2})?$/.test(value)) throw new Error('ระบุยอดเงินตั้งแต่ 0 และทศนิยมไม่เกิน 2 ตำแหน่ง')
  const satang = Math.round(Number(value) * 100)
  if (!Number.isSafeInteger(satang) || satang > 200_000_000_000) throw new Error('ยอดเงินเกินกำหนด')
  return satang
}
export async function monthSnapshot(tx: Prisma.TransactionClient, month: string) {
  const { startOn, endOn } = monthRange(month)
  const entries = await tx.ledgerEntry.findMany({
    where: { occurredOn: { lte: endOn }, voidedAt: null }, orderBy: [{ occurredOn: 'asc' }, { id: 'asc' }],
    select: { id: true, contractId: true, kind: true, direction: true, categoryCode: true, amountSatang: true, occurredOn: true, penaltyAssessed: true, penaltyWaivedSatang: true, settlementWaivedSatang: true, principalReceivedSatang: true, interestReceivedSatang: true, penaltyReceivedSatang: true, _count: { select: { revisions: true } } },
  })
  const contracts = await tx.loanContract.findMany({ orderBy: { id: 'asc' }, select: { id: true, borrowerName: true, principalSatang: true, interestSatang: true, interestMethod: true, netSatang: true, repaymentSatang: true, status: true, paidAt: true, repaymentDueDate: true, legacyReceivedSatang: true, legacySourceCode: true, penaltyMaxDays: true } })
  const balances = contracts.map(contract => {
    const timeline = entries.filter(e => e.contractId === contract.id)
    return { ...contract, ...contractLedgerBalance(contract, timeline, endOn) }
  }).filter(c => c.disbursed)
  const periodEntries = entries.filter(e => e.occurredOn >= startOn)
  const receipts = periodEntries.filter(e => e.kind === 'REPAYMENT').map(entry => {
    const contract = contracts.find(c => c.id === entry.contractId)
    const timeline = entries.filter(e => e.contractId === entry.contractId && (e.occurredOn < entry.occurredOn || e.occurredOn === entry.occurredOn && e.id < entry.id))
    const before = contract && contractLedgerBalance(contract, timeline, entry.occurredOn)
    const after = contract && contractLedgerBalance(contract, [...timeline, entry], entry.occurredOn)
    const penalty = before && after ? after.penaltyPaid - before.penaltyPaid : 0
    const allocated = entry.principalReceivedSatang !== null && entry.interestReceivedSatang !== null && entry.penaltyReceivedSatang !== null
      && entry.principalReceivedSatang + entry.interestReceivedSatang + entry.penaltyReceivedSatang === entry.amountSatang && entry.penaltyReceivedSatang === penalty
    return { ...entry, borrowerName: contract?.borrowerName ?? 'ไม่พบสัญญา', expectedPenaltySatang: penalty, allocated }
  })
  const sum = (direction: string, group = periodEntries) => group.filter(e => e.direction === direction).reduce((s, e) => s + e.amountSatang, 0)
  const snapshot = {
    month, startOn, endOn, entries: periodEntries, balances,
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
