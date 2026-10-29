'use server'

import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/lib/auth/current-user'
import { bangkokToday, ledgerAmount, validLedgerDate } from '@/lib/ledger'
import { assertAccountingDateOpen } from '@/lib/monthly-accounting'
import { assertUniqueLedgerProof } from '@/lib/ledger-proof'
import { recurringData, recurringPeriod, recurringInMonth, validMonth, type RecurringInput } from '@/lib/recurring'
import { lockCashForMatching } from '@/lib/cash-matching'

async function operator(write = false) {
  const user = await getCurrentUser()
  if (!user || user.status !== 'ACTIVE' || (write && user.role === 'REVIEWER')) throw new Error('ไม่มีสิทธิ์ทำรายการนี้')
  return user
}
function refresh() { for (const path of ['/dashboard/recurring', '/dashboard/ledger', '/dashboard/accounting', '/dashboard']) revalidatePath(path) }
function failure(e: unknown) {
  return { error: (e as { code?: string })?.code === 'P2002' ? 'รายการนี้มีอยู่หรือบันทึกงวดนี้แล้ว กรุณาโหลดข้อมูลล่าสุด' : e instanceof Error && !e.name.startsWith('Prisma') ? e.message : 'บันทึกไม่สำเร็จ กรุณาลองใหม่' }
}
export async function getRecurring() {
  const user = await operator()
  const [items, payments, channels, vehicles] = await Promise.all([
    prisma.recurringItem.findMany({ orderBy: [{ frequency: 'asc' }, { id: 'asc' }], include: { asset: { select: { id: true, code: true, name: true } } } }),
    prisma.recurringPayment.findMany({ orderBy: { id: 'desc' }, include: { ledgerEntry: { select: { id: true, voidedAt: true, amountSatang: true, occurredOn: true } }, historicalEntry: { select: { id: true, amountSatang: true, occurredOn: true } } } }),
    prisma.paymentChannel.findMany({ where: { isActive: true }, select: { code: true, nameTh: true }, orderBy: { code: 'asc' } }),
    prisma.asset.findMany({ where: { operatorId: user.id, kind: 'vehicle', status: 'ACTIVE', archivedOn: null }, select: { id: true, code: true, name: true }, orderBy: { code: 'asc' } }),
  ])
  return { canWrite: user.role !== 'REVIEWER', channels, vehicles,
    items: items.map(i => ({ id: i.id, name: i.name, direction: i.direction, amountSatang: i.amountSatang, frequency: i.frequency, dueDay: i.dueDay, dueMonth: i.dueMonth, startMonth: i.startMonth, isActive: i.isActive, note: i.note, assetId: i.assetId, asset: i.asset })),
    payments: payments.map(p => ({ id: p.id, itemId: p.itemId, period: p.period, name: p.itemName, expected: p.expectedSatang, entry: p.historicalEntry ? { source: 'HISTORICAL', ...p.historicalEntry } : p.ledgerEntry ? { source: 'LEDGER', id: p.ledgerEntry.id, amountSatang: p.ledgerEntry.amountSatang, occurredOn: p.ledgerEntry.occurredOn } : null, voided: Boolean(p.ledgerEntry?.voidedAt) })),
  }
}
export async function saveRecurring(input: RecurringInput) {
  try {
    const user = await operator(true), plan = recurringData(input)
    if (input.assetId !== undefined && (typeof input.assetId !== 'string' || input.assetId.length > 100)) throw new Error('ข้อมูลรถไม่ถูกต้อง')
    const assetId = input.assetId || null
    const data = { ...plan, assetId, assetOperatorId: assetId ? user.id : null }
    if (assetId) {
      const asset = await prisma.asset.findUnique({ where: { operatorId_id: { operatorId: user.id, id: assetId } } })
      if (!asset || asset.kind !== 'vehicle' || asset.status !== 'ACTIVE' || asset.archivedOn) throw new Error('กรุณาเลือกรถที่ใช้งานอยู่ใน ASSET ของคุณ')
    }
    if (input.id !== undefined && (!Number.isSafeInteger(input.id) || input.id <= 0)) throw new Error('ไม่พบรายการ')
    if (input.id) {
      const old = await prisma.recurringItem.findUniqueOrThrow({ where: { id: input.id }, include: { _count: { select: { payments: true } } } })
      if (old._count.payments && (old.direction !== data.direction || old.frequency !== data.frequency || old.startMonth !== data.startMonth || old.assetId !== data.assetId)) throw new Error('รายการที่มีประวัติแล้วเปลี่ยนประเภท รอบ เดือนเริ่ม หรือรถไม่ได้ ให้พักรายการเดิมแล้วเพิ่มใหม่')
      await prisma.recurringItem.update({ where: { id: input.id }, data })
    } else await prisma.recurringItem.create({ data: { ...data, createdBy: user.id } })
    refresh(); return { success: true }
  } catch (e) { return failure(e) }
}
export async function setRecurringActive(id: number, active: boolean) {
  try {
    await operator(true)
    if (!Number.isSafeInteger(id) || typeof active !== 'boolean') throw new Error('ข้อมูลไม่ถูกต้อง')
    await prisma.recurringItem.update({ where: { id }, data: { isActive: active } })
    refresh(); return { success: true }
  } catch (e) { return failure(e) }
}
export async function recurringCandidates(itemId: number, month: string) {
  await operator()
  if (!Number.isSafeInteger(itemId) || !validMonth(month)) throw new Error('ข้อมูลไม่ถูกต้อง')
  const item = await prisma.recurringItem.findUniqueOrThrow({ where: { id: itemId } })
  const end = new Date(Date.UTC(Number(month.slice(0, 4)), Number(month.slice(5)), 0)).toISOString().slice(0, 10)
  const occurredOn = { gte: `${month}-01`, lte: end < bangkokToday() ? end : bangkokToday() }
  const [ledger, historical] = await Promise.all([
    prisma.ledgerEntry.findMany({ where: { direction: item.direction, accountScope: 'GENERAL', kind: 'GENERAL', contractId: null, payableId: null, receivableId: null, voidedAt: null, occurredOn, recurringPayment: null, payrollReceipt: null }, select: { id: true, occurredOn: true, amountSatang: true, categoryName: true, note: true }, orderBy: { occurredOn: 'desc' } }),
    prisma.historicalCashEntry.findMany({ where: { direction: item.direction, occurredOn, recurringPayment: null, payrollReceipt: null }, select: { id: true, occurredOn: true, amountSatang: true, description: true }, orderBy: { occurredOn: 'desc' } }),
  ])
  return [...ledger.map(e => ({ key: `LEDGER:${e.id}`, date: e.occurredOn, amount: e.amountSatang, label: `${e.categoryName} ${e.note}` })), ...historical.map(e => ({ key: `HISTORICAL:${e.id}`, date: e.occurredOn, amount: e.amountSatang, label: e.description }))].sort((a, b) => Math.abs(a.amount - item.amountSatang) - Math.abs(b.amount - item.amountSatang))
}
export async function settleRecurring(input: { id: number; month: string; existingKey?: string; amount: string; occurredOn: string; channelCode: string; reference: string }) {
  try {
    const user = await operator(true)
    if (!Number.isSafeInteger(input.id) || !validMonth(input.month)) throw new Error('ข้อมูลไม่ถูกต้อง')
    await prisma.$transaction(async tx => {
      const item = await tx.recurringItem.findUniqueOrThrow({ where: { id: input.id }, include: { asset: { select: { name: true, code: true, status: true, archivedOn: true } } } })
      if (item.asset && (item.asset.status !== 'ACTIVE' || item.asset.archivedOn)) throw new Error('รถคันนี้ไม่ได้ใช้งานแล้ว กรุณาตรวจ ASSET ก่อนบันทึกจ่าย')
      if (!item.isActive || !recurringInMonth(item, input.month)) throw new Error('รายการพักใช้งาน ยังไม่ถึงเดือนเริ่ม หรือยังไม่ได้กำหนดเดือนครบกำหนด')
      const period = recurringPeriod(item, input.month)
      const previous = await tx.recurringPayment.findUnique({ where: { itemId_period: { itemId: item.id, period } }, include: { ledgerEntry: { select: { voidedAt: true } } } })
      if (previous && (previous.historicalEntryId || !previous.ledgerEntry?.voidedAt)) throw new Error('งวดนี้บันทึกแล้ว ห้ามบันทึกซ้ำ')
      let ledgerEntryId: number | null = null, historicalEntryId: number | null = null
      if (input.existingKey) {
        const match = /^(LEDGER|HISTORICAL):(\d+)$/.exec(input.existingKey)
        if (!match) throw new Error('กรุณาเลือกรายการเดิม')
        const id = Number(match[2])
        await lockCashForMatching(tx, match[1] as 'LEDGER' | 'HISTORICAL', id)
        if (match[1] === 'LEDGER') {
          const e = await tx.ledgerEntry.findUniqueOrThrow({ where: { id }, include: { payrollReceipt: true, recurringPayment: true } })
          if (e.voidedAt || e.accountScope !== 'GENERAL' || e.direction !== item.direction || e.kind !== 'GENERAL' || e.contractId || e.payableId || e.receivableId || e.payrollReceipt || e.recurringPayment) throw new Error('รายการนี้ไม่ใช่เงินทั่วไปที่ว่างสำหรับจับคู่')
          ledgerEntryId = id
        } else {
          const e = await tx.historicalCashEntry.findUniqueOrThrow({ where: { id }, include: { payrollReceipt: true, recurringPayment: true } })
          if (e.direction !== item.direction || e.payrollReceipt || e.recurringPayment) throw new Error('รายการนี้ถูกจับคู่แล้ว หรือประเภทไม่ตรง')
          historicalEntryId = id
        }
      } else {
        const amountSatang = ledgerAmount(input.amount)
        if (!validLedgerDate(input.occurredOn)) throw new Error('วันรับ–จ่ายเงินจริงไม่ถูกต้องหรืออยู่ในอนาคต')
        if (typeof input.reference !== 'string' || input.reference.length > 150) throw new Error('เลขอ้างอิงยาวเกินกำหนด')
        await assertAccountingDateOpen(tx, input.occurredOn)
        await assertUniqueLedgerProof(tx, { reference: input.reference, channelCode: input.channelCode, slipHash: null })
        const channel = await tx.paymentChannel.findUnique({ where: { code: input.channelCode } })
        if (!channel?.isActive) throw new Error('กรุณาเลือกช่องทางที่เปิดใช้งาน')
        const code = item.direction === 'IN' ? 'RECURRING_GENERAL_IN' : 'RECURRING_GENERAL_OUT'
        const category = await tx.financialCategory.upsert({ where: { code }, update: {}, create: { code, nameTh: item.direction === 'IN' ? 'รายรับประจำ' : 'รายจ่ายประจำ', nameEn: 'Recurring general cash', group: item.direction === 'IN' ? 'INCOME' : 'EXPENSE', direction: item.direction } })
        if (!category.isActive || category.direction !== item.direction) throw new Error('หมวดรายการประจำไม่พร้อมใช้งาน')
        const e = await tx.ledgerEntry.create({ data: { requestKey: `recurring-${item.id}-${period}-${previous?.ledgerEntryId ?? 'first'}`, kind: 'GENERAL', accountScope: 'GENERAL', direction: item.direction, categoryCode: code, categoryName: category.nameTh, amountSatang, occurredOn: input.occurredOn, channelCode: channel.code, channelName: channel.nameTh, reference: input.reference.trim(), note: `${item.name} · งวด ${period}${item.asset ? ` · ASSET ${item.asset.code} ${item.asset.name}` : ''}`, createdBy: user.id } })
        ledgerEntryId = e.id
      }
      const data = { itemName: item.name, expectedSatang: item.amountSatang, ledgerEntryId, historicalEntryId, createdBy: user.id }
      if (previous) await tx.recurringPayment.update({ where: { id: previous.id }, data })
      else await tx.recurringPayment.create({ data: { itemId: item.id, period, ...data } })
    })
    refresh(); return { success: true }
  } catch (e) { return failure(e) }
}
