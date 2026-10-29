'use server'

import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/lib/auth/current-user'
import { assertAccountingDateOpen } from '@/lib/monthly-accounting'
import { assertUniqueLedgerProof } from '@/lib/ledger-proof'
import { validLedgerDate } from '@/lib/ledger'
import { parsePayrollDetails, payrollReceiptWindow, validatePayroll, type PayrollInput } from '@/lib/payroll'
import { lockCashForMatching } from '@/lib/cash-matching'

async function operator(write = false) {
  const user = await getCurrentUser()
  if (!user || user.status !== 'ACTIVE' || (write && user.role === 'REVIEWER')) throw new Error('ไม่มีสิทธิ์ทำรายการนี้')
  return user
}
function refresh() {
  for (const path of ['/dashboard/payroll', '/dashboard/ledger', '/dashboard/accounting', '/dashboard/ac', '/dashboard']) revalidatePath(path)
}
function failure(error: unknown) {
  const code = (error as { code?: string })?.code
  return { error: code === 'P2002' ? 'งวดเดือนและนายจ้างนี้มีแล้ว หรือรายการรับเงินถูกจับคู่แล้ว กรุณาโหลดข้อมูลล่าสุด' : error instanceof Error && !error.name.startsWith('Prisma') ? error.message : 'บันทึกไม่สำเร็จ กรุณาลองใหม่' }
}
export async function getPayroll() {
  const user = await operator()
  const [records, channels] = await Promise.all([
    prisma.payrollRecord.findMany({ orderBy: [{ month: 'desc' }, { id: 'desc' }], include: { ledgerEntry: { select: { id: true, voidedAt: true, occurredOn: true, amountSatang: true } }, historicalEntry: { select: { id: true, occurredOn: true, amountSatang: true } } } }),
    prisma.paymentChannel.findMany({ where: { isActive: true }, select: { code: true, nameTh: true }, orderBy: { code: 'asc' } }),
  ])
  return {
    canWrite: user.role !== 'REVIEWER', channels,
    records: records.map(r => ({ id: r.id, month: r.month, employer: r.employer, ...parsePayrollDetails(r.amountsJson), gross: r.grossSatang, deductions: r.deductionSatang, net: r.netSatang, note: r.note, receipt: r.historicalEntry ? { source: 'HISTORICAL', id: r.historicalEntry.id, date: r.historicalEntry.occurredOn, amount: r.historicalEntry.amountSatang } : r.ledgerEntry && !r.ledgerEntry.voidedAt ? { source: 'LEDGER', id: r.ledgerEntry.id, date: r.ledgerEntry.occurredOn, amount: r.ledgerEntry.amountSatang } : null, voided: Boolean(r.ledgerEntry?.voidedAt) })),
  }
}
export async function getPayrollCandidates(recordId: number) {
  await operator()
  if (!Number.isSafeInteger(recordId) || recordId <= 0) throw new Error('ไม่พบรายการเงินเดือน')
  const record = await prisma.payrollRecord.findUniqueOrThrow({ where: { id: recordId }, select: { netSatang: true, month: true } })
  const window = payrollReceiptWindow(record.month)
  const occurredOn = { gte: window.startOn, lte: window.endOn }
  const [ledger, historical] = await Promise.all([
    prisma.ledgerEntry.findMany({ where: { occurredOn, voidedAt: null, accountScope: 'GENERAL', direction: 'IN', kind: 'GENERAL', contractId: null, payableId: null, receivableId: null, recurringPayment: null, payrollReceipt: null }, select: { id: true, occurredOn: true, categoryName: true, reference: true, amountSatang: true }, orderBy: { occurredOn: 'desc' } }),
    prisma.historicalCashEntry.findMany({ where: { occurredOn, direction: 'IN', recurringPayment: null, payrollReceipt: null }, select: { id: true, occurredOn: true, description: true, amountSatang: true }, orderBy: { occurredOn: 'desc' } }),
  ])
  return [...ledger.map(e => ({ key: `LEDGER:${e.id}`, date: e.occurredOn, amount: e.amountSatang, label: `${e.categoryName} ${e.reference}` })), ...historical.map(e => ({ key: `HISTORICAL:${e.id}`, date: e.occurredOn, amount: e.amountSatang, label: e.description }))].map(e => ({ ...e, difference: e.amount - record.netSatang })).sort((a, b) => Number(a.difference !== 0) - Number(b.difference !== 0) || a.date.localeCompare(b.date))
}
export async function savePayroll(input: PayrollInput) {
  try {
    const user = await operator(true)
    const totals = validatePayroll(input)
    const payload = { month: input.month, employer: input.employer.trim(), amountsJson: JSON.stringify({ amounts: totals.amounts, customItems: (input.customItems ?? []).map(item => ({ ...item, label: item.label.trim() })), hiddenFields: input.hiddenFields ?? [] }), grossSatang: totals.gross, deductionSatang: totals.deductions, netSatang: totals.net, note: input.note.trim() }
    if (input.id !== undefined && (!Number.isSafeInteger(input.id) || input.id <= 0)) throw new Error('ไม่พบรายการเงินเดือน')
    await prisma.$transaction(async tx => {
      if (input.id) {
        const record = await tx.payrollRecord.findUnique({ where: { id: input.id } })
        if (!record) throw new Error('ไม่พบรายการเงินเดือน')
        if (record.ledgerEntryId || record.historicalEntryId) throw new Error('รายการที่เชื่อมบัญชีแล้วแก้ไขไม่ได้ เพื่อรักษายอดให้ตรงกัน')
        const changed = await tx.payrollRecord.updateMany({ where: { id: record.id, updatedAt: record.updatedAt, ledgerEntryId: null, historicalEntryId: null }, data: payload })
        if (changed.count !== 1) throw new Error('ข้อมูลเปลี่ยนระหว่างบันทึก กรุณาโหลดใหม่')
      } else await tx.payrollRecord.create({ data: { ...payload, createdBy: user.id } })
    })
    refresh()
    return { success: true }
  } catch (error) { return failure(error) }
}
export async function receivePayroll(input: { id: number; existingKey?: string; occurredOn: string; channelCode: string; reference: string; acceptDifference?: boolean }) {
  try {
    const user = await operator(true)
    if (!Number.isSafeInteger(input.id) || input.id <= 0) throw new Error('ไม่พบรายการเงินเดือน')
    await prisma.$transaction(async tx => {
      const record = await tx.payrollRecord.findUnique({ where: { id: input.id }, include: { ledgerEntry: true } })
      if (!record) throw new Error('ไม่พบรายการเงินเดือน')
      if (record.historicalEntryId || (record.ledgerEntry && !record.ledgerEntry.voidedAt)) throw new Error('รายการนี้รับเงินเข้าบัญชีแล้ว ห้ามบันทึกซ้ำ')
      if (record.netSatang <= 0) throw new Error('ยอดสุทธิเป็นศูนย์ จึงไม่มีเงินรับเข้าบัญชี')
      const claim = await tx.payrollRecord.updateMany({ where: { id: record.id, updatedAt: record.updatedAt }, data: { updatedAt: new Date(Math.max(Date.now(), record.updatedAt.getTime() + 1)) } })
      if (claim.count !== 1) throw new Error('มีการบันทึกรายการนี้แล้ว กรุณาโหลดข้อมูลล่าสุด')
      const differenceNote = (actual: number) => {
        const difference = actual - record.netSatang
        if (Math.abs(difference) > 100) throw new Error('ยอดต่างเกิน 1 บาท กรุณาตรวจรายละเอียดเงินเดือนก่อนจับคู่')
        if (difference !== 0 && input.acceptDifference !== true) throw new Error('กรุณายืนยันรับทราบส่วนต่างก่อนจับคู่')
        return difference === 0 ? record.note : record.note + '\nยืนยันจับคู่ส่วนต่าง ' + (difference / 100).toFixed(2) + ' บาท; สุทธิตามงวด ' + (record.netSatang / 100).toFixed(2) + ' บาท; รับจริง ' + (actual / 100).toFixed(2) + ' บาท; ผู้บันทึก ' + user.id + '; ' + new Date().toISOString()
      }
      if (input.existingKey) {
        const match = /^(LEDGER|HISTORICAL):(\d+)$/.exec(input.existingKey)
        if (!match) throw new Error('กรุณาเลือกรายการรับเงินเดิม')
        const id = Number(match[2])
        await lockCashForMatching(tx, match[1] as 'LEDGER' | 'HISTORICAL', id)
        const recurring = await tx.recurringPayment.findUnique({ where: match[1] === 'LEDGER' ? { ledgerEntryId: id } : { historicalEntryId: id }, select: { id: true } })
        if (recurring) throw new Error('รายการนี้จับคู่กับรายการประจำแล้ว ไม่สามารถนับซ้ำเป็นเงินเดือนได้')
        if (match[1] === 'LEDGER') {
          const entry = await tx.ledgerEntry.findUnique({ where: { id } })
          if (!entry || entry.voidedAt || entry.direction !== 'IN' || entry.accountScope !== 'GENERAL' || entry.kind !== 'GENERAL') throw new Error('รายการเดิมต้องเป็นรายรับทั่วไปที่ยังใช้งาน และยอดตรงกับเงินรับสุทธิ')
          await tx.payrollRecord.update({ where: { id: record.id }, data: { ledgerEntryId: id, historicalEntryId: null, note: differenceNote(entry.amountSatang) } })
        } else {
          const entry = await tx.historicalCashEntry.findUnique({ where: { id } })
          if (!entry || entry.direction !== 'IN' || entry.amountSatang !== record.netSatang) throw new Error('ยอดรับย้อนหลังไม่ตรงกับเงินรับสุทธิ')
          await tx.payrollRecord.update({ where: { id: record.id }, data: { historicalEntryId: id, ledgerEntryId: null, note: differenceNote(entry.amountSatang) } })
        }
      } else {
        if (!validLedgerDate(input.occurredOn)) throw new Error('กรุณาระบุวันรับเงินจริงที่ไม่อยู่ในอนาคต')
        if (typeof input.reference !== 'string' || input.reference.length > 150) throw new Error('เลขอ้างอิงยาวเกินกำหนด')
        await assertAccountingDateOpen(tx, input.occurredOn)
        await assertUniqueLedgerProof(tx, { reference: input.reference, channelCode: input.channelCode, slipHash: null })
        const channel = await tx.paymentChannel.findUnique({ where: { code: input.channelCode } })
        if (!channel?.isActive) throw new Error('กรุณาเลือกช่องทางรับเงินที่ใช้งานได้')
        const category = await tx.financialCategory.upsert({ where: { code: 'PAYROLL_SALARY_RECEIVED' }, update: {}, create: { code: 'PAYROLL_SALARY_RECEIVED', nameTh: 'เงินเดือนและรายได้ประจำ', nameEn: 'Payroll income', direction: 'IN', group: 'INCOME' } })
        if (!category.isActive || category.direction !== 'IN') throw new Error('หมวดเงินเดือนปิดใช้งาน')
        const entry = await tx.ledgerEntry.create({ data: { requestKey: `payroll-${record.id}-${record.ledgerEntryId ?? 'first'}`, accountScope: 'GENERAL', kind: 'GENERAL', direction: 'IN', categoryCode: category.code, categoryName: category.nameTh, amountSatang: record.netSatang, occurredOn: input.occurredOn, channelCode: channel.code, channelName: channel.nameTh, reference: input.reference.trim(), note: `เงินเดือนงวด ${record.month} · ${record.employer} · PAY-${record.id}`, createdBy: user.id } })
        await tx.payrollRecord.update({ where: { id: record.id }, data: { ledgerEntryId: entry.id, historicalEntryId: null } })
      }
    })
    refresh()
    return { success: true }
  } catch (error) { return failure(error) }
}
