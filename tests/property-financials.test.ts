import test from 'node:test'
import assert from 'node:assert/strict'
import { newHome, type BuildingProject, type LandDevelopment } from '../app/thing/_shared/model'
import { assetFinancials, latestAssetAppraisal } from '../app/thing/property/financials'

test('property presentation separates capital, expenses, project spending and refunds', () => {
  const home = newHome('house')
  home.purchasePrice = 1000000
  home.buildingWorks = [
    { id: 'extension', type: 'improvement', name: 'Extension', amount: 100000, treatment: 'capital', date: '2026-01-01', roomNames: [], vendor: '', warrantyUntil: '', reference: '', notes: '' },
    { id: 'repair', type: 'repair', name: 'Repair', amount: 3000, treatment: 'expense', date: '2026-01-02', roomNames: [], vendor: '', warrantyUntil: '', reference: '', notes: '' },
  ]
  home.landDevelopments = [{ id: 'garden', name: 'Garden', treatment: 'capital', status: 'retired', startedOn: '2026-01-01', completedOn: '', budget: 80000, actualCost: 50000, recognizedAssetValue: 45000, maintenance: [{ cost: 1000 }], payments: [{ direction: 'OUT', amount: 40000 }, { direction: 'IN', amount: 2000 }] } as LandDevelopment]
  const result = assetFinancials(home)
  assert.equal(result.budget, 80000)
  assert.equal(result.total, 1100000)
  assert.equal(result.additions, 100000)
  assert.equal(result.developmentActual, 50000)
  assert.equal(result.expenses, 4000)
  assert.equal(result.netPaid, 38000)
  assert.equal(result.activity.find(row => row.id === 'land-garden')!.recognized, 45000)
  assert.equal(result.activity.find(row => row.id === 'land-garden')!.included, false)
  home.buildingWorks[0].amount = 120000
  assert.equal(assetFinancials(home).total, 1120000, 'new source values flow into the view')
})

test('completed project costs appear once in additions while payments stay separate', () => {
  const home = newHome('house')
  home.purchasePrice = 1000000
  home.buildingProjects = [{ id: 'extension', name: 'Extension', type: 'extension', roomNames: [], vendor: '', reference: '', notes: '', warrantyUntil: '', status: 'completed', actualCost: 120000, startedOn: '2026-01-01', completedOn: '2026-02-01', pricingMode: 'lump_sum', lumpSum: 150000, boqLines: [], payments: [{ id: 'payment', ledgerEntryId: 1, date: '2026-02-01', type: 'final', reference: '', note: '', direction: 'OUT', amount: 120000 }] } satisfies BuildingProject]
  const result = assetFinancials(home)
  assert.equal(result.total, 1120000)
  assert.equal(result.additions, 120000)
  assert.equal(result.projectActual, 120000)
  assert.equal(result.paid, 120000)
  assert.equal(result.activity[0].included, true)
  assert.equal(result.budget, 150000)
})

test('appraisals exclude asking and sale prices, preserve coverage and require dated evidence', () => {
  const home = newHome('land')
  home.landValue = 9000000
  home.landDetails = { deedNumber: 'XXX', areaSquareWa: 100, valuationOn: '2026-02-01', valuationSource: 'asking', priceType: 'asking', priceHistory: [{ amount: 2000000, date: '2026-01-01', source: 'appraiser', type: 'market_appraisal', notes: '' }] }
  assert.equal(latestAssetAppraisal(home)!.amount, 2000000)
  home.valuations = [{ id: 'v', date: '2026-03-01', landValue: 2000000, buildingValue: 1000000, source: 'bank', notes: '' }]
  assert.equal(latestAssetAppraisal(home)!.amount, 3000000)
  assert.equal(latestAssetAppraisal(home)!.scope, 'รวมที่ดินและอาคาร')
  home.valuations = []; home.landDetails.priceHistory = []
  assert.equal(latestAssetAppraisal(home), null)
})
