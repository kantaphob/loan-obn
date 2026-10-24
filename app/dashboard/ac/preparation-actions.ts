'use server'
import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/lib/auth/current-user'
import { assertAccountingDateOpen } from '@/lib/monthly-accounting'
import { monthRange } from '@/lib/accounting-period'
import { bangkokToday, validLedgerDate } from '@/lib/ledger'
import { validateChecklist, type Checklist } from '@/lib/closing-preparation'
import { calculateWorkpaper, validateTrialAccounts, validateAdjustment, type TrialAccount, type EquityMovement, type AdjustmentLine } from '@/lib/accounting-workpaper'
async function operator() {
  const user = await getCurrentUser()
  if (!user || user.status !== 'ACTIVE' || !['ADMIN', 'SUPER_ADMIN'].includes(user.role)) throw new Error('เฉพาะผู้ดูแลระบบที่จัดเตรียมปิดดุลได้')
  return user
}
function yearValid(year: string) { if (typeof year !== 'string' || !/^(19|[2-9]\d)\d{2}$/.test(year) || year > bangkokToday().slice(0, 4)) throw new Error('ปีไม่ถูกต้อง') }
const errorMessage = (error: unknown) => error instanceof Error && /^[ก-๙]/.test(error.message) ? error.message : 'บันทึกไม่สำเร็จ กรุณาโหลดข้อมูลล่าสุดแล้วลองใหม่'
export async function saveMonthPreparation(input: { month: string; expectedVersion: number; checklist: Checklist; note: string }) {
  try {
    const user = await operator()
    const { startOn } = monthRange(input.month)
    const checklist = validateChecklist(input.checklist)
    if (!Number.isSafeInteger(input.expectedVersion) || typeof input.note !== 'string' || input.note.length > 2000) throw new Error('ข้อมูลหมายเหตุหรือเวอร์ชันไม่ถูกต้อง')
    await prisma.$transaction(async tx => {
      await assertAccountingDateOpen(tx, startOn)
      const before = await tx.accountingPreparation.findUnique({ where: { month: input.month } })
      if ((before?.version ?? 0) !== input.expectedVersion) throw new Error('รายการตรวจสอบเปลี่ยนแล้ว กรุณาโหลดข้อมูลล่าสุด')
      const data = { checklistJson: JSON.stringify(checklist), note: input.note.trim(), updatedBy: user.id }
      const after = before ? await tx.accountingPreparation.update({ where: { month: input.month }, data: { ...data, version: { increment: 1 } } }) : await tx.accountingPreparation.create({ data: { month: input.month, ...data } })
      await tx.accountingPreparationRevision.create({ data: { scope: input.month, beforeJson: JSON.stringify(before), afterJson: JSON.stringify(after), reason: 'ตรวจรายการเตรียมปิดเดือน', createdBy: user.id } })
    })
    revalidatePath('/dashboard/ac')
    return { ok: true, message: 'บันทึกรายการตรวจสอบแล้ว' }
  } catch (error) { return { ok: false, message: errorMessage(error) } }
}
export async function saveYearWorkpaper(input: { year: string; expectedVersion: number; accounts: TrialAccount[]; equity: EquityMovement; notes: string; reason: string }) {
  try {
    const user = await operator(); yearValid(input.year)
    const accounts = validateTrialAccounts(input.accounts)
    calculateWorkpaper(accounts, [], input.equity)
    if (!Number.isSafeInteger(input.expectedVersion) || typeof input.notes !== 'string' || input.notes.length > 10000 || typeof input.reason !== 'string' || !input.reason.trim() || input.reason.length > 500) throw new Error('กรุณาระบุเหตุผลและหมายเหตุให้ถูกต้อง')
    await prisma.$transaction(async tx => {
      if (await tx.accountingClose.findFirst({ where: { startOn: { lte: `${input.year}-12-31` }, endOn: { gte: `${input.year}-01-01` } } })) throw new Error('ปีนี้ปิดบัญชีแล้ว ไม่สามารถเปลี่ยนงบทดลองได้')
      const before = await tx.accountingYearWorkpaper.findUnique({ where: { year: input.year } })
      if ((before?.version ?? 0) !== input.expectedVersion) throw new Error('งบทดลองเปลี่ยนแปลงแล้ว กรุณาโหลดข้อมูลล่าสุด')
      const adjustments = await tx.accountingAdjustment.findMany({ where: { year: input.year } })
      calculateWorkpaper(accounts, adjustments.map(a => JSON.parse(a.linesJson)), input.equity)
      const data = { accountsJson: JSON.stringify(accounts), equityJson: JSON.stringify(input.equity), notes: input.notes.trim(), updatedBy: user.id }
      const after = before ? await tx.accountingYearWorkpaper.update({ where: { year: input.year }, data: { ...data, version: { increment: 1 } } }) : await tx.accountingYearWorkpaper.create({ data: { year: input.year, ...data } })
      await tx.accountingPreparationRevision.create({ data: { scope: input.year, beforeJson: JSON.stringify(before), afterJson: JSON.stringify(after), reason: input.reason.trim(), createdBy: user.id } })
    })
    revalidatePath('/dashboard/ac'); return { ok: true, message: 'บันทึกงบทดลองและหมายเหตุแล้ว' }
  } catch (error) { return { ok: false, message: errorMessage(error) } }
}
export async function postAccountingAdjustment(input: { requestKey: string; year: string; occurredOn: string; description: string; lines: AdjustmentLine[] }) {
  try {
    const user = await operator(); yearValid(input.year)
    if (!/^[a-f0-9-]{36}$/i.test(input.requestKey) || !validLedgerDate(input.occurredOn) || !input.occurredOn.startsWith(`${input.year}-`) || typeof input.description !== 'string' || !input.description.trim() || input.description.length > 1000) throw new Error('วันที่หรือรายละเอียดรายการปรับปรุงไม่ถูกต้อง')
    await prisma.$transaction(async tx => {
      if (await tx.accountingClose.findFirst({ where: { startOn: { lte: `${input.year}-12-31` }, endOn: { gte: `${input.year}-01-01` } } })) throw new Error('ปีนี้ปิดบัญชีแล้ว')
      const baseline = await tx.accountingYearWorkpaper.findUnique({ where: { year: input.year } })
      if (!baseline) throw new Error('กรุณาบันทึกผังบัญชีและงบทดลองก่อนปรับปรุง')
      const lines = validateAdjustment(input.lines, JSON.parse(baseline.accountsJson))
      const previous = await tx.accountingAdjustment.findUnique({ where: { requestKey: input.requestKey } })
      if (previous) {
        if (previous.createdBy !== user.id || previous.year !== input.year || previous.occurredOn !== input.occurredOn || previous.description !== input.description.trim() || previous.linesJson !== JSON.stringify(lines)) throw new Error('คำขอนี้ถูกใช้กับข้อมูลอื่นแล้ว')
        return
      }
      await tx.accountingAdjustment.create({ data: { requestKey: input.requestKey, year: input.year, occurredOn: input.occurredOn, description: input.description.trim(), linesJson: JSON.stringify(lines), createdBy: user.id } })
    })
    revalidatePath('/dashboard/ac'); return { ok: true, message: 'บันทึกรายการปรับปรุงแล้ว รายการนี้ไม่เปลี่ยนยอดเงินในบัญชีรับ–จ่าย' }
  } catch (error) { return { ok: false, message: errorMessage(error) } }
}
