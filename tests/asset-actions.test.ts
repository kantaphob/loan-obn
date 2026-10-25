import assert from 'node:assert/strict'
import { test, after } from 'node:test'
import { prisma } from '../lib/prisma'
import { getAssetWorkspace, saveAssetWorkspace, getAssetHistory, getAssetRevision } from '../app/thing/_shared/actions'
import { ASSET_CATEGORY_DEFAULTS } from '../lib/asset-category-data'
import { assetCosts, propertyCosts, propertyTotalCost, outstanding, newHome } from '../app/thing/_shared/model'
if (!process.env.DATABASE_URL?.includes('loan-assets-test-')) throw new Error('Isolated database required')
after(() => prisma.$disconnect())

test('assets, independent debt, immutable terms, audit snapshots and ledger reconciliation persist atomically', async () => {
  const user = await prisma.user.create({ data: { acccode: 'asset-test', password: 'test', role: 'ADMIN', level: 0 } })
  for (const category of ASSET_CATEGORY_DEFAULTS) await prisma.assetCategory.create({ data: category })
  const initial = await getAssetWorkspace(); const stale = structuredClone(initial.data)
  const data = structuredClone(initial.data); const home = data.homes[0]; const loan = data.loans[0]
  home.costSource = 'boq'; home.boq.push({ id: 'boq-test', category: 'ก่อสร้าง', name: 'งานตัวอย่าง', quantity: 1, unit: 'งาน', price: 1970000, labor: 0, paid: 2000000, spec: '', vendor: '', reference: '' })
  loan.rounds[0].effectiveOn = '2026-01-01'
  const saved = await saveAssetWorkspace(data, 'ตั้งราคา BOQ และวันเริ่มเงินกู้'); assert.ok(saved.data, saved.error)
  assert.equal(assetCosts(saved.data.homes[0]).main, 1970000)
  assert.match((await saveAssetWorkspace(stale)).error ?? '', /อีกหน้าต่าง/)
  const entry = await prisma.ledgerEntry.create({ data: { requestKey: crypto.randomUUID(), kind: 'GENERAL', direction: 'OUT', categoryCode: 'TEST', categoryName: 'ชำระบ้าน', amountSatang: 820000, occurredOn: '2026-01-31', channelCode: 'CASH', channelName: 'เงินสด', createdBy: user.id } })
  const pay = structuredClone(saved.data)
  pay.loans[0].payments.push({ id: 'pay-test', date: '2026-01-31', amount: 8200, interest: 1560, principal: 6640, reference: 'GHB งวด 1', roundId: 'original', ledgerEntryId: entry.id })
  const paid = await saveAssetWorkspace(pay, 'อ้างอิงใบแจ้งยอดธนาคาร'); assert.ok(paid.data, paid.error)
  assert.equal(outstanding(paid.data.loans[0], '2026-02-01'), 2593360)
  assert.equal(assetCosts(paid.data.homes[0]).main, 1970000)
  assert.equal(await prisma.ledgerEntry.count(), 1, 'linking never posts another payment')
  const changed = structuredClone(paid.data); changed.loans[0].rounds[0].opening = 3000000
  assert.match((await saveAssetWorkspace(changed)).error ?? '', /แก้เงื่อนไขเดิมไม่ได้/)
  const mismatch = structuredClone(paid.data); mismatch.loans[0].payments[0].amount = 9000; mismatch.loans[0].payments[0].principal = 7440
  assert.match((await saveAssetWorkspace(mismatch)).error ?? '', /ไม่ตรง/)
  const loaded = await getAssetWorkspace(); assert.equal(loaded.data.revision, paid.data.revision)
  assert.equal(loaded.data.loans[0].payments.length, 1)
  const history = await getAssetHistory(); assert.equal(history.length, 3)
  assert.equal(JSON.parse(await getAssetRevision(initial.data.revision)).loans[0].payments.length, 0)
  const archived = structuredClone(paid.data); archived.homes[0].archivedOn = '2026-01-31'
  const hidden = await saveAssetWorkspace(archived, 'ลบสินทรัพย์แบบกู้คืนได้'); assert.ok(hidden.data, hidden.error)
  assert.equal(hidden.data.homes.length, 1, 'archiving the last asset preserves its record')
  assert.deepEqual(hidden.data.loans, paid.data.loans, 'debt and its payments must not be removed with the property')
  assert.equal((await getAssetWorkspace()).data.homes[0].archivedOn, '2026-01-31')
  const restored = structuredClone(hidden.data); delete restored.homes[0].archivedOn
  const recovered = await saveAssetWorkspace(restored, 'กู้คืนสินทรัพย์'); assert.ok(recovered.data, recovered.error)
  assert.equal(recovered.data.homes[0].archivedOn, undefined)
  assert.equal(await prisma.ledgerEntry.count(), 1, 'archive and restore never change cash records')
  const withLand = structuredClone(recovered.data)
  const land = newHome('ที่ดินทดสอบ'); land.categoryCode = 'VACANT_LAND'; land.purchasePrice = 400000; land.purchasedOn = '2026-01-01'; land.landValue = 450000
  land.landDetails = { deedNumber: 'TEST-001', areaSquareWa: 100, valuationOn: '2026-01-31', valuationSource: 'ประเมินเพื่อทดสอบ', annualGrowthRate: 5, projectionYears: 5 }
  withLand.homes.push(land)
  const savedLand = await saveAssetWorkspace(withLand, 'บันทึกราคาที่ดินและสมมติฐานการเติบโต'); assert.ok(savedLand.data, savedLand.error)
  const storedLand = await prisma.land.findUniqueOrThrow({ where: { operatorId_assetId: { operatorId: String(user.id), assetId: land.id } } })
  assert.equal(storedLand.titleDeedNo, 'TEST-001')
  assert.equal(Number(storedLand.squareWah), 0)
  assert.equal(storedLand.ngan, 1)
  assert.equal(await prisma.assetValuation.count({ where: { assetId: land.id } }), 1)
  const storedPurchase = await prisma.assetTransaction.findFirstOrThrow({ where: { assetId: land.id, transactionType: 'PURCHASE' } })
  assert.equal(storedPurchase.amountSatang, BigInt(40000000))
  const loadedLand = (await getAssetWorkspace()).data.homes.find(row => row.id === land.id)!
  assert.deepEqual(loadedLand.landDetails, land.landDetails)
  assert.equal(loadedLand.purchasePrice, 400000)
  assert.equal(loadedLand.landValue, 450000, 'the growth assumption must not inflate the recorded market value')
  const grouped = structuredClone(savedLand.data)
  grouped.homes.find(row => row.id === land.id)!.purchasePrice = 1000000
  grouped.properties = [{ id: 'property-test', code: 'PROPERTY-001', name: 'บ้านพร้อมที่ดิน · บ้านเลขที่ 99', landId: land.id, buildingId: home.id }]
  const propertySaved = await saveAssetWorkspace(grouped, 'สร้าง PROPERTY โดยอ้างอิงต้นทุนเดิม'); assert.ok(propertySaved.data, propertySaved.error)
  assert.equal(await prisma.assetValuation.count({ where: { assetId: land.id } }), 1, 'saving unchanged prices never duplicates the valuation history')
  assert.equal(await prisma.buildingLand.count({ where: { landId: land.id, buildingId: home.id } }), 1)
  const reloaded = (await getAssetWorkspace()).data
  assert.deepEqual(propertyCosts(reloaded.properties![0], reloaded.homes), { land: 1000000, building: 1970000, total: 2970000 })
  assert.equal(reloaded.homes.length, grouped.homes.length, 'grouping existing assets must not create another cost-bearing asset')
  assert.equal(await prisma.ledgerEntry.count(), 1, 'grouping must not post money movements')
  const invalidProperty = structuredClone(reloaded)
  invalidProperty.properties![0].landId = home.id
  invalidProperty.properties![0].buildingId = land.id
  assert.match((await saveAssetWorkspace(invalidProperty)).error ?? '', /ที่ดินกับอาคาร/)
  assert.deepEqual((await getAssetWorkspace()).data, reloaded, 'invalid relationship leaves the workspace unchanged')
  assert.deepEqual(JSON.parse(await getAssetRevision(reloaded.revision)).properties, reloaded.properties)
  const ungrouped = structuredClone(reloaded); ungrouped.properties = []
  const unlinked = await saveAssetWorkspace(ungrouped, 'ยกเลิกการจัดกลุ่ม PROPERTY'); assert.ok(unlinked.data, unlinked.error)
  assert.equal(await prisma.buildingLand.count({ where: { landId: land.id } }), 0)
  assert.equal(await prisma.land.count({ where: { assetId: land.id } }), 1, 'unlinking a building preserves the land')
  assert.equal(await prisma.assetValuation.count({ where: { assetId: land.id } }), 1)
  const multi = structuredClone(unlinked.data)
  const secondLand = { ...newHome('โฉนดที่สอง'), categoryCode: 'LAND', purchasePrice: 500000 }
  const wall = { ...newHome('กำแพงและรั้ว'), categoryCode: 'OTHER_BUILDING', purchasePrice: 150000 }
  multi.homes.push(secondLand, wall)
  multi.properties = [{ id: 'site-one', code: 'PROP-001', name: 'บ้านเลขที่ 99', type: 'RESIDENTIAL', status: 'DEVELOPING', houseNumber: '99', moo: '7', village: 'สว่างไทรงาม', postalCode: '40000', latitude: 16.4, longitude: 102.8, assetIds: [land.id, secondLand.id, home.id, wall.id] }]
  const multiSaved = await saveAssetWorkspace(multi, 'รวมหลายโฉนด บ้าน และรั้ว'); assert.ok(multiSaved.data, multiSaved.error)
  const site = await prisma.property.findUniqueOrThrow({ where: { operatorId_id: { operatorId: user.id, id: 'site-one' } }, include: { assets: true } })
  assert.equal(site.assets.length, 4)
  assert.equal(site.village, 'สว่างไทรงาม')
  assert.equal(site.status, 'DEVELOPING')
  assert.equal(Number(site.latitude), 16.4)
  assert.equal(propertyTotalCost(multiSaved.data.properties![0], multiSaved.data.homes), 3620000)
  assert.equal(await prisma.buildingLand.count(), 0, 'a group does not imply buildings occupy every parcel')
  assert.equal(await prisma.ledgerEntry.count(), 1)
  const linkedAt = site.assets[0].linkedAt
  const metadata = structuredClone(multiSaved.data); metadata.properties![0].name = 'บ้าน 99 ปรับชื่อ'
  const renamed = await saveAssetWorkspace(metadata); assert.ok(renamed.data, renamed.error)
  const unchangedLink = await prisma.propertyAsset.findFirstOrThrow({ where: { operatorId: user.id, propertyId: site.id, assetId: site.assets[0].assetId } })
  assert.equal(unchangedLink.linkedAt.toISOString(), linkedAt.toISOString())
  const duplicate = structuredClone(renamed.data)
  duplicate.properties!.push({ id: 'site-two', code: 'PROP-002', name: 'ใช้ซ้ำ', assetIds: [land.id] })
  assert.match((await saveAssetWorkspace(duplicate)).error ?? '', /PROPERTY อื่น/)
  const before = (await getAssetWorkspace()).data
  assert.deepEqual(before, renamed.data)
  const detach = structuredClone(before); detach.properties![0].assetIds = [secondLand.id]
  const detached = await saveAssetWorkspace(detach); assert.ok(detached.data, detached.error)
  assert.equal(await prisma.propertyAsset.count(), 1)
  assert.equal(await prisma.asset.count(), detached.data.homes.length)
  const clear = structuredClone(detached.data); clear.properties = []
  const cleared = await saveAssetWorkspace(clear); assert.ok(cleared.data, cleared.error)
  assert.equal(await prisma.property.count(), 0)
  assert.equal(await prisma.propertyAsset.count(), 0)
  assert.equal(await prisma.asset.count(), cleared.data.homes.length, 'unlinking a property never deletes its assets')
  await prisma.user.update({ where: { id: user.id }, data: { role: 'REVIEWER' } })
  assert.match((await saveAssetWorkspace(paid.data)).error ?? '', /ไม่มีสิทธิ์/)
})
