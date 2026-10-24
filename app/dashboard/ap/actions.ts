'use server'

import { assertUniqueLedgerProof } from '@/lib/ledger-proof'
import { syncGoogleLedger } from '@/lib/google-sync'

import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/lib/auth/current-user'
import { ledgerAmount, validLedgerDate } from '@/lib/ledger'

async function operator() {
  const user = await getCurrentUser()
  if (!user || user.status !== 'ACTIVE' || user.role === 'REVIEWER') throw new Error('ไม่มีสิทธิ์บันทึกรายการ')
  return user
}
function field(data: FormData, name: string, max = 200) {
  const value = data.get(name)
  if (typeof value !== 'string' || !value.trim() || value.length > max) throw new Error('กรุณากรอกข้อมูลให้ครบและไม่เกินความยาวที่กำหนด')
  return value.trim()
}
export async function savePayable(_: { message: string; success?: boolean }, data: FormData) {
  try {
    const user = await operator()
    const supplier = field(data, 'supplier'), invoiceNumber = field(data, 'invoiceNumber'), description = field(data, 'description', 1000)
    const invoiceDate = field(data, 'invoiceDate'), dueDate = field(data, 'dueDate')
    const requestKey = field(data, 'requestKey', 36)
    if (!/^[a-f0-9-]{36}$/i.test(requestKey)) throw new Error('คำขอไม่ถูกต้อง')
    if (!validLedgerDate(invoiceDate) || !/^\d{4}-\d{2}-\d{2}$/.test(dueDate) || !Number.isFinite(Date.parse(dueDate)) || new Date(dueDate).toISOString().slice(0, 10) !== dueDate || dueDate < invoiceDate) throw new Error('ตรวจสอบวันที่ใบแจ้งหนี้และวันครบกำหนด')
    const amountSatang = ledgerAmount(field(data, 'amount'))
    await prisma.tradePayable.upsert({ where: { requestKey }, update: {}, create: { requestKey, supplier, invoiceNumber, description, invoiceDate, dueDate, amountSatang, createdBy: user.id } })
    revalidatePath('/dashboard/ap'); revalidatePath('/dashboard/ap/trade')
    return { success: true, message: 'เพิ่มบิลเจ้าหนี้เรียบร้อยแล้ว' }
  } catch (error) {
    return { message: error instanceof Error && !error.name.startsWith('Prisma') ? error.message : 'บันทึกไม่สำเร็จ ตรวจสอบเลขใบแจ้งหนี้ซ้ำแล้วลองใหม่' }
  }
}
export async function payPayable(_: { message: string; success?: boolean }, data: FormData) {
  try {
    const user = await operator()
    const id = Number(data.get('id')), occurredOn = field(data, 'occurredOn'), channelCode = field(data, 'channelCode')
    const reference = field(data, 'reference', 150)
    if (!Number.isSafeInteger(id) || id <= 0 || !validLedgerDate(occurredOn)) throw new Error('ข้อมูลการชำระเงินไม่ถูกต้อง')
    const entry = await prisma.$transaction(async tx => {
      await assertUniqueLedgerProof(tx, { reference, channelCode })
      const payable = await tx.tradePayable.findUnique({ where: { id }, include: { payments: { where: { voidedAt: null } } } })
      if (!payable || payable.payments.length) throw new Error('ไม่พบบิล หรือบิลนี้ชำระแล้ว')
      if (occurredOn < payable.invoiceDate) throw new Error('วันชำระต้องไม่ก่อนวันที่ใบแจ้งหนี้')
      const channel = await tx.paymentChannel.findUnique({ where: { code: channelCode } })
      if (!channel?.isActive) throw new Error('กรุณาเลือกช่องทางชำระเงิน')
      return tx.ledgerEntry.create({ data: { requestKey: `AP-${id}-${payable.payments.length}-${crypto.randomUUID()}`, payableId: id, kind: 'GENERAL', direction: 'OUT', categoryCode: 'TRADE_PAYABLE', categoryName: 'ชำระเจ้าหนี้การค้า', amountSatang: payable.amountSatang, occurredOn, channelCode, channelName: channel.nameTh, reference, note: `${payable.supplier} · ${payable.invoiceNumber} · ${payable.description}`, createdBy: user.id } })
    })
    await syncGoogleLedger(entry.id)
    revalidatePath('/dashboard/ap'); revalidatePath('/dashboard/ap/trade'); revalidatePath('/dashboard/ledger')
    return { success: true, message: 'บันทึกจ่ายเงินและลงบัญชีรับ–จ่ายเรียบร้อยแล้ว' }
  } catch (error) {
    return { message: error instanceof Error && !error.name.startsWith('Prisma') ? error.message : 'บันทึกการจ่ายไม่สำเร็จ กรุณาลองใหม่' }
  }
}
