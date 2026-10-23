import assert from 'node:assert/strict'
import { after, test } from 'node:test'
import { randomUUID } from 'node:crypto'
import { prisma } from '../lib/prisma'
import { contractAmounts, type ContractDraft } from '../lib/contracts'
import { saveContract, listContracts } from '../app/dashboard/contracts/actions'

if (!process.env.DATABASE_URL?.includes('loan-contract-test-')) throw new Error('Tests require an isolated loan-contract-test database')
after(() => prisma.$disconnect())

test('interest timing and rounding', () => {
  assert.deepEqual(contractAmounts('5000', 20, 'INTEREST_UPFRONT'), { principalSatang: 500000, interestSatang: 100000, netSatang: 400000, repaymentSatang: 500000 })
  assert.equal(contractAmounts('5000', 20, 'INTEREST_WITH_PRINCIPAL').repaymentSatang, 600000)
  assert.equal(contractAmounts('100.01', 7.5, 'INTEREST_UPFRONT').interestSatang, 750)
  assert.equal(contractAmounts('5000', 0, 'INTEREST_WITH_PRINCIPAL').repaymentSatang, 500000)
  assert.throws(() => contractAmounts('-10', 20, 'INTEREST_UPFRONT'))
  assert.throws(() => contractAmounts('100.001', 20, 'INTEREST_UPFRONT'))
  assert.throws(() => contractAmounts('100', Number.NaN, 'INTEREST_UPFRONT'))
})

test('save, retry, validation and persisted listing', async () => {
  await prisma.user.create({ data: { acccode: 'test-admin', password: 'test-only', role: 'ADMIN', level: 0 } })
  const borrower = await prisma.borrower.create({ data: { nickname: 'Test', firstName: 'Test', lastName: 'Borrower', phone: '', status: 'WAITING_PAYMENT', borrowerId: 'BR-TEST' } })
  const lender = await prisma.lender.create({ data: { nickname: 'Test lender', firstName: 'Test', lastName: 'Lender' } })
  await prisma.interestRate.create({ data: { code: 'TEST20', percent: 20 } })
  const draft: ContractDraft = { borrowerId: borrower.id, lenderId: lender.id, requestKey: randomUUID(), documentChoice: 'NONE', signingMethod: 'PRINT', documentPackage: 'LOAN', interestMethod: 'INTEREST_UPFRONT', rateCode: 'TEST20', customRate: '', principal: '5000' }
  const result = await saveContract(draft)
  assert.equal(result.code, 'CT-000001')
  assert.deepEqual(await saveContract(draft), result)
  assert.equal(await prisma.loanContract.count(), 1)
  const [saved] = await listContracts()
  assert.equal(saved.status, 'WAITING_PAYMENT')
  assert.equal(saved.netSatang, 400000)
  assert.equal(saved.repaymentSatang, 500000)
  assert.equal(saved.signingMethod, null)
  assert.equal(saved.paidAt, null)
  assert.equal((await prisma.borrower.findUniqueOrThrow({ where: { id: borrower.id } })).usedLimit, 0)
  const custom = await saveContract({ ...draft, requestKey: randomUUID(), rateCode: 'CUSTOM', customRate: '7.5', interestMethod: 'INTEREST_WITH_PRINCIPAL', documentChoice: 'CREATE', signingMethod: 'E_SIGNATURE', documentPackage: 'LOAN_GUARANTEE' })
  assert.ok(custom.code)
  assert.equal((await prisma.loanContract.findFirstOrThrow({ orderBy: { id: 'desc' } })).repaymentSatang, 537500)
  assert.ok((await saveContract({ ...draft, requestKey: randomUUID(), documentChoice: 'CREATE', signingMethod: '' })).error)
  await prisma.interestRate.update({ where: { code: 'TEST20' }, data: { isActive: false } })
  assert.ok((await saveContract({ ...draft, requestKey: randomUUID() })).error)
  assert.equal(await prisma.loanContract.count(), 2)
})
