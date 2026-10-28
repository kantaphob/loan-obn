import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { saveContract } from '../app/dashboard/contracts/actions'
import { after, test } from 'node:test'
import { prisma } from '../lib/prisma'
import { savePersuader, searchPersuaderBorrowers } from '../app/dashboard/persuaders/actions'
if (!process.env.DATABASE_URL?.includes('loan-persuaders-test-')) throw new Error('Isolated database required')
after(() => prisma.$disconnect())
test('create/import/edit preserve borrower, prevent duplicate links, reject invalid accounts, and enforce reviewer permissions', async () => {
  const user = await prisma.user.create({ data: { acccode: 'persuader-admin', password: 'test', role: 'ADMIN', level: 0 } })
  const borrower = await prisma.borrower.create({ data: { nickname: 'source', firstName: 'Source', lastName: 'Borrower', phone: '0812345678' } })
  const results = await searchPersuaderBorrowers('Source')
  assert.equal(results[0].id, borrower.id)
  const input = { name: 'Source Borrower', phone: borrower.phone, bankCode: '', bankAccount: '', bankAccountName: '', notes: '', isActive: true, borrowerId: borrower.id }
  const result = await savePersuader(input)
  assert.equal((await prisma.persuader.findUniqueOrThrow({ where: { id: result.id } })).borrowerId, borrower.id)
  await assert.rejects(savePersuader(input), /เป็น Persuader แล้ว/)
  await savePersuader({ ...input, id: result.id, name: 'Updated', isActive: false })
  assert.equal((await prisma.borrower.findUniqueOrThrow({ where: { id: borrower.id } })).firstName, 'Source')
  assert.equal((await prisma.persuader.findUniqueOrThrow({ where: { id: result.id } })).isActive, false)
  await assert.rejects(savePersuader({ ...input, borrowerId: null, bankCode: 'INVALID' }), /บัญชี/)
  await assert.rejects(savePersuader({ ...input, borrowerId: 99999 }), /ไม่พบ Borrower/)
  await assert.rejects(savePersuader({ ...input, id: result.id, borrowerId: null }), /ไม่สามารถเปลี่ยน/)
  const lender = await prisma.lender.create({ data: { nickname: 'Lender' } })
  await prisma.persuader.update({ where: { id: result.id }, data: { isActive: true } })
  const contract = await saveContract({ borrowerId: borrower.id, lenderId: lender.id, persuaderId: result.id, persuaderSharePercent: '5', requestKey: randomUUID(), documentChoice: 'NONE', signingMethod: 'PRINT', documentPackage: 'LOAN', interestMethod: 'INTEREST_WITH_PRINCIPAL', internalRateCode: 'CUSTOM', internalCustomRate: '20', principal: '10000', scheduledDisbursementDate: '2026-10-27', repaymentDueDate: '2026-11-27' })
  assert.ok(contract.code, contract.error)
  const savedContract = await prisma.loanContract.findFirstOrThrow({ where: { persuaderId: result.id } })
  assert.equal(savedContract.persuaderShareSatang, 50000)
  assert.equal(savedContract.persuaderNameSnapshot, 'Updated')
  await savePersuader({ ...input, id: result.id, name: 'Renamed' })
  assert.equal((await prisma.loanContract.findUniqueOrThrow({ where: { id: savedContract.id } })).persuaderNameSnapshot, 'Updated')
  await prisma.user.update({ where: { id: user.id }, data: { role: 'REVIEWER' } })
  await assert.rejects(savePersuader({ ...input, borrowerId: null }), /ไม่มีสิทธิ์/)
})
