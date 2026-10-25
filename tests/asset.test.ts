import test from 'node:test'
import assert from 'node:assert/strict'
import { initialData, balance, forecast, ghbPayments, newHome } from '../app/asset/model'
import { validateAssetData } from '../app/asset/validation'
import { categoryKind, categoryPath, validateCategories, type AssetCategory } from '../app/asset/categories'

const categories: AssetCategory[] = [
  { code: 'TANGIBLE_ASSETS', nameTh: 'สินทรัพย์ที่มีตัวตน', parentCode: null, isActive: true },
  { code: 'BUILDINGS', nameTh: 'อาคารและสิ่งปลูกสร้าง', parentCode: 'TANGIBLE_ASSETS', isActive: true },
  { code: 'VEHICLES', nameTh: 'ยานพาหนะ', parentCode: 'TANGIBLE_ASSETS', isActive: true },
  { code: 'MOTORCYCLES', nameTh: 'รถจักรยานยนต์', parentCode: 'VEHICLES', isActive: true },
  { code: 'OLD', nameTh: 'หมวดเดิม', parentCode: null, isActive: false },
]

test('masterdata categories support hierarchy and inherited asset detail forms', () => {
  assert.equal(categoryPath('MOTORCYCLES', categories), 'สินทรัพย์ที่มีตัวตน / ยานพาหนะ / รถจักรยานยนต์')
  assert.equal(categoryKind('MOTORCYCLES', categories), 'vehicle')
  assert.equal(categoryKind('BUILDINGS', categories), 'house')
  assert.equal(categoryKind('UNKNOWN', categories), 'other')
})
test('category writes reject inactive or unknown selections but preserve legacy assignments', () => {
  const asset = newHome('Forza', 'vehicle')
  validateCategories([asset], [], categories)
  asset.categoryCode = 'OLD'
  assert.throws(() => validateCategories([asset], [], categories), /Masterdata/)
  validateCategories([asset], [structuredClone(asset)], categories)
  asset.categoryCode = 'MISSING'
  assert.throws(() => validateCategories([asset], [], categories), /Masterdata/)
  validateCategories([asset], [structuredClone(asset)], categories)
  asset.categoryCode = 'BUILDINGS'
  assert.throws(() => validateCategories([asset], [], categories), /ไม่ตรง/)
})

test('contract reference has correct loan, period rates and payments', () => {
  const data = initialData(); validateAssetData(data)
  const r = data.homes[0].rounds[0]; const plan = forecast(r)
  assert.equal(r.opening, 2600000); assert.equal(r.months, 480)
  assert.equal(plan.rows[0].interest, 1581.67)
  assert.equal(plan.rows[3].payment, 8300)
  assert.equal(plan.rows[9].payment, 11100)
  assert.equal(plan.rows[24].rate, 3.73)
  assert.equal(plan.rows[72].rate, 5.145)
  assert.ok(plan.rows.every(row => Math.abs(row.payment - row.interest - row.principal) < .011))
})
test('actual bank interest is preserved and retention carries remaining principal', () => {
  const data = initialData(); const h = data.homes[0]; const original = h.rounds[0]
  original.effectiveOn = '2026-01-01'
  h.payments.push({ id: 'payment-1', roundId: original.id, date: '2026-01-31', amount: 8200, interest: 1560, principal: 6640, reference: 'GHB งวด 1' })
  assert.equal(balance(h, original), 2593360)
  h.rounds.push({ ...structuredClone(original), id: 'retention-1', name: 'รีเทนชันครั้งที่ 1', effectiveOn: '2026-02-01', opening: balance(h, original) })
  validateAssetData(data)
  assert.equal(h.payments[0].interest, 1560)
  h.rounds[1].opening = 2600000
  assert.throws(() => validateAssetData(data), /ยอดยกมา/)
})
test('invalid payment splits, duplicate payments, rate gaps and historic cutoff are rejected', () => {
  const data = initialData(); const h = data.homes[0]; h.rounds[0].effectiveOn = '2026-01-01'
  h.payments.push({ id: 'p1', roundId: 'original', date: '2026-01-31', amount: 8200, interest: 1560, principal: 6640, reference: 'GHB งวด 1' })
  const invalid = structuredClone(data); invalid.homes[0].payments[0].principal = 8200
  assert.throws(() => validateAssetData(invalid), /เงินต้นบวกดอกเบี้ย/)
  h.payments.push({ ...h.payments[0], id: 'p2' }); assert.throws(() => validateAssetData(data), /ซ้ำ/); h.payments.pop()
  h.rounds[0].periods[1].from = 5; assert.throws(() => validateAssetData(data), /ต่อเนื่อง/); h.rounds[0].periods[1].from = 4
  h.rounds.push({ ...structuredClone(h.rounds[0]), id: 'r2', name: 'รีเทนชัน', effectiveOn: '2026-01-20', opening: 2593360 })
  assert.throws(() => validateAssetData(data), /วันชำระ/)
})
test('cash vehicle supports nested decorations without a loan', () => {
  const data = initialData(); const vehicle = newHome('Forza', 'vehicle'); vehicle.purchasePrice = 180000
  vehicle.items.push({ id: 'crash-bar', name: 'แครชบาร์', room: 'ตกแต่ง', quantity: 1, price: 3500, shop: 'อู่เปิด', size: '', purchasedOn: '2026-10-25', warrantyStart: '2026-10-25', warrantyMonths: 6, warrantyUntil: '2027-04-25', notes: '' })
  data.homes.push(vehicle); validateAssetData(data)
  assert.equal(vehicle.financing, 'cash'); assert.equal(vehicle.rounds.length, 0)
  assert.equal(vehicle.purchasePrice + vehicle.items.reduce((s, i) => s + i.quantity * i.price, 0), 183500)
})
test('GHB import only reads paid rows, preserves blank dates and handles quoted money', () => {
  const rows = ghbPayments('วันเดือนปี,ปีที่,งวดที่,ยอดต้นงวด,อัตราดอกเบี้ย,ดอกเบี้ยต่องวด,ยอดชำระ,ค่างวด,ยอดโปะ,ตัดเงินต้น,ยอดคงเหลือ\r\n,1,1,"2,600,000.00",0.730%,"1,560.00","8,200.00","7,100.00","1,100.00","6,640.00","2,593,360.00"\r\n,1,2,"2,593,360.00",0.730%,"1,556.02",,,,,')
  assert.equal(rows.length, 1); assert.equal(rows[0].date, ''); assert.equal(rows[0].principal, 6640)
  assert.throws(() => ghbPayments('wrong,file'), /หัวตาราง/)
})
test('extra principal reduces interest and payoff time; negative amortization is surfaced', () => {
  const r = initialData().homes[0].rounds[0]
  const base = forecast(r); const extra = forecast(r, r.opening, 3000)
  assert.ok(extra.totalInterest < base.totalInterest); assert.ok(extra.rows.length < base.rows.length)
  const insufficient = { ...r, periods: [{ from: 1, to: 480, rate: 10, installment: 100, floating: false, discount: 0 }] }
  const result = forecast(insufficient)
  assert.equal(result.rows.length, 1); assert.ok(result.remaining > r.opening)
})
