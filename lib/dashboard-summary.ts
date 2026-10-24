import { prisma } from '@/lib/prisma'
import { bangkokToday, contractLedgerBalance } from '@/lib/ledger'

/** Read only: monetary totals remain in satang until display. */
export async function getDashboardSummary() {
  const today = bangkokToday()
  const [year, month] = today.split('-').map(Number)
  const months = Array.from({ length: 6 }, (_, i) => {
    const date = new Date(Date.UTC(year, month - 6 + i, 1))
    return { key: date.toISOString().slice(0, 7), label: new Intl.DateTimeFormat('th-TH', { month: 'short', year: '2-digit', timeZone: 'UTC' }).format(date), incoming: 0, outgoing: 0 }
  })
  const [borrowers, lenders, limits, contracts, entries, statuses] = await Promise.all([
    prisma.borrower.count(), prisma.lender.count(),
    prisma.borrower.aggregate({ _sum: { approvedLimit: true, usedLimit: true } }),
    prisma.loanContract.findMany({ select: {
      id: true, status: true, repaymentSatang: true, principalSatang: true, paidAt: true,
      repaymentDueDate: true, penaltyMaxDays: true, legacyReceivedSatang: true,
      ledgerEntries: { where: { voidedAt: null }, select: { id: true, kind: true, amountSatang: true, occurredOn: true, penaltyWaivedSatang: true, penaltyAssessed: true, settlementWaivedSatang: true } },
    } }),
    prisma.ledgerEntry.findMany({ where: { voidedAt: null, occurredOn: { gte: `${months[0].key}-01`, lte: today } }, select: { direction: true, amountSatang: true, occurredOn: true } }),
    prisma.loanStatus.findMany({ select: { code: true, nameTh: true }, orderBy: { sortOrder: 'asc' } }),
  ])
  for (const entry of entries) {
    const bucket = months.find(m => m.key === entry.occurredOn.slice(0, 7))
    if (bucket && entry.direction === 'IN') bucket.incoming += entry.amountSatang
    if (bucket && entry.direction === 'OUT') bucket.outgoing += entry.amountSatang
  }
  let outstanding = 0, overdueAmount = 0, overdueCount = 0, activeCount = 0, invalidCount = 0
  const dueSoon: { id: number; due: string; remaining: number }[] = []
  const distribution = new Map<string, number>()
  const weekEnd = new Date(`${today}T00:00:00Z`); weekEnd.setUTCDate(weekEnd.getUTCDate() + 7)
  for (const contract of contracts) {
    distribution.set(contract.status, (distribution.get(contract.status) ?? 0) + 1)
    if (contract.status === 'CANCELLED') continue
    const balance = contractLedgerBalance(contract, contract.ledgerEntries, today)
    if (balance.invalid) invalidCount++
    if (!balance.disbursed || balance.remaining <= 0) continue
    activeCount++; outstanding += balance.remaining
    if (contract.repaymentDueDate && contract.repaymentDueDate < today) { overdueCount++; overdueAmount += balance.remaining }
    if (contract.repaymentDueDate && contract.repaymentDueDate >= today && contract.repaymentDueDate <= weekEnd.toISOString().slice(0, 10)) dueSoon.push({ id: contract.id, due: contract.repaymentDueDate, remaining: balance.remaining })
  }
  return { today, borrowers, lenders, approved: limits._sum.approvedLimit ?? 0, used: limits._sum.usedLimit ?? 0,
    totalContracts: contracts.length, activeCount, outstanding, overdueCount, overdueAmount, invalidCount, months,
    dueSoon: dueSoon.sort((a, b) => a.due.localeCompare(b.due)),
    statuses: [...distribution].map(([code, count]) => ({ code, count, label: statuses.find(s => s.code === code)?.nameTh ?? ({ PAID: "จ่ายเงินแล้ว", WAITING_PAYMENT: "รอจ่ายเงิน", CLOSED: "ปิดยอด", CANCELLED: "ยกเลิก" } as Record<string, string>)[code] ?? code })),
  }
}
