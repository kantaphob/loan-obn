import test from 'node:test'
import assert from 'node:assert/strict'
import { capitalPercent, capitalPosition } from '../lib/capital'

const contract = { principalSatang: 100000, interestSatang: 10000, netSatang: 100000, repaymentSatang: 110000, interestMethod: 'INTEREST_WITH_PRINCIPAL', status: 'PAID', paidAt: '2026-10-01T00:00:00+07:00' }
const payment = { id: 1, kind: 'REPAYMENT', amountSatang: 50000, occurredOn: '2026-10-02', penaltyAssessed: false }
test('separates principal and interest received', () => {
  const result = capitalPosition(contract, [payment], '2026-10-03')!
  assert.equal(result.principalReceived, 40000)
  assert.equal(result.interestReceived, 10000)
  assert.equal(result.principalRemaining, 60000)
  assert.equal(result.cashReceived, 50000)
})
test('upfront interest stays separate from cash receipts and net funding', () => {
  const result = capitalPosition({ ...contract, interestMethod: 'INTEREST_UPFRONT', netSatang: 90000, repaymentSatang: 100000 }, [payment], '2026-10-03')!
  assert.equal(result.cashOut, 90000)
  assert.equal(result.upfrontInterest, 10000)
  assert.equal(result.principalReceived, 50000)
  assert.equal(result.interestReceived, 0)
  assert.equal(result.cashReceived, 50000)
})
test('settlement waiver is never counted as cash returned', () => {
  const result = capitalPosition(contract, [{ ...payment, settlementWaivedSatang: 60000 }], '2026-10-03')!
  assert.equal(result.principalReceived, 40000)
  assert.equal(result.principalWaived, 60000)
  assert.equal(result.principalRemaining, 0)
  assert.equal(result.cashReceived, 50000)
})
test('penalties are excluded from principal and interest', () => {
  const result = capitalPosition({ ...contract, repaymentDueDate: '2026-10-01' }, [{ ...payment, penaltyAssessed: true }], '2026-10-03')!
  assert.equal(result.penaltyReceived, 5000)
  assert.equal(result.principalReceived, 35000)
})
test('legacy receipts, voids, future entries and unfunded contracts', () => {
  const result = capitalPosition({ ...contract, legacyReceivedSatang: 20000 }, [
    { ...payment, voidedAt: new Date() }, { ...payment, occurredOn: '2026-11-01' },
  ], '2026-10-03')!
  assert.equal(result.cashReceived, 20000)
  assert.equal(result.principalReceived, 10000)
  assert.equal(capitalPosition({ ...contract, status: 'WAITING_PAYMENT', paidAt: null }, [], '2026-10-03'), null)
  assert.equal(capitalPercent(0, 0), 0)
})

test('cash balance counts funding and all cash flows once, excluding voids and future entries', async () => {
  const { capitalCash } = await import('../lib/capital')
  const entry = { direction: 'IN', categoryCode: 'OPENING_CAPITAL', amountSatang: 2000000, occurredOn: '2026-10-01' }
  const result = capitalCash([entry,
    { ...entry, categoryCode: 'CAPITAL_INCREASE', amountSatang: 100000 },
    { ...entry, direction: 'OUT', categoryCode: 'LOAN_DISBURSEMENT', amountSatang: 1500000 },
    { ...entry, categoryCode: 'CONTRACT_REPAYMENT', amountSatang: 500000 },
    { ...entry, direction: 'OUT', categoryCode: 'CAPITAL_WITHDRAWAL', amountSatang: 200000 },
    { ...entry, direction: 'OUT', categoryCode: 'EXPENSE', amountSatang: 10000 },
    { ...entry, voidedAt: new Date() }, { ...entry, occurredOn: '2026-11-01' },
  ], '2026-10-24')
  assert.equal(result.balance, 890000)
  assert.equal(result.hasOpening, true)
  assert.equal(capitalCash([], '2026-10-24').hasOpening, false)
})

test('lending account accepts contract cash and explicitly sourced funds only', async () => {
  const { lendingCapitalCash } = await import('../lib/capital')
  const base = { id: 1, direction: 'IN', categoryCode: 'CAPITAL_INCREASE', amountSatang: 100000, occurredOn: '2026-10-24', kind: 'GENERAL', accountScope: 'LENDING' }
  const cash = lendingCapitalCash([base,
    { ...base, id: 2, accountScope: 'GENERAL', amountSatang: 430000000 },
    { ...base, id: 3, accountScope: undefined, categoryCode: 'OPENING_CAPITAL', amountSatang: 430000000 },
    { ...base, id: 4, categoryCode: 'OTHER_INCOME', amountSatang: 430000000 },
    { ...base, id: 5, categoryCode: 'CONTRACT_EXPENSE', direction: 'OUT', amountSatang: 2000000 },
    { ...base, id: 6, kind: 'DISBURSEMENT', contractId: 1, direction: 'OUT', categoryCode: 'LOAN_DISBURSEMENT', amountSatang: 50000 },
    { ...base, id: 7, kind: 'REPAYMENT', contractId: 1, categoryCode: 'CONTRACT_REPAYMENT', amountSatang: 25000 },
    { ...base, id: 8, kind: 'REPAYMENT', contractId: null, categoryCode: 'CONTRACT_REPAYMENT', amountSatang: 999999 },
    { ...base, id: 9, direction: 'OUT', amountSatang: 999999 },
  ], new Set(), '2026-10-26')
  assert.equal(cash.incoming, 125000)
  assert.equal(cash.outgoing, 50000)
  assert.equal(cash.balance, 75000)
})
test('receipt allocations preserve same-day order and never count settlement waiver as principal received', async () => {
  const { capitalRepaymentAllocations } = await import('../lib/capital')
  const entries = [{ ...payment, id: 1, amountSatang: 5000 }, { ...payment, id: 2, amountSatang: 45000, settlementWaivedSatang: 60000 }]
  const result = capitalRepaymentAllocations(contract, entries, '2026-10-03')
  assert.deepEqual(result.get(1), { principal: 0, interest: 5000, penalty: 0 })
  assert.deepEqual(result.get(2), { principal: 40000, interest: 5000, penalty: 0 })
})
