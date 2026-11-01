import type { Prisma } from '@/generated/prisma/client'
import type { AssetData } from '@/app/thing/_shared/model'

/** Loan cash links must remain consistent with the versioned debt register. */
export async function assertBankLoanLedgerUnlinked(tx: Prisma.TransactionClient, entryId: number) {
  const states = await tx.assetWorkspaceState.findMany({ where: { payload: { contains: 'ledgerEntryId' } }, select: { payload: true } })
  for (const state of states) {
    const data = JSON.parse(state.payload) as AssetData
    if (data.homes?.some(home => home.buildingWorks?.some(work => work.payments?.some(payment => payment.ledgerEntryId === entryId)))) throw new Error('รายการนี้เชื่อมกับงานซ่อมบำรุง ไม่สามารถแก้ไขหรือยกเลิกแยกจากประวัติงานได้')
    if (data.loans?.some(loan => loan.payments.some(row => row.ledgerEntryId === entryId) || loan.disbursements?.some(row => row.ledgerEntryId === entryId) || loan.contractorPayments?.some(row => row.ledgerEntryId === entryId))) throw new Error('รายการนี้เชื่อมกับทะเบียนหนี้สินธนาคารหรือสัญญาจ้างเหมา ไม่สามารถแก้ไขหรือยกเลิกแยกจากสัญญาได้')
  }
}
