'use server'

import { revalidatePath } from 'next/cache'
import { getCurrentUser } from '@/lib/auth/current-user'
import { prisma } from '@/lib/prisma'
import { assertAccountingDateOpen } from '@/lib/monthly-accounting'
import { assertUniqueLedgerProof, slipDigest } from '@/lib/ledger-proof'
import { readRepaymentSlip } from '@/lib/repayment-slip'
import { ledgerAmount, validLedgerDate } from '@/lib/ledger'

async function operator(write = false) {
  const user = await getCurrentUser()
  if (!user || user.status !== 'ACTIVE' || write && user.role === 'REVIEWER') throw new Error('ไม่มีสิทธิ์จัดการส่วนแบ่งผู้แนะนำ')
  return user
}

export async function getPersuaderShares() {
  await operator()
  const [events, payments, channels] = await Promise.all([
    prisma.persuaderShareEvent.findMany({ include: {
      contract: { select: { id: true, borrowerName: true, principalSatang: true, interestSatang: true, persuaderNameSnapshot: true, persuaderShareBasisPoints: true, persuaderShareSatang: true, persuaderShareBase: true } },
      persuader: { select: { id: true, name: true, phone: true, bankCode: true, bankAccount: true, bankAccountName: true } },
      ledgerEntry: { select: { occurredOn: true, voidedAt: true } },
    }, orderBy: { id: 'asc' } }),
    prisma.persuaderSharePayment.findMany({ include: {
      contract: { select: { id: true } }, ledgerEntry: { select: { occurredOn: true, amountSatang: true, channelName: true, reference: true, note: true, voidedAt: true } },
    }, orderBy: { id: 'desc' } }),
    prisma.paymentChannel.findMany({ where: { isActive: true }, select: { code: true, nameTh: true }, orderBy: { code: 'asc' } }),
  ])
  const byContract = new Map<number, {
    contractId: number; borrowerName: string; persuaderId: number; persuaderName: string; phone: string;
    bankCode: string; bankAccount: string; bankAccountName: string; principalSatang: number;
    interestSatang: number; shareBasisPoints: number; shareSatang: number; accruedSatang: number;
    paidSatang: number; dueSatang: number; lastActivity: string; payments: { id: number; occurredOn: string; amountSatang: number; channelName: string; reference: string; note: string; voidedAt: string | null }[]
  }>()
  for (const event of events) {
    const row = byContract.get(event.contractId) ?? {
      contractId: event.contractId, borrowerName: event.contract.borrowerName, persuaderId: event.persuaderId,
      persuaderName: event.contract.persuaderNameSnapshot ?? event.persuader.name, phone: event.persuader.phone,
      bankCode: event.persuader.bankCode, bankAccount: event.persuader.bankAccount, bankAccountName: event.persuader.bankAccountName,
      principalSatang: event.contract.principalSatang, interestSatang: event.contract.interestSatang,
      shareBasisPoints: event.contract.persuaderShareBasisPoints ?? 0, shareSatang: event.contract.persuaderShareSatang ?? 0,
      accruedSatang: 0, paidSatang: 0, dueSatang: 0, lastActivity: event.ledgerEntry.occurredOn, payments: [],
    }
    row.accruedSatang += event.amountSatang
    if (event.ledgerEntry.occurredOn > row.lastActivity) row.lastActivity = event.ledgerEntry.occurredOn
    byContract.set(event.contractId, row)
  }
  for (const payment of payments) {
    const event = events.find(item => item.contractId === payment.contractId)
    if (!event) continue
    const row = byContract.get(payment.contractId)!
    if (!payment.ledgerEntry.voidedAt) row.paidSatang += payment.amountSatang
    row.payments.push({ id: payment.id, occurredOn: payment.ledgerEntry.occurredOn, amountSatang: payment.amountSatang, channelName: payment.ledgerEntry.channelName, reference: payment.ledgerEntry.reference, note: payment.ledgerEntry.note, voidedAt: payment.ledgerEntry.voidedAt?.toISOString() ?? null })
    if (payment.ledgerEntry.occurredOn > row.lastActivity) row.lastActivity = payment.ledgerEntry.occurredOn
  }
  for (const row of byContract.values()) row.dueSatang = row.accruedSatang - row.paidSatang
  return {
    rows: [...byContract.values()].sort((a, b) => b.lastActivity.localeCompare(a.lastActivity) || b.contractId - a.contractId),
    channels,
  }
}

export async function payPersuaderShare(input: { requestKey: string; contractId: number; amount: string; occurredOn: string; channelCode: string; reference: string; note: string }, file?: File | null) {
  try {
    const user = await operator(true)
    if (!input || !/^[a-f0-9-]{36}$/i.test(input.requestKey) || !Number.isSafeInteger(input.contractId) || input.contractId <= 0) throw new Error('ข้อมูลรายการจ่ายไม่ถูกต้อง')
    const amountSatang = ledgerAmount(input.amount)
    if (!validLedgerDate(input.occurredOn)) throw new Error('วันที่จ่ายไม่ถูกต้อง')
    if (typeof input.reference !== 'string' || input.reference.length > 150 || typeof input.note !== 'string' || input.note.length > 1000) throw new Error('เลขอ้างอิงหรือหมายเหตุยาวเกินกำหนด')
    const slip = await readRepaymentSlip(file ?? null)
    await prisma.$transaction(async tx => {
      const previous = await tx.ledgerEntry.findUnique({ where: { requestKey: input.requestKey }, include: { persuaderSharePayment: true, slip: true } })
      if (previous) {
        const sameFile = slip ? Boolean(previous.slip && previous.slip.mimeType === slip.mimeType && Buffer.from(previous.slip.fileData).equals(Buffer.from(slip.fileData))) : !previous.slip
        if (previous.createdBy !== user.id || previous.kind !== 'GENERAL' || previous.categoryCode !== 'PERSUADER_SHARE_PAYMENT' || previous.voidedAt || previous.persuaderSharePayment?.contractId !== input.contractId || previous.amountSatang !== amountSatang || previous.occurredOn !== input.occurredOn || previous.channelCode !== input.channelCode || previous.reference !== input.reference.trim() || previous.note !== input.note.trim() || !sameFile) throw new Error('รหัสคำขอนี้ถูกใช้กับข้อมูลอื่นแล้ว กรุณาโหลดรายการใหม่')
        return
      }
      await assertAccountingDateOpen(tx, input.occurredOn)
      await assertUniqueLedgerProof(tx, { reference: input.reference, channelCode: input.channelCode, slipHash: slip ? slipDigest(slip.fileData) : null })
      const [contract, category, channel, events, payments] = await Promise.all([
        tx.loanContract.findUnique({ where: { id: input.contractId }, select: { id: true, persuaderId: true, persuaderShareSatang: true, persuaderNameSnapshot: true } }),
        tx.financialCategory.findUnique({ where: { code: 'PERSUADER_SHARE_PAYMENT' } }),
        tx.paymentChannel.findUnique({ where: { code: input.channelCode } }),
        tx.persuaderShareEvent.findMany({ where: { contractId: input.contractId }, select: { amountSatang: true } }),
        tx.persuaderSharePayment.findMany({ where: { contractId: input.contractId, ledgerEntry: { is: { voidedAt: null } } }, select: { amountSatang: true } }),
      ])
      if (!contract?.persuaderId || !contract.persuaderShareSatang || contract.persuaderShareSatang <= 0) throw new Error('สัญญานี้ไม่มีส่วนแบ่งผู้แนะนำ')
      if (!category?.isActive || category.direction !== 'OUT' || category.group === 'LOAN') throw new Error('หมวดจ่ายส่วนแบ่งผู้แนะนำยังไม่พร้อมใช้งาน')
      if (!channel?.isActive) throw new Error('กรุณาเลือกช่องทางจ่ายที่ใช้งานได้')
      const entitled = events.reduce((sum, event) => sum + event.amountSatang, 0)
      const paid = payments.reduce((sum, payment) => sum + payment.amountSatang, 0)
      const due = entitled - paid
      if (due <= 0) throw new Error(due < 0 ? 'มีส่วนแบ่งที่ต้องปรับปรุงหรือเรียกคืนก่อน จึงยังจ่ายเพิ่มไม่ได้' : 'ยังไม่เกิดสิทธิ์จ่าย ต้องให้ผู้กู้ชำระครบสัญญาก่อน')
      if (amountSatang > due) throw new Error('ยอดจ่ายเกินส่วนแบ่งค้างจ่าย')
      const ledgerEntry = await tx.ledgerEntry.create({ data: {
        accountScope: 'LENDING', requestKey: input.requestKey, slipHash: slip ? slipDigest(slip.fileData) : null, kind: 'GENERAL', contractId: null,
        direction: 'OUT', categoryCode: category.code, categoryName: category.nameTh, amountSatang,
        occurredOn: input.occurredOn, channelCode: channel.code, channelName: channel.nameTh,
        reference: input.reference.trim(), note: input.note.trim(),
        createdBy: user.id,
        ...(slip ? { slip: { create: slip } } : {}),
      } })
      await tx.persuaderSharePayment.create({ data: { contractId: contract.id, persuaderId: contract.persuaderId, ledgerEntryId: ledgerEntry.id, amountSatang } })
    })
    revalidatePath('/dashboard/persuaders/shares'); revalidatePath('/dashboard/ledger'); revalidatePath('/dashboard/accounting')
    return { success: true }
  } catch (error) {
    return { error: error instanceof Error && !error.name.startsWith('Prisma') ? error.message : 'บันทึกการจ่ายส่วนแบ่งไม่สำเร็จ กรุณาลองอีกครั้ง' }
  }
}
