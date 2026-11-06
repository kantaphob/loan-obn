import assert from 'node:assert/strict'
import test from 'node:test'
import { personalAmount, personalDate, personalSummary } from '../lib/personal'

test('personal budget calculations count only active expenses and preserve unfinished funding needs', () => {
  const expense = (amountSatang: number, direction = 'OUT', voidedAt: unknown = null) => ({ amountSatang, direction, voidedAt })
  const rows = personalSummary([
    { category: 'GURUACADEMY', status: 'ACTIVE', budgetSatang: 10000, expenses: [expense(3000), expense(9000, 'IN'), expense(8000, 'OUT', 'cancelled')] },
    { category: 'GURUACADEMY', status: 'DONE', budgetSatang: 20000, expenses: [expense(25000)] },
    { category: 'GURUACADEMY', status: 'CANCELLED', budgetSatang: 90000, expenses: [expense(70000)] },
  ])
  assert.deepEqual(rows.find(r => r.key === 'GURUACADEMY'), { key: 'GURUACADEMY', label: 'guruacademy', budget: 30000, spent: 28000, needed: 7000 })
})

test('personal input validation rejects invalid dates and money', () => {
  assert.equal(personalAmount('123.45'), 12345)
  assert.equal(personalAmount('0'), 0)
  for (const value of ['-1', '1.001', 'NaN', '20000001']) assert.throws(() => personalAmount(value))
  assert.equal(personalDate('2028-02-29'), '2028-02-29')
  assert.equal(personalDate(''), '')
  assert.throws(() => personalDate('2026-02-29'))
})
