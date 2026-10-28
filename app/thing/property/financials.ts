import { assetCosts, roundMoney, today, type Home } from '../_shared/model'

/** Display only: operational spending is not posted again as asset cost. */
export function assetFinancials(home: Home) {
  const costs = assetCosts(home)
  const developments = home.landDevelopments ?? []
  const projects = home.buildingProjects ?? []
  const works = home.buildingWorks ?? []
  const developmentActual = roundMoney(developments.filter(row => row.treatment === 'capital').reduce((sum, row) => sum + row.actualCost, 0))
  const projectActual = roundMoney(projects.reduce((sum, row) => sum + row.actualCost, 0))
  const projectBudget = (row: typeof projects[number]) => row.pricingMode === 'lump_sum' ? row.lumpSum : row.boqLines.reduce((sum, line) => sum + line.quantity * line.unitPrice + line.labor, 0)
  const budget = roundMoney(developments.reduce((sum, row) => sum + row.budget, 0) + projects.reduce((sum, row) => sum + projectBudget(row), 0))
  const boqPaid = roundMoney(home.boq.reduce((sum, row) => sum + row.paid, 0))
  const expenses = roundMoney(works.filter(row => row.treatment === 'expense').reduce((sum, row) => sum + row.amount, 0) + developments.filter(row => row.treatment === 'expense').reduce((sum, row) => sum + row.actualCost, 0) + developments.reduce((sum, row) => sum + row.maintenance.reduce((value, item) => value + item.cost, 0), 0))
  const payments = [...developments.flatMap(row => row.payments), ...projects.flatMap(row => row.payments)]
  const paid = roundMoney(payments.filter(row => row.direction !== 'IN').reduce((sum, row) => sum + row.amount, 0))
  const refunded = roundMoney(payments.filter(row => row.direction === 'IN').reduce((sum, row) => sum + row.amount, 0))
  const activity = [
    ...works.map(row => ({ id: `work-${row.id}`, name: row.name, date: row.date, amount: row.amount, label: row.treatment === 'capital' ? 'เพิ่มต้นทุนในทะเบียน' : 'ค่าใช้จ่าย', budget: 0, recognized: 0, included: row.treatment === 'capital' })),
    ...developments.map(row => ({ id: `land-${row.id}`, name: row.name, date: row.completedOn || row.startedOn, amount: row.actualCost, label: row.treatment === 'capital' ? 'ต้นทุนพัฒนาจริง · ติดตามแยก' : 'ค่าใช้จ่ายพัฒนาที่ดิน', budget: row.budget, recognized: row.treatment === 'capital' ? row.recognizedAssetValue : 0, included: false })),
    ...projects.map(row => ({ id: `project-${row.id}`, name: row.name, date: row.completedOn || row.startedOn, amount: row.actualCost, label: row.status === 'completed' ? 'โครงการเสร็จแล้ว · รวมในต้นทุนเพิ่ม' : 'โครงการระหว่างดำเนินการ · ติดตามแยก', budget: projectBudget(row), recognized: 0, included: row.status === 'completed' })),
  ].sort((a, b) => b.date.localeCompare(a.date))
  return { ...costs, budget, boqPaid, developmentActual, projectActual, expenses, paid, refunded, netPaid: roundMoney(paid - refunded), activity }
}

export function latestAssetAppraisal(home: Home) {
  const candidates = [...(home.valuations ?? [])].reverse().filter(row => row.date && row.date <= today() && row.source.trim()).map(row => ({ date: row.date, amount: roundMoney(row.landValue + row.buildingValue), source: row.source, scope: row.landValue > 0 && row.buildingValue > 0 ? 'รวมที่ดินและอาคาร' : 'ราคาประเมินสินทรัพย์' }))
  const land = home.landDetails
  for (const price of [...(land?.priceHistory ?? [])].reverse()) if (['appraisal', 'official_appraisal', 'market_appraisal'].includes(price.type) && price.date && price.date <= today() && price.source.trim()) candidates.push({ date: price.date, amount: price.amount, source: price.source, scope: 'ราคาประเมินที่ดิน' })
  if (land?.valuationOn && land.valuationOn <= today() && land.valuationSource.trim() && ['appraisal', 'official_appraisal', 'market_appraisal'].includes(land.priceType ?? 'appraisal')) candidates.unshift({ date: land.valuationOn, amount: home.landValue, source: land.valuationSource, scope: 'ราคาประเมินที่ดิน' })
  return candidates.sort((a, b) => b.date.localeCompare(a.date))[0] ?? null
}

/** Only single-asset assessments can be added across a Property. Combined assessments are excluded. */
export function appraisalHistory(home: Home, land: boolean) {
  const rows = (home.valuations ?? []).filter(row => row.date && row.date <= today() && row.source.trim() && (land ? row.buildingValue === 0 : row.landValue === 0)).map((row, index) => ({ id: row.id, date: row.date, amount: land ? row.landValue : row.buildingValue, source: row.source, notes: row.notes, order: index }))
  if (land) {
    for (const [index, row] of (home.landDetails?.priceHistory ?? []).entries()) if (['appraisal', 'official_appraisal', 'market_appraisal'].includes(row.type) && row.date && row.date <= today() && row.source.trim()) rows.push({ id: `land-history-${index}`, date: row.date, amount: row.amount, source: row.source, notes: row.notes, order: -1 })
    const details = home.landDetails
    if (details?.valuationOn && details.valuationOn <= today() && details.valuationSource.trim() && ['appraisal', 'official_appraisal', 'market_appraisal'].includes(details.priceType ?? 'appraisal') && !rows.some(row => row.date === details.valuationOn && row.amount === home.landValue && row.source === details.valuationSource)) rows.push({ id: 'land-current', date: details.valuationOn, amount: home.landValue, source: details.valuationSource, notes: details.priceNotes ?? '', order: -1 })
  }
  return rows.sort((a,b) => b.date.localeCompare(a.date) || b.order - a.order)
}

export function appraisalComparison(home: Home, amount: number) {
  const costs = assetCosts(home)
  const completeCost = costs.main > 0 || home.purchasePrice > 0 || home.boq.length > 0
  const difference = roundMoney(amount - costs.total)
  return { cost: costs.total, difference, percent: completeCost && costs.total > 0 ? difference / costs.total * 100 : null }
}

export function propertyAppraisal(members: Home[], landIds: Set<string>) {
  const values = members.map(home => ({ home, appraisal: appraisalHistory(home, landIds.has(home.id))[0] }))
  const covered = values.filter(row => row.appraisal).length
  const cost = roundMoney(members.reduce((sum,home) => sum + assetCosts(home).total, 0))
  const amount = roundMoney(values.reduce((sum,row) => sum + (row.appraisal?.amount ?? 0), 0))
  const difference = roundMoney(amount - cost)
  const complete = members.length > 0 && covered === members.length
  const completeCost = members.every(home => appraisalComparison(home, 0).percent !== null)
  return { covered, complete, cost, amount, difference, percent: complete && completeCost && cost > 0 ? difference / cost * 100 : null }
}
