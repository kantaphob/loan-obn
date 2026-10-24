import assert from 'node:assert/strict'
import { test, after } from 'node:test'
import { randomUUID } from 'node:crypto'
import { prisma } from '../lib/prisma'
import { saveLedger, voidLedger, editLedger } from '../app/dashboard/ledger/actions'
import { saveMonthPreparation, saveYearWorkpaper, postAccountingAdjustment } from '../app/dashboard/ac/preparation-actions'
import { emptyChecklist } from '../lib/closing-preparation-types'
import { loadYearWorkpaper } from '../lib/accounting-workpaper'
import { POST as uploadDocument } from '../app/api/accounting/documents/route'
import { annualSnapshot } from '../lib/monthly-accounting'
import { bangkokToday } from '../lib/ledger'
import { closeAccounts } from '../app/dashboard/ac/actions'
import { getMonthReview, lockAccountingMonth, saveRepaymentAllocation } from '../app/dashboard/ac/month-actions'
if (!process.env.DATABASE_URL?.includes('loan-closing-test-')) throw new Error('Isolated database required')
after(() => prisma.$disconnect())
test('monthly reviews, allocation, carryforward and annual closing stay separate and immutable', async () => {
  const user = await prisma.user.create({ data: { acccode: 'closing-test', password: 'test', role: 'REVIEWER', level: 0 } })
  let annual = { requestKey: randomUUID(), startOn: '2024-01-01', endOn: '2024-12-31', note: 'Checked trial balance', balances: [{ code: '4001', name: 'Interest', type: 'REVENUE' as const, amount: '10' }], useWorkpaper: false, workpaperToken: '' }
  assert.equal((await closeAccounts(annual)).ok, false)
  assert.equal((await lockAccountingMonth({ requestKey: randomUUID(), month: '2024-01', note: 'reviewed', reviewToken: '' })).ok, false)
  await prisma.user.update({ where: { id: user.id }, data: { role: 'ADMIN' } })
  const borrower = await prisma.borrower.create({ data: { nickname: 'test', firstName: 'Test', lastName: 'Closing', phone: '' } })
  const lender = await prisma.lender.create({ data: { nickname: 'lender' } })
  const contract = await prisma.loanContract.create({ data: { requestKey: randomUUID(), borrowerId: borrower.id, lenderId: lender.id, borrowerCode: 'B1', borrowerName: 'Test Closing', lenderName: 'Lender', documentChoice: 'CREATE', interestMethod: 'INTEREST_WITH_PRINCIPAL', interestPercent: 10, principalSatang: 10000, interestSatang: 1000, netSatang: 10000, repaymentSatang: 11000, createdBy: user.id, status: 'PAID', paidAt: new Date('2024-01-01T00:00:00+07:00'), repaymentDueDate: '2028-01-31' } })
  const base = { contractId: contract.id, categoryCode: 'TEST', categoryName: 'Test', channelCode: 'CASH', channelName: 'Cash', createdBy: user.id }
  await prisma.ledgerEntry.create({ data: { ...base, requestKey: randomUUID(), kind: 'DISBURSEMENT', direction: 'OUT', amountSatang: 10000, occurredOn: '2024-01-01' } })
  const receipt = await prisma.ledgerEntry.create({ data: { ...base, requestKey: randomUUID(), kind: 'REPAYMENT', direction: 'IN', amountSatang: 6000, occurredOn: '2024-01-15', penaltyAssessed: true } })
  const readyChecklist = emptyChecklist()
  for (const row of Object.values(readyChecklist)) { row.status = 'DONE'; row.note = 'Reviewed supporting records' }
  const prepare = async (month: string) => { assert.equal((await saveMonthPreparation({ month, expectedVersion: 0, checklist: readyChecklist, note: 'checked' })).ok, true) }
  await prepare('2024-01')
  assert.equal((await saveMonthPreparation({ month: '2024-01', expectedVersion: 0, checklist: readyChecklist, note: 'stale' })).ok, false)
  const form = new FormData(); form.set('month', '2024-01'); form.set('category', 'STATEMENT'); form.set('requestKey', randomUUID()); form.set('file', new File(['%PDF-1.4\n% statement fixture'], 'statement.pdf', { type: 'application/pdf' }))
  assert.equal((await uploadDocument(new Request('http://localhost/api/accounting/documents', { method: 'POST', body: form }))).status, 201)
  const initialFebruary = await getMonthReview('2024-02')
  assert.equal((await lockAccountingMonth({ requestKey: randomUUID(), month: '2024-02', note: 'cannot start midyear', reviewToken: initialFebruary.reviewToken })).ok, false)
  let review = await getMonthReview('2024-01')
  const monthInput = { requestKey: randomUUID(), month: '2024-01', note: 'Compared to bank statement', reviewToken: review.reviewToken }
  assert.equal(review.snapshot.unallocatedCount, 1)
  assert.equal((await lockAccountingMonth(monthInput)).ok, false)
  const allocation = { id: receipt.id, expectedRevision: 0, principal: '50', interest: '10', reason: 'Compared receipt and contract' }
  assert.equal((await saveRepaymentAllocation({ ...allocation, principal: '60' })).ok, false, 'allocation must equal receipt')
  assert.equal((await saveRepaymentAllocation(allocation)).ok, true)
  assert.equal((await saveRepaymentAllocation(allocation)).ok, false, 'stale revision rejected')
  assert.equal((await lockAccountingMonth(monthInput)).ok, false, 'old review token rejected after allocation')
  review = await getMonthReview('2024-01')
  assert.equal(review.snapshot.cash.closing, -4000)
  assert.equal(review.snapshot.outstandingSatang, 5000)
  assert.equal(review.snapshot.principalReceivedSatang, 5000)
  assert.equal(review.snapshot.interestReceivedSatang, 1000)
  const latestMonthInput = { ...monthInput, reviewToken: review.reviewToken }
  assert.equal((await lockAccountingMonth(latestMonthInput)).ok, true)
  assert.equal((await lockAccountingMonth(latestMonthInput)).ok, true, 'same request safely retried')
  assert.equal(await prisma.accountingMonthLock.count(), 1)
  assert.equal(await prisma.accountingClose.count(), 0, 'monthly locks never post closing journals')
  assert.equal((await prisma.loanContract.findUniqueOrThrow({ where: { id: contract.id } })).status, 'PAID', 'monthly review never closes loan')
  assert.equal((await saveRepaymentAllocation({ ...allocation, expectedRevision: 1 })).ok, false)
  await assert.rejects(prisma.ledgerEntry.update({ where: { id: receipt.id }, data: { amountSatang: 5000 } }))
  await assert.rejects(prisma.accountingMonthLock.deleteMany())
  assert.match((await voidLedger(receipt.id, 'attempt after lock')).error!, /งวดบัญชีถูกล็อก/)
  assert.match((await saveLedger({ requestKey: randomUUID(), kind: 'GENERAL', contractId: null, direction: 'IN', categoryCode: 'TEST', amount: '1', occurredOn: '2024-01-31', channelCode: 'CASH', reference: '', note: '' })).error!, /งวดบัญชีถูกล็อก/)
  assert.match((await editLedger({ id: receipt.id, expectedRevision: 1, amount: '60', occurredOn: '2024-02-01', direction: 'IN', categoryCode: 'TEST', channelCode: 'CASH', reference: '', note: '', reason: 'move out of locked month' })).error!, /งวดบัญชีถูกล็อก/)
  assert.equal((await lockAccountingMonth({ requestKey: randomUUID(), month: bangkokToday().slice(0, 7), note: 'not ended', reviewToken: '' })).ok, false)
  assert.equal((await closeAccounts(annual)).ok, false, 'annual closing requires all twelve months')
  assert.equal((await closeAccounts({ ...annual, endOn: '2024-01-31' })).ok, false, 'monthly financial journal closing rejected')
  const march = await getMonthReview('2024-03')
  assert.equal((await lockAccountingMonth({ requestKey: randomUUID(), month: '2024-03', note: 'skip', reviewToken: march.reviewToken })).ok, false, 'cannot skip February')
  for (let i = 2; i <= 12; i++) {
    const month = `2024-${String(i).padStart(2, '0')}`
    await prepare(month)
    const current = await getMonthReview(month)
    assert.equal(current.snapshot.cash.opening, -4000, 'cash balance carries without becoming a new receipt')
    assert.equal(current.snapshot.cash.incoming, 0)
    assert.equal(current.snapshot.outstandingSatang, 5000, 'loan balance carries across months')
    assert.equal((await lockAccountingMonth({ requestKey: randomUUID(), month, note: 'Checked empty month and carryforward', reviewToken: current.reviewToken })).ok, true)
  }
  const accounts = [
    { code: '1100', name: 'Cash', type: 'ASSET' as const, debit: '110', credit: '0' },
    { code: '1200', name: 'Interest receivable', type: 'ASSET' as const, debit: '0', credit: '0' },
    { code: '3100', name: 'Capital', type: 'EQUITY' as const, debit: '0', credit: '100' },
    { code: '4100', name: 'Interest revenue', type: 'REVENUE' as const, debit: '0', credit: '10' },
  ]
  assert.equal((await saveYearWorkpaper({ year: '2024', expectedVersion: 0, accounts, equity: { opening: '100', contributions: '0', withdrawals: '0', target: 'RETAINED_EARNINGS' }, notes: 'Reviewed accrual basis trial balance and source limitations', reason: 'Prepare year-end workpaper' })).ok, true)
  const oldWorkpaper = await prisma.$transaction(tx => loadYearWorkpaper(tx, '2024'))
  const adjustment = { requestKey: randomUUID(), year: '2024', occurredOn: '2024-12-31', description: 'Interest accrued at year end', lines: [{ code: '1200', debit: '5', credit: '0' }, { code: '4100', debit: '0', credit: '5' }] }
  assert.equal((await postAccountingAdjustment(adjustment)).ok, true)
  assert.equal((await postAccountingAdjustment(adjustment)).ok, true, 'adjustment retry does not duplicate posting')
  assert.equal((await closeAccounts({ ...annual, useWorkpaper: true, workpaperToken: oldWorkpaper.reviewToken })).ok, false, 'changed adjustment invalidates review')
  const finalWorkpaper = await prisma.$transaction(tx => loadYearWorkpaper(tx, '2024'))
  annual = { ...annual, useWorkpaper: true, workpaperToken: finalWorkpaper.reviewToken }
  assert.equal(finalWorkpaper.financials?.profit, 1500)
  assert.equal(finalWorkpaper.financials?.assets, 11500)
  assert.equal(finalWorkpaper.financials?.closingEquity, 11500)
  assert.equal((await closeAccounts(annual)).ok, true)
  assert.equal((await closeAccounts(annual)).ok, true)
  assert.equal((await saveYearWorkpaper({ year: '2024', expectedVersion: 1, accounts, equity: { opening: '100', contributions: '0', withdrawals: '0', target: 'CAPITAL' }, notes: 'cannot edit after close', reason: 'blocked' })).ok, false)
  assert.equal((await postAccountingAdjustment({ ...adjustment, requestKey: randomUUID() })).ok, false)
  assert.ok((await prisma.accountingClose.findFirstOrThrow()).workpaperSnapshotJson)
  assert.ok(await prisma.accountingDocument.count({ where: { month: '2024-01' } }) >= 2)
  const frozenContract = await prisma.accountingDocument.findFirstOrThrow({ where: { month: '2024-01', category: 'CONTRACT' } })
  assert.equal(frozenContract.mimeType, 'application/pdf')
  assert.equal(Buffer.from(frozenContract.fileData).subarray(0, 5).toString(), '%PDF-')
  const archivedDocument = await prisma.accountingDocument.findFirstOrThrow({ where: { month: '2024-01', category: 'STATEMENT' } })
  await assert.rejects(prisma.accountingDocument.update({ where: { id: archivedDocument.id }, data: { originalName: 'changed' } }))
  await assert.rejects(prisma.accountingDocument.delete({ where: { id: archivedDocument.id } }))
  const lateUpload = new FormData(); lateUpload.set('month', '2024-01'); lateUpload.set('category', 'STATEMENT'); lateUpload.set('file', new File(['%PDF-1.4\nnew'], 'late.pdf', { type: 'application/pdf' }))
  assert.equal((await uploadDocument(new Request('http://localhost/api/accounting/documents', { method: 'POST', body: lateUpload }))).status, 400)
  assert.equal(await prisma.accountingClose.count(), 1)
  assert.equal(await prisma.ledgerEntry.count(), 2, 'no cash movement created by month or year close')
  const stored = await prisma.accountingClose.findFirstOrThrow()
  assert.equal(stored.kind, 'YEAR_END')
  const annualReport = await prisma.$transaction(tx => annualSnapshot(tx, '2024'))
  assert.equal(annualReport.cash.opening, 0)
  assert.equal(annualReport.cash.closing, -4000)
  const year2025 = await prisma.$transaction(tx => annualSnapshot(tx, '2025'))
  assert.equal(year2025.cash.opening, -4000, 'prior-year money is opening, not revenue')
  assert.equal(annualReport.lockedCount, 12)
  assert.equal(annualReport.incoming, 6000)
  assert.equal(annualReport.principal, 5000)
  assert.equal(annualReport.interest, 1000)
  assert.equal(annualReport.outstanding, 5000)
  assert.equal(annualReport.annualClose?.profitSatang, 1500)
  assert.equal(annualReport.months.reduce((sum, month) => sum + month.incoming, 0), annualReport.incoming)
  const currentYearReport = await prisma.$transaction(tx => annualSnapshot(tx, bangkokToday().slice(0, 4)))
  assert.equal(currentYearReport.asOf, bangkokToday(), 'current year never projects future interest or penalties')
  assert.equal(stored.profitSatang, 1500)
  assert.ok(JSON.parse(stored.journalJson).some((line: { code: string }) => line.code === 'INCOME_SUMMARY'))
  assert.equal((await closeAccounts({ ...annual, useWorkpaper: false })).ok, false, 'manual journal cannot bypass workpaper')
  assert.equal((await closeAccounts({ ...annual, note: 'changed' })).ok, false)
  await assert.rejects(prisma.accountingClose.deleteMany())
  // New open-period changes clear prior allocation; waived/voided cash is never counted twice.
  const openReceipt = await prisma.ledgerEntry.create({ data: { ...base, requestKey: randomUUID(), kind: 'REPAYMENT', direction: 'IN', amountSatang: 2000, occurredOn: '2025-01-15', penaltyAssessed: true } })
  assert.equal((await saveRepaymentAllocation({ id: openReceipt.id, expectedRevision: 0, principal: '20', interest: '0', reason: 'review' })).ok, true)
  await prisma.ledgerEntry.update({ where: { id: openReceipt.id }, data: { amountSatang: 1000 } })
  assert.equal((await prisma.ledgerEntry.findUniqueOrThrow({ where: { id: openReceipt.id } })).principalReceivedSatang, null)
  const january = await getMonthReview('2025-01')
  assert.equal(january.snapshot.unallocatedCount, 1)
  await prisma.ledgerEntry.update({ where: { id: openReceipt.id }, data: { voidedAt: new Date() } })
  assert.equal((await getMonthReview('2025-01')).snapshot.unallocatedCount, 0)
  const upfront = await prisma.loanContract.create({ data: { requestKey: randomUUID(), borrowerId: borrower.id, lenderId: lender.id, borrowerCode: 'B1', borrowerName: 'Upfront', lenderName: 'Lender', documentChoice: 'NONE', interestMethod: 'INTEREST_UPFRONT', interestPercent: 10, principalSatang: 10000, interestSatang: 1000, netSatang: 9000, repaymentSatang: 10000, createdBy: user.id, status: 'PAID', paidAt: new Date('2025-02-01T00:00:00+07:00'), repaymentDueDate: '2028-01-31' } })
  await prisma.ledgerEntry.create({ data: { ...base, contractId: upfront.id, requestKey: randomUUID(), kind: 'DISBURSEMENT', direction: 'OUT', amountSatang: 9000, occurredOn: '2025-02-01' } })
  const upfrontReceipt = await prisma.ledgerEntry.create({ data: { ...base, contractId: upfront.id, requestKey: randomUUID(), kind: 'REPAYMENT', direction: 'IN', amountSatang: 10000, occurredOn: '2025-02-02', penaltyAssessed: true } })
  const upfrontInput = { id: upfrontReceipt.id, expectedRevision: 0, principal: '90', interest: '10', reason: 'review upfront contract' }
  assert.equal((await saveRepaymentAllocation(upfrontInput)).ok, false, 'never count prepaid interest twice')
  assert.equal((await saveRepaymentAllocation({ ...upfrontInput, principal: '100', interest: '0' })).ok, true)
  assert.equal((await getMonthReview('2025-02')).snapshot.interestReceivedSatang, 0)
  const late = await prisma.loanContract.create({ data: { requestKey: randomUUID(), borrowerId: borrower.id, lenderId: lender.id, borrowerCode: 'B1', borrowerName: 'Late', lenderName: 'Lender', documentChoice: 'NONE', interestMethod: 'INTEREST_WITH_PRINCIPAL', interestPercent: 0, principalSatang: 1000, interestSatang: 0, netSatang: 1000, repaymentSatang: 1000, createdBy: user.id, status: 'PAID', paidAt: new Date('2025-03-01T00:00:00+07:00'), repaymentDueDate: '2025-03-01', penaltyMaxDays: 30 } })
  await prisma.ledgerEntry.create({ data: { ...base, contractId: late.id, requestKey: randomUUID(), kind: 'DISBURSEMENT', direction: 'OUT', amountSatang: 1000, occurredOn: '2025-03-01' } })
  const lateReceipt = await prisma.ledgerEntry.create({ data: { ...base, contractId: late.id, requestKey: randomUUID(), kind: 'REPAYMENT', direction: 'IN', amountSatang: 6000, occurredOn: '2025-03-02', penaltyAssessed: true } })
  const lateInput = { id: lateReceipt.id, expectedRevision: 0, principal: '10', interest: '0', reason: 'penalty and principal receipt' }
  assert.equal((await saveRepaymentAllocation(lateInput)).ok, true)
  const lateSaved = await prisma.ledgerEntry.findUniqueOrThrow({ where: { id: lateReceipt.id } })
  assert.equal(lateSaved.penaltyReceivedSatang, 5000)
  assert.equal(lateSaved.principalReceivedSatang, 1000)
  assert.equal((await getMonthReview('2025-03')).snapshot.penaltyReceivedSatang, 5000)
})
