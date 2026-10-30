import test from 'node:test'
import assert from 'node:assert/strict'
import { initialData, balance, forecast, ghbPayments, newHome, assetCosts, propertyCosts, propertyTotalCost, propertyAssetIds, outstanding, migrateAssetData } from '../app/thing/_shared/model'
import { loanAssetIds } from '../app/thing/_shared/model'
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

test('construction BOQ is the main house cost once, replacement excludes cancelled budget and preserves actual spend', () => {
  const home = initialData().homes[0]; home.costSource = 'boq'; home.purchasePrice = 999999
  home.boq = [
    { id: 'old', category: 'ครัว', name: 'เคาน์เตอร์เดิม', quantity: 1, price: 20000, labor: 0, paid: 20000, spec: '', unit: 'งาน', vendor: '', reference: '', cancelled: true },
    { id: 'built', category: 'ครัว', name: 'บิวท์อินใหม่', quantity: 1, price: 95000, labor: 0, paid: 0, spec: '', unit: 'งาน', vendor: '', reference: '', replacesId: 'old', scope: 'construction' },
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


test('Property supports land-only and multiple parcels/buildings without copying costs', () => {
  const data = initialData()
  const a = { ...newHome('แปลง 1'), id: 'parcel-a', categoryCode: 'LAND', purchasePrice: 1000000 }
  const b = { ...newHome('แปลง 2'), id: 'parcel-b', categoryCode: 'LAND', purchasePrice: 500000 }
  const c = { ...newHome('บ้าน'), id: 'house-c', purchasePrice: 1970000 }
  const d = { ...newHome('กำแพง'), id: 'wall-d', purchasePrice: 150000 }
  data.homes.push(a, b, c, d)
  const masterdata = [...categories, { code: 'LAND', nameTh: 'ที่ดิน', parentCode: 'TANGIBLE_ASSETS', isActive: true }]
  data.properties = [{ id: 'group-a', code: 'PROP-001', name: 'สถานที่เดียวกัน', type: 'LAND_ONLY', status: 'PLANNING', assetIds: [a.id] }]
  validateAssetData(data); validatePropertyCategories(data, masterdata)
  assert.equal(propertyTotalCost(data.properties[0], data.homes), 1000000)
  data.properties[0].type = 'RESIDENTIAL'
  data.properties[0].assetIds = [a.id, b.id, c.id, d.id]
  validateAssetData(data); validatePropertyCategories(data, masterdata)
  assert.deepEqual(propertyAssetIds(data.properties[0]), [a.id, b.id, c.id, d.id])
  assert.equal(propertyTotalCost(data.properties[0], data.homes), 3620000)
  d.purchasePrice = 160000
  assert.equal(propertyTotalCost(data.properties[0], data.homes), 3630000)
  data.properties[0].type = 'LAND_ONLY'
  assert.throws(() => validatePropertyCategories(data, masterdata), /ที่ดินเปล่า/)
  data.properties[0].assetIds = []
  assert.throws(() => validateAssetData(data), /อย่างน้อย 1/)
  data.properties[0].assetIds = [a.id, a.id]
  assert.throws(() => validateAssetData(data), /ห้ามเลือกซ้ำ/)
  data.properties[0].assetIds = [a.id]
  data.properties[0].latitude = 91
  assert.throws(() => validateAssetData(data), /พิกัด/)
  delete data.properties[0].latitude
  data.properties[0].postalCode = '123'
  assert.throws(() => validateAssetData(data), /ไปรษณีย์/)
  delete data.properties[0].postalCode
  data.properties[0].landId = a.id
  assert.throws(() => validateAssetData(data), /รูปแบบเดียว/)
})

test('loan drawdowns determine actual balance and payments separate fees and extra principal', () => {
  const data = initialData(); const loan = data.loans[0]; const r = loan.rounds[0]
  r.effectiveOn = '2020-01-01'
  loan.disbursements = [{ id: 'draw-test', date: '2020-01-02', amount: 100000, reference: 'DRAW-1', notes: '' }]
  loan.payments = [{ id: 'payment-test', roundId: r.id, date: '2020-02-01', amount: 12500, principal: 11000, interest: 1000, fee: 300, penalty: 200, extraPrincipal: 10000, reference: 'SLIP-1' }]
  validateAssetData(data)
  assert.equal(outstanding(loan, '2020-01-01'), 0)
  assert.equal(outstanding(loan, '2020-01-02'), 100000)
  assert.equal(outstanding(loan, '2020-02-01'), 89000)
  assert.equal(balance(loan, r), 89000)
  const bad = structuredClone(data); bad.loans[0].payments[0].amount = 12000
  assert.throws(() => validateAssetData(bad), /ค่าธรรมเนียม/)
  const beforeDraw = structuredClone(data); beforeDraw.loans[0].payments[0].date = '2020-01-01'
  assert.throws(() => validateAssetData(beforeDraw), /ยอดเบิก/)
  const overLimit = structuredClone(data); overLimit.loans[0].disbursements![0].amount = r.opening + 1
  assert.throws(() => validateAssetData(overLimit), /วงเงิน/)
  const overExtra = structuredClone(data); overExtra.loans[0].payments[0].extraPrincipal = 12000
  assert.throws(() => validateAssetData(overExtra), /ยอดโปะ/)
})

test('retention carries only drawn principal less actual principal and locks original drawdowns', () => {
  const data = initialData(); const loan = data.loans[0]; const r = loan.rounds[0]
  r.effectiveOn = '2020-01-01'
  loan.disbursements = [{ id: 'retention-draw', date: '2020-01-01', amount: 100000, reference: '', notes: '' }]
  loan.payments = [{ id: 'retention-payment', roundId: r.id, date: '2020-02-01', amount: 11000, principal: 10000, interest: 1000, reference: '' }]
  loan.rounds.push({ ...structuredClone(r), id: 'retention-round', effectiveOn: '2021-01-01', opening: 90000 })
  validateAssetData(data)
  assert.equal(outstanding(loan, '2021-01-01'), 90000)
  const bad = structuredClone(data); bad.loans[0].disbursements![0].reference = 'changed'
  assert.throws(() => validateHistory(bad, data), /ยอดเบิก/)
  const legacy = initialData(); legacy.loans[0].rounds[0].effectiveOn = '2020-01-01'; legacy.loans[0].payments = [{ id: 'legacy-pay', roundId: legacy.loans[0].rounds[0].id, date: '2020-02-01', amount: 11000, principal: 10000, interest: 1000, reference: '' }]
  const converted = structuredClone(legacy); converted.loans[0].disbursements = []
  assert.throws(() => validateHistory(converted, legacy), /ยอดยกมาเดิม/)
})

test('loan document links and uploaded file types are validated', () => {
  const data = initialData(); const loan = data.loans[0]
  loan.documents = [{ id: 'loan-contract-doc', name: 'Contract', kind: 'contract', reference: 'CABINET-1' }]
  validateAssetData(data)
  loan.documents[0].paymentId = 'missing-payment'
  assert.throws(() => validateAssetData(data), /เอกสาร/)
  delete loan.documents[0].paymentId
  loan.documents[0].file = { mimeType: 'application/pdf', dataUrl: 'data:text/html;base64,SGVsbG8=' }
  assert.throws(() => validateAssetData(data), /PDF/)
})

test('one bank loan can link land and house without duplicating its debt', () => {
  const data = initialData(); const loan = data.loans[0]
  assert.deepEqual(loanAssetIds(loan), [loan.assetId])
  const land = newHome('ที่ดิน'); data.homes.push(land)
  loan.assetIds = [data.homes[0].id, land.id]; loan.assetId = loan.assetIds[0]
  validateAssetData(data)
  assert.deepEqual(loanAssetIds(loan), [data.homes[0].id, land.id])
  assert.equal(data.loans.length, 1)
  assert.equal(outstanding(loan), 2600000)
  loan.assetIds.push(land.id)
  assert.throws(() => validateAssetData(data), /ซ้ำกัน/)
  loan.assetIds = [data.homes[0].id, 'missing-land']
  assert.throws(() => validateAssetData(data), /ไม่พบสินทรัพย์/)
  loan.assetIds = []; loan.assetId = null
  validateAssetData(data)
  assert.deepEqual(loanAssetIds(loan), [])
})

test('initial loan settings preserve stepped interest while applying annual bank installments', async () => {
  const { configureInitialLoan } = await import('../app/thing/liabilities/initial-settings')
  const data = initialData(); const loan = data.loans[0]
  const configured = configureInitialLoan(loan, { opening: 2600000, months: 480, mrr: 6.145, effectiveOn: '', referenceInterest: 5413070, rate: 0, annualInstallments: Array.from({ length: 40 }, (_, i) => i === 0 ? 7100 : i === 1 ? 8300 : 12600) })
  data.loans[0] = configured
  validateAssetData(data)
  const at = (month: number) => configured.rounds[0].periods.find(p => p.from <= month && p.to >= month)!
  assert.equal(at(4).rate, 1.73)
  assert.equal(at(4).installment, 7100)
  assert.equal(at(13).installment, 8300)
  assert.equal(at(25).installment, 12600)
  assert.equal(at(480).installment, 12600)
  assert.equal(configured.payments.length, 0)
  assert.equal(outstanding(configured), 2600000)
  const dateOnly = configureInitialLoan(loan, { opening: 2600000, months: 480, mrr: 6.145, effectiveOn: '2020-01-01', referenceInterest: 5413070, rate: 0, annualInstallments: [7100], applyAnnualInstallments: false })
  assert.deepEqual(dateOnly.rounds[0].periods, loan.rounds[0].periods, 'setting a date must not rewrite existing within-year installments')
  loan.payments.push({ id: 'lock-initial', date: '2020-01-01', roundId: 'original', amount: 100, interest: 0, principal: 100, reference: '' })
  assert.deepEqual(configureInitialLoan(loan, { opening: 2600000, months: 480, mrr: 6.145, effectiveOn: '', referenceInterest: 0, rate: 0, annualInstallments: [7100] }).payments, loan.payments)
})

test('GHB supplied insurance and customer terms remain floating MRR formulas', async () => {
  const { ghbRatePeriods, configureInitialLoan } = await import('../app/thing/liabilities/initial-settings')
  const periods = ghbRatePeriods(480, 'qualifying', 'welfare')
  assert.deepEqual(periods.map(p => [p.from, p.to, p.rate, p.floating, p.discount]), [[1, 3, .73, false, 0], [4, 9, 1.73, false, 0], [10, 24, 0, true, 3.415], [25, 72, 0, true, 2.415], [73, 480, 0, true, 1]])
  const uninsured = ghbRatePeriods(480, 'not_qualifying', 'retail')
  assert.equal(uninsured[0].rate, .98); assert.equal(uninsured[1].rate, 1.98)
  assert.equal(uninsured[2].discount, 3.165); assert.equal(uninsured[3].discount, 2.165); assert.equal(uninsured[4].discount, .5)
  assert.equal(ghbRatePeriods(480, 'qualifying', 'equipment').at(-1)!.discount, 0)
  const data = initialData()
  data.loans[0] = configureInitialLoan(data.loans[0], { opening: 2600000, creditLimit: 2600000, months: 480, mrr: 6.145, effectiveOn: '', referenceInterest: 5413070, annualInstallments: Array.from({ length: 40 }, (_, i) => i === 0 ? 7100 : i === 1 ? 8300 : 12600), rate: 0, ratePeriods: periods, insurance: 'qualifying', customerType: 'welfare' })
  validateAssetData(data)
  assert.equal(data.loans[0].rounds[0].periods.find(p => p.from === 10)!.floating, true)
  assert.equal(outstanding(data.loans[0]), 2600000)
  assert.equal(data.loans[0].payments.length, 0)
  const atMrr = forecast(data.loans[0].rounds[0]).rows[9].rate
  assert.ok(Math.abs(atMrr - 2.73) < .000001)
  const changed = structuredClone(data.loans[0].rounds[0]); changed.mrr = 7
  assert.ok(Math.abs(forecast(changed).rows[9].rate - 3.585) < .000001)
})

test('pre-existing bank debt is separate from full credit and does not become a new cash receipt', async () => {
  const { configureInitialLoan } = await import('../app/thing/liabilities/initial-settings')
  const data = initialData(); data.loans[0].disbursements = []
  data.loans[0] = configureInitialLoan(data.loans[0], { opening: 100000, creditLimit: 200000, months: 120, mrr: 6, effectiveOn: '2020-01-01', referenceInterest: 0, annualInstallments: [5000], rate: 5 })
  validateAssetData(data)
  assert.equal(outstanding(data.loans[0]), 100000)
  assert.equal(data.loans[0].disbursements!.length, 0)
  data.loans[0].disbursements!.push({ id: 'new-bank-draw', date: '2020-01-02', amount: 50000, reference: '', notes: '' })
  data.loans[0].payments.push({ id: 'initial-debt-paid', roundId: data.loans[0].rounds[0].id, date: '2020-02-01', amount: 6000, interest: 1000, principal: 5000, reference: '' })
  validateAssetData(data)
  assert.equal(outstanding(data.loans[0]), 145000)
  const edited = structuredClone(data); edited.loans[0].openingBalance = 110000
  assert.throws(() => validateHistory(edited, data), /ยอดหนี้ตั้งต้น/)
  data.loans[0].disbursements![0].amount = 100001
  assert.throws(() => validateAssetData(data), /เกินวงเงิน/)
})

test('contract percentage stages price land 70/30 and house seven installments exactly', async () => {
  const { priceContractStages } = await import('../app/thing/_shared/model')
  const stages = (prefix: string, percentages: number[]) => percentages.map((percent, i) => ({ id: `${prefix}-${i + 1}`, number: i + 1, name: `งวด ${i + 1}`, amount: 0, dueOn: '', percent }))
  const land = priceContractStages(400000, stages('land-pct', [70, 30]))
  const house = priceContractStages(2600000, stages('house-pct', [20, 20, 15, 15, 15, 10, 5]))
  assert.deepEqual(land.map(row => row.amount), [280000, 120000])
  assert.deepEqual(house.map(row => row.amount), [520000, 520000, 390000, 390000, 390000, 260000, 130000])
  assert.equal(house.reduce((sum, row) => sum + row.amount, 0), 2600000)
  const rounded = priceContractStages(1, stages('round-pct', [33.33, 33.33, 33.34]))
  assert.deepEqual(rounded.map(row => row.amount), [.33, .33, .34])
  const data = initialData(); data.loans[0].contractorContracts = [{ id: 'percent-contract', kind: 'land_purchase', code: 'LC-001', name: 'ที่ดิน', contractor: 'ผู้ขายทดสอบ', amount: 400000, signedOn: '', description: '', stages: land }]
  validateAssetData(data)
  const badAmount = structuredClone(data); badAmount.loans[0].contractorContracts![0].stages[0].amount = 270000
  assert.throws(() => validateAssetData(badAmount), /ไม่ตรงกับเปอร์เซ็นต์/)
  const badPercent = structuredClone(data); badPercent.loans[0].contractorContracts![0].stages[0].percent = 69
  assert.throws(() => validateAssetData(badPercent), /100%/)
})

test('approved work variations adjust net contract and stages without rewriting original BOQ price', async () => {
  const { contractPrice, contractPaymentStages } = await import('../app/thing/_shared/model')
  const data = initialData()
  const contract = { id: 'vo-contract', code: 'CT-VO-001', name: 'บ้าน', contractor: 'ช่างทดสอบ', amount: 100000, signedOn: '2020-01-01', description: '', stages: [{ id: 'vo-base-stage', number: 1, name: 'งานเดิม', amount: 100000, percent: 100, dueOn: '' }], variations: [
    { id: 'vo-add', code: 'VO-001', kind: 'add' as const, name: 'งานเพิ่ม', quantity: 2, unit: 'งาน', unitPrice: 5000, amount: 10000, date: '2020-02-01', status: 'approved' as const, reference: 'BOQ-1', notes: '' },
    { id: 'vo-deduct', code: 'VO-002', kind: 'deduct' as const, name: 'ลดงานเดิม', quantity: 1, unit: 'งาน', unitPrice: 20000, amount: 20000, date: '2020-02-01', status: 'approved' as const, stageId: 'vo-base-stage', reference: '', notes: '' },
    { id: 'vo-draft', code: 'VO-003', kind: 'add' as const, name: 'ยังไม่ตกลง', quantity: 1, unit: 'งาน', unitPrice: 50000, amount: 50000, date: '2020-02-01', status: 'draft' as const, reference: '', notes: '' },
  ] }
  data.loans[0].contractorContracts = [contract]
  validateAssetData(data)
  assert.deepEqual(contractPrice(contract), { original: 100000, additions: 10000, deductions: 20000, net: 90000 })
  assert.deepEqual(contractPaymentStages(contract).map(row => [row.id, row.amount]), [['vo-base-stage', 80000], ['vo-add', 10000]])
  assert.equal(contractPaymentStages(contract, '2020-01-31').length, 1)
  assert.equal(contract.stages[0].amount, 100000)
  const bad = structuredClone(data); bad.loans[0].contractorContracts![0].variations![1].unitPrice = 200000; bad.loans[0].contractorContracts![0].variations![1].amount = 200000
  assert.throws(() => validateAssetData(bad), /ลดงานเกิน/)
  const removed = structuredClone(data); removed.loans[0].contractorContracts![0].variations!.pop()
  assert.throws(() => validateHistory(removed, data), /เก็บประวัติ/)
})

test('contract BOQ summary preserves document price and counts approved replacement differences once', async () => {
  const { contractBoqSummary } = await import('../app/thing/_shared/model')
  const data = initialData()
  const contract: import('../app/thing/_shared/model').ContractorContract = { id: 'summary-contract', code: 'CT-SUMMARY', name: 'บ้าน', contractor: 'ช่าง', amount: 2600000, signedOn: '', description: '', stages: [{id:'summary-stage',number:1,name:'งาน',amount:2600000,dueOn:''}], boqSummary: { rows: [{key:'roof',name:'หลังคา',amount:200000}],managementFee:20000,agreedTotal:219000,reference:'BOQ'}, documents:[{id:'11111111-1111-4111-8111-111111111111',kind:'plan',name:'plan.pdf',mimeType:'application/pdf',size:100}], variations:[
    {id:'summary-vo',code:'VO-SUMMARY',kind:'add',name:'หลังคาทดแทน',quantity:1,unit:'งาน',unitPrice:30000,amount:30000,date:'2020-01-01',status:'approved',summaryKey:'roof',replacement:{original:50000,proposed:80000},reference:'',notes:''},
    {id:'summary-draft',code:'VO-SUMMARY-DRAFT',kind:'deduct',name:'ยังไม่ตกลง',quantity:1,unit:'งาน',unitPrice:10000,amount:10000,date:'2020-01-01',status:'draft',stageId:'summary-stage',summaryKey:'roof',reference:'',notes:''}
  ] }
  data.loans[0].contractorContracts=[contract]; validateAssetData(data)
  const summary=contractBoqSummary(contract)
  assert.equal(summary.base,220000); assert.equal(summary.rows[0].net,230000); assert.equal(summary.net,2630000); assert.equal(summary.agreedDifference,2380000)
  assert.equal(contract.boqSummary!.rows[0].amount,200000)
  const bad=structuredClone(data);bad.loans[0].contractorContracts![0].variations![0].replacement!.proposed=90000
  assert.throws(() => validateAssetData(bad), /ยอดทดแทน/)
  const unknown=structuredClone(data);unknown.loans[0].contractorContracts![0].variations![0].summaryKey='unknown'
  assert.throws(() => validateAssetData(unknown), /หมวด BOQ/)
  const unsafe=structuredClone(data);unsafe.loans[0].contractorContracts![0].documents![0].id='../private'
  assert.throws(() => validateAssetData(unsafe), /รหัสรายการ|เอกสารสัญญา/)
})

test('BOQ PDF summary reads amounts on separate baselines and agreed price above its label', async () => {
  const {readContractBoqSummary}=await import('../app/thing/_shared/contract-boq-import')
  const summary={rows:Array.from({length:7},(_,i)=>({key:`category-${i+1}`,name:`หมวด ${i+1}`,amount:0})),managementFee:0,reference:''}
  const imported=readContractBoqSummary(['1 หมวดงานโครงสร้าง','452,580.00','2 หมวดงานโครงสร้างหลังคา 212,851.00','3 หมวดงานสถาปัตยกรรม 805,473.00','4 หมวดงานสุขภัณฑ์','34,368.00','5 หมวดงานระบบสุขาภิบาล 72,000.00','6 หมวดงานไฟฟ้า','118,490.00','7 หมวดงานสี 95,367.00','รวมหมวดงาน 1 - 7 1,791,129.00','ค่าดาเนินงานก่อสร้าง 179,112.90','รวมค่าก่อสร้างเป็นเงิน 1,970,241.90','1,970,000.00','คิดเป็นค่าก่อสร้างเพียง'],summary,'boq.pdf')!
  assert.deepEqual(imported.rows.map(row=>row.amount),[452580,212851,805473,34368,72000,118490,95367])
  assert.equal(imported.managementFee,179112.9);assert.equal(imported.agreedTotal,1970000)
  assert.equal(readContractBoqSummary(['not a summary'],summary,'bad.pdf'),null)
})

test('planned equipment preserves reference prices without cost or warranty until actual purchase', () => {
  const data = initialData()
  const home = newHome('Planning house', 'house')
  home.purchasePrice = 100000
  home.items = [{ id: 'planned-item', name: 'Filter', room: '', size: 'Model A', quantity: 2, price: 0, shop: '', purchasedOn: '', warrantyStart: '', warrantyUntil: '', warrantyMonths: 0, notes: '', purchaseStatus: 'planned', referencePrice: 5000, referenceShop: 'Online A', referenceOn: '2026-01-01', referenceUrl: 'https://example.com/item' }]
  data.homes = [home]; data.loans = []; data.properties = []
  validateAssetData(data)
  assert.equal(assetCosts(home).total, 100000)
  home.items[0].price = 4200
  assert.throws(() => validateAssetData(data), /วางแผน/)
  home.items[0] = { ...home.items[0], purchaseStatus: 'purchased', purchasedOn: '2026-02-01', warrantyStart: '2026-02-01', shop: 'Actual B' }
  validateAssetData(data)
  assert.equal(assetCosts(home).total, 108400)
  assert.equal(home.items.length, 1)
  assert.equal(home.items[0].referencePrice, 5000)
  assert.equal(home.items[0].referenceShop, 'Online A')
  assert.equal(data.loans.length, 0)
  home.items[0].includedInMainCost = true
  assert.equal(assetCosts(home).total, 100000, 'purchases already included in the main cost are not added again')
})

test('equipment condition and fixed installation preserve room history and BOQ receipts do not duplicate costs', async () => {
 const { equipmentBoqReport } = await import('../app/thing/asset/equipment-report')
 const data = initialData(); const home = newHome('Fixed equipment', 'house')
 home.rooms = ['Room A','Room B']; home.purchasePrice=100000
 home.boq=[{id:'wiring',category:'Electrical',name:'Wiring',spec:'',quantity:1,unit:'set',price:5000,labor:1000,paid:0,vendor:'',reference:''}]
 home.items=[{id:'light',name:'Light',room:'Room A',size:'',quantity:1,price:4500,shop:'Builder',purchasedOn:'2026-01-01',warrantyStart:'',warrantyUntil:'',warrantyMonths:0,notes:'',purchaseStatus:'purchased',fixedInstallation:true,status:'waiting_repair',includedInMainCost:true,boqId:'wiring',receivedOn:'2026-01-01'}]
 data.homes=[home];data.properties=[];data.loans=[]
 validateAssetData(data)
 assert.equal(assetCosts(home).total,100000)
 assert.equal(equipmentBoqReport(home)[0].difference,-500)
 const moved=structuredClone(data);moved.homes[0].items[0].room='Room B'
 assert.throws(()=>validateHistory(moved,data),/ติดตั้งถาวร/)
 moved.homes[0].items[0].fixedInstallation=false
 validateHistory(moved,data)
 for(const status of ['damaged','waiting_repair','repair','retired'] as const){ home.items[0].status=status;validateAssetData(data) }
 home.items[0].receivedOn='';home.items[0].purchaseStatus='planned';home.items[0].price=0;home.items[0].purchasedOn=''
 assert.throws(()=>validateAssetData(data),/ยังไม่ซื้อ/)
})

test('electrical scope can move to pending change order without fabricated prices, cost or approval', () => {
 const data=initialData();const home=newHome('Electrical scope','house');home.purchasePrice=1800000;home.rooms=['Bedroom']
 home.items=[{id:'switch-plan',room:'Bedroom',name:'Switch',size:'',quantity:2,price:0,shop:'',purchasedOn:'',warrantyStart:'',warrantyMonths:0,warrantyUntil:'',notes:'',purchaseStatus:'planned',referencePrice:150,workOrderId:'electrical-order',fixedInstallation:true}]
 home.buildingChangeOrders=[{id:'electrical-order',number:1,baseVersion:1,title:'Electrical scope review',date:'2026-01-01',status:'draft',reference:'',notes:'',lines:[{id:'switch-line',kind:'add',description:'Bedroom switch',amount:0,pricingStatus:'pending',sourceItemId:'switch-plan'}]}]
 data.homes=[home];data.loans=[];data.properties=[]
 validateAssetData(data)
 assert.equal(assetCosts(home).total,1800000)
 home.buildingChangeOrders[0].status='approved'
 assert.throws(()=>validateAssetData(data),/อนุมัติไม่ได้/)
 home.buildingChangeOrders[0].status='draft'
 home.items[0].workOrderId='missing-order'
 assert.throws(()=>validateAssetData(data),/ใบงาน/)
})

test('estimate categories and material/labor breakdown preserve exact change-order totals', () => {
 const data=initialData(); const home=newHome('Estimate','house'); data.homes=[home];data.loans=[];data.properties=[]
 home.buildingChangeOrders=[{id:'estimate-order',number:1,baseVersion:1,title:'Electrical estimate',date:'2026-01-01',status:'draft',reference:'',notes:'',lines:[{id:'estimate-line',kind:'add',description:'Switch',amount:600,estimateCategory:'6',quantity:5,unit:'point',materialRate:100,laborRate:20,pricingStatus:'quoted'}]}]
 validateAssetData(data)
 const line=home.buildingChangeOrders[0].lines[0]
 line.amount=500
 assert.throws(()=>validateAssetData(data),/ยอดวัสดุและค่าแรง/)
 line.laborRate=0;validateAssetData(data)
 line.estimateCategory='10';validateAssetData(data)
 line.estimateCategory='11'
 assert.throws(()=>validateAssetData(data),/หมวดใบประมาณราคา/)
})

test('house hierarchy counts real rooms once, preserves assets on rename, and rejects invalid links', async () => {
 const { houseRooms, roomSubtree, roomPatch } = await import('../app/thing/asset/house-rooms')
 const data = initialData(); const home = newHome('Hierarchy','house'); data.homes=[home]; data.loans=[]; data.properties=[]
 home.rooms=['Bedroom','Bathroom','Bathroom group','CCTV']
 home.roomDefinitions=[{id:'br',code:'BLD-BR01',name:'Bedroom',kind:'room'},{id:'ba',code:'BLD-BA01',name:'Bathroom',kind:'room',parentId:'br'},{id:'group',code:'BLD-G01',name:'Bathroom group',kind:'group'},{id:'sys',code:'BLD-SY01',name:'CCTV',kind:'system'}]
 home.items=[{id:'tap',room:'Bathroom',name:'Tap',size:'',quantity:1,price:0,shop:'',purchasedOn:'',warrantyStart:'',warrantyMonths:0,warrantyUntil:'',notes:'',purchaseStatus:'planned',fixedInstallation:true}]
 validateAssetData(data)
 assert.equal(houseRooms(home).filter(room=>room.kind==='room').length,2)
 assert.deepEqual(roomSubtree(houseRooms(home),'br').map(room=>room.name),['Bedroom','Bathroom'])
 const next=structuredClone(data)
 Object.assign(next.homes[0],roomPatch(home,home.roomDefinitions.map(room=>room.id==='ba'?{...room,name:'Ensuite'}:room)))
 validateAssetData(next);validateHistory(next,data)
 assert.equal(next.homes[0].items[0].room,'Ensuite');assert.equal(next.homes[0].items.length,1)
 assert.equal(assetCosts(home).total,assetCosts(next.homes[0]).total)
 assert.throws(()=>roomPatch(home,home.roomDefinitions!.filter(room=>room.id!=='ba')),/ย้ายรายการก่อนลบ/)
 const cycle=structuredClone(data);cycle.homes[0].roomDefinitions![0].parentId='ba'
 assert.throws(()=>validateAssetData(cycle),/วนซ้ำ/)
 const duplicate=structuredClone(data);duplicate.homes[0].roomDefinitions![1].code='BLD-BR01'
 assert.throws(()=>validateAssetData(duplicate),/ซ้ำ/)
})

test('damage and repair histories preserve purchase cost and reject planned or invalid events', () => {
 const data=initialData();const home=newHome('Repair','house');data.homes=[home];data.loans=[];data.properties=[]
 home.items=[{id:'fan',room:'',name:'Fan',size:'',quantity:1,price:1000,shop:'',purchaseStatus:'purchased',purchasedOn:'2026-01-01',warrantyStart:'',warrantyMonths:0,warrantyUntil:'',notes:'',status:'damaged',repairs:[{id:'dmg',code:'DMG-001',kind:'damage',status:'reported',date:'2026-01-02',symptom:'Stopped',cost:0,vendor:'',notes:''},{id:'rep',code:'REP-001',kind:'repair',status:'resolved',relatedId:'dmg',date:'2026-01-03',symptom:'Motor replaced',cost:300,vendor:'Workshop',notes:''}]}]
 validateAssetData(data);assert.equal(assetCosts(home).total,1000)
 home.items[0].repairs![1].relatedId='missing';assert.throws(()=>validateAssetData(data),/ต้นทาง/)
 home.items[0].repairs![1].relatedId='dmg';home.items[0].repairs![1].cost=-1;assert.throws(()=>validateAssetData(data))
})

test('outside-contract BOQ scope stays separate from main construction cost', () => {
 const home=newHome('Scope','house');home.costSource='boq'
 const base={id:'included',name:'Contract',category:'หมวดงานโครงสร้าง',spec:'',quantity:1,unit:'งาน',price:1000,labor:100,paid:0,vendor:'',reference:''}
 home.boq=[{...base,contractScope:'included'},{...base,id:'outside',name:'Outside',price:500,contractScope:'excluded'}]
 assert.equal(assetCosts(home).main,1100)
 assert.equal(assetCosts(home).total,1100)
})

test('construction categories recognize legacy headings and ten new category codes', async () => {
 const { constructionCategoryCode, estimateCategory, estimateCategories }=await import('../app/thing/asset/estimate-categories')
 assert.equal(estimateCategories.length,10)
 assert.equal(constructionCategoryCode('หมวดงานหลังคา'),'2')
 assert.equal(constructionCategoryCode('หมวดงานสุขภัณฑ์ / ระบบสุขาภิบาล'),'4')
 assert.equal(constructionCategoryCode('BLD-A10'),'10')
 const home=newHome('IoT','house');home.items=[{id:'iot',name:'SONOFF MINIR4',size:'',room:'',quantity:1,price:0,shop:'',purchasedOn:'',warrantyStart:'',warrantyMonths:0,warrantyUntil:'',notes:''}]
 assert.equal(estimateCategory({id:'line',sourceItemId:'iot',kind:'add',description:'IoT',amount:0},home),'9')
})
