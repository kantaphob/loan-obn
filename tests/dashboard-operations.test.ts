import assert from 'node:assert/strict'
import { test } from 'node:test'
import { summarizeOpenItems } from '../lib/dashboard-operations'

test('open items exclude fully paid invoices and sort overdue partial balances first', () => {
  const result = summarizeOpenItems([
    { id:1, dueDate:'2026-10-31', amountSatang:10000, payments:[] },
    { id:2, dueDate:'2026-10-20', amountSatang:20000, payments:[{amountSatang:5000}] },
    { id:3, dueDate:'2026-10-19', amountSatang:30000, payments:[{amountSatang:30000}] },
    { id:4, dueDate:'', amountSatang:40000, payments:[] },
  ], '2026-10-28')
  assert.deepEqual(result.find(r=>r.id===2),{id:2,dueDate:'2026-10-20',remaining:15000,overdue:true})
  assert.equal(result.some(r=>r.id===3),false)
  assert.equal(result.find(r=>r.id===1)?.overdue,false)
  assert.equal(result.find(r=>r.id===4)?.overdue,false)
})
