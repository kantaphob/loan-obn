import assert from 'node:assert/strict'
import { after, test } from 'node:test'
import { randomUUID } from 'node:crypto'
import { prisma } from '../lib/prisma'
import { savePayable, payPayable } from '../app/dashboard/ap/actions'
import { voidLedger } from '../app/dashboard/ledger/actions'
if (!process.env.DATABASE_URL?.includes('loan-ap-test-')) throw new Error('Isolated database required')
after(() => prisma.$disconnect())
const form = (values: Record<string, string>) => {
  const data = new FormData()
  for (const [key, value] of Object.entries(values)) data.set(key, value)
  return data
}
test('trade payable lifecycle: validation, retries, early payment, duplicate payment, void and permissions', async () => {
  const user = await prisma.user.create({ data: { acccode: 'ap-admin', password: 'test', role: 'ADMIN', level: 0 } })
  await prisma.paymentChannel.create({ data: { code: 'CASH', nameTh: 'เงินสด' } })
  const input = { requestKey: randomUUID(), supplier: 'Supplier', invoiceNumber: 'INV-001', description: 'Office supplies', amount: '1200.50', invoiceDate: '2026-01-01', dueDate: '2026-02-01' }
  assert.ok(!(await savePayable({ message: '' }, form({ ...input, amount: '-1' }))).success)
  assert.ok(!(await savePayable({ message: '' }, form({ ...input, dueDate: '2026-02-30' }))).success)
  assert.ok(!(await savePayable({ message: '' }, form({ ...input, dueDate: '2025-12-31' }))).success)
  assert.ok((await savePayable({ message: '' }, form(input))).success)
  assert.ok((await savePayable({ message: '' }, form(input))).success)
  assert.equal(await prisma.tradePayable.count(), 1)
  assert.ok(!(await savePayable({ message: '' }, form({ ...input, requestKey: randomUUID() }))).success)
  const bill = await prisma.tradePayable.findFirstOrThrow()
  assert.equal(bill.amountSatang, 120050)
  const payment = { id: String(bill.id), occurredOn: '2026-01-15', channelCode: 'CASH', reference: 'PAY-001' }
  assert.ok(!(await payPayable({ message: '' }, form({ ...payment, occurredOn: '2025-12-31' }))).success)
  assert.ok(!(await payPayable({ message: '' }, form({ ...payment, channelCode: 'INVALID' }))).success)
  assert.ok((await payPayable({ message: '' }, form(payment))).success)
  assert.ok(!(await payPayable({ message: '' }, form(payment))).success)
  const entry = await prisma.ledgerEntry.findFirstOrThrow()
  assert.equal(entry.amountSatang, 120050)
  assert.equal(entry.direction, 'OUT')
  assert.equal(entry.payableId, bill.id)
  assert.ok((await voidLedger(entry.id, 'จ่ายผิดช่องทาง')).success)
  assert.ok((await payPayable({ message: '' }, form(payment))).success)
  assert.equal(await prisma.ledgerEntry.count({ where: { payableId: bill.id, voidedAt: null } }), 1)
  await prisma.user.update({ where: { id: user.id }, data: { role: 'REVIEWER' } })
  assert.ok(!(await savePayable({ message: '' }, form({ ...input, requestKey: randomUUID(), invoiceNumber: 'INV-002' }))).success)
  assert.ok(!(await payPayable({ message: '' }, form(payment))).success)
})
