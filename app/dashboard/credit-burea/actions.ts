'use server'

import { borrowerPosition } from '@/lib/borrower-position'
import { paymentBehavior, closureMethod } from '@/lib/credit-history'
import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/lib/auth/current-user'
import { bangkokToday, contractLedgerBalance } from '@/lib/ledger'

async function authorize() {
  const user = await getCurrentUser()
  if (!user || user.status !== 'ACTIVE') throw new Error('ไม่มีสิทธิ์ดูประวัติการเงิน')
}
export async function getCreditDirectory() {
  await authorize()
  const [borrowers, lenders, persuaders] = await Promise.all([
    prisma.borrower.findMany({ select: { id: true, borrowerId: true, firstName: true, lastName: true, nickname: true, phone: true, _count: { select: { contracts: true } } }, orderBy: { id: 'desc' } }),
    prisma.lender.findMany({ select: { id: true, firstName: true, lastName: true, nickname: true, phone: true, _count: { select: { contracts: true } } }, orderBy: { id: 'desc' } }),
    prisma.persuader.findMany({ select: { id: true, name: true, phone: true, isActive: true, _count: { select: { contracts: true } } }, orderBy: { id: 'desc' } }),
  ])
  return [
    ...borrowers.map(p => ({ id: p.id, role: 'BORROWER' as const, code: p.borrowerId || `BR-${p.id}`, name: `${p.firstName} ${p.lastName}`.trim() || p.nickname, nickname: p.nickname, phone: p.phone, isActive: true, contracts: p._count.contracts })),
    ...lenders.map(p => ({ id: p.id, role: 'LENDER' as const, code: `LN-${String(p.id).padStart(6, '0')}`, name: `${p.firstName} ${p.lastName}`.trim() || p.nickname, nickname: p.nickname, phone: p.phone, isActive: true, contracts: p._count.contracts })),
    ...persuaders.map(p => ({ id: p.id, role: 'PERSUADER' as const, code: `PS-${String(p.id).padStart(4, '0')}`, name: p.name, nickname: '', phone: p.phone, isActive: p.isActive, contracts: p._count.contracts })),
  ]
}
export async function getCreditHistory(role: 'BORROWER' | 'LENDER' | 'PERSUADER', id: number) {
  await authorize()
  if (!['BORROWER', 'LENDER', 'PERSUADER'].includes(role) || !Number.isSafeInteger(id) || id < 1) throw new Error('ข้อมูลบุคคลไม่ถูกต้อง')
  const rows = await prisma.loanContract.findMany({
    where: role === 'BORROWER' ? { borrowerId: id } : role === 'LENDER' ? { lenderId: id } : { persuaderId: id },
    select: {
      id: true, legacySourceCode: true, borrowerName: true, lenderName: true, status: true, limitApprovalRequired: true,
      persuaderId: true, persuaderNameSnapshot: true, persuaderShareBase: true, persuaderShareBasisPoints: true, persuaderShareSatang: true,
      principalSatang: true, interestSatang: true, interestMethod: true, netSatang: true, repaymentSatang: true, legacyReceivedSatang: true,
      paidAt: true, createdAt: true, scheduledDisbursementDate: true, repaymentDueDate: true, penaltyMaxDays: true,
      ledgerEntries: { select: { id: true, createdBy: true, createdAt: true, voidedBy: true, settlementWaiverReason: true, penaltyWaiverReason: true, slip: { select: { id: true } }, kind: true, direction: true, categoryName: true, amountSatang: true, occurredOn: true, channelName: true, reference: true, note: true, voidedAt: true, voidReason: true, penaltyWaivedSatang: true, penaltyAssessed: true, settlementWaivedSatang: true, revisions: { select: { id: true, createdBy: true, beforeJson: true, afterJson: true, reason: true, createdAt: true }, orderBy: { id: 'desc' } } }, orderBy: [{ occurredOn: 'desc' }, { id: 'desc' }] },
    }, orderBy: { id: 'desc' },
  })
  const operatorIds = [...new Set(rows.flatMap(c => c.ledgerEntries.flatMap(e => [e.createdBy, e.voidedBy, ...e.revisions.map(r => r.createdBy)]).filter((id): id is string => Boolean(id))))]
  const users = operatorIds.length ? await prisma.user.findMany({ where: { id: { in: operatorIds } }, select: { id: true, acccode: true } }) : []
  const names = new Map(users.map(u => [u.id, u.acccode]))
  const operatorName = (id: string | null) => id ? names.get(id) ?? 'บัญชีเดิม / ไม่พบผู้ใช้' : 'ไม่ระบุ'
  const today = bangkokToday()
  const borrower = role === 'BORROWER' ? await prisma.borrower.findUnique({ where: { id }, select: { borrowerId: true, nickname: true, firstName: true, lastName: true, phone: true, status: true, riskRatingCode: true, approvedLimit: true, usedLimit: true } }) : null
  const position = borrower ? borrowerPosition(rows.map(c => ({ ...c, ledgerEntries: c.ledgerEntries.filter(e => !e.voidedAt) })), borrower.usedLimit, today) : null
  const creditLimit = borrower && position ? { approved: borrower.approvedLimit, used: position.currentUsedLimit, reserved: position.reservedLimit, available: Math.max(0, borrower.approvedLimit - position.committedLimit), overLimit: Math.max(0, position.committedLimit - borrower.approvedLimit) } : null
  const borrowerProfile = borrower && position ? { borrowerId: borrower.borrowerId, nickname: borrower.nickname, firstName: borrower.firstName, lastName: borrower.lastName, phone: borrower.phone, status: borrower.status, riskRating: borrower.riskRatingCode || position.currentRiskRating } : null
  const persuader = role === 'PERSUADER' ? await prisma.persuader.findUnique({ where: { id }, select: { name: true, phone: true, isActive: true } }) : null
  const shareEvents = role === 'PERSUADER' ? await prisma.persuaderShareEvent.findMany({ where: { persuaderId: id }, select: { contractId: true, amountSatang: true, ledgerEntry: { select: { occurredOn: true } } } }) : []
  const sharePayments = role === 'PERSUADER' ? await prisma.persuaderSharePayment.findMany({ where: { persuaderId: id }, select: { contractId: true, amountSatang: true, ledgerEntry: { select: { occurredOn: true, voidedAt: true } } } }) : []
  const shareByContract = new Map<number, { accruedSatang: number; paidSatang: number }>()
  for (const event of shareEvents) {
    if (event.ledgerEntry.occurredOn > today) continue
    const row = shareByContract.get(event.contractId) ?? { accruedSatang: 0, paidSatang: 0 }
    row.accruedSatang += event.amountSatang
    shareByContract.set(event.contractId, row)
  }
  for (const payment of sharePayments) {
    if (payment.ledgerEntry.occurredOn > today) continue
    const row = shareByContract.get(payment.contractId) ?? { accruedSatang: 0, paidSatang: 0 }
    if (!payment.ledgerEntry.voidedAt) row.paidSatang += payment.amountSatang
    shareByContract.set(payment.contractId, row)
  }
  const persuaderSummary = persuader ? [...shareByContract.values()].reduce((sum, row) => ({ accruedSatang: sum.accruedSatang + row.accruedSatang, paidSatang: sum.paidSatang + row.paidSatang }), { accruedSatang: 0, paidSatang: 0 }) : null
  const persuaderShareSummary = persuaderSummary ? { ...persuaderSummary, dueSatang: persuaderSummary.accruedSatang - persuaderSummary.paidSatang, byContract: [...shareByContract].map(([contractId, row]) => ({ contractId, ...row, dueSatang: row.accruedSatang - row.paidSatang })) } : null
  const persuaderProfile = persuader ? { ...persuader } : null
  return { borrowerProfile, creditLimit, persuaderProfile, persuaderShareSummary, asOf: today, loadedAt: new Date().toISOString(), contracts: rows.map(({ ledgerEntries, ...c }) => ({
    ...c, closureMethod: closureMethod(contractLedgerBalance(c, ledgerEntries.filter(e => !e.voidedAt), today), ledgerEntries.some(e => !e.voidedAt && e.occurredOn <= today && e.kind === 'REPAYMENT' && !e.penaltyAssessed) || c.legacyReceivedSatang > 0), paidAt: c.paidAt?.toISOString() ?? null, createdAt: c.createdAt.toISOString(),
    balance: contractLedgerBalance(c, ledgerEntries.filter(e => !e.voidedAt), today),
    behavior: paymentBehavior(c, ledgerEntries, today),
    entries: ledgerEntries.map(e => ({ ...e, createdBy: operatorName(e.createdBy), voidedBy: operatorName(e.voidedBy), createdAt: e.createdAt.toISOString(), voidedAt: e.voidedAt?.toISOString() ?? null, revisions: e.revisions.map(r => ({ ...r, createdBy: operatorName(r.createdBy), createdAt: r.createdAt.toISOString() })) })),
  })) }
}
