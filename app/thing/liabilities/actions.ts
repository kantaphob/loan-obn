'use server'

import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/lib/auth/current-user'
import { ledgerAmount, validLedgerDate } from '@/lib/ledger'
import { assertAccountingDateOpen } from '@/lib/monthly-accounting'
import { assertUniqueLedgerProof } from '@/lib/ledger-proof'
import { syncGoogleLedger } from '@/lib/google-sync'
import { migrateAssetData, contractPaymentStages, type Payment } from '@/app/thing/_shared/model'
import { validateAssetData } from '@/app/thing/_shared/validation'
import { assetLedgerIds, validateHistory, validateLedgerLinks } from '@/app/thing/_shared/integrity'

export type BankLoanCashInput = {
  requestKey: string; loanId: string; revision: number; direction: 'IN' | 'OUT'
  date: string; amount: string; channelCode: string; reference: string; notes: string
  drawNumber?: number
  drawType?: 'land' | 'house'
  contractorPayment?: { contractId: string; stageId: string }
  payment?: Pick<Payment, 'roundId' | 'principal' | 'interest' | 'fee' | 'penalty' | 'extraPrincipal' | 'bankInstallment'>
}

export async function recordBankLoanCash(input: BankLoanCashInput) {
  try {
    const user = await getCurrentUser()
    if (!user || user.status !== 'ACTIVE' || user.role === 'REVIEWER') throw new Error('ไม่มีสิทธิ์ทำรายการนี้')
    if (!input || !/^[a-f0-9-]{36}$/i.test(input.requestKey) || typeof input.loanId !== 'string' || !Number.isSafeInteger(input.revision) || !['IN', 'OUT'].includes(input.direction)) throw new Error('ข้อมูลรายการไม่ถูกต้อง')
    const amountSatang = ledgerAmount(input.amount)
    if (!validLedgerDate(input.date)) throw new Error('วันที่รับหรือจ่ายไม่ถูกต้อง หรือเป็นวันที่ในอนาคต')
    if (typeof input.reference !== 'string' || input.reference.length > 150 || typeof input.notes !== 'string' || input.notes.length > 1000) throw new Error('เลขอ้างอิงหรือหมายเหตุยาวเกินกำหนด')
    if (input.direction === 'OUT' && Boolean(input.payment) === Boolean(input.contractorPayment) || input.direction === 'IN' && (input.payment || input.contractorPayment)) throw new Error('ระบุรายละเอียดการรับหรือจ่ายให้ถูกต้อง')
    if (input.drawNumber !== undefined && (input.direction !== 'IN' || !Number.isSafeInteger(input.drawNumber) || input.drawNumber < 1 || input.drawNumber > 10000)) throw new Error('เลขงวดรับไม่ถูกต้อง')
    if (input.drawType !== undefined && (input.direction !== 'IN' || !['land', 'house'].includes(input.drawType))) throw new Error('ประเภทรับเงินกู้ไม่ถูกต้อง')
    const result = await prisma.$transaction(async tx => {
      const state = await tx.assetWorkspaceState.findUniqueOrThrow({ where: { operatorId: user.id } })
      const current = migrateAssetData(JSON.parse(state.payload))
      const loan = current.loans.find(row => row.id === input.loanId)
      if (!loan) throw new Error('ไม่พบสัญญาเงินกู้')
      const contractor = input.contractorPayment ? loan.contractorContracts?.find(row => row.id === input.contractorPayment!.contractId) : undefined
      const stage = contractor && contractPaymentStages(contractor, input.date).find(row => row.id === input.contractorPayment?.stageId)
      if (input.contractorPayment && (!contractor || !stage)) throw new Error('กรุณาเลือกสัญญาจ้างเหมาและงวดงานที่มีอยู่')
      const categoryCode = input.direction === 'IN' ? input.drawType === 'land' ? 'BANK_LOAN_LAND_RECEIVED' : input.drawType === 'house' ? 'BANK_LOAN_HOUSE_RECEIVED' : 'BANK_LOAN_RECEIVED' : contractor?.kind === 'land_purchase' ? 'LAND_PURCHASE_PAYMENT' : contractor ? 'CONTRACTOR_PROGRESS_PAYMENT' : 'BANK_LOAN_PAYMENT'
      const categoryName = input.direction === 'IN' ? `รับเงินกู้ธนาคาร${input.drawType === 'land' ? ' - ที่ดิน' : input.drawType === 'house' ? ' - บ้าน' : ''}` : contractor?.kind === 'land_purchase' ? 'จ่ายค่าซื้อที่ดิน' : contractor ? 'จ่ายค่างวดงานผู้รับเหมา' : 'จ่ายชำระหนี้ธนาคาร'
      const categoryGroup = contractor ? 'ASSET' : 'LIABILITY'
      const note = `${categoryName}${contractor && stage ? ` · ${contractor.code} · ${contractor.contractor} · ${contractor.kind === 'land_purchase' ? 'งวดชำระ' : 'งวดงาน'} ${stage.number} ${stage.name}` : ''}${input.drawNumber !== undefined ? ` งวดที่ ${input.drawNumber}` : ''} · ${loan.name} · ${loan.bank} · สัญญา ${loan.accountNumber || 'ไม่ระบุ'}${input.notes.trim() ? ` · ${input.notes.trim()}` : ''}`
      const previous = await tx.ledgerEntry.findUnique({ where: { requestKey: input.requestKey } })
      if (previous) {
        const linked = input.direction === 'IN' ? loan.disbursements?.find(row => row.ledgerEntryId === previous.id) : contractor ? loan.contractorPayments?.find(row => row.ledgerEntryId === previous.id && row.contractId === contractor.id && row.stageId === stage?.id) : loan.payments.find(row => row.ledgerEntryId === previous.id)
        const linkedPayment = loan.payments.find(row => row.ledgerEntryId === previous.id)
        const samePayment = input.direction === 'IN' || !!contractor && !!linked || !!input.payment && !!linkedPayment
          && (['roundId', 'principal', 'interest'] as const).every(key => linkedPayment[key] === input.payment![key])
          && (['fee', 'penalty', 'extraPrincipal', 'bankInstallment'] as const).every(key => (linkedPayment[key] ?? 0) === (input.payment![key] ?? 0))
        if (!linked || !samePayment || previous.voidedAt || previous.createdBy !== user.id || previous.direction !== input.direction || previous.categoryCode !== categoryCode || previous.amountSatang !== amountSatang || previous.occurredOn !== input.date || previous.channelCode !== input.channelCode || previous.reference !== input.reference.trim() || previous.note !== note) throw new Error('คำขอนี้ถูกใช้กับรายการอื่นแล้ว กรุณาโหลดหน้าใหม่')
        return { entryId: previous.id, data: current }
      }
      if (state.revision !== input.revision) throw new Error('ข้อมูลเปลี่ยนจากอีกหน้าต่าง กรุณาโหลดหน้าใหม่ก่อนบันทึก')
      const channel = await tx.paymentChannel.findUnique({ where: { code: input.channelCode } })
      if (!channel?.isActive) throw new Error('กรุณาเลือกช่องทางรับ–จ่ายที่เปิดใช้งาน')
      const category = await tx.financialCategory.upsert({ where: { code: categoryCode }, update: {}, create: { code: categoryCode, nameTh: categoryName, group: categoryGroup, direction: input.direction, sortOrder: input.direction === 'IN' ? 330 : 340 } })
      if (!category.isActive || category.direction !== input.direction || category.group !== categoryGroup) throw new Error('หมวดเงินกู้ธนาคารไม่เปิดใช้งานหรือมีการตั้งค่าไม่ตรงประเภท')
      await assertAccountingDateOpen(tx, input.date)
      await assertUniqueLedgerProof(tx, { reference: input.reference, channelCode: input.channelCode })
      const entry = await tx.ledgerEntry.create({ data: { requestKey: input.requestKey, kind: 'GENERAL', direction: input.direction, categoryCode, categoryName: category.nameTh, amountSatang, occurredOn: input.date, channelCode: channel.code, channelName: channel.nameTh, reference: input.reference.trim(), note, createdBy: user.id } })
      const next = structuredClone(current)
      const updated = next.loans.find(row => row.id === input.loanId)!
      if (input.direction === 'IN') {
        if (loan.disbursements === undefined && loan.payments.length) throw new Error('เงินกู้เดิมที่มีการชำระแล้วต้องคงยอดยกมาเดิม')
        updated.disbursements = [...(updated.disbursements ?? []), { id: input.requestKey, date: input.date, amount: amountSatang / 100, reference: input.reference.trim(), notes: input.notes.trim(), ledgerEntryId: entry.id, ...(input.drawNumber !== undefined ? { drawNumber: input.drawNumber } : {}), ...(input.drawType !== undefined ? { drawType: input.drawType } : {}) }]
      } else if (contractor && stage) {
        updated.contractorPayments = [...(updated.contractorPayments ?? []), { id: input.requestKey, contractId: contractor.id, stageId: stage.id, date: input.date, amount: amountSatang / 100, reference: input.reference.trim(), notes: input.notes.trim(), ledgerEntryId: entry.id }]
      } else {
        const p = input.payment!
        updated.payments.push({ id: input.requestKey, date: input.date, amount: amountSatang / 100, reference: input.reference.trim(), roundId: p.roundId, principal: p.principal, interest: p.interest, fee: p.fee ?? 0, penalty: p.penalty ?? 0, extraPrincipal: p.extraPrincipal ?? 0, ...(p.bankInstallment !== undefined ? { bankInstallment: p.bankInstallment } : {}), notes: input.notes.trim(), ledgerEntryId: entry.id })
      }
      validateAssetData(next); validateHistory(next, current)
      const entries = await tx.ledgerEntry.findMany({ where: { id: { in: assetLedgerIds(next) }, voidedAt: null }, select: { id: true, amountSatang: true, occurredOn: true, direction: true, reference: true, note: true, categoryName: true } })
      validateLedgerLinks(next, entries)
      next.revision = current.revision + 1
      const payload = JSON.stringify(next)
      if (payload.length > 4_000_000) throw new Error('ข้อมูลมีขนาดใหญ่เกินไป')
      const saved = await tx.assetWorkspaceState.updateMany({ where: { operatorId: user.id, revision: current.revision }, data: { revision: next.revision, payload } })
      if (saved.count !== 1) throw new Error('ข้อมูลเปลี่ยนจากอีกหน้าต่าง กรุณาโหลดหน้าใหม่')
      await tx.assetWorkspaceRevision.create({ data: { operatorId: user.id, revision: next.revision, payload, reason: `${categoryName}: ${loan.name} / TX-${String(entry.id).padStart(6, '0')}` } })
      return { entryId: entry.id, data: next }
    }, { timeout: 30000 })
    // The cash entry has committed. A downstream notification failure must not ask for another payment.
    try { await syncGoogleLedger(result.entryId) } catch { /* A replay can retry the existing entry's sync. */ }
    revalidatePath('/dashboard/ledger'); revalidatePath('/thing/liabilities'); revalidatePath('/dashboard')
    return { success: true as const, ...result }
  } catch (error) {
    return { error: error instanceof Error && 'code' in error && error.code === 'P2002' ? 'รายการหรือเลขอ้างอิงนี้บันทึกแล้ว กรุณาโหลดหน้าใหม่' : error instanceof Error && !error.name.startsWith('Prisma') ? error.message : 'บันทึกรับ–จ่ายไม่สำเร็จ กรุณาลองใหม่' }
  }
}
