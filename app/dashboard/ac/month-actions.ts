'use server'
import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/lib/auth/current-user'
import { bangkokToday } from '@/lib/ledger'
import { monthRange, monthSnapshot, nextMonth, allocationAmount } from '@/lib/monthly-accounting'
async function operator(write = false) {
  const user = await getCurrentUser()
  if (!user || user.status !== 'ACTIVE' || write && !['ADMIN', 'SUPER_ADMIN'].includes(user.role)) throw new Error('เฉพาะผู้ดูแลระบบที่ตรวจยอดและล็อกงวดได้')
  return user
}
const message = (error: unknown) => error instanceof Error && /^[ก-๙]/.test(error.message) ? error.message : 'บันทึกไม่สำเร็จ กรุณาโหลดข้อมูลล่าสุดแล้วลองใหม่'
export async function getMonthReview(month: string) {
  await operator()
  monthRange(month)
  return prisma.$transaction(tx => monthSnapshot(tx, month))
}
export async function saveRepaymentAllocation(input: { id: number; expectedRevision: number; principal: string; interest: string; reason: string }) {
  try {
    const user = await operator(true)
    if (!input || !Number.isSafeInteger(input.id) || !Number.isSafeInteger(input.expectedRevision) || typeof input.reason !== 'string' || !input.reason.trim() || input.reason.length > 500) throw new Error('กรุณาระบุรายการและเหตุผลตรวจยอด ไม่เกิน 500 ตัวอักษร')
    const principalReceivedSatang = allocationAmount(input.principal), interestReceivedSatang = allocationAmount(input.interest)
    await prisma.$transaction(async tx => {
      const entry = await tx.ledgerEntry.findUnique({ where: { id: input.id }, include: { _count: { select: { revisions: true } } } })
      if (!entry || entry.kind !== 'REPAYMENT' || !entry.contractId || entry.voidedAt) throw new Error('ไม่พบรายการรับชำระที่ใช้งานได้')
      if (entry._count.revisions !== input.expectedRevision) throw new Error('รายการเปลี่ยนแปลงแล้ว กรุณาโหลดข้อมูลใหม่')
      const locked = await tx.accountingMonthLock.findFirst({ where: { endOn: { gte: entry.occurredOn } } })
      const closed = await tx.accountingClose.findFirst({ where: { endOn: { gte: entry.occurredOn } } })
      if (locked || closed) throw new Error('รายการอยู่ในงวดที่ล็อกแล้ว ไม่สามารถเปลี่ยนการแยกยอดได้')
      const { snapshot } = await monthSnapshot(tx, entry.occurredOn.slice(0, 7))
      const receipt = snapshot.receipts.find(e => e.id === entry.id)!
      const contract = await tx.loanContract.findUniqueOrThrow({ where: { id: entry.contractId } })
      const penaltyReceivedSatang = receipt.expectedPenaltySatang
      if (principalReceivedSatang + interestReceivedSatang + penaltyReceivedSatang !== entry.amountSatang) throw new Error('เงินต้น + ดอกเบี้ย + ค่าปรับ ต้องเท่ากับยอดรับชำระ')
      if (contract.interestMethod === 'INTEREST_UPFRONT' && interestReceivedSatang !== 0) throw new Error('สัญญาหักดอกเบี้ยล่วงหน้าไม่รับดอกเบี้ยซ้ำในรายการคืนเงินต้น')
      const others = await tx.ledgerEntry.aggregate({ where: { contractId: contract.id, kind: 'REPAYMENT', voidedAt: null, id: { not: entry.id } }, _sum: { principalReceivedSatang: true, interestReceivedSatang: true } })
      if (principalReceivedSatang + (others._sum.principalReceivedSatang ?? 0) > contract.principalSatang || interestReceivedSatang + (others._sum.interestReceivedSatang ?? 0) > contract.interestSatang) throw new Error('ยอดที่แยกสะสมเกินเงินต้นหรือดอกเบี้ยตามสัญญา')
      const before = { principalReceivedSatang: entry.principalReceivedSatang, interestReceivedSatang: entry.interestReceivedSatang, penaltyReceivedSatang: entry.penaltyReceivedSatang }
      const after = { principalReceivedSatang, interestReceivedSatang, penaltyReceivedSatang }
      await tx.ledgerEntry.update({ where: { id: entry.id }, data: after })
      await tx.ledgerRevision.create({ data: { entryId: entry.id, beforeJson: JSON.stringify(before), afterJson: JSON.stringify(after), reason: input.reason.trim(), createdBy: user.id } })
    })
    for (const path of ['/dashboard/ac', '/dashboard/repayments', '/dashboard/ledger']) revalidatePath(path)
    return { ok: true, message: 'บันทึกการแยกเงินต้น–ดอกเบี้ยแล้ว' }
  } catch (error) { return { ok: false, message: message(error) } }
}
export async function lockAccountingMonth(input: { requestKey: string; month: string; note: string; reviewToken: string }) {
  try {
    const user = await operator(true)
    if (!input || !/^[a-f0-9-]{36}$/i.test(input.requestKey) || typeof input.note !== 'string' || !input.note.trim() || input.note.length > 1000) throw new Error('กรุณาระบุหมายเหตุตรวจยอด ไม่เกิน 1,000 ตัวอักษร')
    const { startOn, endOn } = monthRange(input.month)
    if (endOn >= bangkokToday()) throw new Error('ล็อกได้เฉพาะเดือนที่สิ้นสุดแล้ว')
    await prisma.$transaction(async tx => {
      const previous = await tx.accountingMonthLock.findUnique({ where: { requestKey: input.requestKey } })
      if (previous) {
        if (previous.createdBy !== user.id || previous.month !== input.month || previous.note !== input.note.trim()) throw new Error('คำขอนี้ถูกใช้กับข้อมูลอื่นแล้ว')
        return
      }
      const latest = await tx.accountingMonthLock.findFirst({ orderBy: { endOn: 'desc' } })
      if (latest && nextMonth(latest.month) !== input.month) throw new Error('ต้องล็อกเดือนต่อจากเดือนล่าสุดตามลำดับ')
      if (!latest) {
        const first = await tx.ledgerEntry.findFirst({ orderBy: { occurredOn: 'asc' } })
        if (first && first.occurredOn < startOn) throw new Error('กรุณาเริ่มล็อกเดือนให้ครอบคลุมรายการรับ–จ่ายแรกของระบบ')
      }
      const review = await monthSnapshot(tx, input.month)
      if (review.reviewToken !== input.reviewToken) throw new Error('ข้อมูลเปลี่ยนแปลงหลังตรวจยอด กรุณาโหลดหน้าตรวจยอดใหม่')
      if (review.snapshot.unallocatedCount) throw new Error('กรุณาแยกเงินต้น–ดอกเบี้ยทุกรายการรับชำระในเดือนก่อนล็อก')
      if (review.snapshot.invalidCount) throw new Error('พบยอดสัญญาที่ไม่สอดคล้อง กรุณาตรวจรายการรับชำระก่อนล็อก')
      await tx.accountingMonthLock.create({ data: { requestKey: input.requestKey, month: input.month, startOn, endOn, note: input.note.trim(), snapshotJson: JSON.stringify(review.snapshot), createdBy: user.id } })
    })
    revalidatePath('/dashboard/ac')
    return { ok: true, message: 'ตรวจยอดและล็อกเดือนแล้ว โดยไม่สร้างรายการโอนกำไร' }
  } catch (error) { return { ok: false, message: message(error) } }
}
