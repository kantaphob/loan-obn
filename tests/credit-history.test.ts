import assert from 'node:assert/strict'
import { paymentBehavior, agingBands, closureMethod, parseRevision, outstandingBreakdown } from '../lib/credit-history'
const contract = { repaymentSatang: 10000, status: 'PAID', paidAt: '2026-01-01', repaymentDueDate: '2026-01-10' }
const payment = { id: 1, kind: 'REPAYMENT', amountSatang: 10000, occurredOn: '2026-01-10' }
assert.equal(paymentBehavior(contract, [payment], '2026-02-01'), 'ON_TIME')
assert.equal(paymentBehavior(contract, [{ ...payment, occurredOn: '2026-01-11', penaltyAssessed: false }], '2026-02-01'), 'LATE')
assert.equal(paymentBehavior(contract, [{ ...payment, voidedAt: '2026-01-11' }], '2026-02-01'), 'OVERDUE')
assert.equal(paymentBehavior(contract, [], '2026-01-09'), 'CURRENT')
assert.equal(paymentBehavior({ ...contract, paidAt: null, status: 'DRAFT' }, [], '2026-02-01'), 'PENDING')
assert.equal(paymentBehavior({ ...contract, legacyReceivedSatang: 10000 }, [], '2026-02-01'), 'UNKNOWN')
assert.equal(paymentBehavior({ ...contract, repaymentDueDate: null }, [payment], '2026-02-01'), 'UNKNOWN')
assert.equal(paymentBehavior(contract, [{ ...payment, occurredOn: '2026-02-02' }], '2026-02-01'), 'OVERDUE')
assert.equal(paymentBehavior(contract, [{ ...payment, amountSatang: 5000, settlementWaivedSatang: 5000 }], '2026-02-01'), 'ON_TIME')
assert.equal(paymentBehavior({ ...contract, legacyReceivedSatang: 5000 }, [{ ...payment, amountSatang: 5000 }], '2026-02-01'), 'ON_TIME')
assert.equal(paymentBehavior(contract, [{ ...payment, amountSatang: 20000 }], '2026-02-01'), 'UNKNOWN')
for (const days of [1, 30, 31, 60, 61, 90, 91, 300]) assert.equal(agingBands.filter(b => days >= b.min && days <= b.max).length, 1)
console.log('Credit history: 12 checks passed')

const closed = { disbursed: true, remaining: 0, invalid: false, settlementWaived: 0, penaltyWaived: 0 }
assert.equal(closureMethod(closed, false), 'FULL_PAYMENT')
assert.equal(closureMethod({ ...closed, settlementWaived: 5000 }, false), 'SETTLEMENT_WAIVER')
assert.equal(closureMethod({ ...closed, penaltyWaived: 5000 }, false), 'PENALTY_WAIVER')
assert.equal(closureMethod({ ...closed, settlementWaived: 100, penaltyWaived: 100 }, true), 'SETTLEMENT_WAIVER')
assert.equal(closureMethod(closed, true), 'HISTORICAL')
assert.equal(closureMethod({ ...closed, remaining: 100 }, false), 'OPEN')
assert.equal(closureMethod({ ...closed, invalid: true }, false), 'UNKNOWN')
assert.equal(parseRevision('invalid'), null)
assert.equal(parseRevision('null'), null)
assert.equal(parseRevision('[]'), null)
assert.deepEqual(parseRevision('{"amountSatang":100}'), { amountSatang: 100 })
console.log('Closure method and revision checks passed')

// Waiving a late fee closes the debt but preserves the late payment date.
const waivedLate = { ...payment, occurredOn: '2026-01-11', penaltyAssessed: true, penaltyWaivedSatang: 5000 }
assert.equal(paymentBehavior(contract, [waivedLate], '2026-02-01'), 'LATE')
assert.equal(closureMethod({ ...closed, penaltyWaived: 5000 }, false), 'PENALTY_WAIVER')
console.log('Late payment with waived penalty remains LATE')

assert.deepEqual(outstandingBreakdown(100000, { disbursed: true, baseRemaining: 120000, penaltyRemaining: 5000 }), { principal: 100000, interest: 20000, penalty: 5000, total: 125000 })
assert.deepEqual(outstandingBreakdown(100000, { disbursed: true, baseRemaining: 110000, penaltyRemaining: 0 }), { principal: 100000, interest: 10000, penalty: 0, total: 110000 })
assert.deepEqual(outstandingBreakdown(100000, { disbursed: true, baseRemaining: 90000, penaltyRemaining: 0 }), { principal: 90000, interest: 0, penalty: 0, total: 90000 })
assert.deepEqual(outstandingBreakdown(100000, { disbursed: true, baseRemaining: 0, penaltyRemaining: 0 }), { principal: 0, interest: 0, penalty: 0, total: 0 })
assert.deepEqual(outstandingBreakdown(100000, { disbursed: false, baseRemaining: 120000, penaltyRemaining: 5000 }), { principal: 0, interest: 0, penalty: 0, total: 0 })
console.log('Outstanding breakdown checks passed')
