import 'server-only'

import { createHash } from 'node:crypto'
import type { Prisma } from '@/generated/prisma/client'
import { bangkokToday, contractLedgerBalance } from './ledger'
import { borrowerPosition } from './borrower-position'
import { contractSignaturesComplete } from './contracts'

export async function loadPendingContractReview(tx: Prisma.TransactionClient, id: number) {
  if (!Number.isSafeInteger(id) || id < 1) throw new Error('เลขสัญญาไม่ถูกต้อง')
  const c = await tx.loanContract.findUnique({ where: { id }, include: {
    borrower: { include: { contracts: { orderBy: { id: 'asc' }, include: { ledgerEntries: { where: { voidedAt: null } } } } } },
    lender: { select: { status: true } },
    ledgerEntries: { where: { voidedAt: null } }, witnesses: true, documentSignatures: true,
    revisions: { orderBy: { id: 'desc' }, take: 5, select: { id: true, kind: true, reason: true, createdBy: true, createdAt: true } },
  } })
  if (!c || c.status !== 'WAITING_PAYMENT' || c.paidAt || c.ledgerEntries.some(e => e.kind === 'DISBURSEMENT')) throw new Error('สัญญานี้ไม่ได้อยู่ในสถานะรอจ่าย หรือจ่ายแล้ว')
  const today = bangkokToday()
  const others = c.borrower.contracts.filter(other => other.id !== c.id)
  const funded = others.map(other => ({ other, balance: contractLedgerBalance(other, other.ledgerEntries, today) })).filter(({ balance }) => balance.disbursed && balance.remaining > 0)
  const position = borrowerPosition(c.borrower.contracts, c.borrower.usedLimit, today)
  const approvedLimitSatang = Math.round(c.borrower.approvedLimit * 100)
  const committedBeforeSatang = Math.round(position.committedLimit * 100) - c.principalSatang
  const interestRates = await tx.interestRate.findMany({ where: { isActive: true }, orderBy: [{ sortOrder: 'asc' }, { percent: 'asc' }], select: { code: true, percent: true } })
  const data = {
    interestRates,
    id: c.id, borrowerName: c.borrowerName, borrowerCode: c.borrowerCode, lenderName: c.lenderName,
    principalSatang: c.principalSatang, interestSatang: c.interestSatang, netSatang: c.netSatang, repaymentSatang: c.repaymentSatang,
    interestMethod: c.interestMethod, interestPercent: c.interestPercent, internalInterestPercent: c.internalInterestPercent,
    scheduledDisbursementDate: c.scheduledDisbursementDate, repaymentDueDate: c.repaymentDueDate,
    collateralDescription: c.collateralDescription, documentChoice: c.documentChoice, documentPackage: c.documentPackage,
    signingMethod: c.signingMethod, limitApprovalRequired: c.limitApprovalRequired, reviewVersion: c.reviewVersion,
    hasSignatures: Boolean(c.borrowerSignedAt || c.lenderSignedAt || c.guarantorSignedAt || c.witnesses.length || c.documentSignatures.length),
    signaturesReady: c.signingMethod !== 'E_SIGNATURE' || contractSignaturesComplete(c),
    approvedLimitSatang, committedBeforeSatang,
    availableBeforeSatang: approvedLimitSatang - committedBeforeSatang,
    availableAfterSatang: approvedLimitSatang - committedBeforeSatang - c.principalSatang,
    reservedOtherSatang: Math.round(position.reservedLimit * 100) - c.principalSatang,
    outstandingSatang: funded.reduce((sum, { balance }) => sum + balance.remaining, 0),
    principalOutstandingSatang: Math.round(position.currentUsedLimit * 100),
    penaltyOutstandingSatang: funded.reduce((sum, { balance }) => sum + balance.penaltyRemaining, 0),
    outstandingContracts: funded.map(({ other, balance }) => ({ id: other.id, remainingSatang: balance.remaining, dueDate: other.repaymentDueDate, overdueDays: balance.overdueDays, penaltySatang: balance.penaltyRemaining })),
    revisions: c.revisions.map(r => ({ ...r, createdAt: r.createdAt.toISOString() })),
  }
  // The digest includes exposure, dates and the version: stale confirmations cannot authorize changed terms.
  const reviewToken = createHash('sha256').update(JSON.stringify({ ...data, interestRates: undefined, today, borrowerStatus: c.borrower.status, lenderStatus: c.lender.status })).digest('hex')
  return { contract: c, data: { ...data, reviewToken } }
}
export type PendingContractReview = Awaited<ReturnType<typeof loadPendingContractReview>>['data']
export function assertReviewToken(current: string, expected: unknown) {
  if (typeof expected !== 'string' || expected !== current) throw new StaleContractReviewError()
}

export class StaleContractReviewError extends Error {
  readonly code = 'STALE_CONTRACT_REVIEW'
  constructor() { super('ข้อมูลสัญญาหรือยอดค้างมีการเปลี่ยนแปลง กรุณาโหลดข้อมูลล่าสุดและตรวจสอบอีกครั้ง') }
}
