import { createHash } from 'node:crypto'
import type { Prisma } from '@/generated/prisma/client'
import { assignAssetCodes, categoryChain, type AssetCategory } from '@/app/thing/property/categories'
import type { AssetData } from '@/app/thing/_shared/model'

const asDate = (value: string) => value ? new Date(`${value}T00:00:00.000Z`) : null
const satang = (value: number) => BigInt(Math.round(value * 100))

/** Relational projection of the existing editor, committed with its audit snapshot.
 * Supplemental title/ownership/encumbrance records are never overwritten here.
 */
export async function syncLandRegister(tx: Prisma.TransactionClient, operatorId: string, data: AssetData, categories: AssetCategory[]) {
  const homes = assignAssetCodes(data.homes, data.homes, categories)
  const categoryCodes = new Set(categories.map(row => row.code))
  for (const home of homes) {
    const fields = { code: home.assetCode!, name: home.name, kind: home.kind, categoryCode: categoryCodes.has(home.categoryCode) ? home.categoryCode : null, status: home.archivedOn ? 'ARCHIVED' : 'ACTIVE', archivedOn: asDate(home.archivedOn ?? '') }
    await tx.asset.upsert({ where: { operatorId_id: { operatorId, id: home.id } }, create: { operatorId, id: home.id, ...fields }, update: fields })
    if (!categoryChain(home.categoryCode, categories).some(row => row.code === 'LAND')) continue
    const area = Math.round((home.landDetails?.areaSquareWa ?? 0) * 100)
    const physical = { titleDeedNo: home.landDetails?.deedNumber || null, address: home.address || null, rai: Math.floor(area / 40000), ngan: Math.floor((area % 40000) / 10000), squareWah: (area % 10000) / 100 }
    await tx.land.upsert({ where: { operatorId_assetId: { operatorId, assetId: home.id } }, create: { operatorId, assetId: home.id, ...physical }, update: physical })
    // Purchase entries describe acquisition cost, never bank repayments or proceeds.
    if (home.purchasePrice > 0 || home.purchasedOn) {
      const acquisitionId = `workspace-purchase-${home.id}`
      await tx.landAcquisition.upsert({ where: { operatorId_id: { operatorId, id: acquisitionId } }, create: { operatorId, id: acquisitionId, landId: home.id, acquisitionType: 'PURCHASE', acquiredAt: asDate(home.purchasedOn) }, update: { acquiredAt: asDate(home.purchasedOn) } })
    }
    const purchaseKey = { operatorId, assetId: home.id, sourceKey: 'workspace-purchase' }
    // Update a corrected price without creating a zero-value acquisition for unknown costs.
    if (home.purchasePrice > 0) await tx.assetTransaction.upsert({ where: { operatorId_assetId_sourceKey: purchaseKey }, create: { ...purchaseKey, transactionType: 'PURCHASE', amountSatang: satang(home.purchasePrice), occurredAt: asDate(home.purchasedOn) }, update: { amountSatang: satang(home.purchasePrice), occurredAt: asDate(home.purchasedOn) } })
    if (home.purchasePrice === 0) await tx.assetTransaction.updateMany({ where: purchaseKey, data: { amountSatang: BigInt(0), occurredAt: asDate(home.purchasedOn) } })
    const detail = home.landDetails
    const prices = [...(detail?.priceHistory ?? [])]
    if (home.landValue > 0 && detail?.valuationOn && detail.valuationSource) prices.push({ amount: home.landValue, date: detail.valuationOn, source: detail.valuationSource, type: detail.priceType ?? 'appraisal', notes: detail.priceNotes ?? '' })
    const existing = new Set((await tx.assetValuation.findMany({ where: { operatorId, assetId: home.id }, select: { sourceKey: true } })).map(row => row.sourceKey))
    const rows: Prisma.AssetValuationCreateManyInput[] = []
    for (const price of prices) {
      const sourceKey = `workspace-${createHash('sha256').update(JSON.stringify([price.amount, price.date, price.source, price.type, price.notes])).digest('hex')}`
      if (existing.has(sourceKey)) continue
      existing.add(sourceKey)
      rows.push({ operatorId, assetId: home.id, sourceKey, amountSatang: satang(price.amount), valuationDate: asDate(price.date)!, valuationType: price.type.toUpperCase(), source: price.source, notes: price.notes })
    }
    for (let start = 0; start < rows.length; start += 100) await tx.assetValuation.createMany({ data: rows.slice(start, start + 100) })
  }
  // Existing PROPERTY links identify buildings without duplicating land costs.
  const links = (data.properties ?? []).map(property => ({ landId: property.landId, buildingId: property.buildingId }))
  await tx.buildingLand.deleteMany({ where: { operatorId, ...(links.length ? { NOT: { OR: links } } : {}) } })
  for (const property of data.properties ?? []) {
    const key = { operatorId, landId: property.landId, buildingId: property.buildingId }
    await tx.buildingLand.upsert({ where: { operatorId_landId_buildingId: key }, create: key, update: {} })
  }
}
