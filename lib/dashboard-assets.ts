import { prisma } from '@/lib/prisma'
import { assetCosts, migrateAssetData, outstanding, propertyAssetIds, roundMoney, type AssetData } from '@/app/thing/_shared/model'

/** Values in this workspace are baht, unlike the lending ledger's satang. */
export function summarizeDashboardAssets(data: AssetData, asOf: string) {
  const active = data.homes.filter(asset => !asset.archivedOn)
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
    return { id: property.id, code: property.code, name: property.name, status: property.status ?? 'ACTIVE', count: ids.length, cost: roundMoney(ids.reduce((sum,id) => sum + (costs.get(id) ?? 0),0)) }
  })
  const debt = roundMoney(data.loans.reduce((sum,loan) => sum + outstanding(loan,asOf),0))
  return { count: active.length, archived: data.homes.length-active.length,
    cost: roundMoney([...costs.values()].reduce((sum,value) => sum+value,0)), debt,
    propertyCount: properties.length, linkedCount: linked.size,
    propertyCost: roundMoney([...linked].reduce((sum,id) => sum + (costs.get(id) ?? 0),0)),
    groups: [...groups.values()], properties: rows,
  }
}

export async function getDashboardAssets(operatorId: string, asOf: string) {
  const workspace = await prisma.assetWorkspaceState.findUnique({ where: { operatorId }, select: { payload: true } })
  return summarizeDashboardAssets(workspace ? migrateAssetData(JSON.parse(workspace.payload)) : { version: 2, revision: 0, homes: [], loans: [], properties: [] }, asOf)
}
