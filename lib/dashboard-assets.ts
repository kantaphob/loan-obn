import { prisma } from '@/lib/prisma'
import { isHomeDisposed, assetAcquisitionCost, saleDeclarationAmounts, assetCosts, migrateAssetData, outstanding, activeRound, propertyAssetIds, roundMoney, type AssetData } from '@/app/thing/_shared/model'

/** Values in this workspace are baht, unlike the lending ledger's satang. */
export function summarizeDashboardAssets(data: AssetData, asOf: string) {
  const soldByProperty = new Set((data.properties ?? []).filter(property => property.status === 'DISPOSED').flatMap(propertyAssetIds))
  const active = data.homes.filter(asset => !asset.archivedOn && !isHomeDisposed(asset) && !soldByProperty.has(asset.id))
  const sold = data.homes.filter(asset => !asset.archivedOn && (isHomeDisposed(asset) || soldByProperty.has(asset.id)))
  const soldIds = new Set(sold.map(asset => asset.id))
  const activeIds = new Set(active.map(asset => asset.id))
  const properties = data.properties ?? []
  const costs = new Map(active.map(asset => [asset.id, assetCosts(asset).total]))
  const groups = new Map<string, { label: string; count: number; cost: number }>()
  for (const asset of active) {
    const label = asset.kind === 'house' ? 'บ้าน / อาคาร' : asset.kind === 'vehicle' ? 'ยานพาหนะ' : 'ที่ดิน / สินทรัพย์อื่น'
    const row = groups.get(label) ?? { label, count: 0, cost: 0 }
    row.count++; row.cost = roundMoney(row.cost + (costs.get(asset.id) ?? 0)); groups.set(label, row)
  }
  const linked = new Set(properties.flatMap(propertyAssetIds).filter(id => activeIds.has(id)))
  const rows = properties.map(property => {
    const ids = propertyAssetIds(property).filter(id => activeIds.has(id))
    const sold = property.status === 'DISPOSED' || propertyAssetIds(property).some(id => soldIds.has(id))
    const members = data.homes.filter(home => propertyAssetIds(property).includes(home.id))
    const reported = members.find(home => home.saleDeclaration)
    const sale = reported?.saleDeclaration
    const saleAmounts = sale ? saleDeclarationAmounts(sale, sale.landCost ?? reported!.landValue) : null
    return { historicalCost: roundMoney(members.reduce((sum,home) => sum + assetAcquisitionCost(home), 0)), saleAmounts, saleRecorded: Boolean(reported?.sale), id: property.id, code: property.code, name: property.name, status: sold ? 'DISPOSED' : property.status ?? 'ACTIVE', count: ids.length, cost: roundMoney(ids.reduce((sum,id) => sum + (costs.get(id) ?? 0),0)) }
  })
  const liabilities = data.loans.map(loan => {
    const round = activeRound(loan,asOf)
    const elapsed = round?.effectiveOn ? Math.max(1,(Number(asOf.slice(0,4))-Number(round.effectiveOn.slice(0,4)))*12+Number(asOf.slice(5,7))-Number(round.effectiveOn.slice(5,7))+1) : 1
    const installment = round?.periods.find(period => period.from<=elapsed && period.to>=elapsed)?.installment ?? null
    return { id:loan.id, name:loan.name, bank:loan.bank, remaining:outstanding(loan,asOf), installment,
      lastPaid:loan.payments.filter(p=>p.date<=asOf).sort((a,b)=>b.date.localeCompare(a.date))[0]?.date ?? null }
  }).filter(row=>row.remaining>0)
  const projects = active.flatMap(home => [
    ...(home.landDevelopments ?? []).filter(work=>work.status!=='cancelled').map(work=>({id:work.id,name:work.name,asset:home.name,status:work.status,budget:work.budget,actual:work.actualCost,paid:roundMoney(work.payments.filter(p=>p.date<=asOf).reduce((n,p)=>n+(p.direction==='IN'?-p.amount:p.amount),0))})),
    ...(home.buildingProjects ?? []).map(work=>({id:work.id,name:work.name,asset:home.name,status:work.status,budget:work.pricingMode==='lump_sum'?work.lumpSum:roundMoney(work.boqLines.reduce((n,r)=>n+r.quantity*r.unitPrice+r.labor,0)),actual:work.actualCost,paid:roundMoney(work.payments.filter(p=>p.date<=asOf).reduce((n,p)=>n+(p.direction==='IN'?-p.amount:p.amount),0))})),
  ])
  const debt = roundMoney(data.loans.reduce((sum,loan) => sum + outstanding(loan,asOf),0))
  return { liabilities, projects, count: active.length, sold: sold.length, archived: data.homes.filter(asset => Boolean(asset.archivedOn)).length,
    cost: roundMoney([...costs.values()].reduce((sum,value) => sum+value,0)), debt,
    heldPropertyCount: rows.filter(row => row.status !== 'DISPOSED').length, soldPropertyCount: rows.filter(row => row.status === 'DISPOSED').length,
    propertyCount: properties.length, linkedCount: linked.size,
    propertyCost: roundMoney([...linked].reduce((sum,id) => sum + (costs.get(id) ?? 0),0)),
    groups: [...groups.values()], properties: rows,
  }
}

export async function getDashboardAssets(operatorId: string, asOf: string) {
  const workspace = await prisma.assetWorkspaceState.findUnique({ where: { operatorId }, select: { payload: true } })
  return summarizeDashboardAssets(workspace ? migrateAssetData(JSON.parse(workspace.payload)) : { version: 2, revision: 0, homes: [], loans: [], properties: [] }, asOf)
}
