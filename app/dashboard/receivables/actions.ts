'use server'

import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/lib/auth/current-user'
import { assertAccountingDateOpen } from '@/lib/monthly-accounting'
import { assertUniqueLedgerProof } from '@/lib/ledger-proof'
import { bangkokToday, ledgerAmount, validLedgerDate } from '@/lib/ledger'

async function operator(write = false) {
  const user = await getCurrentUser()
  if (!user || user.status !== 'ACTIVE' || (write && user.role === 'REVIEWER')) throw new Error('ไม่มีสิทธิ์ทำรายการนี้')
  return user
}

function validDate(value: unknown): value is string {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)
    && Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value
}

export async function getTradeReceivables() {
  const user = await operator()
  const [rows, channels, borrowers] = await Promise.all([
    prisma.tradeReceivable.findMany({
      orderBy: [{ dueDate: 'asc' }, { id: 'desc' }],
      include: { payments: { where: { voidedAt: null }, orderBy: [{ occurredOn: 'asc' }, { id: 'asc' }], select: { id: true, amountSatang: true, occurredOn: true, channelName: true, reference: true } } },
    }),
    prisma.paymentChannel.findMany({ where: { isActive: true }, orderBy: { code: 'asc' }, select: { code: true, nameTh: true } }),
    prisma.borrower.findMany({ orderBy: [{ firstName: 'asc' }, { nickname: 'asc' }, { id: 'asc' }], select: { id: true, borrowerId: true, titleTh: true, firstName: true, middleNameTh: true, lastName: true, nickname: true, phone: true } }),
  ])
  const today = bangkokToday()
  const receivables = rows.map(row => {
    const receivedSatang = row.payments.reduce((sum, payment) => sum + payment.amountSatang, 0)
    return { ...row, createdAt: row.createdAt.toISOString(), receivedSatang, remainingSatang: Math.max(0, row.amountSatang - receivedSatang), overdue: Boolean(row.dueDate) && row.dueDate < today && receivedSatang < row.amountSatang }
  })
  return { canWrite: user.role !== 'REVIEWER', channels, receivables, borrowers: borrowers.map(row => ({
    id: row.id, borrowerCode: row.borrowerId || `BR-${String(row.id).padStart(5, '0')}`,
    name: [row.titleTh, row.firstName, row.middleNameTh, row.lastName].filter(Boolean).join(' ') || row.nickname,
    nickname: row.nickname, phone: row.phone,
  })) }
}

export async function createTradeReceivable(input: {
  requestKey: string; borrowerId: number; description: string;
  reference: string; amount: string; occurredOn: string; dueDate: string
}) {
  try {
    const user = await operator(true)
    if (!input || !/^[a-f0-9-]{36}$/i.test(input.requestKey)) throw new Error('ข้อมูลรายการไม่ถูกต้อง')
    const description = input.description.trim(), reference = input.reference.trim()
    if (!Number.isSafeInteger(input.borrowerId) || input.borrowerId < 1 || !description || description.length > 500 || reference.length > 150) throw new Error('กรุณาเลือกลูกค้าจาก Borrower และตรวจสอบรายการ')
    const amountSatang = ledgerAmount(input.amount)
    if (!validLedgerDate(input.occurredOn) || input.dueDate !== '' && (!validDate(input.dueDate) || input.dueDate < input.occurredOn)) throw new Error('กรุณาระบุวันที่รายการและวันครบกำหนดให้ถูกต้อง')
    await prisma.$transaction(async tx => {
      const borrower = await tx.borrower.findUnique({ where: { id: input.borrowerId }, select: { id: true, nickname: true, titleTh: true, firstName: true, middleNameTh: true, lastName: true, phone: true } })
      if (!borrower) throw new Error('ไม่พบลูกค้าในรายการ Borrower')
      const customerName = [borrower.titleTh, borrower.firstName, borrower.middleNameTh, borrower.lastName].filter(Boolean).join(' ') || borrower.nickname
      const previous = await tx.tradeReceivable.findUnique({ where: { requestKey: input.requestKey } })
      if (previous) {
        if (previous.createdBy === user.id && previous.borrowerId === borrower.id && previous.customerName === customerName && previous.customerPhone === borrower.phone && previous.description === description && previous.reference === reference && previous.amountSatang === amountSatang && previous.occurredOn === input.occurredOn && previous.dueDate === input.dueDate) return
        throw new Error('รหัสคำขอนี้ถูกใช้แล้ว กรุณาโหลดรายการใหม่')
      }
      await tx.tradeReceivable.create({ data: { requestKey: input.requestKey, borrowerId: borrower.id, customerName, customerPhone: borrower.phone, description, reference, amountSatang, occurredOn: input.occurredOn, dueDate: input.dueDate, createdBy: user.id } })
    })
    revalidatePath('/dashboard/receivables')
    return { success: true }
  } catch (error) {
    return { error: error instanceof Error && !error.name.startsWith('Prisma') ? error.message : 'บันทึกรายการไม่สำเร็จ กรุณาลองอีกครั้ง' }
  }
}

export async function receiveTradeReceivablePayment(input: {
  requestKey: string; receivableId: number; amount: string; occurredOn: string;
  channelCode: string; reference: string; note: string
}) {
  try {
    const user = await operator(true)
    if (!input || !/^[a-f0-9-]{36}$/i.test(input.requestKey) || !Number.isSafeInteger(input.receivableId) || input.receivableId < 1) throw new Error('ข้อมูลรับชำระไม่ถูกต้อง')
    const amountSatang = ledgerAmount(input.amount), reference = input.reference.trim(), note = input.note.trim()
    if (!validLedgerDate(input.occurredOn) || reference.length > 150 || note.length > 1000) throw new Error('กรุณาตรวจสอบวันที่และรายละเอียดการรับเงิน')
    await prisma.$transaction(async tx => {
      const previous = await tx.ledgerEntry.findUnique({ where: { requestKey: input.requestKey } })
      if (previous) {
        if (previous.createdBy === user.id && previous.receivableId === input.receivableId && previous.amountSatang === amountSatang && previous.occurredOn === input.occurredOn && previous.channelCode === input.channelCode && previous.reference === reference && !previous.voidedAt && (previous.note.endsWith(note) || !note)) return
        throw new Error('รหัสคำขอนี้ถูกใช้แล้ว กรุณาโหลดรายการใหม่')
      }
      const receivable = await tx.tradeReceivable.findUnique({ where: { id: input.receivableId }, include: { payments: { where: { voidedAt: null } } } })
      if (!receivable) throw new Error('ไม่พบรายการลูกหนี้ค้างรับ')
      if (input.occurredOn < receivable.occurredOn) throw new Error('วันที่รับเงินจริงต้องไม่ก่อนวันที่เกิดรายการค้างรับ')
      const remaining = receivable.amountSatang - receivable.payments.reduce((sum, payment) => sum + payment.amountSatang, 0)
      if (remaining <= 0) throw new Error('รายการนี้ชำระครบแล้ว')
      if (amountSatang > remaining) throw new Error('ยอดรับชำระเกินยอดค้าง')
      await assertAccountingDateOpen(tx, input.occurredOn)
      await assertUniqueLedgerProof(tx, { reference, channelCode: input.channelCode })
      const [channel, category] = await Promise.all([
        tx.paymentChannel.findUnique({ where: { code: input.channelCode } }),
        tx.financialCategory.findUnique({ where: { code: 'TRADE_RECEIVABLE_PAYMENT' } }),
      ])
      if (!channel?.isActive || !category?.isActive || category.direction !== 'IN' || category.group === 'LOAN') throw new Error('ช่องทางรับเงินหรือหมวดรายรับยังไม่พร้อมใช้งาน')
      await tx.ledgerEntry.create({ data: {
        requestKey: input.requestKey, receivableId: receivable.id, kind: 'GENERAL', direction: 'IN',
        categoryCode: category.code, categoryName: category.nameTh, amountSatang,
        occurredOn: input.occurredOn, channelCode: channel.code, channelName: channel.nameTh,
        reference, note: [`รับชำระจาก ${receivable.customerName}`, receivable.description, note].filter(Boolean).join(' · '), createdBy: user.id,
      } })
    })
    revalidatePath('/dashboard/receivables'); revalidatePath('/dashboard/ledger'); revalidatePath('/dashboard/accounting'); revalidatePath('/dashboard/ac')
    return { success: true }
  } catch (error) {
    return { error: error instanceof Error && 'code' in error && error.code === 'P2002' ? 'เลขอ้างอิงนี้บันทึกแล้ว' : error instanceof Error && !error.name.startsWith('Prisma') ? error.message : 'รับชำระไม่สำเร็จ กรุณาลองอีกครั้ง' }
  }
}
