import test from 'node:test'
import assert from 'node:assert/strict'
import { initialData, balance, forecast, ghbPayments, newHome, assetCosts, propertyCosts, outstanding, migrateAssetData } from '../app/thing/_shared/model'
import { validateHistory, validateLedgerLinks } from '../app/thing/_shared/integrity'
import { projectLandValue } from '../app/thing/asset/land-value'
import { validateAssetData } from '../app/thing/_shared/validation'
import { assignAssetCodes, categoryKind, categoryPath, validateCategories, validatePropertyCategories, type AssetCategory } from '../app/thing/property/categories'

test('PROPERTY derives land plus BOQ costs and rejects duplicate or missing sources and copied costs', () => {
  const data = initialData()
  const land = { ...newHome('โฉนดเลขที่ XXX'), id: 'LAND-001', categoryCode: 'LAND', purchasePrice: 1000000 }
  const building = { ...newHome('บ้านเลขที่ 99 หมู่ 7 สว่างไทรงาม'), id: 'BLD-001', costSource: 'boq' as const, purchasePrice: 1970000, boq: [{ id: 'boq-property', category: '', name: 'ก่อสร้าง', spec: '', quantity: 1, unit: 'งาน', price: 1970000, labor: 0, paid: 0, vendor: '', reference: '' }] }
  data.homes.push(land, building)
  const property = { id: 'property-test', code: 'PROPERTY-001', name: 'บ้านพร้อมที่ดิน · บ้านเลขที่ 99', landId: land.id, buildingId: building.id }
  data.properties = [property]
  validateAssetData(data)
  const masterdata = [...categories, { code: 'LAND', nameTh: 'ที่ดิน', parentCode: 'TANGIBLE_ASSETS', isActive: true }]
  validatePropertyCategories(data, masterdata)
  assert.deepEqual(propertyCosts(property, data.homes), { land: 1000000, building: 1970000, total: 2970000 })
  building.boq[0].price += 100
  assert.equal(propertyCosts(property, data.homes).total, 2970100, 'BOQ changes flow through without copying purchasePrice')
  const copied = structuredClone(data)
  Object.assign(copied.properties![0], { total: 2970000 })
  assert.throws(() => validateAssetData(copied), /ไม่บันทึกต้นทุนซ้ำ/)
  const duplicate = structuredClone(data)
  duplicate.properties!.push({ ...property, id: 'property-other', code: 'PROPERTY-002' })
  assert.throws(() => validateAssetData(duplicate), /PROPERTY อื่น/)
  const missing = structuredClone(data); missing.homes = missing.homes.filter(home => home.id !== land.id)
  assert.throws(() => validateAssetData(missing), /ยังใช้งาน/)
  const wrong = structuredClone(data); wrong.properties![0].landId = building.id; wrong.properties![0].buildingId = land.id
  assert.throws(() => validatePropertyCategories(wrong, masterdata), /ที่ดินกับอาคาร/)
  land.archivedOn = '2026-01-01'
  assert.throws(() => validateAssetData(data), /ยังใช้งาน/)
})

const categories: AssetCategory[] = [
  { code: 'TANGIBLE_ASSETS', nameTh: 'สินทรัพย์ที่มีตัวตน', parentCode: null, isActive: true },
  { code: 'BUILDINGS', nameTh: 'อาคารและสิ่งปลูกสร้าง', parentCode: 'TANGIBLE_ASSETS', isActive: true },
  { code: 'VEHICLES', nameTh: 'ยานพาหนะ', parentCode: 'TANGIBLE_ASSETS', isActive: true },
  { code: 'MOTORCYCLES', nameTh: 'รถจักรยานยนต์', parentCode: 'VEHICLES', isActive: true },
  { code: 'OLD', nameTh: 'หมวดเดิม', parentCode: null, isActive: false },
]

test('land growth compounds the supplied rate and supports zero and negative assumptions', () => {
  assert.deepEqual(projectLandValue(400000, 5, 2), [{ year: 1, value: 420000 }, { year: 2, value: 441000 }])
  assert.equal(projectLandValue(400000, 0, 5).at(-1)!.value, 400000)
  assert.equal(projectLandValue(400000, -10, 2).at(-1)!.value, 324000)
  assert.equal(projectLandValue(400000, -100, 2).at(-1)!.value, 0)
  assert.throws(() => projectLandValue(400000, -101, 2))
  assert.throws(() => projectLandValue(400000, 5, 1.5))
  assert.throws(() => projectLandValue(1e12, 100, 50), /สูงเกิน/)
})

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
  const r = data.loans[0].rounds[0]; const plan = forecast(r)
  assert.equal(r.opening, 2600000); assert.equal(r.months, 480)
  assert.equal(plan.rows[0].interest, 1581.67)
  assert.equal(plan.rows[3].payment, 8300)
  assert.equal(plan.rows[9].payment, 11100)
  assert.equal(plan.rows[24].rate, 3.73)
  assert.equal(plan.rows[72].rate, 5.145)
  assert.ok(plan.rows.every(row => Math.abs(row.payment - row.interest - row.principal) < .011))
})
test('actual bank interest is preserved and retention carries remaining principal', () => {
  const data = initialData(); const h = data.loans[0]; const original = h.rounds[0]
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
  const data = initialData(); const h = data.loans[0]; h.rounds[0].effectiveOn = '2026-01-01'
  h.payments.push({ id: 'p1', roundId: 'original', date: '2026-01-31', amount: 8200, interest: 1560, principal: 6640, reference: 'GHB งวด 1' })
  const invalid = structuredClone(data); invalid.loans[0].payments[0].principal = 8200
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
  assert.equal(vehicle.financing, 'cash'); assert.equal(data.loans.filter(l => l.assetId === vehicle.id).length, 0)
  assert.equal(vehicle.purchasePrice + vehicle.items.reduce((s, i) => s + i.quantity * i.price, 0), 183500)
})
test('GHB import only reads paid rows, preserves blank dates and handles quoted money', () => {
  const rows = ghbPayments('วันเดือนปี,ปีที่,งวดที่,ยอดต้นงวด,อัตราดอกเบี้ย,ดอกเบี้ยต่องวด,ยอดชำระ,ค่างวด,ยอดโปะ,ตัดเงินต้น,ยอดคงเหลือ\r\n,1,1,"2,600,000.00",0.730%,"1,560.00","8,200.00","7,100.00","1,100.00","6,640.00","2,593,360.00"\r\n,1,2,"2,593,360.00",0.730%,"1,556.02",,,,,')
  assert.equal(rows.length, 1); assert.equal(rows[0].date, ''); assert.equal(rows[0].principal, 6640)
  assert.throws(() => ghbPayments('wrong,file'), /หัวตาราง/)
})
test('extra principal reduces interest and payoff time; negative amortization is surfaced', () => {
  const r = initialData().loans[0].rounds[0]
  const base = forecast(r); const extra = forecast(r, r.opening, 3000)
  assert.ok(extra.totalInterest < base.totalInterest); assert.ok(extra.rows.length < base.rows.length)
  const insufficient = { ...r, periods: [{ from: 1, to: 480, rate: 10, installment: 100, floating: false, discount: 0 }] }
  const result = forecast(insufficient)
  assert.equal(result.rows.length, 1); assert.ok(result.remaining > r.opening)
})

test('BOQ is the main house cost once, replacement excludes cancelled budget and preserves actual spend', () => {
  const home = initialData().homes[0]; home.costSource = 'boq'; home.purchasePrice = 999999
  home.boq = [
    { id: 'old', category: 'ครัว', name: 'เคาน์เตอร์เดิม', quantity: 1, price: 20000, labor: 0, paid: 20000, spec: '', unit: 'งาน', vendor: '', reference: '', cancelled: true },
    { id: 'built', category: 'ครัว', name: 'บิวท์อินใหม่', quantity: 1, price: 95000, labor: 0, paid: 0, spec: '', unit: 'งาน', vendor: '', reference: '', replacesId: 'old', scope: 'builtin' },
  ]
  home.items = [{ id: 'counter', room: home.rooms[0], name: 'เคาน์เตอร์', quantity: 1, price: 95000, size: '', shop: '', purchasedOn: '', warrantyStart: '', warrantyMonths: 0, warrantyUntil: '', notes: '', boqId: 'built' }]
  assert.deepEqual(assetCosts(home), { main: 95000, boq: 95000, additions: 0, total: 95000 })
  assert.equal(home.boq.reduce((s,b) => s+b.paid,0), 20000)
})
test('legacy JSON separates the debt without changing prices or payment amounts', () => {
  const data = initialData(); const source = { version: 1, revision: 4, homes: [{ ...data.homes[0], rounds: data.loans[0].rounds, payments: data.loans[0].payments }] }
  const upgraded = migrateAssetData(source); validateAssetData(upgraded)
  assert.equal(upgraded.version, 2); assert.equal(upgraded.revision, 4)
  assert.equal(upgraded.loans[0].assetId, upgraded.homes[0].id)
  assert.equal(upgraded.loans[0].rounds[0].opening, 2600000)
  assert.equal(upgraded.homes[0].landValue, 400000)
  assert.ok(!('rounds' in upgraded.homes[0])); assert.equal(source.version, 1)
})
test('real payments cannot be future-dated and never change house cost', () => {
  const data = initialData(); const loan = data.loans[0]; loan.rounds[0].effectiveOn = '2026-01-01'; const before = assetCosts(data.homes[0])
  loan.payments.push({ id: 'p1', date: '2026-01-31', amount: 8200, interest: 1560, principal: 6640, reference: '', roundId: 'original' })
  validateAssetData(data); assert.equal(outstanding(loan, '2026-02-01'), 2593360); assert.deepEqual(assetCosts(data.homes[0]), before)
  loan.payments[0].date = '2099-01-01'; assert.throws(() => validateAssetData(data), /อนาคต/)
})
test('the server integrity guard freezes contract terms once payments exist', () => {
  const data = initialData(); const l = data.loans[0]; l.rounds[0].effectiveOn = '2026-01-01'
  l.payments.push({ id: 'p1', date: '2026-01-31', amount: 8200, interest: 1560, principal: 6640, reference: '', roundId: 'original' })
  const changed = structuredClone(data); changed.loans[0].rounds[0].opening += 100000
  assert.throws(() => validateHistory(changed, data), /แก้เงื่อนไขเดิมไม่ได้/)
  assert.doesNotThrow(() => validateHistory(structuredClone(data), data))
})
test('ledger links reconcile amount and date and cannot be counted twice', () => {
  const data = initialData(); const l = data.loans[0]; l.rounds[0].effectiveOn = '2026-01-01'
  l.payments.push({ id: 'p1', date: '2026-01-31', amount: 8200, interest: 1560, principal: 6640, reference: '', roundId: 'original', ledgerEntryId: 1 })
  const entries = [{ id: 1, occurredOn: '2026-01-31', amountSatang: 820000, reference: '', note: '', categoryName: '' }]
  validateLedgerLinks(data, entries)
  assert.throws(() => validateLedgerLinks(data, [{ ...entries[0], amountSatang: 800000 }]), /ยอด/)
  assert.throws(() => validateLedgerLinks(data, [{ ...entries[0], occurredOn: '2026-02-01' }]), /วันที่/)
  l.payments.push({ ...l.payments[0], id: 'p2' }); assert.throws(() => validateLedgerLinks(data, entries), /เชื่อมซ้ำ/)
})


test('manual land prices retain dated history without growth settings', () => {
  const data = initialData()
  const land = newHome('ที่ดิน')
  land.landValue = 500000
  land.landDetails = { deedNumber: '', areaSquareWa: 100, valuationOn: '2026-01-01', valuationSource: 'สอบถามผู้ประเมิน', priceType: 'appraisal', priceHistory: [
    { amount: 450000, date: '2025-01-01', source: 'เจ้าของประเมิน', type: 'appraisal', notes: '' },
    { amount: 500000, date: '2026-01-01', source: 'สอบถามผู้ประเมิน', type: 'appraisal', notes: 'ประเมินรอบใหม่' },
  ] }
  data.homes.push(land)
  validateAssetData(data)
  assert.equal(land.landDetails.priceHistory?.length, 2)
  land.landDetails.priceHistory![0].amount = -1
  assert.throws(() => validateAssetData(data), /จำนวนเงิน/)
})


test('asset codes follow category families and reserve archived and existing numbers', () => {
  const master = [...categories, { code: 'LAND', nameTh: 'ที่ดิน', parentCode: 'TANGIBLE_ASSETS', isActive: true }]
  const old = { ...newHome('เดิม'), categoryCode: 'LAND', assetCode: 'LAND-001', archivedOn: '2026-01-01' }
  const land = { ...newHome('ใหม่'), categoryCode: 'LAND' }
  const building = { ...newHome('บ้าน'), categoryCode: 'BUILDINGS' }
  const rows = assignAssetCodes([old, land, building], [old], master)
  assert.deepEqual(rows.map(row => row.assetCode), ['LAND-001', 'LAND-002', 'BLD-001'])
  assert.equal(assignAssetCodes([{ ...rows[1], categoryCode: 'BUILDINGS', assetCode: 'FAKE-001' }], rows, master)[0].assetCode, 'LAND-002')
})
