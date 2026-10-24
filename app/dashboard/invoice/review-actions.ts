'use server'

import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/lib/auth/current-user'
import { loadPendingContractReview, assertReviewToken } from '@/lib/pending-contract-review'
import { contractAmounts, validContractSchedule } from '@/lib/contracts'
import { syncGoogleContract } from '@/lib/google-sync'
import { publishCreditBureauChanged } from '@/lib/realtime'
import { revalidatePath } from 'next/cache'

async function operator(admin = false) {
  const user = await getCurrentUser()
  if (!user || user.status !== 'ACTIVE' || user.role === 'REVIEWER' || admin && !['ADMIN', 'SUPER_ADMIN'].includes(user.role)) throw new Error('ไม่มีสิทธิ์ทำรายการนี้')
  return user
}
function refresh() {
  for (const path of ['/dashboard/ap', '/dashboard/invoice', '/dashboard/contracts', '/dashboard/borrower', '/dashboard/repayments']) revalidatePath(path)
  publishCreditBureauChanged()
}
export async function getPendingContractReview(id: number) {
  await operator()
  try { return await prisma.$transaction(async tx => (await loadPendingContractReview(tx, id)).data) }
  catch (error) { throw new Error(error instanceof Error && !error.name.startsWith('Prisma') ? error.message : 'โหลดข้อมูลสัญญาไม่สำเร็จ กรุณาลองใหม่') }
}
export async function approvePendingContract(id: number, expectedToken: string) {
  try {
    const user = await operator(true)
    await prisma.$transaction(async tx => {
      const { contract: c, data } = await loadPendingContractReview(tx, id)
      assertReviewToken(data.reviewToken, expectedToken)
      if (!c.limitApprovalRequired) throw new Error('รายการนี้อนุมัติแล้ว กรุณาเปิดข้อมูลล่าสุด')
      const result = await tx.loanContract.updateMany({ where: { id, reviewVersion: c.reviewVersion, status: 'WAITING_PAYMENT', paidAt: null, limitApprovalRequired: true }, data: { limitApprovalRequired: false, limitApprovedAt: new Date(), limitApprovedBy: user.id, reviewVersion: { increment: 1 } } })
      if (!result.count) throw new Error('รายการเปลี่ยนแปลงแล้ว กรุณาโหลดใหม่')
      await tx.contractRevision.create({ data: { contractId: id, kind: 'APPROVAL', beforeJson: JSON.stringify(data), afterJson: JSON.stringify({ limitApprovalRequired: false, reviewed: data }), reason: 'ยืนยันอนุมัติหลังตรวจสอบวงเงินและรายการค้าง', createdBy: user.id } })
    })
    await syncGoogleContract(id); refresh()
    return { success: true as const }
  } catch (error) { return { success: false as const, error: error instanceof Error && !error.name.startsWith('Prisma') ? error.message : 'อนุมัติไม่สำเร็จ กรุณาลองใหม่' } }
}
export type EditPendingContractInput = {
  id: number; reviewToken: string; principal: string; scheduledDisbursementDate: string; repaymentDueDate: string;
  collateralDescription: string; reason: string; confirmResetSignatures: boolean;
}
export async function editPendingContract(input: EditPendingContractInput) {
  try {
    const user = await operator()
    if (!input || !validContractSchedule(input.scheduledDisbursementDate, input.repaymentDueDate)) throw new Error('วันครบกำหนดคืนต้องไม่ก่อนวันนัดจ่าย และต้องเป็นวันที่ที่ถูกต้อง')
    if (typeof input.reason !== 'string' || !input.reason.trim() || input.reason.length > 500) throw new Error('กรุณาระบุเหตุผลแก้ไข ไม่เกิน 500 ตัวอักษร')
    if (typeof input.collateralDescription !== 'string' || input.collateralDescription.length > 2000) throw new Error('รายละเอียดหลักประกันต้องไม่เกิน 2,000 ตัวอักษร')
    const result = await prisma.$transaction(async tx => {
      const { contract: c, data } = await loadPendingContractReview(tx, input.id)
      assertReviewToken(data.reviewToken, input.reviewToken)
      if (c.limitApprovalRequired) throw new Error('กรุณาอนุมัติรายการจองก่อนแก้ไขสัญญาในขั้นรอจ่าย')
      if (data.hasSignatures && input.confirmResetSignatures !== true) throw new Error('สัญญามีลายเซ็นแล้ว กรุณายืนยันจัดทำเอกสารและลงนามใหม่ก่อนแก้ไข')
      const computedAmounts = contractAmounts(input.principal, c.internalInterestPercent ?? c.interestPercent, c.interestMethod)
      const amounts = computedAmounts.principalSatang === c.principalSatang ? { principalSatang: c.principalSatang, interestSatang: c.interestSatang, netSatang: c.netSatang, repaymentSatang: c.repaymentSatang } : computedAmounts
      const collateralDescription = input.collateralDescription.trim() || null
      const principalChanged = amounts.principalSatang !== c.principalSatang
      const changed = principalChanged || input.scheduledDisbursementDate !== c.scheduledDisbursementDate || input.repaymentDueDate !== c.repaymentDueDate || collateralDescription !== c.collateralDescription
      if (!changed) throw new Error('ยังไม่มีข้อมูลเปลี่ยนแปลง')
      // A previously approved amount does not authorize increasing an over-limit reservation.
      const needsApproval = principalChanged && amounts.principalSatang > c.principalSatang && amounts.principalSatang > data.availableBeforeSatang
      const update = {
        ...amounts, scheduledDisbursementDate: input.scheduledDisbursementDate, repaymentDueDate: input.repaymentDueDate, collateralDescription,
        limitApprovalRequired: needsApproval,
        ...(needsApproval ? { limitApprovedAt: null, limitApprovedBy: null } : {}),
        reviewVersion: { increment: 1 },
        borrowerSignatureData: null, borrowerSignedAt: null, borrowerConsentAt: null, borrowerCapturedBy: null,
        lenderSignatureData: null, lenderSignedAt: null, lenderConsentAt: null, lenderCapturedBy: null,
        guarantorSignatureData: null, guarantorSignedAt: null, guarantorConsentAt: null, guarantorCapturedBy: null, signatureTermsHash: null,
      }
      const updated = await tx.loanContract.updateMany({ where: { id: c.id, reviewVersion: c.reviewVersion, status: 'WAITING_PAYMENT', paidAt: null }, data: update })
      if (!updated.count) throw new Error('สัญญาเปลี่ยนแปลงแล้ว กรุณาโหลดใหม่')
      // Preserve the old signed version before clearing live signatures.
      const snapshot = Object.fromEntries(Object.entries(c).filter(([key]) => !['borrower', 'lender', 'revisions'].includes(key)))
      await tx.contractRevision.create({ data: { contractId: c.id, kind: 'EDIT', beforeJson: JSON.stringify(snapshot), afterJson: JSON.stringify({ ...data, ...amounts, scheduledDisbursementDate: input.scheduledDisbursementDate, repaymentDueDate: input.repaymentDueDate, collateralDescription, limitApprovalRequired: needsApproval, reviewVersion: c.reviewVersion + 1 }), reason: input.reason.trim(), createdBy: user.id } })
      await tx.contractWitness.deleteMany({ where: { contractId: c.id } })
      await tx.contractDocumentSignature.deleteMany({ where: { contractId: c.id } })
      return { needsApproval, signaturesReset: data.hasSignatures }
    })
    await syncGoogleContract(input.id); refresh()
    return { success: true as const, ...result }
  } catch (error) { return { success: false as const, error: error instanceof Error && !error.name.startsWith('Prisma') ? error.message : 'แก้ไขไม่สำเร็จ กรุณาลองใหม่' } }
}

export async function rejectPendingContract(id: number, expectedToken: string, reason: string) {
  try {
    const user = await operator(true)
    if (typeof reason !== 'string' || !reason.trim() || reason.length > 500) throw new Error('กรุณาระบุเหตุผลไม่อนุมัติ ไม่เกิน 500 ตัวอักษร')
    await prisma.$transaction(async tx => {
      const { contract: c, data } = await loadPendingContractReview(tx, id)
      assertReviewToken(data.reviewToken, expectedToken)
      if (!c.limitApprovalRequired) throw new Error('รายการนี้ได้รับอนุมัติแล้ว ไม่สามารถปฏิเสธคำขอเดิมได้')
      const updated = await tx.loanContract.updateMany({ where: { id, reviewVersion: c.reviewVersion, status: 'WAITING_PAYMENT', paidAt: null, limitApprovalRequired: true }, data: { status: 'REJECTED', limitApprovalRequired: false, limitApprovedAt: null, limitApprovedBy: null, reviewVersion: { increment: 1 } } })
      if (!updated.count) throw new Error('รายการเปลี่ยนแปลงแล้ว กรุณาโหลดใหม่')
      await tx.contractRevision.create({ data: { contractId: id, kind: 'REJECTION', beforeJson: JSON.stringify(data), afterJson: JSON.stringify({ status: 'REJECTED', limitApprovalRequired: false, reviewVersion: c.reviewVersion + 1 }), reason: reason.trim(), createdBy: user.id } })
    })
    await syncGoogleContract(id); refresh()
    return { success: true as const }
  } catch (error) { return { success: false as const, error: error instanceof Error && !error.name.startsWith('Prisma') ? error.message : 'บันทึกไม่อนุมัติไม่สำเร็จ กรุณาลองใหม่' } }
}
