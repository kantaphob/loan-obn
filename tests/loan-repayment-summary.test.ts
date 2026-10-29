import assert from 'node:assert/strict'
import { test } from 'node:test'
import { buildLoanRepaymentSummary, loanSummaryCsv } from '../lib/loan-repayment-summary'

const contract = {
  id: 1, borrowerId: 10, borrowerName: 'ผู้กู้ ก', borrowerCode: 'BR-00010', legacySourceCode: 'LM26-001',
  principalSatang: 100000, interestSatang: 20000, repaymentSatang: 120000, interestMethod: 'INTEREST_WITH_PRINCIPAL',
  paidAt: '2026-01-01T00:00:00+07:00', repaymentDueDate: '2026-01-31', status: 'PAID', ledgerEntries: [],
}

test('groups by borrower identity, keeps all contracts, and reconciles row/person/grand totals', () => {
  const data = buildLoanRepaymentSummary([
    contract,
    { ...contract, id: 2, interestMethod: 'INTEREST_UPFRONT', repaymentSatang: 100000 },
    { ...contract, id: 3, borrowerId: 20, borrowerCode: 'BR-00020' },
  ], '2026-01-15')
  assert.equal(data.borrowerCount, 2, 'people with the same name must remain separate')
  assert.equal(data.people.find(p => p.id === 10)?.contracts.length, 2)
  assert.deepEqual(data.totals, { principal: 300000, interest: 40000, penalty: 0, total: 340000 })
  for (const person of data.people) {
    assert.equal(person.amounts.total, person.contracts.reduce((sum, c) => sum + c.total, 0))
    for (const row of person.contracts) assert.equal(row.total, row.principal + row.interest + row.penalty)
  }
  const many = buildLoanRepaymentSummary(Array.from({ length: 25 }, (_, i) => ({ ...contract, id: i + 1 })), '2026-01-15')
  assert.equal(many.contractCount, 25, 'summary must not inherit the repayment page pagination')
  assert.equal(many.totals.total, 3000000)
})

test('upfront interest is shown as already received and never added to the amount to repay', () => {
  const data = buildLoanRepaymentSummary([{ ...contract, principalSatang: 200000, interestSatang: 40000,
    repaymentSatang: 200000, interestMethod: 'INTEREST_UPFRONT' }], '2026-01-15')
  const row = data.people[0].contracts[0]
  assert.equal(row.principal, 200000)
  assert.equal(row.interest, 0)
  assert.equal(row.upfrontInterestReceived, 40000)
  assert.equal(row.total, 200000)
})

test('partial payment allocation separates penalties, interest and principal consistently', () => {
  const data = buildLoanRepaymentSummary([{ ...contract, repaymentDueDate: '2026-01-03',
    ledgerEntries: [{ id: 1, kind: 'REPAYMENT', amountSatang: 20000, occurredOn: '2026-01-05', penaltyAssessed: true }] }], '2026-01-06')
  assert.deepEqual(data.totals, { principal: 100000, interest: 10000, penalty: 5000, total: 115000 })
  const legacy = buildLoanRepaymentSummary([{ ...contract, legacyReceivedSatang: 25000 }], '2026-01-15')
  assert.deepEqual(legacy.totals, { principal: 95000, interest: 0, penalty: 0, total: 95000 })
})

test('excludes unfunded, cancelled and fully settled contracts, including a settlement waiver', () => {
  const data = buildLoanRepaymentSummary([
    { ...contract, status: 'WAITING_PAYMENT', paidAt: null },
    { ...contract, id: 2, status: 'CANCELLED' },
    { ...contract, id: 3, paidAt: '2026-02-01T00:00:00+07:00' },
    { ...contract, id: 4, status: 'CLOSED', ledgerEntries: [{ kind: 'REPAYMENT', amountSatang: 110000, settlementWaivedSatang: 10000, occurredOn: '2026-01-10' }] },
  ], '2026-01-15')
  assert.equal(data.contractCount, 0)
  assert.deepEqual(data.totals, { principal: 0, interest: 0, penalty: 0, total: 0 })
})

test('search totals match only displayed contracts and CSV protects formula-like names', () => {
  const data = buildLoanRepaymentSummary([contract, { ...contract, id: 2, legacySourceCode: null }], '2026-01-15', 'LM26-001')
  assert.equal(data.contractCount, 1)
  assert.equal(data.totals.total, 120000)
  const csv = loanSummaryCsv(buildLoanRepaymentSummary([{ ...contract, borrowerName: '=1+1' }], '2026-01-15'))
  assert.ok(csv.startsWith('\uFEFF'))
  assert.ok(csv.includes('"\'=1+1"'))
  assert.ok(csv.includes('"1000.00","200.00","0.00","1200.00"'))
  assert.ok(csv.includes('รวมทั้งหมด'))
})

test('personal text includes only that borrower and reconciles amounts without charging prepaid interest twice', async () => {
  const { borrowerSummaryText } = await import('../lib/loan-repayment-summary')
  const data = buildLoanRepaymentSummary([contract,
    { ...contract, id: 2, interestMethod: 'INTEREST_UPFRONT', repaymentSatang: 100000 },
    { ...contract, id: 3, borrowerId: 20, borrowerName: 'ผู้กู้คนอื่น' },
  ], '2026-01-15')
  const person = data.people.find(p => p.id === 10)!
  const text = borrowerSummaryText(person, data.asOf)
  assert.ok(text.startsWith('ข้อมูล ณ วันที่ 15/01/2026\n'))
  assert.ok(!text.includes('ผู้กู้:'))
  assert.ok(!text.includes('เลขสัญญา เงินต้นคงค้าง'))
  assert.ok(text.includes('CT-000001 1,000 200 0 1,200 31/01/2026'))
  assert.ok(text.includes('CT-000002 1,000 0 0 1,000 31/01/2026'))
  assert.ok(text.includes('รวม 2,000 200 0 2,200 บาท'))
  assert.ok(!text.includes('ผู้กู้คนอื่น'))
  assert.ok(!text.includes('CT-000003'))
  assert.ok(!text.includes('เฉพาะรายการที่แสดง'))
  assert.ok(borrowerSummaryText(person, data.asOf, true).includes('เฉพาะรายการที่แสดงตามการค้นหา'))
})
