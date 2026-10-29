import 'server-only'

import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/lib/auth/current-user'
import { bangkokToday } from '@/lib/ledger'
import { buildLoanRepaymentSummary } from '@/lib/loan-repayment-summary'

export async function getLoanRepaymentSummary(query = '') {
  const user = await getCurrentUser()
  if (!user || user.status !== 'ACTIVE') throw new Error('ไม่มีสิทธิ์ดูสรุปยอดผู้กู้')
  const today = bangkokToday()
  // One relation query, without pagination: all funded outstanding contracts contribute to the report.
  const contracts = await prisma.loanContract.findMany({
    where: { status: { notIn: ['CANCELLED', 'REJECTED', 'VOID', 'RESERVED'] } },
    select: {
      id: true, borrowerId: true, borrowerName: true, borrowerCode: true, legacySourceCode: true,
      principalSatang: true, interestSatang: true, interestMethod: true, repaymentSatang: true,
      status: true, paidAt: true, repaymentDueDate: true, legacyReceivedSatang: true, penaltyMaxDays: true,
      borrower: { select: { borrowerId: true, titleTh: true, firstName: true, middleNameTh: true, lastName: true } },
      ledgerEntries: { where: { voidedAt: null, kind: { in: ['DISBURSEMENT', 'REPAYMENT'] } }, select: {
        id: true, kind: true, amountSatang: true, occurredOn: true, penaltyAssessed: true,
        penaltyWaivedSatang: true, settlementWaivedSatang: true,
      } },
    },
  })
  return buildLoanRepaymentSummary(contracts.map(contract => ({ ...contract,
    borrowerName: [contract.borrower.titleTh, contract.borrower.firstName, contract.borrower.middleNameTh, contract.borrower.lastName].filter(Boolean).join(' ').trim() || contract.borrowerName,
    borrowerCode: contract.borrower.borrowerId || contract.borrowerCode,
  })), today, query)
}
