import assert from 'node:assert/strict'
import { test, after } from 'node:test'
import { prisma } from '../lib/prisma'
import { getAssetWorkspace, saveAssetWorkspace, saveBankLoanContractSettings, getAssetHistory, getAssetRevision } from '../app/thing/_shared/actions'
import { recordBankLoanCash, type BankLoanCashInput } from '../app/thing/liabilities/actions'
import { voidLedger, editLedger } from '../app/dashboard/ledger/actions'
import { ASSET_CATEGORY_DEFAULTS } from '../lib/asset-category-data'
import { migrateAssetData, assetCosts, propertyCosts, propertyTotalCost, outstanding, newHome } from '../app/thing/_shared/model'
import { priceContractStages } from '../app/thing/_shared/model'
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
  assert.match((await saveAssetWorkspace(mismatch)).error ?? '', /ไม่ตรง|ledger/)
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
  assert.deepEqual(before, migrateAssetData(renamed.data))
  const detach = structuredClone(before); detach.properties![0].assetIds = [secondLand.id]
  const detached = await saveAssetWorkspace(detach); assert.ok(detached.data, detached.error)
  assert.equal(await prisma.propertyAsset.count(), 1)
  assert.equal(await prisma.asset.count(), detached.data.homes.length)
  const clear = structuredClone(detached.data); clear.properties = []
  const cleared = await saveAssetWorkspace(clear); assert.ok(cleared.data, cleared.error)
  assert.equal(await prisma.property.count(), 0)
  assert.equal(await prisma.propertyAsset.count(), 0)
  assert.equal(await prisma.asset.count(), cleared.data.homes.length, 'unlinking a property never deletes its assets')
  const liabilities = structuredClone(cleared.data)
  const round = { ...structuredClone(liabilities.loans[0].rounds[0]), id: 'draw-round', effectiveOn: '2020-01-01', opening: 100000 }
  liabilities.loans.push({ id: 'draw-loan', assetId: null, bank: 'Test Bank', name: 'Drawdown loan', accountNumber: '', rounds: [round], disbursements: [{ id: 'action-draw', date: '2020-01-02', amount: 50000, reference: 'D1', notes: '' }], payments: [{ id: 'action-loan-payment', roundId: round.id, date: '2020-02-01', amount: 12500, principal: 11000, interest: 1000, fee: 300, penalty: 200, extraPrincipal: 10000, reference: 'P1' }], documents: [{ id: 'action-loan-doc', name: 'Payment slip', kind: 'slip', paymentId: 'action-loan-payment', reference: 'FILE-1', file: { mimeType: 'application/pdf', dataUrl: 'data:application/pdf;base64,JVBERi0xLjc=' } }] })
  liabilities.loans.at(-1)!.assetIds = liabilities.homes.slice(0, 2).map(row => row.id)
  liabilities.loans.at(-1)!.assetId = liabilities.loans.at(-1)!.assetIds![0]
  const liabilitySaved = await saveAssetWorkspace(liabilities, 'บันทึกเบิกเงินและชำระพร้อมเอกสาร'); assert.ok(liabilitySaved.data, liabilitySaved.error)
  const liabilityReloaded = (await getAssetWorkspace()).data
  assert.deepEqual(liabilityReloaded.loans.at(-1), liabilities.loans.at(-1))
  assert.equal(outstanding(liabilityReloaded.loans.at(-1)!), 39000)
  assert.deepEqual(JSON.parse(await getAssetRevision(liabilityReloaded.revision)).loans.at(-1), liabilities.loans.at(-1))
  assert.equal(await prisma.ledgerEntry.count(), 1, 'recording a loan payment does not manufacture a ledger transaction')
  await prisma.paymentChannel.create({ data: { code: 'BANKING', nameTh: 'ธนาคาร' } })
  const receipt: BankLoanCashInput = { requestKey: crypto.randomUUID(), loanId: 'draw-loan', revision: liabilityReloaded.revision, direction: 'IN', date: '2020-01-03', amount: '5000.00', channelCode: 'BANKING', reference: 'BANK-RECEIPT-1', notes: '', drawNumber: 1 }
  const received = await recordBankLoanCash(receipt); assert.ok('data' in received, 'error' in received ? received.error : '')
  const receiveEntry = await prisma.ledgerEntry.findUniqueOrThrow({ where: { id: received.entryId } })
  assert.equal(receiveEntry.direction, 'IN'); assert.equal(receiveEntry.amountSatang, 500000)
  assert.equal(receiveEntry.categoryCode, 'BANK_LOAN_RECEIVED')
  assert.equal(received.data.loans.at(-1)!.disbursements!.at(-1)!.drawNumber, 1)
  assert.match(receiveEntry.note, /งวดที่ 1/)
  const duplicateDraw = await recordBankLoanCash({ ...receipt, requestKey: crypto.randomUUID(), revision: received.data.revision, reference: 'DUPLICATE-DRAW-NUMBER' })
  assert.ok('error' in duplicateDraw)
  assert.equal(await prisma.ledgerEntry.count(), 2, 'duplicate draw number rolls back its ledger entry')
  assert.equal(received.data.loans.at(-1)!.disbursements!.at(-1)!.ledgerEntryId, receiveEntry.id)
  assert.equal(outstanding(received.data.loans.at(-1)!), 44000)
  const replay = await recordBankLoanCash(receipt); assert.ok('data' in replay)
  assert.equal(replay.entryId, received.entryId); assert.equal(replay.data.revision, received.data.revision)
  const replayMismatch = await recordBankLoanCash({ ...receipt, amount: '5001.00' }); assert.ok('error' in replayMismatch)
  const paymentInput: BankLoanCashInput = { requestKey: crypto.randomUUID(), loanId: 'draw-loan', revision: received.data.revision, direction: 'OUT', date: '2020-03-01', amount: '1500.00', channelCode: 'BANKING', reference: 'BANK-PAYMENT-1', notes: 'ค่างวดรวมโปะ', payment: { roundId: 'draw-round', principal: 1000, interest: 300, fee: 100, penalty: 100, extraPrincipal: 500, bankInstallment: 800 } }
  const bankPaid = await recordBankLoanCash(paymentInput); assert.ok('data' in bankPaid, 'error' in bankPaid ? bankPaid.error : '')
  const payEntry = await prisma.ledgerEntry.findUniqueOrThrow({ where: { id: bankPaid.entryId } })
  assert.equal(payEntry.direction, 'OUT'); assert.equal(payEntry.amountSatang, 150000)
  assert.equal(payEntry.categoryCode, 'BANK_LOAN_PAYMENT')
  assert.equal(outstanding(bankPaid.data.loans.at(-1)!), 43000)
  assert.equal(bankPaid.data.loans.at(-1)!.payments.at(-1)!.bankInstallment, 800)
  assert.equal(bankPaid.data.loans.at(-1)!.payments.at(-1)!.notes, 'ค่างวดรวมโปะ')
  assert.equal((await getAssetWorkspace()).data.loans.at(-1)!.payments.at(-1)!.ledgerEntryId, payEntry.id)
  assert.equal(JSON.parse(await getAssetRevision(bankPaid.data.revision)).loans.at(-1).payments.at(-1).ledgerEntryId, payEntry.id)
  assert.equal(await prisma.ledgerEntry.count(), 3)
  const paymentReplay = await recordBankLoanCash(paymentInput); assert.ok('data' in paymentReplay); assert.equal(paymentReplay.entryId, payEntry.id)
  const beforeFailure = (await getAssetWorkspace()).data
  const invalidPayment = await recordBankLoanCash({ ...paymentInput, requestKey: crypto.randomUUID(), revision: beforeFailure.revision, reference: 'INVALID-SPLIT', amount: '1501.00' })
  assert.ok('error' in invalidPayment)
  const invalidReceipt = await recordBankLoanCash({ ...receipt, requestKey: crypto.randomUUID(), revision: beforeFailure.revision, reference: 'OVER-LIMIT', amount: '100000.00' })
  assert.ok('error' in invalidReceipt)
  const staleReceipt = await recordBankLoanCash({ ...receipt, requestKey: crypto.randomUUID(), reference: 'STALE-RECEIPT' }); assert.ok('error' in staleReceipt)
  assert.equal(await prisma.ledgerEntry.count(), 3, 'failed or replayed requests must not create ledger rows')
  assert.deepEqual((await getAssetWorkspace()).data, beforeFailure, 'failed entries leave the workspace and revision unchanged')
  const removed = structuredClone(beforeFailure); removed.loans.at(-1)!.payments.pop()
  assert.match((await saveAssetWorkspace(removed)).error ?? '', /ledger/)
  assert.match((await voidLedger(payEntry.id, 'test linked guard')).error ?? '', /ทะเบียนหนี้สิน/)
  assert.match((await editLedger({ id: receiveEntry.id, expectedRevision: 0, amount: '5000.00', occurredOn: '2020-01-03', channelCode: 'BANKING', reference: 'BANK-RECEIPT-1', note: '', reason: 'test linked guard', categoryCode: 'BANK_LOAN_RECEIVED', direction: 'IN' })).error ?? '', /ทะเบียนหนี้สิน/)
  const contractSettings = { opening: 50000, creditLimit: 200000, months: 120, mrr: 7, effectiveOn: '2020-01-01', referenceInterest: 1000, annualInstallments: [5000], rate: 5, insurance: 'qualifying' as const, customerType: 'welfare' as const, roundName: 'สัญญาที่แก้ไข', fee: 250, notes: 'แก้ข้อตกลงธนาคาร' }
  const amended = await saveBankLoanContractSettings('draw-loan', beforeFailure.revision, contractSettings)
  assert.ok(amended.data, amended.error)
  assert.equal(amended.data.loans.at(-1)!.rounds[0].mrr, 7)
  assert.equal(amended.data.loans.at(-1)!.rounds[0].name, 'สัญญาที่แก้ไข')
  assert.equal(amended.data.loans.at(-1)!.rounds[0].fee, 250)
  assert.equal(outstanding(amended.data.loans.at(-1)!), 93000)
  assert.deepEqual(amended.data.loans.at(-1)!.payments, beforeFailure.loans.at(-1)!.payments)
  assert.deepEqual(amended.data.loans.at(-1)!.disbursements, beforeFailure.loans.at(-1)!.disbursements)
  assert.equal(await prisma.ledgerEntry.count(), 3, 'editing agreement fields never rewrites cash transactions')
  assert.deepEqual((await getAssetWorkspace()).data, amended.data)
  assert.deepEqual(JSON.parse(await getAssetRevision(amended.data.revision)), amended.data)
  assert.match((await saveBankLoanContractSettings('draw-loan', beforeFailure.revision, contractSettings)).error ?? '', /อีกหน้าต่าง/)
  const invalidContract = await saveBankLoanContractSettings('draw-loan', amended.data.revision, { ...contractSettings, creditLimit: 1 })
  assert.ok(invalidContract.error)
  assert.deepEqual((await getAssetWorkspace()).data, amended.data)
  const construction = structuredClone(amended.data)
  construction.loans.at(-1)!.contractorContracts = [{ id: 'contractor-agreement', code: 'CT-001', name: 'ก่อสร้างบ้าน', contractor: 'ช่างทดสอบ', amount: 20000, signedOn: '2020-01-01', description: 'ตามงวดงาน', stages: [{ id: 'construction-stage-1', number: 1, name: 'ฐานราก', amount: 10000, dueOn: '' }, { id: 'construction-stage-2', number: 2, name: 'โครงสร้าง', amount: 10000, dueOn: '' }] }]
  const contractCreated = await saveAssetWorkspace(construction, 'สร้างสัญญาจ้างเหมา'); assert.ok(contractCreated.data, contractCreated.error)
  const constructionInput: BankLoanCashInput = { requestKey: crypto.randomUUID(), loanId: 'draw-loan', revision: contractCreated.data.revision, direction: 'OUT', date: '2020-04-01', amount: '4000.00', channelCode: 'BANKING', reference: 'CONTRACTOR-PAID-1', notes: 'งวดงานฐานราก', contractorPayment: { contractId: 'contractor-agreement', stageId: 'construction-stage-1' } }
  const constructionPaid = await recordBankLoanCash(constructionInput); assert.ok('data' in constructionPaid, 'error' in constructionPaid ? constructionPaid.error : '')
  assert.equal(outstanding(constructionPaid.data.loans.at(-1)!), outstanding(amended.data.loans.at(-1)!), 'paying the builder never reduces bank debt')
  assert.equal(constructionPaid.data.loans.at(-1)!.payments.length, amended.data.loans.at(-1)!.payments.length)
  assert.equal(constructionPaid.data.loans.at(-1)!.contractorPayments!.at(-1)!.amount, 4000)
  const constructionEntry = await prisma.ledgerEntry.findUniqueOrThrow({ where: { id: constructionPaid.entryId } })
  assert.equal(constructionEntry.direction, 'OUT'); assert.equal(constructionEntry.categoryCode, 'CONTRACTOR_PROGRESS_PAYMENT')
  assert.match(constructionEntry.note, /CT-001.*ช่างทดสอบ.*ฐานราก/)
  const constructionReplay = await recordBankLoanCash(constructionInput); assert.ok('data' in constructionReplay); assert.equal(constructionReplay.entryId, constructionPaid.entryId)
  const overStage = await recordBankLoanCash({ ...constructionInput, requestKey: crypto.randomUUID(), revision: constructionPaid.data.revision, amount: '6500.00', reference: 'OVER-STAGE' }); assert.ok('error' in overStage)
  assert.equal(await prisma.ledgerEntry.count(), 4, 'overpaying a stage rolls back the ledger write')
  const contractorReload = (await getAssetWorkspace()).data
  assert.deepEqual(contractorReload, constructionPaid.data)
  assert.equal(JSON.parse(await getAssetRevision(contractorReload.revision)).loans.at(-1).contractorPayments.at(-1).ledgerEntryId, constructionPaid.entryId)
  const alteredConstruction = structuredClone(contractorReload); alteredConstruction.loans.at(-1)!.contractorPayments = []
  assert.match((await saveAssetWorkspace(alteredConstruction)).error ?? '', /ผู้รับเหมา/)
  assert.match((await voidLedger(constructionPaid.entryId, 'test construction link')).error ?? '', /สัญญาจ้างเหมา/)
  const landAgreement = structuredClone(contractorReload)
  landAgreement.loans.at(-1)!.contractorContracts!.push({ id: 'land-agreement', kind: 'land_purchase', code: 'LC-001', name: 'ซื้อที่ดิน', contractor: 'ผู้ขายที่ดินทดสอบ', amount: 50000, signedOn: '', description: 'ชำระตามสัญญา', landReference: 'โฉนด 1403', location: 'ที่ตั้งทดสอบ', stages: [{ id: 'land-deposit', number: 1, name: 'มัดจำ', amount: 10000, dueOn: '' }, { id: 'land-transfer', number: 2, name: 'ชำระวันโอน', amount: 40000, dueOn: '' }] })
  const landAgreementSaved = await saveAssetWorkspace(landAgreement, 'สัญญาซื้อที่ดิน'); assert.ok(landAgreementSaved.data, landAgreementSaved.error)
  const landCashInput: BankLoanCashInput = { ...constructionInput, requestKey: crypto.randomUUID(), revision: landAgreementSaved.data.revision, amount: '10000.00', reference: 'LAND-DEPOSIT-1', notes: 'มัดจำที่ดิน', contractorPayment: { contractId: 'land-agreement', stageId: 'land-deposit' } }
  const landCash = await recordBankLoanCash(landCashInput); assert.ok('data' in landCash, 'error' in landCash ? landCash.error : '')
  const landCashEntry = await prisma.ledgerEntry.findUniqueOrThrow({ where: { id: landCash.entryId } })
  assert.equal(landCashEntry.categoryCode, 'LAND_PURCHASE_PAYMENT'); assert.equal(landCashEntry.direction, 'OUT')
  assert.match(landCashEntry.note, /LC-001.*ผู้ขายที่ดินทดสอบ.*มัดจำ/)
  assert.equal(outstanding(landCash.data.loans.at(-1)!), outstanding(contractorReload.loans.at(-1)!))
  const landReload = (await getAssetWorkspace()).data
  assert.equal(landReload.loans.at(-1)!.contractorContracts!.at(-1)!.landReference, 'โฉนด 1403')
  assert.equal(landReload.loans.at(-1)!.contractorPayments!.at(-1)!.ledgerEntryId, landCash.entryId)
  const duplicateLandCash = await recordBankLoanCash(landCashInput); assert.ok('data' in duplicateLandCash); assert.equal(duplicateLandCash.entryId, landCash.entryId)
  assert.equal(await prisma.ledgerEntry.count(), 5)
  const landKindChanged = structuredClone(landReload); landKindChanged.loans.at(-1)!.contractorContracts!.at(-1)!.kind = 'construction'
  assert.match((await saveAssetWorkspace(landKindChanged)).error ?? '', /เปลี่ยนประเภท/)
  const landDrawInput: BankLoanCashInput = { ...receipt, requestKey: crypto.randomUUID(), revision: landReload.revision, amount: '10000.00', reference: 'LAND-DRAW-1', drawType: 'land', drawNumber: 1 }
  const landDraw = await recordBankLoanCash(landDrawInput); assert.ok('data' in landDraw, 'error' in landDraw ? landDraw.error : '')
  assert.equal(landDraw.data.loans.at(-1)!.disbursements!.at(-1)!.drawType, 'land')
  assert.equal((await prisma.ledgerEntry.findUniqueOrThrow({ where: { id: landDraw.entryId } })).categoryCode, 'BANK_LOAN_LAND_RECEIVED')
  const houseDrawInput: BankLoanCashInput = { ...landDrawInput, requestKey: crypto.randomUUID(), revision: landDraw.data.revision, amount: '15000.00', reference: 'HOUSE-DRAW-1', drawType: 'house', drawNumber: 1 }
  const houseDraw = await recordBankLoanCash(houseDrawInput); assert.ok('data' in houseDraw, 'error' in houseDraw ? houseDraw.error : '')
  const houseDrawRow = houseDraw.data.loans.at(-1)!.disbursements!.at(-1)!
  assert.equal(houseDrawRow.drawType, 'house'); assert.equal(houseDrawRow.drawNumber, 1)
  assert.equal((await prisma.ledgerEntry.findUniqueOrThrow({ where: { id: houseDraw.entryId } })).categoryCode, 'BANK_LOAN_HOUSE_RECEIVED')
  const duplicateTypedDraw = await recordBankLoanCash({ ...houseDrawInput, requestKey: crypto.randomUUID(), revision: houseDraw.data.revision, reference: 'HOUSE-DRAW-1-DUPLICATE' })
  assert.ok('error' in duplicateTypedDraw)
  assert.equal(await prisma.ledgerEntry.count(), 7, 'a duplicate receipt in the same type rolls back both records')
  const typedReplay = await recordBankLoanCash(houseDrawInput); assert.ok('data' in typedReplay); assert.equal(typedReplay.entryId, houseDraw.entryId)
  assert.deepEqual((await getAssetWorkspace()).data, houseDraw.data)
  assert.equal(JSON.parse(await getAssetRevision(houseDraw.data.revision)).loans.at(-1).disbursements.at(-1).drawType, 'house')
  const percentageContracts = structuredClone(houseDraw.data)
  percentageContracts.loans.at(-1)!.contractorContracts!.push(...([
    { id: 'land-percent-agreement', code: 'LC-002', kind: 'land_purchase' as const, amount: 400000, percentages: [70, 30] },
    { id: 'house-percent-agreement', code: 'CT-002', kind: 'construction' as const, amount: 2600000, percentages: [20, 20, 15, 15, 15, 10, 5] },
  ].map(row => ({ id: row.id, code: row.code, kind: row.kind, name: 'สัญญาตามเปอร์เซ็นต์', contractor: 'ผู้รับเงินทดสอบ', amount: row.amount, signedOn: '', description: '', stages: priceContractStages(row.amount, row.percentages.map((percent, i) => ({ id: `${row.id}-stage-${i + 1}`, number: i + 1, name: `งวด ${i + 1}`, percent, amount: 0, dueOn: '' }))) }))))
  const percentageSaved = await saveAssetWorkspace(percentageContracts, 'กำหนดงวดชำระเป็นเปอร์เซ็นต์'); assert.ok(percentageSaved.data, percentageSaved.error)
  const percentageReloaded = (await getAssetWorkspace()).data
  assert.deepEqual(percentageReloaded, percentageSaved.data)
  assert.deepEqual(percentageReloaded.loans.at(-1)!.contractorContracts!.at(-1)!.stages.map(stage => [stage.percent, stage.amount]), [[20, 520000], [20, 520000], [15, 390000], [15, 390000], [15, 390000], [10, 260000], [5, 130000]])
  assert.equal(await prisma.ledgerEntry.count(), 7, 'defining stage percentages is an agreement and does not move money')
  const variationWorkspace = structuredClone(percentageSaved.data)
  const variedContract = variationWorkspace.loans.at(-1)!.contractorContracts!.find(c => c.id === 'contractor-agreement')!
  variedContract.variations = [
    { id: 'action-vo-add', code: 'VO-001', kind: 'add', name: 'งานนอก BOQ', quantity: 2, unit: 'งาน', unitPrice: 5000, amount: 10000, date: '2020-03-01', status: 'approved', reference: 'QUOTE-1', notes: '' },
    { id: 'action-vo-deduct', code: 'VO-002', kind: 'deduct', name: 'ลดขอบเขตฐานราก', quantity: 1, unit: 'งาน', unitPrice: 2000, amount: 2000, date: '2020-03-01', status: 'approved', stageId: 'construction-stage-1', reference: '', notes: '' },
  ]
  const varied = await saveAssetWorkspace(variationWorkspace, 'ตกลงงานเพิ่ม–งานลด'); assert.ok(varied.data, varied.error)
  assert.equal(await prisma.ledgerEntry.count(), 7, 'agreeing a variation never records money paid')
  assert.equal(varied.data.loans.at(-1)!.contractorContracts!.find(c => c.id === variedContract.id)!.amount, 20000)
  const extraWorkInput: BankLoanCashInput = { ...constructionInput, requestKey: crypto.randomUUID(), revision: varied.data.revision, amount: '5000.00', date: '2020-04-02', reference: 'EXTRA-WORK-1', notes: 'จ่ายงานเพิ่ม', contractorPayment: { contractId: variedContract.id, stageId: 'action-vo-add' } }
  const extraPaid = await recordBankLoanCash(extraWorkInput); assert.ok('data' in extraPaid, 'error' in extraPaid ? extraPaid.error : '')
  assert.equal(outstanding(extraPaid.data.loans.at(-1)!), outstanding(varied.data.loans.at(-1)!))
  assert.match((await prisma.ledgerEntry.findUniqueOrThrow({ where: { id: extraPaid.entryId } })).note, /VO-001.*งานนอก BOQ/)
  const extraReplay = await recordBankLoanCash(extraWorkInput); assert.ok('data' in extraReplay); assert.equal(extraReplay.entryId, extraPaid.entryId)
  const overExtra = await recordBankLoanCash({ ...extraWorkInput, requestKey: crypto.randomUUID(), revision: extraPaid.data.revision, amount: '6000.00', reference: 'OVER-EXTRA' }); assert.ok('error' in overExtra)
  assert.equal(await prisma.ledgerEntry.count(), 8)
  const cancelledPaidWork = structuredClone(extraPaid.data); cancelledPaidWork.loans.at(-1)!.contractorContracts!.find(c => c.id === variedContract.id)!.variations![0].status = 'cancelled'
  assert.ok((await saveAssetWorkspace(cancelledPaidWork)).error, 'paid additional work cannot disappear from payment stages')
  const belowPaidWork = structuredClone(extraPaid.data); const reduction = belowPaidWork.loans.at(-1)!.contractorContracts!.find(c => c.id === variedContract.id)!.variations![1]; reduction.unitPrice = 9000; reduction.amount = 9000
  assert.match((await saveAssetWorkspace(belowPaidWork)).error ?? '', /ยอดจ่ายเกินงวดงาน/)
  const variationReload = (await getAssetWorkspace()).data
  assert.deepEqual(variationReload, extraPaid.data)
  assert.equal(JSON.parse(await getAssetRevision(variationReload.revision)).loans.at(-1).contractorPayments.at(-1).stageId, 'action-vo-add')
  await prisma.user.update({ where: { id: user.id }, data: { role: 'REVIEWER' } })
  assert.match((await saveBankLoanContractSettings('draw-loan', amended.data.revision, contractSettings)).error ?? '', /ไม่มีสิทธิ์/)
  assert.match((await recordBankLoanCash({ ...receipt, requestKey: crypto.randomUUID(), revision: beforeFailure.revision })).error ?? '', /ไม่มีสิทธิ์/)
  assert.match((await saveAssetWorkspace(paid.data)).error ?? '', /ไม่มีสิทธิ์/)
})
