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
