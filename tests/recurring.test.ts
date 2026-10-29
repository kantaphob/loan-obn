import test from 'node:test'
import assert from 'node:assert/strict'
import { prisma } from '../lib/prisma'
import { recurringData, recurringDue, recurringInMonth } from '../lib/recurring'
import { getRecurring, recurringCandidates, saveRecurring, setRecurringActive, settleRecurring } from '../app/dashboard/recurring/actions'
import { lendingCapitalCash } from '../lib/capital'

test('monthly/yearly scheduling clamps month-end and leaves unknown annual dates unscheduled', () => {
  assert.equal(recurringDue({ dueDay: 31, dueMonth: null, frequency: 'MONTHLY' }, '2025-02'), '2025-02-28')
  assert.equal(recurringDue({ dueDay: 31, dueMonth: 2, frequency: 'YEARLY' }, '2024-02'), '2024-02-29')
  assert.equal(recurringDue({ dueDay: null, dueMonth: null, frequency: 'YEARLY' }, '2026-10'), null)
  assert.equal(recurringInMonth({ startMonth: '2026-10', dueMonth: null, frequency: 'YEARLY' }, '2026-10'), false)
  assert.equal(recurringInMonth({ startMonth: '2026-10', dueMonth: 12, frequency: 'YEARLY' }, '2026-12'), true)
  assert.throws(() => recurringData({ name: 'test', direction: 'OUT', amount: '-1', frequency: 'MONTHLY', dueDay: '', dueMonth: '', startMonth: '2026-10', note: '' }))
})

test('plans do not create cash; actual postings/matching are general, unique and keep history', async () => {
  await prisma.user.create({ data: { id: 'operator', acccode: 'recurring-test', password: 'test-only', role: 'ADMIN', level: 0 } })
  await prisma.paymentChannel.create({ data: { code: 'CASH', nameTh: 'เงินสด', nameEn: 'Cash' } })
  const plan = { name: 'iCloud', direction: 'OUT', amount: '399', frequency: 'MONTHLY', dueDay: '31', dueMonth: '', startMonth: '2025-01', note: '' }
  assert.ok('success' in await saveRecurring(plan))
  assert.equal(await prisma.ledgerEntry.count(), 0)
  const item = await prisma.recurringItem.findFirstOrThrow()
  assert.ok('error' in await saveRecurring(plan))
  const posting = { id: item.id, month: '2025-01', amount: '399', occurredOn: '2025-01-31', channelCode: 'CASH', reference: 'fixture-jan' }
  const results = await Promise.all([settleRecurring(posting), settleRecurring(posting)])
  assert.equal(results.filter(r => 'success' in r).length, 1)
  assert.equal(await prisma.ledgerEntry.count(), 1)
  const entry = await prisma.ledgerEntry.findFirstOrThrow()
  assert.equal(entry.accountScope, 'GENERAL')
  assert.equal(lendingCapitalCash([entry]).balance, 0)
  assert.equal((await getRecurring()).payments[0].entry?.amountSatang, 39900)
  assert.ok('error' in await saveRecurring({ ...plan, id: item.id, direction: 'IN' }))
  await setRecurringActive(item.id, false)
  assert.ok('error' in await settleRecurring({ ...posting, month: '2025-02', reference: 'fixture-feb' }))
  await setRecurringActive(item.id, true)
  const actual = await prisma.ledgerEntry.create({ data: { requestKey: 'existing-feb', kind: 'GENERAL', accountScope: 'GENERAL', direction: 'OUT', categoryCode: entry.categoryCode, categoryName: entry.categoryName, amountSatang: 40000, occurredOn: '2025-02-28', channelCode: 'CASH', channelName: 'Cash', createdBy: 'operator' } })
  const matches = await recurringCandidates(item.id, '2025-02')
  assert.equal(matches[0].key, `LEDGER:${actual.id}`)
  assert.ok('success' in await settleRecurring({ ...posting, month: '2025-02', existingKey: `LEDGER:${actual.id}` }))
  assert.equal(await prisma.ledgerEntry.count(), 2, 'matching makes no additional cash')
  assert.equal((await getRecurring()).payments[0].expected, 39900)
  assert.equal((await getRecurring()).payments[0].entry?.amountSatang, 40000)
  await saveRecurring({ ...plan, name: 'Another bill' })
  const other = await prisma.recurringItem.findFirstOrThrow({ where: { name: 'Another bill' } })
  assert.ok('error' in await settleRecurring({ ...posting, id: other.id, month: '2025-02', existingKey: `LEDGER:${actual.id}` }), 'cannot reuse a matched cash entry')
  await prisma.ledgerEntry.update({ where: { id: entry.id }, data: { voidedAt: new Date(), voidReason: 'test correction' } })
  assert.ok('success' in await settleRecurring({ ...posting, reference: 'fixture-correction' }))
  assert.equal(await prisma.ledgerEntry.count({ where: { voidedAt: null } }), 2)
  await saveRecurring({ ...plan, name: 'Unscheduled annual', frequency: 'YEARLY', dueDay: '', dueMonth: '' })
  const annual = await prisma.recurringItem.findFirstOrThrow({ where: { name: 'Unscheduled annual' } })
  assert.ok('error' in await settleRecurring({ ...posting, id: annual.id }), 'annual bill needs an assigned month')
  await prisma.assetWorkspaceState.create({ data: { operatorId: 'operator', payload: '{}' } })
  await prisma.asset.create({ data: { operatorId: 'operator', id: 'click', code: 'VEH-001', name: 'Click 125i', kind: 'vehicle' } })
  await prisma.asset.create({ data: { operatorId: 'operator', id: 'house', code: 'BLD-001', name: 'House', kind: 'house' } })
  assert.ok('success' in await saveRecurring({ ...plan, name: 'Vehicle insurance', frequency: 'YEARLY', dueMonth: '10', assetId: 'click' }))
  assert.ok('error' in await saveRecurring({ ...plan, name: 'Wrong asset', assetId: 'house' }))
  assert.ok('error' in await saveRecurring({ ...plan, name: 'Missing asset', assetId: 'missing' }))
  assert.ok('error' in await saveRecurring({ ...plan, id: item.id, assetId: 'click' }), 'cannot move paid history to another vehicle')
  const linked = (await getRecurring()).items.find(i => i.name === 'Vehicle insurance')!
  assert.equal(linked.asset?.name, 'Click 125i')
  assert.equal(linked.assetId, 'click')
  await prisma.user.update({ where: { id: 'operator' }, data: { role: 'REVIEWER' } })
  assert.ok('error' in await saveRecurring({ ...plan, name: 'No permission' }))
  await prisma.$disconnect()
})
