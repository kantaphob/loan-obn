'use server'
import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/lib/auth/current-user'
import { validLedgerDate, bangkokToday } from '@/lib/ledger'
import { closingJournal, type ClosingBalance, type EquityTarget } from '@/lib/account-closing'

export async function closeAccounts(input: { requestKey: string; startOn: string; endOn: string; note: string; balances: ClosingBalance[]; equity?: EquityTarget }) {
  try {
    const user = await getCurrentUser()
    if (!user || user.status !== 'ACTIVE' || !['ADMIN', 'SUPER_ADMIN'].includes(user.role)) throw new Error('เฉพาะผู้ดูแลระบบที่ปิดงวดบัญชีได้')
    if (!input || !/^[a-f0-9-]{36}$/i.test(input.requestKey) || !validLedgerDate(input.startOn) || !validLedgerDate(input.endOn) || input.startOn > input.endOn || input.endOn >= bangkokToday()) throw new Error('เลือกช่วงวันที่ให้ถูกต้อง โดยวันสิ้นงวดต้องก่อนวันนี้')
    if (typeof input.note !== 'string' || !input.note.trim() || input.note.length > 1000) throw new Error('กรุณาระบุแหล่งที่มาของยอดบัญชี ไม่เกิน 1,000 ตัวอักษร')
    if (!/^\d{4}-01-01$/.test(input.startOn) || input.endOn !== `${input.startOn.slice(0, 4)}-12-31`) throw new Error('ปิดรายได้–ค่าใช้จ่ายเฉพาะงวดสิ้นปี 1 มกราคม ถึง 31 ธันวาคม')
    const journal = closingJournal(input.balances, input.equity, { allowEmpty: true })
    await prisma.$transaction(async tx => {
      const previous = await tx.accountingClose.findUnique({ where: { requestKey: input.requestKey } })
      if (previous) {
        if (previous.createdBy !== user.id || previous.startOn !== input.startOn || previous.endOn !== input.endOn || previous.note !== input.note.trim() || previous.balancesJson !== JSON.stringify(input.balances) || previous.journalJson !== JSON.stringify(journal.lines)) throw new Error('คำขอนี้ถูกใช้กับข้อมูลอื่นแล้ว')
        return
      }
      const months = await tx.accountingMonthLock.findMany({ where: { startOn: { gte: input.startOn }, endOn: { lte: input.endOn } }, orderBy: { month: 'asc' } })
      if (months.length !== 12 || months.some((m, i) => m.month !== `${input.startOn.slice(0, 4)}-${String(i + 1).padStart(2, '0')}`)) throw new Error('ต้องตรวจยอดและล็อกครบทั้ง 12 เดือนของปีก่อนปิดบัญชีสิ้นปี')
      const latest = await tx.accountingClose.findFirst({ orderBy: { endOn: 'desc' } })
      if (latest) {
        const next = new Date(`${latest.endOn}T00:00:00Z`); next.setUTCDate(next.getUTCDate() + 1)
        if (input.startOn !== next.toISOString().slice(0, 10)) throw new Error('วันเริ่มงวดต้องต่อจากวันสิ้นงวดล่าสุด')
      }
      const entries = await tx.ledgerEntry.findMany({ where: { voidedAt: null, occurredOn: { gte: input.startOn, lte: input.endOn } }, orderBy: { id: 'asc' } })
      await tx.accountingClose.create({ data: {
        kind: 'YEAR_END', requestKey: input.requestKey, startOn: input.startOn, endOn: input.endOn, note: input.note.trim(),
        balancesJson: JSON.stringify(input.balances), journalJson: JSON.stringify(journal.lines), profitSatang: journal.profit,
        cashSnapshotJson: JSON.stringify(entries), createdBy: user.id,
      } })
    })
    revalidatePath('/dashboard/ac')
    return { ok: true, message: 'ปิดบัญชีสิ้นปีและบันทึกรายการโอนกำไรแล้ว' }
  } catch (error) {
    console.error('Account closing failed', error)
    return { ok: false, message: error instanceof Error && /^[ก-๙]/.test(error.message) ? error.message : 'บันทึกไม่สำเร็จ กรุณาโหลดข้อมูลล่าสุดแล้วลองใหม่' }
  }
}
