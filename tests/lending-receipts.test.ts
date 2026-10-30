import test from 'node:test'
import assert from 'node:assert/strict'
import { lendingReceiptPeriods } from '../lib/lending-receipts'
const base = { accountScope: 'LENDING', kind: 'REPAYMENT', contractId: 1, direction: 'IN', categoryCode: 'CONTRACT_REPAYMENT', amountSatang: 10000, occurredOn: '2026-01-01' }
test('six calendar months cross years, year and month totals stay distinct', () => {
  const report = lendingReceiptPeriods([
    { ...base, occurredOn: '2025-08-01' }, { ...base, occurredOn: '2025-07-31' }, base,
    { ...base, kind: 'GENERAL', contractId: null, categoryCode: 'CAPITAL_INCREASE', amountSatang: 50000 },
    { ...base, occurredOn: '2026-01-16' }, { ...base, accountScope: 'GENERAL' },
    { ...base, voidedAt: new Date() }, { ...base, direction: 'OUT' },
  ], '2026-01-15')
  assert.equal(report.sixMonths.from, '2025-08-01')
  assert.equal(report.sixMonths.total, 70000)
  assert.equal(report.thisMonth.total, 60000)
  assert.equal(report.thisYear.total, 60000)
  assert.equal(report.thisYear.repayments, 10000)
  assert.equal(report.thisYear.funding, 50000)
  assert.equal(report.months[0].total, 60000)
  assert.equal(report.months[1].future, true)
  assert.equal(report.months[1].total, 0)
})
test('empty months and year-end dates remain accurate', () => {
  const report = lendingReceiptPeriods([{ ...base, occurredOn: '2026-12-31' }], '2026-12-31')
  assert.equal(report.months.length, 12)
  assert.equal(report.months[10].total, 0)
  assert.equal(report.months[11].total, 10000)
  assert.equal(lendingReceiptPeriods([], '2026-10-30').thisYear.total, 0)
})
test('principal, interest, penalties and funding reconcile with monthly cash receipts', () => {
  const report = lendingReceiptPeriods([
    { ...base, amountSatang: 60000, allocation: { principal: 40000, interest: 15000, penalty: 5000 } },
    { ...base, kind: 'GENERAL', contractId: null, categoryCode: 'CAPITAL_INCREASE', amountSatang: 50000 },
  ], '2026-01-31')
  assert.equal(report.thisMonth.total, 110000)
  assert.equal(report.thisMonth.funding, 50000)
  assert.equal(report.thisMonth.principal, 40000)
  assert.equal(report.thisMonth.interest, 15000)
  assert.equal(report.thisMonth.penalty, 5000)
  assert.equal(report.thisMonth.unallocated, 0)
})
test('chart series reconcile with selected periods and distinguish future days', () => {
  const report = lendingReceiptPeriods([{ ...base, occurredOn: '2025-08-01' }, base], '2026-01-15')
  assert.equal(report.sixMonthRows.reduce((sum, row) => sum + row.total, 0), report.sixMonths.total)
  assert.equal(report.days.length, 31)
  assert.equal(report.days.reduce((sum, row) => sum + row.total, 0), report.thisMonth.total)
  assert.equal(report.days[15].future, true)
  assert.equal(lendingReceiptPeriods([], '2024-02-15').days.length, 29)
})
