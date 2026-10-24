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
