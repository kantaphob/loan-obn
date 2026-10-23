'use server'

import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/lib/auth/current-user'
import { contractLedgerBalance, ledgerAmount, validLedgerDate, type LedgerInput } from '@/lib/ledger'
import { contractSignaturesComplete } from '@/lib/contracts'

async function operator(write = false) {
  const user = await getCurrentUser()
  if (!user || user.status !== 'ACTIVE' || (write && user.role === 'REVIEWER')) throw new Error('ไม่มีสิทธิ์ทำรายการนี้')
  return user
}
export async function getLedger() {
  const user = await operator()
  const [entries, contracts, categories, channels] = await Promise.all([
    prisma.ledgerEntry.findMany({ orderBy: [{ occurredOn: 'desc' }, { id: 'desc' }], include: { contract: { select: { borrowerName: true } } } }),
    prisma.loanContract.findMany({ select: { id: true, borrowerName: true, lenderName: true, netSatang: true, repaymentSatang: true, interestMethod: true, status: true, paidAt: true, repaymentDueDate: true }, orderBy: { id: 'desc' } }),
    prisma.financialCategory.findMany({ where: { isActive: true }, orderBy: { sortOrder: 'asc' } }),
    prisma.paymentChannel.findMany({ where: { isActive: true }, orderBy: { code: 'asc' } }),
  ])
  return {
    canWrite: user.role !== 'REVIEWER', categories, channels,
    entries: entries.map(e => ({ ...e, createdAt: e.createdAt.toISOString(), voidedAt: e.voidedAt?.toISOString() ?? null })),
    contracts: contracts.map(c => ({ ...c, paidAt: c.paidAt?.toISOString() ?? null, ...contractLedgerBalance(c, entries.filter(e => e.contractId === c.id && !e.voidedAt)) })),
  }
}
export async function saveLedger(input: LedgerInput) {
  try {
    const user = await operator(true)
    if (!input || !/^[a-f0-9-]{36}$/i.test(input.requestKey) || !['GENERAL', 'DISBURSEMENT', 'REPAYMENT'].includes(input.kind)) throw new Error('ข้อมูลรายการไม่ถูกต้อง')
    const amountSatang = ledgerAmount(input.amount)
    if (!validLedgerDate(input.occurredOn)) throw new Error('วันที่ทำรายการไม่ถูกต้อง หรือเป็นวันที่ในอนาคต')
    if (typeof input.reference !== 'string' || input.reference.length > 150 || typeof input.note !== 'string' || input.note.length > 1000) throw new Error('เลขอ้างอิงหรือหมายเหตุยาวเกินกำหนด')
    await prisma.$transaction(async tx => {
      const previous = await tx.ledgerEntry.findUnique({ where: { requestKey: input.requestKey } })
      if (previous) { if (previous.createdBy !== user.id) throw new Error('คำขอนี้ถูกใช้แล้ว'); return }
      const channel = await tx.paymentChannel.findUnique({ where: { code: input.channelCode } })
      if (!channel?.isActive) throw new Error('กรุณาเลือกช่องทางชำระเงินที่ใช้งานได้')
      let direction = input.direction, categoryCode = input.categoryCode, categoryName = '', contractId: number | null = null
      if (input.kind === 'GENERAL') {
        if (input.contractId !== null) throw new Error('รายการทั่วไปไม่สามารถผูกสัญญาได้')
        const category = await tx.financialCategory.findUnique({ where: { code: categoryCode } })
        if (!category?.isActive || !['IN', 'OUT'].includes(direction) || category.direction !== direction || category.group === 'LOAN' || ['INTEREST_RECEIVED'].includes(category.code)) throw new Error('กรุณาเลือกหมวดรับ–จ่ายทั่วไปให้ตรงประเภทรายการ')
        categoryName = category.nameTh
      } else {
        if (!Number.isSafeInteger(input.contractId) || !input.contractId || input.contractId < 1) throw new Error('กรุณาเลือกสัญญา')
        const contract = await tx.loanContract.findUnique({ where: { id: input.contractId }, include: { witnesses: true, documentSignatures: { select: { documentStage: true, signer: true, signedAt: true } }, ledgerEntries: { where: { voidedAt: null } } } })
        if (!contract) throw new Error('ไม่พบสัญญา')
        const balance = contractLedgerBalance(contract, contract.ledgerEntries)
        contractId = contract.id
        if (input.kind === 'DISBURSEMENT') {
          if (balance.disbursed || contract.status !== 'WAITING_PAYMENT') throw new Error('สัญญานี้จ่ายเงินแล้วหรือไม่อยู่ในสถานะรอจ่าย')
          if (contract.signingMethod === 'E_SIGNATURE' && !contractSignaturesComplete(contract)) throw new Error('กรุณาลงนามอิเล็กทรอนิกส์ให้ครบก่อนจ่ายเงิน')
          if (amountSatang !== contract.netSatang) throw new Error('ยอดจ่ายต้องเท่ากับยอดสุทธิตามสัญญา')
          direction = 'OUT'; categoryCode = 'LOAN_DISBURSEMENT'; categoryName = ''
          await tx.loanContract.update({ where: { id: contract.id }, data: { status: 'PAID', paidAt: new Date(`${input.occurredOn}T00:00:00+07:00`) } })
        } else {
          if (!balance.disbursed) throw new Error('ต้องจ่ายเงินกู้ก่อนรับชำระคืน')
          const firstDate = balance.disbursementOn ?? contract.paidAt?.toLocaleDateString('en-CA', { timeZone: 'Asia/Bangkok' })
          if (firstDate && input.occurredOn < firstDate) throw new Error('วันรับชำระต้องไม่ก่อนวันจ่ายเงินกู้')
          if (amountSatang > balance.remaining) throw new Error('ยอดรับชำระเกินยอดคงค้าง')
          direction = 'IN'; categoryCode = 'CONTRACT_REPAYMENT'; categoryName = ''
          await tx.loanContract.update({ where: { id: contract.id }, data: { status: amountSatang === balance.remaining ? 'CLOSED' : 'PAID' } })
        }
      }
      if (input.kind !== 'GENERAL') {
        const category = await tx.financialCategory.findUnique({ where: { code: categoryCode } })
        if (!category?.isActive || category.direction !== direction || category.group !== 'LOAN') throw new Error('หมวดบัญชีตามสัญญาไม่พร้อมใช้งาน กรุณาตรวจสอบ Masterdata')
        categoryName = category.nameTh
      }
      await tx.ledgerEntry.create({ data: { requestKey: input.requestKey, kind: input.kind, contractId, direction, categoryCode, categoryName, amountSatang, occurredOn: input.occurredOn, channelCode: channel.code, channelName: channel.nameTh, reference: input.reference.trim(), note: input.note.trim(), createdBy: user.id } })
    })
    revalidatePath('/dashboard/repayments'); revalidatePath('/dashboard/ledger'); revalidatePath('/dashboard/contracts')
    return { success: true }
  } catch (error) {
    return { error: error instanceof Error && !error.name.startsWith('Prisma') ? error.message : 'บันทึกไม่สำเร็จ กรุณาลองอีกครั้ง' }
  }
}
export async function voidLedger(id: number, reason: string) {
  try {
    const user = await operator(true)
    if (!Number.isSafeInteger(id) || typeof reason !== 'string' || !reason.trim() || reason.length > 500) throw new Error('กรุณาระบุเหตุผลยกเลิกไม่เกิน 500 ตัวอักษร')
    await prisma.$transaction(async tx => {
      const entry = await tx.ledgerEntry.findUnique({ where: { id } })
      if (!entry || entry.voidedAt) throw new Error('ไม่พบรายการ หรือรายการถูกยกเลิกแล้ว')
      if (entry.contractId) {
        const others = await tx.ledgerEntry.findMany({ where: { contractId: entry.contractId, voidedAt: null, id: { not: id } } })
        if (entry.kind === 'DISBURSEMENT' && others.some(e => e.kind === 'REPAYMENT')) throw new Error('ต้องยกเลิกรายการรับชำระคืนทั้งหมดก่อนยกเลิกจ่ายเงินกู้')
        await tx.loanContract.update({ where: { id: entry.contractId }, data: entry.kind === 'DISBURSEMENT' ? { status: 'WAITING_PAYMENT', paidAt: null } : { status: 'PAID' } })
      }
      await tx.ledgerEntry.update({ where: { id }, data: { voidedAt: new Date(), voidedBy: user.id, voidReason: reason.trim() } })
    })
    revalidatePath('/dashboard/repayments'); revalidatePath('/dashboard/ledger'); revalidatePath('/dashboard/contracts')
    return { success: true }
  } catch (error) { return { error: error instanceof Error && !error.name.startsWith('Prisma') ? error.message : 'ยกเลิกไม่สำเร็จ กรุณาลองใหม่' } }
}
