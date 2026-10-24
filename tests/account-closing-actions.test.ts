import assert from 'node:assert/strict'
import { test, after } from 'node:test'
import { randomUUID } from 'node:crypto'
import { prisma } from '../lib/prisma'
import { closeAccounts } from '../app/dashboard/ac/actions'
if (!process.env.DATABASE_URL?.includes('loan-closing-test-')) throw new Error('Isolated database required')
after(() => prisma.$disconnect())
test('authorization, atomic close, snapshots, retry, sequencing and no cash posting', async () => {
  const user = await prisma.user.create({ data: { acccode: 'closing-test', password: 'test', role: 'REVIEWER', level: 0 } })
  const input = { requestKey: randomUUID(), startOn: '2026-01-01', endOn: '2026-01-31', note: 'Checked trial balance', balances: [{ code: '4001', name: 'Interest', type: 'REVENUE' as const, amount: '100.25' }] }
  assert.equal((await closeAccounts(input)).ok, false)
  await prisma.user.update({ where: { id: user.id }, data: { role: 'ADMIN' } })
  await prisma.ledgerEntry.create({ data: { requestKey: randomUUID(), kind: 'GENERAL', direction: 'IN', categoryCode: 'TEST', categoryName: 'Test', amountSatang: 10025, occurredOn: '2026-01-15', channelCode: 'CASH', channelName: 'Cash', createdBy: user.id } })
  assert.equal((await closeAccounts(input)).ok, true)
  assert.equal((await closeAccounts(input)).ok, true)
  assert.equal(await prisma.accountingClose.count(), 1)
  assert.equal(await prisma.ledgerEntry.count(), 1, 'closing never posts cash')
  const stored = await prisma.accountingClose.findFirstOrThrow()
  assert.equal(JSON.parse(stored.cashSnapshotJson).length, 1)
  assert.equal(stored.profitSatang, 10025)
  assert.ok(JSON.parse(stored.journalJson).some((line: { code: string }) => line.code === 'INCOME_SUMMARY'))
  assert.equal((await closeAccounts({ ...input, equity: 'CAPITAL' })).ok, false, 'retry cannot silently change equity target')
  assert.equal((await closeAccounts({ ...input, note: 'changed' })).ok, false)
  assert.equal((await closeAccounts({ ...input, requestKey: randomUUID(), startOn: '2026-03-01', endOn: '2026-03-31' })).ok, false)
  assert.equal((await closeAccounts({ ...input, requestKey: randomUUID(), startOn: '2026-02-01', endOn: '2026-02-28' })).ok, true)
  await assert.rejects(prisma.ledgerEntry.updateMany({ data: { amountSatang: 1 } }))
  assert.equal((await prisma.ledgerEntry.findFirstOrThrow()).amountSatang, 10025)
})
