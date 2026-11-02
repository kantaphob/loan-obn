import { prisma } from '@/lib/prisma'
import { bangkokToday, contractLedgerBalance } from '@/lib/ledger'
import { capitalPosition } from '@/lib/capital'
import { cashCarryforward, readCashMovements } from '@/lib/cash-carryforward'
import { getDashboardSummary } from '@/lib/dashboard-summary'

export async function getDashboardAnalytics(from: string, to: string) {
  const today = bangkokToday()
  const [summary, movements, entries, contracts] = await Promise.all([
    getDashboardSummary('all'),
    prisma.$transaction(tx => readCashMovements(tx, to)),
    prisma.ledgerEntry.findMany({
      where: { voidedAt: null, occurredOn: { gte: from, lte: to } },
      select: { id: true, kind: true, direction: true, amountSatang: true, occurredOn: true, categoryCode: true, categoryName: true, channelCode: true, channelName: true },
    }),
    prisma.loanContract.findMany({
      select: {
        borrowerCode: true, status: true, paidAt: true, repaymentDueDate: true, penaltyMaxDays: true,
        repaymentSatang: true, legacyReceivedSatang: true, principalSatang: true, interestSatang: true, netSatang: true, interestMethod: true,
        borrower: { select: { riskRatingCode: true } },
        ledgerEntries: { where: { voidedAt: null, occurredOn: { lte: today } }, select: { id: true, kind: true, amountSatang: true, occurredOn: true, penaltyWaivedSatang: true, penaltyAssessed: true, settlementWaivedSatang: true } },
      },
    }),
  ])

  const cash = cashCarryforward(movements, from, to)
  const periodMovements = movements.filter(row => row.occurredOn >= from && row.occurredOn <= to)
  const sources = (['LEDGER', 'HISTORICAL'] as const).map(source => {
    const rows = periodMovements.filter(row => row.source === source)
    return {
      source,
      count: rows.length,
      incoming: rows.filter(row => row.direction === 'IN').reduce((sum, row) => sum + row.amountSatang, 0),
      outgoing: rows.filter(row => row.direction === 'OUT').reduce((sum, row) => sum + row.amountSatang, 0),
    }
  })

  const categories = new Map<string, { code: string; label: string; direction: string; count: number; amount: number }>()
  const channels = new Map<string, { code: string; label: string; count: number; amount: number }>()
  const months = new Map<string, { month: string; incoming: number; outgoing: number }>()
  for (const entry of entries) {
    const key = `${entry.direction}:${entry.categoryCode}`
    const category = categories.get(key) ?? { code: entry.categoryCode, label: entry.categoryName || entry.categoryCode, direction: entry.direction, count: 0, amount: 0 }
    category.count++; category.amount += entry.amountSatang; categories.set(key, category)
    const channel = channels.get(entry.channelCode) ?? { code: entry.channelCode, label: entry.channelName || entry.channelCode, count: 0, amount: 0 }
    channel.count++; channel.amount += entry.amountSatang; channels.set(entry.channelCode, channel)
    const month = entry.occurredOn.slice(0, 7)
    const bucket = months.get(month) ?? { month, incoming: 0, outgoing: 0 }
    if (entry.direction === 'IN') bucket.incoming += entry.amountSatang
    if (entry.direction === 'OUT') bucket.outgoing += entry.amountSatang
    months.set(month, bucket)
  }

  const risk = new Map<string, { code: string; contracts: number; active: number; overdue: number; principal: number; interest: number }>()
  for (const contract of contracts) {
    const code = contract.borrower.riskRatingCode.trim() || 'UNRATED'
    const group = risk.get(code) ?? { code, contracts: 0, active: 0, overdue: 0, principal: 0, interest: 0 }
    group.contracts++
    const balance = contractLedgerBalance(contract, contract.ledgerEntries, today)
    const position = capitalPosition(contract, contract.ledgerEntries, today)
    if (position && balance.remaining > 0 && balance.disbursed) {
      group.active++
      group.principal += position.principalRemaining
      group.interest += position.interestRemaining
      if (contract.repaymentDueDate && contract.repaymentDueDate < today) group.overdue++
    }
    risk.set(code, group)
  }

  return {
    today, from, to,
    cash: { available: cash.available, incoming: cash.incoming, outgoing: cash.outgoing, net: cash.closing === null ? null : cash.incoming! - cash.outgoing!, overlappingYears: cash.overlappingYears, sources },
    loan: {
      borrowers: summary.borrowers, contracts: summary.totalContracts, active: summary.activeCount,
      overdue: summary.overdueCount, overdueAmount: summary.overdueAmount,
      actualDisbursement: summary.actualDisbursement, received: summary.totalLoanReceived,
      principalOutstanding: summary.principalOutstanding, principalReturned: summary.principalReturned,
      interestOutstanding: summary.interestOutstanding, invalid: summary.invalidCount,
      statuses: summary.statuses,
    },
    risk: [...risk.values()].sort((a, b) => b.principal - a.principal || a.code.localeCompare(b.code)),
    unratedBorrowers: await prisma.borrower.count({ where: { OR: [{ riskRatingCode: '' }, { riskRatingCode: { equals: '' } }] } }),
    categories: [...categories.values()].sort((a, b) => b.amount - a.amount),
    channels: [...channels.values()].sort((a, b) => b.amount - a.amount),
    months: [...months.values()].sort((a, b) => a.month.localeCompare(b.month)).slice(-12),
    ledgerEntries: entries.length,
  }
}
