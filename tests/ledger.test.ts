import assert from 'node:assert/strict'
import { after, test } from 'node:test'
import { randomUUID } from 'node:crypto'
import { prisma } from '../lib/prisma'
import { saveLedger, voidLedger, getLedger } from '../app/dashboard/ledger/actions'
import { ledgerAmount, validLedgerDate, type LedgerInput } from '../lib/ledger'
if (!process.env.DATABASE_URL?.includes('loan-ledger-test-')) throw new Error('Isolated database required')
after(() => prisma.$disconnect())
test('amount and date validation', () => {
  assert.equal(ledgerAmount('10.01'), 1001)
  for (const value of ['0', '-1', '1.001', 'NaN', '2000000001']) assert.throws(() => ledgerAmount(value))
  assert.equal(validLedgerDate('2026-02-30'), false)
  assert.equal(validLedgerDate('2099-01-01'), false)
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
  assert.ok((await saveLedger(input)).success)
  assert.ok((await saveLedger(input)).success)
  assert.equal(await prisma.ledgerEntry.count(), 1)
  assert.equal((await getLedger()).entries[0].categoryName, 'ชื่อจ่ายจาก Masterdata')
  await prisma.financialCategory.update({ where: { code: 'CONTRACT_REPAYMENT' }, data: { isActive: false } })
  assert.ok((await saveLedger({ ...input, requestKey: randomUUID(), kind: 'REPAYMENT', amount: '100' })).error)
  await prisma.financialCategory.update({ where: { code: 'CONTRACT_REPAYMENT' }, data: { isActive: true } })
  assert.ok((await saveLedger({ ...input, requestKey: randomUUID() })).error)
  const pay = { ...input, requestKey: randomUUID(), kind: 'REPAYMENT' as const, amount: '2000' }
  assert.ok((await saveLedger({ ...pay, occurredOn: '2026-01-01' })).error)
  assert.ok((await saveLedger(pay)).success)
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
})
