import assert from 'node:assert/strict'
import { test } from 'node:test'
import { cashCarryforward, type CashMovement } from '../lib/cash-carryforward'
const entries: CashMovement[] = [
  { source: 'HISTORICAL', accountCode: 'DAILY_2025', occurredOn: '2025-01-01', direction: 'IN', amountSatang: 100000 },
  { source: 'HISTORICAL', accountCode: 'DAILY_2025', occurredOn: '2025-12-31', direction: 'OUT', amountSatang: 30000 },
  { source: 'LEDGER', categoryCode: 'OPENING_CAPITAL', occurredOn: '2026-01-01', direction: 'IN', amountSatang: 1057000 },
  { source: 'LEDGER', occurredOn: '2026-01-15', direction: 'OUT', amountSatang: 10000 },
  { source: 'LEDGER', occurredOn: '2026-02-01', direction: 'IN', amountSatang: 5000 },
]
test('prior year closing becomes new year opening without being counted as income again', () => {
  const previous = cashCarryforward(entries, '2025-01-01', '2025-12-31')
  const current = cashCarryforward(entries, '2026-01-01', '2026-12-31')
  assert.equal(previous.available, true); assert.equal(current.available, true)
  assert.equal(previous.closing, 70000)
  assert.equal(current.opening, previous.closing)
  assert.equal(current.incoming, 1062000, 'new capital is a new receipt, distinct from opening balance')
  assert.equal(current.recordedOpeningCapital, 1057000)
  assert.equal(current.closing, 1122000)
  assert.equal(cashCarryforward(entries, '2026-01-01', '2026-12-31').closing, current.closing, 'repeat reads never create duplicate receipt')
  assert.equal(entries.length, 5)
})
test('December to January and later month openings remain continuous', () => {
  const january = cashCarryforward(entries, '2026-01-01', '2026-01-31')
  const february = cashCarryforward(entries, '2026-02-01', '2026-02-28')
  const emptyMarch = cashCarryforward(entries, '2026-03-01', '2026-03-31')
  assert.equal(february.opening, january.closing)
  assert.equal(emptyMarch.opening, february.closing)
  assert.equal(emptyMarch.closing, emptyMarch.opening)
  assert.equal(cashCarryforward(entries, '2027-01-01', '2027-12-31').opening, emptyMarch.closing)
})
test('negative closing balances, empty history, voids and future transactions are handled without resets', () => {
  const overdrawn: CashMovement[] = [{ source: 'LEDGER', occurredOn: '2025-12-31', direction: 'OUT', amountSatang: 10000 }]
  assert.equal(cashCarryforward(overdrawn, '2026-01-01', '2026-01-31').opening, -10000)
  assert.equal(cashCarryforward([], '2026-01-01', '2026-01-31').closing, 0)
  const same = cashCarryforward([...entries, { ...entries[2], voidedAt: new Date() }, { ...entries[2], occurredOn: '2027-01-01' }], '2026-01-01', '2026-12-31')
  assert.equal(same.closing, 1122000)
})
test('overlapping source years do not silently double-count bank archive and live ledger', () => {
  const mixed = cashCarryforward([...entries, { source: 'LEDGER', occurredOn: '2025-01-01', direction: 'IN', amountSatang: 100000 }], '2026-01-01', '2026-12-31')
  assert.equal(mixed.available, false)
  assert.equal(mixed.closing, null)
  assert.deepEqual(mixed.overlappingYears, ['2025'])
})
test('multiple historical accounts in a year require source reconciliation', () => {
  const mixed = cashCarryforward([...entries, { ...entries[0], accountCode: 'ANOTHER_BANK' }], '2026-01-01', '2026-12-31')
  assert.equal(mixed.available, false)
})
