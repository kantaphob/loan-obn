import test from 'node:test'
import assert from 'node:assert/strict'
import { previousUtilityBill } from '../lib/utility-readings'
import { prisma } from '../lib/prisma'
import { saveUtilityBill, saveUtilityHome } from '../app/dashboard/utilities/actions'

function form(values: Record<string, string | number>) {
  const data = new FormData()
  for (const [key, value] of Object.entries(values)) data.set(key, String(value))
  return data
}
test('utility records stay with their home across edits, enforce ownership and reject duplicate months', async () => {
  await prisma.user.create({ data: { id: 'operator', acccode: 'utility-test', password: 'test-only', role: 'ADMIN', level: 0 } })
  await prisma.user.create({ data: { id: 'other', acccode: 'utility-other', password: 'test-only', role: 'ADMIN', level: 10 } })
  const first = await saveUtilityHome(form({ name: 'บ้านหนึ่ง', address: 'ที่อยู่หนึ่ง', electricityMeter: 'same-meter', waterMeter: 'water-one' }))
  const second = await saveUtilityHome(form({ name: 'บ้านสอง', address: 'ที่อยู่สอง', electricityMeter: 'same-meter' }))
  assert.ok(first.homeId && second.homeId)
  const bill = { homeId: first.homeId!, kind: 'ELECTRICITY', meter: 'same-meter', location: 'จุดติดตั้ง', period: '2026-10', previousReading: 100, currentReading: 150, amount: '200.50' }
  assert.ok((await saveUtilityBill(form(bill))).success)
  assert.ok((await saveUtilityBill(form({ ...bill, homeId: second.homeId!, amount: '350.25' }))).success)
  assert.ok((await saveUtilityBill(form(bill))).error, 'duplicates rejected within the same home')
  assert.equal((await prisma.utilityBill.aggregate({ where: { homeId: first.homeId! }, _sum: { amountSatang: true } }))._sum.amountSatang, 20050)
  assert.equal((await prisma.utilityBill.aggregate({ where: { homeId: second.homeId! }, _sum: { amountSatang: true } }))._sum.amountSatang, 35025)
  await saveUtilityHome(form({ id: first.homeId!, name: 'บ้านเปลี่ยนชื่อ', address: 'ที่อยู่ใหม่' }))
  assert.equal(await prisma.utilityBill.count({ where: { homeId: first.homeId! } }), 1, 'renaming preserves home history')
  assert.ok((await saveUtilityBill(form({ ...bill, period: '2026-11', currentReading: 90 }))).error)
  assert.ok((await saveUtilityBill(form({ ...bill, homeId: 99999 }))).error)
  const foreign = await prisma.utilityHome.create({ data: { operatorId: 'other', name: 'บ้านส่วนตัว' } })
  assert.ok((await saveUtilityBill(form({ ...bill, homeId: foreign.id }))).error)
  assert.ok((await saveUtilityHome(form({ id: foreign.id, name: 'แก้ไขข้ามเจ้าของ' }))).error)
  const foreignBill = await prisma.utilityBill.create({ data: { operatorId: 'other', homeId: foreign.id, kind: 'WATER', meter: 'w', location: 'x', period: '2026-10', previousReading: 0, currentReading: 5, amountSatang: 5000 } })
  assert.ok((await saveUtilityBill(form({ ...bill, id: foreignBill.id, period: '2026-11' }))).error)
  assert.equal((await prisma.utilityBill.findUniqueOrThrow({ where: { id: foreignBill.id } })).homeId, foreign.id)
  const saved = await prisma.utilityBill.findFirstOrThrow({ where: { homeId: first.homeId!, period: '2026-10' } })
  assert.equal((await prisma.utilityHome.findUniqueOrThrow({ where: { id: first.homeId! } })).electricityMeter, 'same-meter', 'renaming retains configured meters')
  assert.ok((await saveUtilityHome(form({ id: first.homeId!, name: 'บ้านเปลี่ยนชื่อ', address: 'ที่อยู่ใหม่', electricityMeter: 'new-meter', waterMeter: 'water-one' }))).success)
  assert.ok((await saveUtilityBill(form({ ...bill, period: '2026-11', meter: 'forged-meter' }))).success)
  assert.equal((await prisma.utilityBill.findFirstOrThrow({ where: { homeId: first.homeId!, period: '2026-11' } })).meter, 'new-meter', 'new bills use stored home meter')
  assert.ok((await saveUtilityBill(form({ ...bill, id: saved.id, amount: '250' }))).success)
  assert.equal((await prisma.utilityBill.findUniqueOrThrow({ where: { id: saved.id } })).meter, 'same-meter', 'editing historical bill preserves its meter after replacement')
  assert.ok((await saveUtilityBill(form({ ...bill, kind: 'WATER', period: '2026-11' }))).success)
  assert.equal((await prisma.utilityBill.findFirstOrThrow({ where: { homeId: first.homeId!, kind: 'WATER' } })).meter, 'water-one')
  assert.ok((await saveUtilityBill(form({ ...bill, homeId: second.homeId!, kind: 'WATER', period: '2026-11' }))).error, 'missing configured meter requires setup')
  assert.equal(await prisma.ledgerEntry.count(), 0, 'registry does not create accounting entries')
  await prisma.user.update({ where: { id: 'operator' }, data: { role: 'REVIEWER' } })
  assert.ok((await saveUtilityHome(form({ name: 'บ้านใหม่' }))).error)
  assert.ok((await saveUtilityBill(form({ ...bill, period: '2026-11' }))).error)
})

test('previous reading comes from nearest earlier month of the same home, service and meter', () => {
  const rows = [
    { id: 1, homeId: 1, kind: 'ELECTRICITY', meter: 'a', period: '2026-08', currentReading: 100 },
    { id: 2, homeId: 1, kind: 'ELECTRICITY', meter: 'a', period: '2026-09', currentReading: 150 },
    { id: 3, homeId: 1, kind: 'ELECTRICITY', meter: 'a', period: '2026-10', currentReading: 200 },
    { id: 4, homeId: 2, kind: 'ELECTRICITY', meter: 'a', period: '2026-09', currentReading: 999 },
    { id: 5, homeId: 1, kind: 'WATER', meter: 'a', period: '2026-09', currentReading: 999 },
    { id: 6, homeId: 1, kind: 'ELECTRICITY', meter: 'new', period: '2026-09', currentReading: 999 },
  ]
  const selection = { homeId: 1, kind: 'ELECTRICITY', meter: 'a', period: '2026-10' }
  assert.equal(previousUtilityBill(rows, selection)?.currentReading, 150)
  assert.equal(previousUtilityBill(rows, { ...selection, period: '2026-08' }), undefined)
  assert.equal(previousUtilityBill(rows, { ...selection, excludeId: 2 })?.currentReading, 100)
  assert.equal(previousUtilityBill(rows, { ...selection, meter: 'unseen' }), undefined)
  assert.equal(previousUtilityBill(rows, { ...selection, period: '2027-01' })?.currentReading, 200)
})
