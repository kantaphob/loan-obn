'use server'

import { createHash } from 'node:crypto'
import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/lib/auth/current-user'
import { assertAccountingDateOpen } from '@/lib/monthly-accounting'
import { assertUniqueLedgerProof } from '@/lib/ledger-proof'
import { assertBankLoanLedgerUnlinked } from '@/lib/bank-loan-ledger'
import { lockCashForMatching } from '@/lib/cash-matching'
import { readRepaymentSlip } from '@/lib/repayment-slip'
import { validLedgerDate } from '@/lib/ledger'
import { claimLines, allocations, shortText, personLabel, claimCode, voucherCode, type ClaimInput, type VoucherInput, type ClaimLine } from '@/lib/reimbursements'
import { claimRelations, claimBalance } from '@/lib/reimbursement-data'
import { createReimbursementPdf } from '@/lib/reimbursement-pdf'

async function operator(write = false) {
  const user = await getCurrentUser()
  if (!user || user.status !== 'ACTIVE' || (write && user.role === 'REVIEWER')) throw new Error('ไม่มีสิทธิ์ทำรายการนี้')
  return user
}
function refresh() { for (const p of ['/dashboard/reimbursements', '/dashboard/ledger', '/dashboard/accounting', '/dashboard']) revalidatePath(p) }
function failure(e: unknown) {
  return { error: (e as { code?: string })?.code === 'P2002' ? 'คำขอหรือรายการเงินจริงนี้ถูกใช้แล้ว กรุณาโหลดข้อมูลล่าสุด' : e instanceof Error && !e.name.startsWith('Prisma') ? e.message : 'บันทึกไม่สำเร็จ กรุณาลองใหม่' }
}
const sha = (value: string | Uint8Array) => createHash('sha256').update(value).digest('hex')
async function filesToStore(files: File[], createdBy: string) {
  if (!Array.isArray(files) || files.length > 3) throw new Error('แนบหลักฐานได้ไม่เกิน 3 ไฟล์ต่อเอกสาร')
  const values = await Promise.all(files.map(async f => { const file = await readRepaymentSlip(f); if (!file) throw new Error('ไฟล์ไม่ถูกต้อง'); return { ...file, sha256: sha(file.fileData), createdBy } }))
  if (new Set(values.map(f => f.sha256)).size !== values.length) throw new Error('ไฟล์หลักฐานซ้ำในเอกสารเดียวกัน')
  return values
}
export async function getReimbursements() {
  const user = await operator()
  const [lenders, categories, channels, claims, vouchers] = await Promise.all([
    prisma.lender.findMany({ select: { id: true, nickname: true, firstName: true, lastName: true, status: true }, orderBy: { id: 'asc' } }),
    prisma.financialCategory.findMany({ where: { isActive: true, direction: 'OUT', group: 'EXPENSE' }, select: { code: true, nameTh: true }, orderBy: { sortOrder: 'asc' } }),
    prisma.paymentChannel.findMany({ where: { isActive: true }, select: { code: true, nameTh: true }, orderBy: { code: 'asc' } }),
    prisma.expenseClaim.findMany({ orderBy: { id: 'desc' }, select: { id: true, claimantId: true, payerId: true, claimantName: true, payerName: true, title: true, spentOn: true, itemsJson: true, amountSatang: true, note: true, voidedAt: true, voidReason: true, allocations: claimRelations.allocations, files: { select: { id: true, originalName: true } }, events: { select: { id: true, action: true, reason: true, createdBy: true, createdAt: true }, orderBy: { id: 'asc' } } } }),
    prisma.reimbursementVoucher.findMany({ orderBy: { id: 'desc' }, select: { id: true, payerName: true, payeeName: true, payerId: true, payeeId: true, paidOn: true, amountSatang: true, channelName: true, reference: true, note: true, createdLedger: true, ledgerEntryId: true, historicalEntryId: true, voidedAt: true, voidReason: true, allocations: { select: { amountSatang: true, claim: { select: { id: true, spentOn: true, title: true } } } }, files: { select: { id: true, originalName: true } } } }),
  ])
  const people = lenders.map(l => ({ id: l.id, label: personLabel(l), active: l.status === 'ACTIVE' }))
  return { canWrite: user.role !== 'REVIEWER', people, categories, channels,
    defaultPayerId: lenders.find(l => l.firstName === 'ศุภกิจ' && l.status === 'ACTIVE')?.id ?? people.find(p => p.active)?.id,
    defaultClaimantId: lenders.find(l => l.firstName === 'โอบนิธิ' && l.status === 'ACTIVE')?.id,
    claims: claims.map(c => ({ id: c.id, code: claimCode(c.id, c.spentOn), claimantId: c.claimantId, payerId: c.payerId, claimantName: c.claimantName, payerName: c.payerName, title: c.title, spentOn: c.spentOn, lines: JSON.parse(c.itemsJson) as ClaimLine[], amount: c.amountSatang, note: c.note, voided: Boolean(c.voidedAt), voidReason: c.voidReason, ...claimBalance(c), files: c.files, events: c.events.map(e => ({ ...e, createdAt: e.createdAt.toISOString() })) })),
    vouchers: vouchers.map(v => ({ ...v, code: voucherCode(v.id, v.paidOn), voidedAt: v.voidedAt?.toISOString() ?? null, allocations: v.allocations.map(a => ({ claimId: a.claim.id, code: claimCode(a.claim.id, a.claim.spentOn), title: a.claim.title, amount: a.amountSatang })) })),
  }
}
export async function createExpenseClaim(input: ClaimInput, files: File[] = []) {
  try {
    const user = await operator(true), normalized = claimLines(input), attachments = await filesToStore(files, user.id)
    const hash = sha(JSON.stringify({ ...input, files: attachments.map(f => f.sha256) }))
    const result = await prisma.$transaction(async tx => {
      const previous = await tx.expenseClaim.findUnique({ where: { requestKey: input.requestKey } })
      if (previous) { if (previous.requestHash !== hash || previous.voidedAt) throw new Error('คำขอนี้ใช้กับข้อมูลอื่นหรือยกเลิกแล้ว กรุณาเปิดฟอร์มใหม่'); return { id: previous.id, code: claimCode(previous.id, previous.spentOn) } }
      await assertAccountingDateOpen(tx, input.spentOn)
      const [claimant, payer] = await Promise.all([tx.lender.findUnique({ where: { id: input.claimantId } }), tx.lender.findUnique({ where: { id: input.payerId } })])
      if (!claimant || !payer || claimant.status !== 'ACTIVE' || payer.status !== 'ACTIVE') throw new Error('กรุณาเลือกผู้สำรองจ่ายและผู้คืนเงินที่ใช้งานอยู่ใน Lenders')
      const categories = await tx.financialCategory.findMany({ where: { code: { in: normalized.lines.map(l => l.categoryCode) }, direction: 'OUT', group: 'EXPENSE', isActive: true } })
      const lines = normalized.lines.map(l => { const c = categories.find(c => c.code === l.categoryCode); if (!c) throw new Error('กรุณาเลือกหมวดค่าใช้จ่ายทั่วไปให้ครบ ไม่ใช้หมวดเงินทุนหรือสินเชื่อ'); return { ...l, categoryName: c.nameTh } })
      if (attachments.length) {
        const used = await tx.reimbursementFile.findFirst({ where: { sha256: { in: attachments.map(f => f.sha256) }, claim: { voidedAt: null } }, select: { id: true } })
        if (used) throw new Error('หลักฐานนี้อยู่ในใบเบิกที่ยังใช้งานแล้ว กรุณาตรวจใบเบิกเดิม')
      }
      const c = await tx.expenseClaim.create({ data: { requestKey: input.requestKey, requestHash: hash, claimantId: claimant.id, payerId: payer.id, claimantName: personLabel(claimant), payerName: personLabel(payer), spentOn: input.spentOn, title: input.title.trim(), itemsJson: JSON.stringify(lines), amountSatang: normalized.total, note: input.note.trim(), pdfData: new Uint8Array(), createdBy: user.id, files: { create: attachments }, events: { create: { action: 'CREATE', reason: 'บันทึกใบเบิก ยังไม่ตัดเงินผู้คืนเงิน', createdBy: user.id } } } })
      const code = claimCode(c.id, c.spentOn)
      const pdfData = await createReimbursementPdf({ kind: 'CLAIM', code, date: c.spentOn, payer: c.payerName, payee: c.claimantName, title: c.title, lines: lines.map(l => ({ label: `${l.description} · ${l.categoryName}${l.vendor ? ` · ${l.vendor}` : ''}`, amountSatang: l.amountSatang })), total: c.amountSatang, note: c.note })
      await tx.expenseClaim.update({ where: { id: c.id }, data: { pdfData } })
      return { id: c.id, code }
    }, { timeout: 20000 })
    refresh(); return { success: true, ...result }
  } catch (e) { return failure(e) }
}
export async function reimbursementCandidates(amount: string) {
  await operator()
  const total = allocations({ requestKey: '00000000-0000-0000-0000-000000000000', allocations: [{ claimId: 1, amount }], paidOn: '', channelCode: '', reference: '', note: '' }).total
  const [ledger, historical] = await Promise.all([
    prisma.ledgerEntry.findMany({ where: { amountSatang: total, direction: 'OUT', accountScope: 'GENERAL', kind: 'GENERAL', voidedAt: null, contractId: null, payableId: null, receivableId: null, recurringPayment: null, payrollReceipt: null, reimbursementVoucher: null }, select: { id: true, occurredOn: true, categoryName: true, note: true }, orderBy: { occurredOn: 'desc' } }),
    prisma.historicalCashEntry.findMany({ where: { amountSatang: total, direction: 'OUT', recurringPayment: null, payrollReceipt: null, reimbursementVoucher: null }, select: { id: true, occurredOn: true, description: true }, orderBy: { occurredOn: 'desc' } }),
  ])
  return [...ledger.map(e => ({ key: `LEDGER:${e.id}`, date: e.occurredOn, label: `${e.categoryName} ${e.note}` })), ...historical.map(e => ({ key: `HISTORICAL:${e.id}`, date: e.occurredOn, label: e.description }))]
}
export async function createReimbursementVoucher(input: VoucherInput, files: File[] = []) {
  try {
    const user = await operator(true), normalized = allocations(input), attachments = await filesToStore(files, user.id)
    const hash = sha(JSON.stringify({ ...input, files: attachments.map(f => f.sha256) }))
    const result = await prisma.$transaction(async tx => {
      const previous = await tx.reimbursementVoucher.findUnique({ where: { requestKey: input.requestKey } })
      if (previous) { if (previous.requestHash !== hash || previous.voidedAt) throw new Error('คำขอนี้ใช้กับข้อมูลอื่นหรือยกเลิกแล้ว กรุณาเปิดฟอร์มใหม่'); return { id: previous.id, code: voucherCode(previous.id, previous.paidOn) } }
      for (const a of normalized.rows) {
        const locked = await tx.expenseClaim.updateMany({ where: { id: a.claimId, voidedAt: null }, data: { updatedAt: new Date() } })
        if (locked.count !== 1) throw new Error('ไม่พบใบเบิกหรือถูกยกเลิกแล้ว')
      }
      const claims = await tx.expenseClaim.findMany({ where: { id: { in: normalized.rows.map(a => a.claimId) } }, include: claimRelations })
      const first = claims[0]
      if (!first || claims.length !== normalized.rows.length || claims.some(c => c.claimantId !== first.claimantId || c.payerId !== first.payerId)) throw new Error('ใบสำคัญจ่ายหนึ่งใบต้องเป็นผู้สำรองจ่ายและผู้คืนเงินคู่เดียวกัน')
      const parties = await tx.lender.count({ where: { id: { in: [first.claimantId, first.payerId] }, status: 'ACTIVE' } })
      if (parties !== 2) throw new Error('ผู้สำรองจ่ายหรือผู้คืนเงินปิดใช้งานแล้ว')
      for (const c of claims) { const a = normalized.rows.find(a => a.claimId === c.id)!; if (a.amountSatang > claimBalance(c).remaining) throw new Error(`ยอดคืนเกินยอดค้างของ ${claimCode(c.id, c.spentOn)}`) }
      if (attachments.length && await tx.reimbursementFile.findFirst({ where: { sha256: { in: attachments.map(f => f.sha256) }, voucher: { voidedAt: null } }, select: { id: true } })) throw new Error('หลักฐานนี้ใช้ในใบสำคัญจ่ายแล้ว กรุณาตรวจรายการเดิม')
      let ledgerEntryId: number | null = null, historicalEntryId: number | null = null, paidOn = input.paidOn, channelName = '', reference = input.reference.trim(), createdLedger = false
      if (input.existingKey) {
        const match = /^(LEDGER|HISTORICAL):(\d+)$/.exec(input.existingKey)
        if (!match) throw new Error('กรุณาเลือกรายการโอนคืนเดิม')
        const id = Number(match[2]); await lockCashForMatching(tx, match[1] as 'LEDGER' | 'HISTORICAL', id)
        if (match[1] === 'LEDGER') {
          const e = await tx.ledgerEntry.findUniqueOrThrow({ where: { id }, include: { recurringPayment: true, payrollReceipt: true, reimbursementVoucher: true, landDevelopmentCosts: { select: { id: true } }, projectPayment: true, buildingService: true, persuaderSharePayment: true } })
          if (e.direction !== 'OUT' || e.accountScope !== 'GENERAL' || e.kind !== 'GENERAL' || e.voidedAt || e.amountSatang !== normalized.total || e.contractId || e.payableId || e.receivableId || e.recurringPayment || e.payrollReceipt || e.reimbursementVoucher || e.landDevelopmentCosts.length || e.projectPayment || e.buildingService || e.persuaderSharePayment) throw new Error('รายการเดิมไม่ใช่เงินจ่ายทั่วไปที่ว่างและตรงกับยอดคืน')
          await assertBankLoanLedgerUnlinked(tx, id)
          ledgerEntryId = e.id; paidOn = e.occurredOn; channelName = e.channelName; reference = e.reference
        } else {
          const e = await tx.historicalCashEntry.findUniqueOrThrow({ where: { id }, include: { recurringPayment: true, payrollReceipt: true, reimbursementVoucher: true } })
          if (e.direction !== 'OUT' || e.amountSatang !== normalized.total || e.recurringPayment || e.payrollReceipt || e.reimbursementVoucher) throw new Error('รายการย้อนหลังถูกใช้แล้วหรือยอดไม่ตรง')
          historicalEntryId = e.id; paidOn = e.occurredOn; channelName = e.sourceChannel || e.channelCode; reference = `HIST-${e.id}`
        }
      } else {
        if (!validLedgerDate(paidOn)) throw new Error('วันที่คืนเงินจริงไม่ถูกต้องหรืออยู่ในอนาคต')
        await assertAccountingDateOpen(tx, paidOn)
        for (const file of attachments) await assertUniqueLedgerProof(tx, { reference, channelCode: input.channelCode, slipHash: file.sha256 })
        await assertUniqueLedgerProof(tx, { reference, channelCode: input.channelCode, slipHash: null })
        const channel = await tx.paymentChannel.findUnique({ where: { code: input.channelCode } })
        if (!channel?.isActive) throw new Error('กรุณาเลือกช่องทางที่เปิดใช้งาน')
        const category = await tx.financialCategory.upsert({ where: { code: 'REIMBURSEMENT_SETTLEMENT' }, update: {}, create: { code: 'REIMBURSEMENT_SETTLEMENT', nameTh: 'คืนเงินสำรองจ่าย', nameEn: 'Reimbursement settlement', direction: 'OUT', group: 'SETTLEMENT' } })
        if (!category.isActive) throw new Error('หมวดคืนเงินสำรองจ่ายปิดใช้งาน')
        channelName = channel.nameTh
        const entry = await tx.ledgerEntry.create({ data: { requestKey: input.requestKey, kind: 'GENERAL', direction: 'OUT', accountScope: 'GENERAL', categoryCode: category.code, categoryName: category.nameTh, amountSatang: normalized.total, occurredOn: paidOn, channelCode: channel.code, channelName, reference, slipHash: attachments[0]?.sha256 ?? null, ...(attachments[0] ? { slip: { create: { originalName: attachments[0].originalName, mimeType: attachments[0].mimeType, fileData: attachments[0].fileData, sizeBytes: attachments[0].sizeBytes } } } : {}), note: `คืนสำรองจ่าย ${first.claimantName} · ${claims.map(c => claimCode(c.id, c.spentOn)).join(', ')}`, createdBy: user.id } })
        ledgerEntryId = entry.id; createdLedger = true
      }
      if (!validLedgerDate(paidOn) || claims.some(c => c.spentOn > paidOn)) throw new Error('วันคืนเงินต้องไม่ก่อนวันสำรองจ่าย และไม่อยู่ในอนาคต')
      const snapshot = { claims: normalized.rows.map(a => { const c = claims.find(c => c.id === a.claimId)!; return { code: claimCode(c.id, c.spentOn), title: c.title, amountSatang: a.amountSatang } }), ledgerEntryId, historicalEntryId }
      const voucher = await tx.reimbursementVoucher.create({ data: { requestKey: input.requestKey, requestHash: hash, payerId: first.payerId, payeeId: first.claimantId, payerName: first.payerName, payeeName: first.claimantName, paidOn, amountSatang: normalized.total, channelName, reference, note: input.note.trim(), createdLedger, ledgerEntryId, historicalEntryId, snapshotJson: JSON.stringify(snapshot), pdfData: new Uint8Array(), createdBy: user.id, files: { create: attachments }, allocations: { create: normalized.rows }, events: { create: { action: 'PAY', reason: createdLedger ? 'สร้างรายการจ่ายคืนใหม่ในบัญชีทั่วไป' : 'จับคู่รายการเงินจริงเดิม ไม่เพิ่มเงินจ่ายซ้ำ', createdBy: user.id } } } })
      const code = voucherCode(voucher.id, paidOn)
      const pdfData = await createReimbursementPdf({ kind: 'VOUCHER', code, date: paidOn, payer: voucher.payerName, payee: voucher.payeeName, title: 'คืนเงินสำรองจ่ายตามใบเบิก', lines: snapshot.claims.map(c => ({ label: `${c.code} · ${c.title}`, amountSatang: c.amountSatang })), total: normalized.total, note: voucher.note, channel: channelName, reference })
      await tx.reimbursementVoucher.update({ where: { id: voucher.id }, data: { pdfData } })
      for (const c of claims) await tx.reimbursementEvent.create({ data: { claimId: c.id, action: 'REIMBURSE', reason: `${code} · คืน ${(normalized.rows.find(a => a.claimId === c.id)!.amountSatang / 100).toFixed(2)} บาท`, createdBy: user.id } })
      return { id: voucher.id, code }
    }, { timeout: 20000 })
    refresh(); return { success: true, ...result }
  } catch (e) { return failure(e) }
}
export async function voidExpenseClaim(id: number, reason: string) {
  try {
    const user = await operator(true); shortText(reason, 'เหตุผลยกเลิก', 500, true)
    if (!Number.isSafeInteger(id) || id <= 0) throw new Error('เลขใบเบิกไม่ถูกต้อง')
    await prisma.$transaction(async tx => {
      await tx.expenseClaim.updateMany({ where: { id, voidedAt: null }, data: { updatedAt: new Date() } })
      const c = await tx.expenseClaim.findUniqueOrThrow({ where: { id }, include: claimRelations })
      if (c.voidedAt || claimBalance(c).paid > 0) throw new Error('ใบเบิกนี้ยกเลิกแล้วหรือมีเงินคืน ต้องยกเลิกใบสำคัญจ่ายก่อน')
      await assertAccountingDateOpen(tx, c.spentOn)
      await tx.expenseClaim.update({ where: { id }, data: { voidedAt: new Date(), voidedBy: user.id, voidReason: reason.trim(), events: { create: { action: 'VOID', reason: reason.trim(), createdBy: user.id } } } })
    })
    refresh(); return { success: true }
  } catch (e) { return failure(e) }
}
export async function voidReimbursementVoucher(id: number, reason: string) {
  try {
    const user = await operator(true); shortText(reason, 'เหตุผลยกเลิก', 500, true)
    if (!Number.isSafeInteger(id) || id <= 0) throw new Error('เลขใบสำคัญจ่ายไม่ถูกต้อง')
    await prisma.$transaction(async tx => {
      const voucher = await tx.reimbursementVoucher.findUniqueOrThrow({ where: { id }, include: { allocations: { orderBy: { claimId: 'asc' } } } })
      for (const a of voucher.allocations) await tx.expenseClaim.update({ where: { id: a.claimId }, data: { updatedAt: new Date() } })
      const v = await tx.reimbursementVoucher.findUniqueOrThrow({ where: { id } })
      if (v.voidedAt) throw new Error('เอกสารนี้ยกเลิกแล้ว')
      await assertAccountingDateOpen(tx, v.paidOn)
      if (v.ledgerEntryId) {
        await lockCashForMatching(tx, 'LEDGER', v.ledgerEntryId)
        if (v.createdLedger) await tx.ledgerEntry.update({ where: { id: v.ledgerEntryId }, data: { voidedAt: new Date(), voidedBy: user.id, voidReason: `ยกเลิก ${voucherCode(v.id, v.paidOn)}: ${reason.trim()}` } })
      }
      await tx.reimbursementVoucher.update({ where: { id }, data: { voidedAt: new Date(), voidedBy: user.id, voidReason: reason.trim(), ledgerEntryId: null, historicalEntryId: null, events: { create: { action: 'VOID', reason: `${reason.trim()} · ${v.createdLedger ? 'ยกเลิกรายการเงินจ่ายที่สร้างพร้อมเอกสาร' : 'ยกเลิกการจับคู่ โดยคงรายการเงินจริงเดิม'}`, createdBy: user.id } } } })
      for (const a of voucher.allocations) await tx.reimbursementEvent.create({ data: { claimId: a.claimId, action: 'REOPEN', reason: `ยกเลิก ${voucherCode(v.id, v.paidOn)}: ${reason.trim()}`, createdBy: user.id } })
    }, { timeout: 20000 })
    refresh(); return { success: true }
  } catch (e) { return failure(e) }
}
