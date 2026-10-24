import assert from 'node:assert/strict'
import { test } from 'node:test'
import { readFileSync } from 'node:fs'
import Database from 'better-sqlite3'
import { monthRange, nextMonth, allocationAmount } from '../lib/monthly-accounting'
import { closingJournal } from '../lib/account-closing'

for (const [revenue, expense] of [['100.25', '40.10'], ['40', '100'], ['100', '100']]) {
  test(`balanced closing journal ${revenue}/${expense}`, () => {
    const result = closingJournal([{ code: '4001', name: 'ดอกเบี้ย', type: 'REVENUE', amount: revenue }, { code: '5001', name: 'ค่าใช้จ่าย', type: 'EXPENSE', amount: expense }])
    assert.equal(result.profit, Math.round(Number(revenue) * 100) - Math.round(Number(expense) * 100))
    assert.equal(result.lines.reduce((s, l) => s + l.debit, 0), result.lines.reduce((s, l) => s + l.credit, 0))
    assert.equal(result.lines[0].credit, 0)
    assert.equal(result.lines.find(l => l.code === '5001')!.debit, 0)
    for (const step of [1, 2, 3, 4]) {
      const lines = result.lines.filter(l => l.step === step)
      assert.equal(lines.reduce((s, l) => s + l.debit, 0), lines.reduce((s, l) => s + l.credit, 0))
    }
    const summary = result.lines.filter(l => l.code === 'INCOME_SUMMARY')
    assert.equal(summary.reduce((s, l) => s + l.debit - l.credit, 0), 0)
  })
}
test('all temporary accounts close to zero; dividends do not reduce profit', () => {
  const result = closingJournal([
    { code: '4001', name: 'Revenue', type: 'REVENUE', amount: '1000' },
    { code: '5001', name: 'Expense', type: 'EXPENSE', amount: '400' },
    { code: '3002', name: 'Dividend', type: 'DIVIDEND', amount: '200' },
  ])
  assert.equal(result.profit, 60000)
  const net = (code: string) => result.lines.filter(l => l.code === code).reduce((s, l) => s + l.debit - l.credit, 0)
  assert.equal(-100000 + net('4001'), 0)
  assert.equal(40000 + net('5001'), 0)
  assert.equal(20000 + net('3002'), 0)
  assert.equal(net('INCOME_SUMMARY'), 0)
  assert.equal(net('RETAINED_EARNINGS'), -40000)
  for (const step of [1, 2, 3, 4]) {
    const lines = result.lines.filter(l => l.step === step)
    assert.equal(lines.reduce((s, l) => s + l.debit - l.credit, 0), 0)
  }
})
test('loss and drawings close to capital independently', () => {
  const rows = [{ code: '5001', name: 'Expense', type: 'EXPENSE' as const, amount: '100' }, { code: '3002', name: 'Drawing', type: 'DRAWING' as const, amount: '50' }]
  const result = closingJournal(rows, 'CAPITAL')
  assert.equal(result.profit, -10000)
  assert.equal(result.lines.filter(l => l.code === 'CAPITAL').reduce((s, l) => s + l.debit - l.credit, 0), 15000)
  assert.throws(() => closingJournal(rows))
  assert.throws(() => closingJournal([{ code: '3003', name: 'Dividend', type: 'DIVIDEND', amount: '50' }], 'CAPITAL'))
})
test('distribution-only period has zero profit and no income summary movement', () => {
  const result = closingJournal([{ code: '3003', name: 'Dividend', type: 'DIVIDEND', amount: '50' }])
  assert.equal(result.profit, 0)
  assert.ok(result.lines.every(l => l.step === 4))
  assert.equal(result.lines.reduce((s, l) => s + l.debit - l.credit, 0), 0)
})
test('invalid, duplicate and reserved balances rejected', () => {
  const row = { code: '4001', name: 'Interest', type: 'REVENUE' as const, amount: '100' }
  for (const amount of ['-1', '0', 'NaN', '1.001', '2000000001']) assert.throws(() => closingJournal([{ ...row, amount }]))
  assert.throws(() => closingJournal([row, row]))
  assert.throws(() => closingJournal([{ ...row, code: 'RETAINED_EARNINGS' }]))
  assert.throws(() => closingJournal([]))
  assert.throws(() => closingJournal([{ ...row, code: 'income_summary' }]))
  assert.throws(() => closingJournal([{ ...row, code: 'CAPITAL' }]))
  assert.throws(() => closingJournal([{ ...row, code: 'income' }, { ...row, code: 'INCOME' }]))
})
test('closed dates cannot be inserted, changed, moved out or deleted; journals immutable', () => {
  const db = new Database(':memory:')
  try {
    db.exec('CREATE TABLE ledger_entry (id INTEGER PRIMARY KEY, occurredOn TEXT, amountSatang REAL, voidedAt TEXT)')
    db.exec(readFileSync('prisma/migrations/20261025160000_accounting_close/migration.sql', 'utf8'))
    db.exec("INSERT INTO ledger_entry VALUES (1, '2026-09-01', 100, NULL), (2, '2026-10-01', 200, NULL)")
    const close = db.prepare('INSERT INTO accounting_close(requestKey,startOn,endOn,note,balancesJson,journalJson,cashSnapshotJson,profitSatang,createdBy) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)')
    close.run('key', '2026-09-01', '2026-09-30', 'checked', '[]', '[]', '[]', 0, 'admin')
    for (const sql of [
      "INSERT INTO ledger_entry VALUES (3, '2026-09-30', 100, NULL)",
      "INSERT INTO ledger_entry VALUES (3, '2026-08-01', 100, NULL)",
      'UPDATE ledger_entry SET amountSatang=300 WHERE id=1',
      "UPDATE ledger_entry SET occurredOn='2026-10-02' WHERE id=1",
      "UPDATE ledger_entry SET occurredOn='2026-09-30' WHERE id=2",
      "UPDATE ledger_entry SET voidedAt='2026-10-01' WHERE id=1",
      'DELETE FROM ledger_entry WHERE id=1',
    ]) assert.throws(() => db.exec(sql), /Accounting period is closed/)
    assert.throws(() => db.exec('DELETE FROM accounting_close'), /immutable/)
    assert.throws(() => db.exec("UPDATE accounting_close SET endOn='2026-08-31'"), /immutable/)
    assert.throws(() => close.run('overlap', '2026-09-30', '2026-10-31', '', '[]', '[]', '[]', 0, 'admin'), /overlapping/)
    db.exec('UPDATE ledger_entry SET amountSatang=500 WHERE id=2')
    assert.equal((db.prepare('SELECT amountSatang FROM ledger_entry WHERE id=2').get() as {amountSatang: number}).amountSatang, 500)
  } finally { db.close() }
})

test('month boundaries include leap days and roll over years', () => {
  assert.deepEqual(monthRange('2024-02'), { startOn: '2024-02-01', endOn: '2024-02-29' })
  assert.equal(monthRange('2025-02').endOn, '2025-02-28')
  assert.equal(nextMonth('2025-12'), '2026-01')
  for (const month of ['2025-00', '2025-13', '2025-2', '', '2025-01-01']) assert.throws(() => monthRange(month))
  assert.equal(allocationAmount('0'), 0)
  assert.equal(allocationAmount('10.01'), 1001)
  for (const amount of ['-1', '1.001', 'NaN']) assert.throws(() => allocationAmount(amount))
})
test('reviewed year with no temporary balances creates no fictitious closing lines', () => {
  assert.deepEqual(closingJournal([], 'CAPITAL', { allowEmpty: true }), { lines: [], profit: 0 })
})
