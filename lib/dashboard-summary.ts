import { prisma } from '@/lib/prisma'
import { bangkokToday, contractLedgerBalance } from '@/lib/ledger'
import { capitalPosition, isLendingCashEntry } from '@/lib/capital'
import { cashCarryforward, readCashMovements } from '@/lib/cash-carryforward'

const thaiMonthAbbreviations = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.']

/** Read only: monetary totals remain in satang until display. */
export async function getDashboardSummary() {
  const today = bangkokToday()
  const [year, month] = today.split('-').map(Number)
  const months = Array.from({ length: 6 }, (_, i) => {
    const date = new Date(Date.UTC(year, month - 6 + i, 1))
    const buddhistYear = date.getUTCFullYear() + 543
    const label = `${thaiMonthAbbreviations[date.getUTCMonth()]} ${String(buddhistYear % 100).padStart(2, '0')}`
    return { key: date.toISOString().slice(0, 7), label, incoming: 0, outgoing: 0 }
  })
  const [borrowers, lenders, limits, contracts, entries, statuses, cashEntries] = await Promise.all([
    prisma.borrower.count(), prisma.lender.count(),
    prisma.borrower.aggregate({ _sum: { approvedLimit: true, usedLimit: true } }),
    prisma.loanContract.findMany({ select: {
      id: true, status: true, repaymentSatang: true, principalSatang: true, interestSatang: true, netSatang: true, interestMethod: true, paidAt: true,
      repaymentDueDate: true, penaltyMaxDays: true, legacyReceivedSatang: true,
      ledgerEntries: { where: { voidedAt: null }, select: { id: true, kind: true, amountSatang: true, occurredOn: true, penaltyWaivedSatang: true, penaltyAssessed: true, settlementWaivedSatang: true } },
    } }),
    prisma.ledgerEntry.findMany({ where: { voidedAt: null, occurredOn: { gte: `${months[0].key}-01`, lte: today } }, select: { direction: true, amountSatang: true, occurredOn: true } }),
    prisma.loanStatus.findMany({ select: { code: true, nameTh: true }, orderBy: { sortOrder: 'asc' } }),
    prisma.$transaction(tx => readCashMovements(tx, today)),
  ])
  for (const entry of entries) {
    const bucket = months.find(m => m.key === entry.occurredOn.slice(0, 7))
    if (bucket && entry.direction === 'IN') bucket.incoming += entry.amountSatang
    if (bucket && entry.direction === 'OUT') bucket.outgoing += entry.amountSatang
  }
  let outstanding = 0, overdueAmount = 0, overdueCount = 0, activeCount = 0, invalidCount = 0
  const dueSoon: { id: number; due: string; remaining: number }[] = []
  const distribution = new Map<string, number>()
  const cash = cashCarryforward(cashEntries, '1900-01-01', today)
  let actualDisbursement = 0, unrecordedDisbursementCount = 0, unrecordedDisbursementAmount = 0
  let totalPrincipal = 0, principalWaived = 0, interestReceived = 0, upfrontInterest = 0, penaltyReceived = 0
  let principalReturned = 0, principalOutstanding = 0, interestOutstanding = 0, totalLoanReceived = 0
  const weekEnd = new Date(`${today}T00:00:00Z`); weekEnd.setUTCDate(weekEnd.getUTCDate() + 7)
  for (const contract of contracts) {
    distribution.set(contract.status, (distribution.get(contract.status) ?? 0) + 1)
    if (contract.status === 'CANCELLED') continue
    const balance = contractLedgerBalance(contract, contract.ledgerEntries, today)
    if (balance.invalid) invalidCount++
    const position = capitalPosition(contract, contract.ledgerEntries, today)
    if (position) {
      totalPrincipal += position.principal
      principalWaived += position.principalWaived
      interestReceived += position.interestReceived
      upfrontInterest += position.upfrontInterest
      penaltyReceived += position.penaltyReceived
      principalReturned += position.principalReceived
      principalOutstanding += position.principalRemaining
      interestOutstanding += position.interestRemaining
      totalLoanReceived += position.cashReceived
      const recordedDisbursement = contract.ledgerEntries.find(e => e.kind === 'DISBURSEMENT' && e.occurredOn <= today)
      if (recordedDisbursement) actualDisbursement += recordedDisbursement.amountSatang
      // Settled contracts with actual repayment records no longer need a dashboard action.
      // This does not create or infer a cash disbursement in accounting totals.
      else if (!(contract.status === 'CLOSED' && balance.remaining === 0 && !balance.invalid && contract.ledgerEntries.some(e => e.kind === 'REPAYMENT' && e.occurredOn <= today))) {
        unrecordedDisbursementCount++
        unrecordedDisbursementAmount += position.cashOut
      }
    }
    if (!balance.disbursed || balance.remaining <= 0) continue
    activeCount++; outstanding += balance.remaining
    if (contract.repaymentDueDate && contract.repaymentDueDate < today) { overdueCount++; overdueAmount += balance.remaining }
    if (contract.repaymentDueDate && contract.repaymentDueDate >= today && contract.repaymentDueDate <= weekEnd.toISOString().slice(0, 10)) dueSoon.push({ id: contract.id, due: contract.repaymentDueDate, remaining: balance.remaining })
  }
  const capitalAmount = (code: string, direction: string) => cashEntries.filter(e => e.source === 'LEDGER' && isLendingCashEntry({ ...e, categoryCode: e.categoryCode ?? '' }) && e.categoryCode === code && e.direction === direction).reduce((sum,e) => sum + e.amountSatang,0)
  const funding = {
    opening: capitalAmount('OPENING_CAPITAL','IN'),
    added: capitalAmount('CAPITAL_INCREASE','IN') + capitalAmount('CAPITAL_INJECTION','IN'),
    withdrawn: capitalAmount('CAPITAL_WITHDRAWAL','OUT'),
    borrowed: capitalAmount('BORROWED_CAPITAL_RECEIVED','IN'),
    repaid: capitalAmount('BORROWED_CAPITAL_REPAID','OUT'),
    interestPaid: capitalAmount('FUNDING_INTEREST_PAID','OUT'),
    profitDistributed: capitalAmount('PROFIT_DISTRIBUTION','OUT'),
  }
  const lendingCashEntries = cashEntries.filter(e => e.source === 'LEDGER' && isLendingCashEntry({ ...e, categoryCode: e.categoryCode ?? '' }))
  const lendingCashIn = lendingCashEntries.filter(e => e.direction === 'IN').reduce((sum,e) => sum+e.amountSatang,0)
  const lendingCashOut = lendingCashEntries.filter(e => e.direction === 'OUT').reduce((sum,e) => sum+e.amountSatang,0)
  const lendingCashAvailable = lendingCashIn-lendingCashOut
  return { today, borrowers, lenders, lendingCashAvailable, lendingCashIn, lendingCashOut, funding, totalPrincipal, principalWaived, interestReceived, upfrontInterest, penaltyReceived,
    cashAvailable: cash.available,
    allIncoming: cash.incoming ?? 0,
    allOutgoing: cash.outgoing ?? 0,
    cashNet: cash.closing ?? 0,
    cashEntryCount: cashEntries.length,
    actualDisbursement, unrecordedDisbursementCount, unrecordedDisbursementAmount,
    totalLoanReceived, principalReturned, principalOutstanding, interestOutstanding,
    pendingCount: contracts.filter(c => c.status === 'WAITING_PAYMENT').length,
    pendingPrincipal: contracts.filter(c => c.status === 'WAITING_PAYMENT').reduce((n,c) => n+c.principalSatang,0), approved: limits._sum.approvedLimit ?? 0, used: limits._sum.usedLimit ?? 0,
    totalContracts: contracts.length, activeCount, outstanding, overdueCount, overdueAmount, invalidCount, months,
    dueSoon: dueSoon.sort((a, b) => a.due.localeCompare(b.due)),
    statuses: [...distribution].map(([code, count]) => ({ code, count, label: statuses.find(s => s.code === code)?.nameTh ?? ({ PAID: "จ่ายเงินแล้ว", WAITING_PAYMENT: "รอจ่ายเงิน", CLOSED: "ปิดยอด", CANCELLED: "ยกเลิก" } as Record<string, string>)[code] ?? code })),
  }
}
