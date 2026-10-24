import assert from 'node:assert/strict'
import { test, after } from 'node:test'
import { randomUUID } from 'node:crypto'
import { prisma } from '../lib/prisma'
import { closeAccounts } from '../app/dashboard/ac/actions'
import { getMonthReview, lockAccountingMonth, saveRepaymentAllocation } from '../app/dashboard/ac/month-actions'
if (!process.env.DATABASE_URL?.includes('loan-closing-test-')) throw new Error('Isolated database required')
after(() => prisma.$disconnect())
test('monthly reviews, allocation, carryforward and annual closing stay separate and immutable', async () => {
  const user = await prisma.user.create({ data: { acccode: 'closing-test', password: 'test', role: 'REVIEWER', level: 0 } })
  const annual = { requestKey: randomUUID(), startOn: '2024-01-01', endOn: '2024-12-31', note: 'Checked trial balance', balances: [{ code: '4001', name: 'Interest', type: 'REVENUE' as const, amount: '10' }] }
  assert.equal((await closeAccounts(annual)).ok, false)
  assert.equal((await lockAccountingMonth({ requestKey: randomUUID(), month: '2024-01', note: 'reviewed', reviewToken: '' })).ok, false)
  await prisma.user.update({ where: { id: user.id }, data: { role: 'ADMIN' } })
  const borrower = await prisma.borrower.create({ data: { nickname: 'test', firstName: 'Test', lastName: 'Closing', phone: '' } })
  const lender = await prisma.lender.create({ data: { nickname: 'lender' } })
  const contract = await prisma.loanContract.create({ data: { requestKey: randomUUID(), borrowerId: borrower.id, lenderId: lender.id, borrowerCode: 'B1', borrowerName: 'Test Closing', lenderName: 'Lender', documentChoice: 'NONE', interestMethod: 'INTEREST_WITH_PRINCIPAL', interestPercent: 10, principalSatang: 10000, interestSatang: 1000, netSatang: 10000, repaymentSatang: 11000, createdBy: user.id, status: 'PAID', paidAt: new Date('2024-01-01T00:00:00+07:00'), repaymentDueDate: '2028-01-31' } })
  const base = { contractId: contract.id, categoryCode: 'TEST', categoryName: 'Test', channelCode: 'CASH', channelName: 'Cash', createdBy: user.id }
  await prisma.ledgerEntry.create({ data: { ...base, requestKey: randomUUID(), kind: 'DISBURSEMENT', direction: 'OUT', amountSatang: 10000, occurredOn: '2024-01-01' } })
  const receipt = await prisma.ledgerEntry.create({ data: { ...base, requestKey: randomUUID(), kind: 'REPAYMENT', direction: 'IN', amountSatang: 6000, occurredOn: '2024-01-15', penaltyAssessed: true } })
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
  assert.equal((await closeAccounts(annual)).ok, false, 'annual closing requires all twelve months')
  assert.equal((await closeAccounts({ ...annual, endOn: '2024-01-31' })).ok, false, 'monthly financial journal closing rejected')
  const march = await getMonthReview('2024-03')
  assert.equal((await lockAccountingMonth({ requestKey: randomUUID(), month: '2024-03', note: 'skip', reviewToken: march.reviewToken })).ok, false, 'cannot skip February')
  for (let i = 2; i <= 12; i++) {
    const month = `2024-${String(i).padStart(2, '0')}`
    const current = await getMonthReview(month)
    assert.equal(current.snapshot.outstandingSatang, 5000, 'loan balance carries across months')
    assert.equal((await lockAccountingMonth({ requestKey: randomUUID(), month, note: 'Checked empty month and carryforward', reviewToken: current.reviewToken })).ok, true)
  }
  assert.equal((await closeAccounts(annual)).ok, true)
  assert.equal((await closeAccounts(annual)).ok, true)
  assert.equal(await prisma.accountingClose.count(), 1)
  assert.equal(await prisma.ledgerEntry.count(), 2, 'no cash movement created by month or year close')
  const stored = await prisma.accountingClose.findFirstOrThrow()
  assert.equal(stored.kind, 'YEAR_END')
  assert.equal(stored.profitSatang, 1000)
  assert.ok(JSON.parse(stored.journalJson).some((line: { code: string }) => line.code === 'INCOME_SUMMARY'))
  assert.equal((await closeAccounts({ ...annual, equity: 'CAPITAL' })).ok, false)
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
})
