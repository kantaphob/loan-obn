'use server'

import { assertAccountingDateOpen } from '@/lib/monthly-accounting'
import { assertBankLoanLedgerUnlinked } from '@/lib/bank-loan-ledger'

import { loadPendingContractReview, assertReviewToken } from '@/lib/pending-contract-review'

import { assertUniqueLedgerProof, slipDigest } from '@/lib/ledger-proof'

import { slipFileName } from '@/lib/slip-name'
import { readRepaymentSlip } from '@/lib/repayment-slip'
import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/lib/auth/current-user'
import { contractLedgerBalance, ledgerAmount, validLedgerDate, type LedgerInput } from '@/lib/ledger'
import { contractSignaturesComplete } from '@/lib/contracts'
import { syncGoogleContract, syncGoogleLedger } from '@/lib/google-sync'
import { publishCreditBureauChanged } from '@/lib/realtime'

async function operator(write = false) {
  const user = await getCurrentUser()
  if (!user || user.status !== 'ACTIVE' || (write && user.role === 'REVIEWER')) throw new Error('ไม่มีสิทธิ์ทำรายการนี้')
  return user
}
export async function getLedger() {
  const user = await operator()
  const [entryCount, contracts, categories, channels] = await Promise.all([
    prisma.ledgerEntry.count(),
    prisma.loanContract.findMany({ select: { id: true, borrowerName: true, lenderName: true, principalSatang: true, interestSatang: true, netSatang: true, repaymentSatang: true, interestMethod: true, status: true, paidAt: true, repaymentDueDate: true, legacyReceivedSatang: true, legacySourceCode: true, penaltyMaxDays: true }, orderBy: { id: 'desc' } }),
    prisma.financialCategory.findMany({ where: { isActive: true, NOT: { code: { startsWith: 'Y2025_' } } }, orderBy: { sortOrder: 'asc' } }),
    prisma.paymentChannel.findMany({ where: { isActive: true }, orderBy: { code: 'asc' } }),
  ])
  // Keep nested relation reads below SQLite's bind-parameter limit on large ledgers.
  const batchSize = 400
  const entryPages = await Promise.all(Array.from({ length: Math.ceil(entryCount / batchSize) }, (_, page) =>
    prisma.ledgerEntry.findMany({
      orderBy: [{ occurredOn: 'desc' }, { id: 'desc' }],
      skip: page * batchSize,
      take: batchSize,
      include: {
        slip: { select: { originalName: true, mimeType: true } },
        contract: { select: { borrowerName: true, interestMethod: true, principalSatang: true, interestSatang: true, netSatang: true, repaymentSatang: true } },
        revisions: { orderBy: { id: 'desc' } },
        landDevelopmentCosts: {
          select: {
            development: {
              select: {
                name: true, treatment: true,
                land: { select: { asset: { select: { code: true, name: true } } } },
              },
            },
          },
        },
      },
    }),
  ))
  const entries = entryPages.flat()
  return {
    canWrite: user.role !== 'REVIEWER', categories, channels,
    entries: entries.map(e => ({ ...e, slip: e.slip ? { ...e.slip, displayName: slipFileName({ ...e, legacySourceCode: contracts.find(c => c.id === e.contractId)?.legacySourceCode }, e.slip.mimeType) } : null, revisions: e.revisions.map(r => ({ ...r, createdAt: r.createdAt.toISOString() })), createdAt: e.createdAt.toISOString(), voidedAt: e.voidedAt?.toISOString() ?? null })),
    contracts: contracts.map(c => ({ ...c, paidAt: c.paidAt?.toISOString() ?? null, ...contractLedgerBalance(c, entries.filter(e => e.contractId === c.id && !e.voidedAt)) })),
  }
}
export async function getHistoricalLedger() {
  await operator()
  return prisma.historicalCashEntry.findMany({
    where: { accountCode: 'DAILY_2025' },
    include: { category: { select: { nameTh: true } }, channel: { select: { nameTh: true } } },
    orderBy: [{ occurredOn: 'desc' }, { sourceRow: 'desc' }],
  })
}
export async function saveLedger(input: LedgerInput, file?: File | null) {
  try {
    const user = await operator(true)
    if (!input || !/^[a-f0-9-]{36}$/i.test(input.requestKey) || !['GENERAL', 'DISBURSEMENT', 'REPAYMENT'].includes(input.kind)) throw new Error('ข้อมูลรายการไม่ถูกต้อง')
    const amountSatang = ledgerAmount(input.amount)
    if (!validLedgerDate(input.occurredOn)) throw new Error('วันที่ทำรายการไม่ถูกต้อง หรือเป็นวันที่ในอนาคต')
    if (typeof input.reference !== 'string' || input.reference.length > 150 || typeof input.note !== 'string' || input.note.length > 1000) throw new Error('เลขอ้างอิงหรือหมายเหตุยาวเกินกำหนด')
    const slip = await readRepaymentSlip(file)
    if (slip && !['REPAYMENT', 'DISBURSEMENT'].includes(input.kind)) throw new Error('แนบสลิปได้เฉพาะรายการจ่ายเงินกู้หรือรับชำระ')
    await prisma.$transaction(async tx => {
      const previous = await tx.ledgerEntry.findUnique({ where: { requestKey: input.requestKey }, include: { slip: true } })
      if (previous) {
        if (previous.createdBy !== user.id) throw new Error('คำขอนี้ถูกใช้แล้ว')
        const same = !previous.voidedAt && previous.kind === input.kind && previous.contractId === input.contractId
          && previous.amountSatang === amountSatang && previous.occurredOn === input.occurredOn
          && previous.channelCode === input.channelCode && previous.reference === input.reference.trim() && previous.note === input.note.trim()
          && (input.kind !== 'GENERAL' || previous.direction === input.direction && previous.categoryCode === input.categoryCode)
          && previous.penaltyWaiverReason === (input.waivePenalty ? input.penaltyWaiverReason?.trim() : '')
          && previous.settlementWaiverReason === (input.settleRemaining ? input.settlementWaiverReason?.trim() : '')
          && (slip ? Boolean(previous.slip && previous.slip.mimeType === slip.mimeType && Buffer.from(previous.slip.fileData).equals(Buffer.from(slip.fileData))) : !previous.slip)
        if (!same) throw new Error('รหัสคำขอนี้บันทึกด้วยข้อมูลอื่นแล้ว กรุณาโหลดรายการล่าสุดก่อนทำรายการใหม่')
        return
      }
      await assertAccountingDateOpen(tx, input.occurredOn)
      await assertUniqueLedgerProof(tx, { reference: input.reference, channelCode: input.channelCode, slipHash: slip ? slipDigest(slip.fileData) : null })
      const channel = await tx.paymentChannel.findUnique({ where: { code: input.channelCode } })
      if (!channel?.isActive) throw new Error('กรุณาเลือกช่องทางชำระเงินที่ใช้งานได้')
      let penaltyWaivedSatang = 0, penaltyWaiverReason = '', settlementWaivedSatang = 0, settlementWaiverReason = ''
      let direction = input.direction, categoryCode = input.categoryCode, categoryName = '', contractId: number | null = null
      if (input.kind === 'GENERAL') {
        if (input.contractId !== null) throw new Error('รายการทั่วไปไม่สามารถผูกสัญญาได้')
        const category = await tx.financialCategory.findUnique({ where: { code: categoryCode } })
        if (!category?.isActive || !['IN', 'OUT'].includes(direction) || category.direction !== direction || category.group === 'LOAN' || ['INTEREST_RECEIVED', 'TRADE_RECEIVABLE_PAYMENT'].includes(category.code)) throw new Error('กรุณาเลือกหมวดรับ–จ่ายทั่วไปให้ตรงประเภทรายการ')
        categoryName = category.nameTh
      } else {
        if (!Number.isSafeInteger(input.contractId) || !input.contractId || input.contractId < 1) throw new Error('กรุณาเลือกสัญญา')
        const contract = await tx.loanContract.findUnique({ where: { id: input.contractId }, include: { witnesses: true, documentSignatures: { select: { documentStage: true, signer: true, signedAt: true } }, ledgerEntries: { where: { voidedAt: null } } } })
        if (!contract) throw new Error('ไม่พบสัญญา')
        const balance = contractLedgerBalance(contract, contract.ledgerEntries, input.occurredOn)
        contractId = contract.id
        if (input.kind === 'DISBURSEMENT') {
          if (input.contractReviewToken !== undefined) {
            const review = await loadPendingContractReview(tx, contract.id)
            assertReviewToken(review.data.reviewToken, input.contractReviewToken)
          }
          if (balance.disbursed || contract.status !== 'WAITING_PAYMENT') throw new Error('สัญญานี้จ่ายเงินแล้วหรือไม่อยู่ในสถานะรอจ่าย')
          if (contract.limitApprovalRequired) throw new Error('รายการจองนี้เกินวงเงิน ต้องได้รับอนุมัติก่อนจ่ายเงินจริง')
          if (contract.signingMethod === 'E_SIGNATURE' && !contractSignaturesComplete(contract)) throw new Error('กรุณาลงนามอิเล็กทรอนิกส์ให้ครบก่อนจ่ายเงิน')
          if (amountSatang !== contract.netSatang) throw new Error('ยอดจ่ายต้องเท่ากับยอดสุทธิตามสัญญา')
          direction = 'OUT'; categoryCode = 'LOAN_DISBURSEMENT'; categoryName = ''
          await tx.loanContract.update({ where: { id: contract.id }, data: { status: 'PAID', paidAt: new Date(`${input.occurredOn}T00:00:00+07:00`) } })
        } else {
          if (!balance.disbursed) throw new Error('ต้องจ่ายเงินกู้ก่อนรับชำระคืน')
          const firstDate = balance.disbursementOn ?? contract.paidAt?.toLocaleDateString('en-CA', { timeZone: 'Asia/Bangkok' })
          if (firstDate && input.occurredOn < firstDate) throw new Error('วันรับชำระต้องไม่ก่อนวันจ่ายเงินกู้')
          if (input.waivePenalty) {
            if (typeof input.penaltyWaiverReason !== 'string' || !input.penaltyWaiverReason.trim() || input.penaltyWaiverReason.length > 500) throw new Error('กรุณาระบุเหตุผลยกเว้นค่าปรับไม่เกิน 500 ตัวอักษร')
            penaltyWaivedSatang = balance.penaltyRemaining
            penaltyWaiverReason = input.penaltyWaiverReason.trim()
          }
          const remaining = balance.remaining - penaltyWaivedSatang
          if (amountSatang > remaining) throw new Error('ยอดรับชำระเกินยอดคงค้าง ณ วันที่รับเงิน')
          if (input.settleRemaining) {
            if (typeof input.settlementWaiverReason !== 'string' || !input.settlementWaiverReason.trim() || input.settlementWaiverReason.length > 500) throw new Error('กรุณาระบุเหตุผลยกเว้นส่วนต่างไม่เกิน 500 ตัวอักษร')
            if (amountSatang < balance.penaltyRemaining - penaltyWaivedSatang) throw new Error('กรุณารับชำระหรือยกเว้นค่าปรับให้ครบก่อนปิดสัญญา')
            settlementWaivedSatang = remaining - amountSatang
            settlementWaiverReason = input.settlementWaiverReason.trim()
          }
          const after = contractLedgerBalance(contract, [...contract.ledgerEntries, { kind: 'REPAYMENT', occurredOn: input.occurredOn, amountSatang, penaltyWaivedSatang, settlementWaivedSatang }])
          if (after.invalid) throw new Error('วันที่หรือยอดรับชำระกระทบรายการที่บันทึกไว้แล้ว กรุณาตรวจสอบประวัติ')
          direction = 'IN'; categoryCode = 'CONTRACT_REPAYMENT'; categoryName = ''
          await tx.loanContract.update({ where: { id: contract.id }, data: { status: after.remaining === 0 ? 'CLOSED' : 'PAID' } })
        }
      }
      if (input.kind !== 'GENERAL') {
        const category = await tx.financialCategory.findUnique({ where: { code: categoryCode } })
        if (!category?.isActive || category.direction !== direction || category.group !== 'LOAN') throw new Error('หมวดบัญชีตามสัญญาไม่พร้อมใช้งาน กรุณาตรวจสอบ Masterdata')
        categoryName = category.nameTh
      }
      await tx.ledgerEntry.create({ data: { requestKey: input.requestKey, slipHash: slip ? slipDigest(slip.fileData) : null, kind: input.kind, contractId, direction, categoryCode, categoryName, amountSatang, occurredOn: input.occurredOn, channelCode: channel.code, channelName: channel.nameTh, reference: input.reference.trim(), note: input.note.trim(), createdBy: user.id, settlementWaivedSatang, settlementWaiverReason, penaltyAssessed: input.kind === 'REPAYMENT', penaltyWaivedSatang, penaltyWaiverReason, ...(slip ? { slip: { create: slip } } : {}) } })
    })
    const saved = await prisma.ledgerEntry.findUnique({ where: { requestKey: input.requestKey }, select: { id: true, contractId: true } })
    if (saved) {
      await syncGoogleLedger(saved.id)
      if (saved.contractId) {
        await syncGoogleContract(saved.contractId)
        publishCreditBureauChanged()
      }
    }
    revalidatePath('/dashboard/invoice'); revalidatePath('/dashboard/ap'); revalidatePath('/dashboard/repayments'); revalidatePath('/dashboard/receivables'); revalidatePath('/dashboard/ledger'); revalidatePath('/dashboard/contracts')
    return { success: true }
  } catch (error) {
    return { error: error instanceof Error && 'code' in error && error.code === 'P2002' ? 'หลักฐานหรือเลขอ้างอิงซ้ำกับรายการที่บันทึกแล้ว' : error instanceof Error && !error.name.startsWith('Prisma') ? error.message : 'บันทึกไม่สำเร็จ กรุณาลองอีกครั้ง' }
  }
}
export async function voidLedger(id: number, reason: string) {
  try {
    const user = await operator(true)
    if (!Number.isSafeInteger(id) || typeof reason !== 'string' || !reason.trim() || reason.length > 500) throw new Error('กรุณาระบุเหตุผลยกเลิกไม่เกิน 500 ตัวอักษร')
    await prisma.$transaction(async tx => {
      const entry = await tx.ledgerEntry.findUnique({ where: { id } })
      if (!entry || entry.voidedAt) throw new Error('ไม่พบรายการ หรือรายการถูกยกเลิกแล้ว')
      await assertBankLoanLedgerUnlinked(tx, entry.id)
      await assertAccountingDateOpen(tx, entry.occurredOn)
      if (entry.contractId) {
        const others = await tx.ledgerEntry.findMany({ where: { contractId: entry.contractId, voidedAt: null, id: { not: id } } })
        if (entry.kind === 'DISBURSEMENT' && others.some(e => e.kind === 'REPAYMENT')) throw new Error('ต้องยกเลิกรายการรับชำระคืนทั้งหมดก่อนยกเลิกจ่ายเงินกู้')
        const contract = await tx.loanContract.findUniqueOrThrow({ where: { id: entry.contractId } })
        if (entry.kind === 'REPAYMENT' && contractLedgerBalance(contract, others).invalid) throw new Error('กรุณายกเลิกรายการรับชำระที่เกี่ยวข้องภายหลังก่อน')
        await tx.loanContract.update({ where: { id: entry.contractId }, data: entry.kind === 'DISBURSEMENT' ? { status: 'WAITING_PAYMENT', paidAt: null } : { status: 'PAID' } })
      }
      await tx.ledgerEntry.update({ where: { id }, data: { voidedAt: new Date(), voidedBy: user.id, voidReason: reason.trim() } })
    })
    const saved = await prisma.ledgerEntry.findUnique({ where: { id }, select: { contractId: true } })
    await syncGoogleLedger(id)
    if (saved?.contractId) {
      await syncGoogleContract(saved.contractId)
      publishCreditBureauChanged()
    }
    revalidatePath('/dashboard/invoice'); revalidatePath('/dashboard/ap'); revalidatePath('/dashboard/repayments'); revalidatePath('/dashboard/receivables'); revalidatePath('/dashboard/ledger'); revalidatePath('/dashboard/contracts')
    return { success: true }
  } catch (error) { return { error: error instanceof Error && 'code' in error && error.code === 'P2002' ? 'หลักฐานหรือเลขอ้างอิงซ้ำกับรายการที่บันทึกแล้ว' : error instanceof Error && !error.name.startsWith('Prisma') ? error.message : 'ยกเลิกไม่สำเร็จ กรุณาลองใหม่' } }
}

export async function editLedger(input: {
  id: number; expectedRevision: number; amount: string; occurredOn: string;
  direction: string; categoryCode: string; channelCode: string; reference: string; note: string; reason: string;
}) {
  try {
    const user = await operator(true)
    if (!input || !Number.isSafeInteger(input.id) || !Number.isSafeInteger(input.expectedRevision)) throw new Error('ข้อมูลรายการไม่ถูกต้อง')
    const amountSatang = ledgerAmount(input.amount)
    if (!validLedgerDate(input.occurredOn)) throw new Error('วันที่ไม่ถูกต้องหรือเป็นวันในอนาคต')
    if (typeof input.reason !== 'string' || !input.reason.trim() || input.reason.length > 500) throw new Error('กรุณาระบุเหตุผลแก้ไขไม่เกิน 500 ตัวอักษร')
    if (typeof input.reference !== 'string' || input.reference.length > 150 || typeof input.note !== 'string' || input.note.length > 1000) throw new Error('เลขอ้างอิงหรือหมายเหตุยาวเกินกำหนด')
    await prisma.$transaction(async tx => {
      const entry = await tx.ledgerEntry.findUnique({ where: { id: input.id }, include: { _count: { select: { revisions: true } } } })
      if (!entry || entry.voidedAt) throw new Error('ไม่พบรายการ หรือรายการถูกยกเลิกแล้ว')
      await assertBankLoanLedgerUnlinked(tx, entry.id)
      await assertAccountingDateOpen(tx, entry.occurredOn, input.occurredOn)
      if (entry._count.revisions !== input.expectedRevision) throw new Error('รายการถูกแก้ไขโดยคำขออื่นแล้ว กรุณาโหลดข้อมูลใหม่')
      await assertUniqueLedgerProof(tx, { reference: input.reference, channelCode: input.channelCode, excludeId: input.id })
      const channel = await tx.paymentChannel.findUnique({ where: { code: input.channelCode } })
      if (!channel?.isActive) throw new Error('กรุณาเลือกช่องทางที่เปิดใช้งาน')
      let direction = entry.direction, categoryCode = entry.categoryCode, categoryName = entry.categoryName
      if (entry.receivableId) {
        const receivable = await tx.tradeReceivable.findUniqueOrThrow({ where: { id: entry.receivableId }, include: { payments: { where: { voidedAt: null, id: { not: entry.id } } } } })
        const remaining = receivable.amountSatang - receivable.payments.reduce((sum, payment) => sum + payment.amountSatang, 0)
        if (input.direction !== 'IN' || input.categoryCode !== 'TRADE_RECEIVABLE_PAYMENT' || input.occurredOn < receivable.occurredOn || amountSatang > remaining) throw new Error('รายการนี้ผูกกับลูกหนี้ค้างรับ ต้องเป็นเงินรับและไม่เกินยอดค้าง หากข้อมูลผิดให้ยกเลิกรายการแล้วบันทึกใหม่')
        const category = await tx.financialCategory.findUnique({ where: { code: 'TRADE_RECEIVABLE_PAYMENT' } })
        if (!category?.isActive) throw new Error('หมวดรับชำระลูกหนี้ค้างรับยังไม่พร้อมใช้งาน')
        direction = 'IN'; categoryCode = category.code; categoryName = category.nameTh
      } else if (!entry.contractId && !entry.payableId) {
        if (entry.kind !== 'GENERAL') throw new Error('รายการประเภทนี้ยังไม่รองรับการแก้ไข')
        const category = await tx.financialCategory.findUnique({ where: { code: input.categoryCode } })
        if (!category?.isActive || !['IN', 'OUT'].includes(input.direction) || category.direction !== input.direction || category.group === 'LOAN' || ['INTEREST_RECEIVED', 'TRADE_RECEIVABLE_PAYMENT'].includes(category.code)) throw new Error('กรุณาเลือกหมวดรับ–จ่ายทั่วไปให้ถูกต้อง')
        direction = input.direction; categoryCode = category.code; categoryName = category.nameTh
      } else if (input.direction !== entry.direction || input.categoryCode !== entry.categoryCode) throw new Error('รายการผูกสัญญาหรือบิลต้องใช้ประเภทและหมวดเดิม หากผูกผิดให้ยกเลิกแล้วบันทึกใหม่')
      if (entry.payableId) {
        const payable = await tx.tradePayable.findUniqueOrThrow({ where: { id: entry.payableId } })
        if (amountSatang !== payable.amountSatang || input.occurredOn < payable.invoiceDate) throw new Error('ยอดจ่ายต้องตรงกับบิล และวันที่ต้องไม่ก่อนใบแจ้งหนี้')
      }
      if (entry.contractId) {
        const contract = await tx.loanContract.findUniqueOrThrow({ where: { id: entry.contractId }, include: { ledgerEntries: { where: { voidedAt: null } } } })
        if (entry.kind === 'DISBURSEMENT') {
          if (amountSatang !== contract.netSatang) throw new Error('ยอดจ่ายต้องตรงกับยอดสุทธิตามสัญญา')
          if (contract.ledgerEntries.some(e => e.kind === 'REPAYMENT' && e.occurredOn < input.occurredOn)) throw new Error('วันจ่ายเงินกู้ต้องไม่หลังวันที่รับชำระคืน')
          await tx.loanContract.update({ where: { id: contract.id }, data: { paidAt: new Date(`${input.occurredOn}T00:00:00+07:00`) } })
        } else if (entry.kind === 'REPAYMENT') {
          const balance = contractLedgerBalance(contract, contract.ledgerEntries.filter(e => e.id !== entry.id), input.occurredOn)
          const firstDate = balance.disbursementOn ?? contract.paidAt?.toLocaleDateString('en-CA', { timeZone: 'Asia/Bangkok' })
          if (!balance.disbursed || firstDate && input.occurredOn < firstDate) throw new Error('วันรับชำระต้องไม่ก่อนวันจ่ายเงินกู้')
          const after = contractLedgerBalance(contract, contract.ledgerEntries.map(e => e.id === entry.id ? { ...e, amountSatang, occurredOn: input.occurredOn } : e))
          if (after.invalid) throw new Error('ยอดหรือวันที่แก้ไขทำให้ยอดชำระหรือยกเว้นค่าปรับไม่ถูกต้อง กรุณายกเลิกแล้วบันทึกใหม่')
          await tx.loanContract.update({ where: { id: contract.id }, data: { status: after.remaining === 0 ? 'CLOSED' : 'PAID' } })
        } else throw new Error('รายการสัญญาประเภทนี้ยังไม่รองรับการแก้ไข')
      }
      const before = { principalReceivedSatang: entry.principalReceivedSatang, interestReceivedSatang: entry.interestReceivedSatang, penaltyReceivedSatang: entry.penaltyReceivedSatang, amountSatang: entry.amountSatang, occurredOn: entry.occurredOn, direction: entry.direction, categoryCode: entry.categoryCode, categoryName: entry.categoryName, channelCode: entry.channelCode, channelName: entry.channelName, reference: entry.reference, note: entry.note }
      const financialDateOrAmountChanged = amountSatang !== entry.amountSatang || input.occurredOn !== entry.occurredOn
      const after = { principalReceivedSatang: financialDateOrAmountChanged ? null : entry.principalReceivedSatang, interestReceivedSatang: financialDateOrAmountChanged ? null : entry.interestReceivedSatang, penaltyReceivedSatang: financialDateOrAmountChanged ? null : entry.penaltyReceivedSatang, amountSatang, occurredOn: input.occurredOn, direction, categoryCode, categoryName, channelCode: channel.code, channelName: channel.nameTh, reference: input.reference.trim(), note: input.note.trim() }
      if (JSON.stringify(before) === JSON.stringify(after)) throw new Error('ยังไม่มีข้อมูลเปลี่ยนแปลง')
      await tx.ledgerEntry.update({ where: { id: entry.id }, data: after })
      await tx.ledgerRevision.create({ data: { entryId: entry.id, beforeJson: JSON.stringify(before), afterJson: JSON.stringify(after), reason: input.reason.trim(), createdBy: user.id } })
    })
    const saved = await prisma.ledgerEntry.findUnique({ where: { id: input.id }, select: { contractId: true } })
    await syncGoogleLedger(input.id)
    if (saved?.contractId) {
      await syncGoogleContract(saved.contractId)
      publishCreditBureauChanged()
    }
    for (const path of ['/dashboard/ledger', '/dashboard/repayments', '/dashboard/receivables', '/dashboard/contracts', '/dashboard/ap']) revalidatePath(path)
    return { success: true }
  } catch (error) { return { error: error instanceof Error && 'code' in error && error.code === 'P2002' ? 'หลักฐานหรือเลขอ้างอิงซ้ำกับรายการที่บันทึกแล้ว' : error instanceof Error && !error.name.startsWith('Prisma') ? error.message : 'แก้ไขไม่สำเร็จ กรุณาลองใหม่' } }
}
