import type { Prisma } from '@/generated/prisma/client'
import { reimbursementBalance } from './reimbursements'
export const claimRelations = { allocations: { include: { voucher: { select: { voidedAt: true, ledgerEntry: { select: { voidedAt: true } } } } } } } as const satisfies Prisma.ExpenseClaimInclude
export function claimBalance(claim: { amountSatang: number; allocations: { amountSatang: number; voucher: { voidedAt: Date | null; ledgerEntry: { voidedAt: Date | null } | null } }[] }) {
  const paid = claim.allocations.filter(a => !a.voucher.voidedAt && !a.voucher.ledgerEntry?.voidedAt).reduce((s, a) => s + a.amountSatang, 0)
  return reimbursementBalance(claim.amountSatang, paid)
}
