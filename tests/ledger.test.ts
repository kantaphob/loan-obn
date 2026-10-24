import assert from 'node:assert/strict'
import { after, test } from 'node:test'
import { randomUUID } from 'node:crypto'
import { prisma } from '../lib/prisma'
import { saveLedger, voidLedger, getLedger, editLedger } from '../app/dashboard/ledger/actions'
import { getReceivables, getRepaymentHistory } from '../app/dashboard/repayments/actions'
import { ledgerAmount, validLedgerDate, bangkokToday, contractLedgerBalance, type LedgerInput } from '../lib/ledger'
if (!process.env.DATABASE_URL?.includes('loan-ledger-test-')) throw new Error('Isolated database required')
after(() => prisma.$disconnect())
test('amount and date validation', () => {
  assert.equal(ledgerAmount('10.01'), 1001)
  for (const value of ['0', '-1', '1.001', 'NaN', '2000000001']) assert.throws(() => ledgerAmount(value))
  assert.equal(validLedgerDate('2026-02-30'), false)
  assert.equal(validLedgerDate('2099-01-01'), false)
})
test('daily penalty starts after due date, allocates fees first, and stops after settlement', () => {
  const contract = { repaymentSatang: 60000, status: 'PAID', paidAt: new Date('2026-01-01T00:00:00+07:00'), repaymentDueDate: '2026-01-03' }
  assert.equal(contractLedgerBalance(contract, [{ kind: 'REPAYMENT', amountSatang: 60000, occurredOn: '2026-01-05', penaltyAssessed: false }], '2026-02-01').remaining, 0, 'historical settlement must remain closed')
  assert.equal(contractLedgerBalance(contract, [], '2026-01-03').penaltyRemaining, 0)
  assert.equal(contractLedgerBalance(contract, [], '2026-01-04').remaining, 65000)
  const monthLate = contractLedgerBalance(contract, [], '2026-02-10')
  assert.equal(monthLate.penaltyRemaining, 150000, 'daily penalty stops after 30 days')
  assert.equal(monthLate.renegotiationRequired, true, 'a new agreement is required after one overdue month')
  const partial = [{ id: 1, kind: 'REPAYMENT', amountSatang: 20000, occurredOn: '2026-01-05' }]
  const balance = contractLedgerBalance(contract, partial, '2026-01-06')
  assert.equal(balance.penaltyPaid, 10000)
  assert.equal(balance.baseRemaining, 50000)
  assert.equal(balance.penaltyRemaining, 5000)
  const onTime = contractLedgerBalance(contract, [{ kind: 'REPAYMENT', occurredOn: '2026-01-03', amountSatang: 50000, settlementWaivedSatang: 10000 }], '2026-02-01')
  assert.equal(onTime.remaining, 0)
  assert.equal(onTime.received, 50000)
  assert.equal(onTime.settlementWaived, 10000)
  assert.equal(onTime.penaltyAccrued, 0, 'late data entry must not penalize an on-time settlement')
  const settled = [...partial, { id: 2, kind: 'REPAYMENT', amountSatang: 50000, occurredOn: '2026-01-06', penaltyWaivedSatang: 5000 }]
  assert.equal(contractLedgerBalance(contract, settled, '2026-02-01').remaining, 0)
  assert.equal(contractLedgerBalance(contract, settled, '2026-02-01').penaltyAccrued, 15000)
  assert.equal(contractLedgerBalance(contract, settled, '2026-02-01').penaltyWaived, 5000)
  assert.equal(contractLedgerBalance(contract, [{ ...settled[1], penaltyWaivedSatang: 999999 }], '2026-02-01').invalid, true)
  assert.equal(contractLedgerBalance({ ...contract, status: 'WAITING_PAYMENT', paidAt: null }, [], '2026-02-01').penaltyRemaining, 0)
  assert.equal(contractLedgerBalance({ ...contract, repaymentDueDate: null }, [], '2026-02-01').penaltyRemaining, 0)
})
test('contract cash lifecycle, retries, overpayment, voids and permissions', async () => {
  const user = await prisma.user.create({ data: { acccode: 'ledger-admin', password: 'test', role: 'ADMIN', level: 0 } })
  const borrower = await prisma.borrower.create({ data: { nickname: 'test', firstName: 'Test', lastName: 'Borrower', phone: '' } })
  const lender = await prisma.lender.create({ data: { nickname: 'lender' } })
  await prisma.paymentChannel.create({ data: { code: 'CASH', nameTh: 'เงินสด' } })
  await prisma.financialCategory.createMany({ data: [
    { code: 'LOAN_DISBURSEMENT', nameTh: 'ชื่อจ่ายจาก Masterdata', group: 'LOAN', direction: 'OUT' },
    { code: 'CONTRACT_REPAYMENT', nameTh: 'ชื่อรับจาก Masterdata', group: 'LOAN', direction: 'IN' },
  ] })
  const contract = await prisma.loanContract.create({ data: { borrowerId: borrower.id, lenderId: lender.id, requestKey: randomUUID(), borrowerCode: 'BR-TEST', borrowerName: 'Test', lenderName: 'Lender', documentChoice: 'NONE', interestMethod: 'INTEREST_UPFRONT', interestPercent: 20, principalSatang: 500000, interestSatang: 100000, netSatang: 400000, repaymentSatang: 500000, createdBy: user.id } })
  const input: LedgerInput = { requestKey: randomUUID(), kind: 'DISBURSEMENT', contractId: contract.id, direction: 'OUT', categoryCode: '', amount: '4000', occurredOn: '2026-01-02', channelCode: 'CASH', reference: '', note: '' }
  assert.ok((await saveLedger({ ...input, kind: 'REPAYMENT' })).error)
  assert.ok((await saveLedger({ ...input, amount: '5000' })).error)
  assert.ok((await saveLedger(input, new File(['%PDF-1.4\ndisbursement proof'], 'paid.pdf', { type: 'application/pdf' }))).success)
  assert.ok((await saveLedger(input, new File(['%PDF-1.4\ndisbursement proof'], 'paid.pdf', { type: 'application/pdf' }))).success)
  assert.ok((await saveLedger({ ...input, amount: '3999' })).error, 'changed payload cannot reuse a committed request key')
  assert.ok((await saveLedger({ ...input, occurredOn: '2026-01-03' })).error)
  assert.equal(await prisma.ledgerEntry.count(), 1)
  const paidEntry = await prisma.ledgerEntry.findUniqueOrThrow({ where: { requestKey: input.requestKey }, include: { slip: true } })
  assert.equal(paidEntry.slip?.originalName, 'paid.pdf')
  assert.equal((await getLedger()).entries[0].categoryName, 'ชื่อจ่ายจาก Masterdata')
  await prisma.financialCategory.update({ where: { code: 'CONTRACT_REPAYMENT' }, data: { isActive: false } })
  assert.ok((await saveLedger({ ...input, requestKey: randomUUID(), kind: 'REPAYMENT', amount: '100' })).error)
  await prisma.financialCategory.update({ where: { code: 'CONTRACT_REPAYMENT' }, data: { isActive: true } })
  assert.ok((await saveLedger({ ...input, requestKey: randomUUID() })).error)
  const pay = { ...input, requestKey: randomUUID(), kind: 'REPAYMENT' as const, amount: '2000' }
  assert.ok((await saveLedger({ ...pay, occurredOn: '2026-01-01' })).error)
  assert.ok((await saveLedger(pay)).success)
  assert.ok((await saveLedger(pay)).success)
  assert.ok((await saveLedger({ ...pay, amount: '1999' })).error)
  assert.equal((await getLedger()).contracts[0].remaining, 300000)
  assert.equal((await getLedger()).entries.find(e => e.kind === 'REPAYMENT')?.categoryName, 'ชื่อรับจาก Masterdata')
  assert.ok((await saveLedger({ ...pay, requestKey: randomUUID(), amount: '3000.01' })).error)
  assert.ok((await saveLedger({ ...pay, requestKey: randomUUID(), amount: '3000' })).success)
  assert.equal((await prisma.loanContract.findUniqueOrThrow({ where: { id: contract.id } })).status, 'CLOSED')
  const entries = await prisma.ledgerEntry.findMany({ orderBy: { id: 'asc' } })
  assert.ok((await voidLedger(entries[0].id, 'wrong')).error)
  assert.ok((await voidLedger(entries[2].id, 'duplicate payment')).success)
  assert.equal((await getLedger()).contracts[0].remaining, 300000)
  assert.ok((await voidLedger(entries[1].id, 'wrong')).success)
  assert.ok((await voidLedger(entries[0].id, 'wrong')).success)
  assert.equal((await prisma.loanContract.findUniqueOrThrow({ where: { id: contract.id } })).status, 'WAITING_PAYMENT')
  assert.equal(await prisma.ledgerEntry.count(), 3)
  await prisma.financialCategory.create({ data: { code: 'CAPITAL', nameTh: 'เงินทุน', group: 'CAPITAL', direction: 'IN' } })
  const general = { ...input, requestKey: randomUUID(), kind: 'GENERAL' as const, contractId: null, direction: 'IN', categoryCode: 'CAPITAL', amount: '100.25' }
  assert.ok((await saveLedger({ ...general, direction: 'OUT' })).error)
  assert.ok((await saveLedger(general)).success)
  assert.equal((await getLedger()).entries.find(e => e.requestKey === general.requestKey)?.amountSatang, 10025)
  await prisma.user.update({ where: { id: user.id }, data: { role: 'REVIEWER' } })
  assert.ok((await saveLedger({ ...input, requestKey: randomUUID() })).error)
  await prisma.user.update({ where: { id: user.id }, data: { role: 'ADMIN' } })
  const generalEntry = (await getLedger()).entries.find(e => e.requestKey === general.requestKey)!
  const edit = { id: generalEntry.id, expectedRevision: 0, amount: '200.50', occurredOn: generalEntry.occurredOn, direction: 'IN', categoryCode: 'CAPITAL', channelCode: 'CASH', reference: 'corrected', note: 'corrected note', reason: 'ยอดเดิมผิด' }
  assert.ok((await editLedger(edit)).success)
  assert.ok((await editLedger(edit)).error, 'stale edit must fail')
  const corrected = (await getLedger()).entries.find(e => e.id === generalEntry.id)!
  assert.equal(corrected.amountSatang, 20050)
  assert.equal(corrected.revisions.length, 1)
  assert.equal(JSON.parse(corrected.revisions[0].beforeJson).amountSatang, 10025)
  assert.ok((await editLedger({ ...edit, expectedRevision: 1, reason: '' })).error)
  // A repayment edit must reopen a closed contract and reject overpayment atomically.
  assert.ok((await saveLedger({ ...input, requestKey: randomUUID() })).success)
  const repaymentKey = randomUUID()
  assert.ok((await saveLedger({ ...pay, requestKey: repaymentKey, amount: '5000' })).success)
  const repayment = (await getLedger()).entries.find(e => e.requestKey === repaymentKey)!
  const repaymentEdit = { ...edit, id: repayment.id, expectedRevision: 0, amount: '4000', categoryCode: 'CONTRACT_REPAYMENT' }
  assert.ok((await editLedger(repaymentEdit)).success)
  assert.equal((await getLedger()).contracts[0].remaining, 100000)
  assert.equal((await prisma.loanContract.findUniqueOrThrow({ where: { id: contract.id } })).status, 'PAID')
  assert.ok((await editLedger({ ...repaymentEdit, expectedRevision: 1, amount: '5000.01' })).error)
  assert.equal((await prisma.ledgerEntry.findUniqueOrThrow({ where: { id: repayment.id } })).amountSatang, 400000)
  assert.ok((await editLedger({ ...edit, id: entries[0].id })).error, 'voided entries cannot be edited')
  // Slip and waiver must commit atomically with the cash entry; retries cannot duplicate either.
  const penaltyContract = await prisma.loanContract.create({ data: { borrowerId: borrower.id, lenderId: lender.id, requestKey: randomUUID(), borrowerCode: 'BR-PENALTY', borrowerName: 'Penalty test', lenderName: 'Lender', documentChoice: 'NONE', interestMethod: 'INTEREST_UPFRONT', interestPercent: 0, principalSatang: 60000, interestSatang: 0, netSatang: 60000, repaymentSatang: 60000, createdBy: user.id, status: 'PAID', paidAt: new Date('2026-01-01'), repaymentDueDate: '2026-01-03' } })
  const penaltyPay: LedgerInput = { ...pay, contractId: penaltyContract.id, requestKey: randomUUID(), amount: '500', occurredOn: '2026-01-05', settleRemaining: true, settlementWaiverReason: 'ปิดด้วยยอดโอนจริงที่ยืนยัน', waivePenalty: true, penaltyWaiverReason: 'ยกเว้นตามที่ตกลง' }
  assert.ok((await saveLedger({ ...penaltyPay, penaltyWaiverReason: '' })).error)
  assert.ok((await saveLedger({ ...penaltyPay, settlementWaiverReason: '' })).error)
  assert.ok((await saveLedger(penaltyPay, new File(['not an image'], 'fake.png', { type: 'image/png' }))).error)
  assert.equal(await prisma.ledgerEntry.count({ where: { contractId: penaltyContract.id } }), 0)
  const slip = new File(['%PDF-1.4\nslip test'], 'slip.pdf', { type: 'application/pdf' })
  assert.ok((await saveLedger(penaltyPay, slip)).success)
  assert.ok((await saveLedger(penaltyPay, slip)).success)
  const saved = await prisma.ledgerEntry.findUniqueOrThrow({ where: { requestKey: penaltyPay.requestKey }, include: { slip: true } })
  assert.equal(saved.amountSatang, 50000)
  assert.equal(saved.settlementWaivedSatang, 10000)
  assert.equal(saved.settlementWaiverReason, 'ปิดด้วยยอดโอนจริงที่ยืนยัน')
  assert.equal(saved.penaltyWaivedSatang, 10000)
  assert.equal(saved.penaltyWaiverReason, 'ยกเว้นตามที่ตกลง')
  assert.equal(saved.slip?.originalName, 'slip.pdf')
  assert.equal(Buffer.from(saved.slip!.fileData).toString(), '%PDF-1.4\nslip test')
  assert.equal(await prisma.ledgerSlip.count({ where: { entryId: saved.id } }), 1)
  assert.equal((await getLedger()).contracts.find(c => c.id === penaltyContract.id)?.remaining, 0)
  assert.ok((await voidLedger(saved.id, 'ยกเลิกเพื่อทดสอบ')).success)
  assert.equal((await getLedger()).contracts.find(c => c.id === penaltyContract.id)?.penaltyWaived, 0)
  assert.ok((await prisma.ledgerSlip.findUnique({ where: { entryId: saved.id } })), 'void retains original evidence')
  await prisma.user.update({ where: { id: user.id }, data: { role: 'REVIEWER' } })
  assert.ok((await editLedger({ ...edit, expectedRevision: 1 })).error)

})

test('historical balances exclude disbursements after the reporting date', () => {
  const contract = { repaymentSatang: 10000, status: 'PAID', paidAt: '2026-10-19T17:00:00.000Z', repaymentDueDate: '2026-10-31' }
  const entries = [{ kind: 'DISBURSEMENT', occurredOn: '2026-10-20', amountSatang: 10000 }]
  for (const rows of [entries, []]) {
    const before = contractLedgerBalance(contract, rows, '2026-10-19')
    assert.equal(before.disbursed, false)
    assert.equal(before.remaining, 0)
    assert.equal(contractLedgerBalance(contract, rows, '2026-10-20').remaining, 10000)
  }
})

test('receivables paginate on the server, preserve global totals and load history separately', async () => {
  const borrower = await prisma.borrower.findFirstOrThrow()
  const lender = await prisma.lender.findFirstOrThrow()
  const user = await prisma.user.findFirstOrThrow()
  await prisma.loanContract.createMany({ data: Array.from({ length: 21 }, (_, i) => ({
    borrowerId: borrower.id, lenderId: lender.id, requestKey: randomUUID(), borrowerCode: 'BR-PAGING', borrowerName: `Paging fixture ${i}`, lenderName: 'Lender',
    documentChoice: 'NONE', interestMethod: 'INTEREST_WITH_PRINCIPAL', interestPercent: 0, principalSatang: 10000, interestSatang: 0, netSatang: 10000,
    repaymentSatang: 10000, createdBy: user.id, status: 'PAID', paidAt: new Date('2026-01-01'), repaymentDueDate: '2099-01-01',
  })) })
  const first = await getReceivables({ q: 'Paging fixture', page: 1 })
  const second = await getReceivables({ q: 'Paging fixture', page: 2 })
  assert.equal(first.total, 21)
  assert.equal(first.contracts.length, 20)
  assert.equal(second.contracts.length, 1)
  assert.equal(first.summary.remaining, second.summary.remaining)
  assert.ok(!first.contracts.some(c => c.id === second.contracts[0].id))
  assert.equal((await getReceivables({ q: 'Paging fixture', view: 'OVERDUE' })).total, 0)
  assert.equal((await getReceivables({ q: 'Paging fixture', page: Infinity })).page, 1)
  assert.equal((await getReceivables({ q: 'Paging fixture', page: 999 })).page, 2)
  const paid = await prisma.ledgerEntry.findFirstOrThrow({ where: { kind: 'REPAYMENT' } })
  const history = await getRepaymentHistory(paid.contractId!)
  assert.ok(history.some(e => e.id === paid.id))
})

test('receivables sort oldest overdue first and classify all four aging ranges', async () => {
  const baseline = await getReceivables()
  const borrower = await prisma.borrower.findFirstOrThrow()
  const lender = await prisma.lender.findFirstOrThrow()
  const user = await prisma.user.findFirstOrThrow()
  const today = bangkokToday()
  const before = (days: number) => new Date(Date.parse(today) - days * 86400000).toISOString().slice(0, 10)
  for (const days of [10, 45, 75, 95]) await prisma.loanContract.create({ data: {
    borrowerId: borrower.id, lenderId: lender.id, requestKey: randomUUID(), borrowerCode: 'BR-AGING', borrowerName: `Aging fixture ${days}`, lenderName: 'Lender',
    documentChoice: 'NONE', interestMethod: 'INTEREST_WITH_PRINCIPAL', interestPercent: 0, principalSatang: 10000, interestSatang: 0, netSatang: 10000,
    repaymentSatang: 10000, createdBy: user.id, status: 'PAID', paidAt: new Date(`${before(100)}T00:00:00+07:00`), repaymentDueDate: before(days),
  } })
  const result = await getReceivables({ q: 'Aging fixture', view: 'OVERDUE' })
  assert.deepEqual(result.contracts.map(c => c.overdueDays), [95, 75, 45, 10])
  assert.deepEqual(result.summary.aging.map((bucket, i) => bucket.count - baseline.summary.aging[i].count), [1, 1, 1, 1])
})
