import { createHash } from 'node:crypto'
import type { Prisma } from '@/generated/prisma/client'
import { assignAssetCodes, categoryChain, type AssetCategory } from '@/app/thing/property/categories'
import { isHomeDisposed, propertyAssetIds, type AssetData } from '@/app/thing/_shared/model'

const asDate = (value: string) => value ? new Date(`${value}T00:00:00.000Z`) : null
const satang = (value: number) => BigInt(Math.round(value * 100))

/** Relational projection of the existing editor, committed with its audit snapshot.
 * Supplemental title/ownership/encumbrance records are never overwritten here.
 */
export async function syncLandRegister(tx: Prisma.TransactionClient, operatorId: string, data: AssetData, categories: AssetCategory[]) {
  const homes = assignAssetCodes(data.homes, data.homes, categories)
  const categoryCodes = new Set(categories.map(row => row.code))
  for (const home of homes) {
    const fields = { code: home.assetCode!, name: home.name, kind: home.kind, categoryCode: categoryCodes.has(home.categoryCode) ? home.categoryCode : null, status: home.archivedOn ? 'ARCHIVED' : isHomeDisposed(home) ? 'SOLD' : 'ACTIVE', archivedOn: asDate(home.archivedOn ?? '') }
    await tx.asset.upsert({ where: { operatorId_id: { operatorId, id: home.id } }, create: { operatorId, id: home.id, ...fields }, update: fields })
    if (!categoryChain(home.categoryCode, categories).some(row => row.code === 'LAND')) continue
    const area = Math.round((home.landDetails?.areaSquareWa ?? 0) * 100)
    const detail = home.landDetails
    const physical = {
      titleType: detail?.titleType || null, titleDeedNo: detail?.deedNumber || null, parcelNo: detail?.parcelNo || null,
      surveyNo: detail?.surveyNo || null, mapSheet: detail?.mapSheet || null, mapScale: detail?.mapScale || null,
      titleBook: detail?.titleBook || null, titlePage: detail?.titlePage || null, address: home.address || null,
      village: detail?.village || null, moo: detail?.moo || null, subdistrict: detail?.subdistrict || null,
      district: detail?.district || null, province: detail?.province || null, postalCode: detail?.postalCode || null,
      landOffice: detail?.landOffice || null, rai: Math.floor(area / 40000), ngan: Math.floor((area % 40000) / 10000), squareWah: (area % 10000) / 100,
      latitude: detail?.latitude ?? null, longitude: detail?.longitude ?? null, landUse: detail?.landUse || null,
      zoning: detail?.zoning || null, roadAccess: detail?.roadAccess || null, utilitiesNotes: detail?.utilitiesNotes || null,
      notes: detail?.notes || null,
    }
    await tx.land.upsert({ where: { operatorId_assetId: { operatorId, assetId: home.id } }, create: { operatorId, assetId: home.id, ...physical }, update: physical })
    const improvements = home.landDevelopments ?? []
    for (const work of improvements) {
      const { id, name, type, mobility, status, treatment, pricingMode, budget, actualCost, recognizedAssetValue, resultingAssetId, payments, ...details } = work
      const key = { operatorId, id }
      const fields = { landId: home.id, name, category: type, mobility, status: status.toUpperCase(), treatment: treatment.toUpperCase(), pricingMode: pricingMode.toUpperCase(), budgetSatang: satang(budget), actualCostSatang: satang(actualCost), recognizedAssetValueSatang: satang(recognizedAssetValue), resultingAssetId: resultingAssetId || null, detailsJson: JSON.stringify(details) }
      await tx.landDevelopment.upsert({ where: { operatorId_id: key }, create: { ...key, ...fields }, update: fields })
      for (const payment of payments) {
        const costKey = { operatorId, id: payment.id }
        const costFields = { developmentId: id, ledgerEntryId: payment.ledgerEntryId, paymentType: payment.type.toUpperCase(), amountSatang: satang(payment.amount), paidOn: asDate(payment.date)!, reference: payment.reference, notes: payment.note }
        await tx.landDevelopmentCost.upsert({ where: { operatorId_id: costKey }, create: { ...costKey, ...costFields }, update: costFields })
      }
      await tx.landDevelopmentCost.deleteMany({ where: { operatorId, developmentId: id, id: { notIn: payments.map(payment => payment.id) } } })
    }
    await tx.landDevelopmentCost.deleteMany({ where: { operatorId, developmentId: { notIn: improvements.map(work => work.id) } } })
    await tx.landDevelopment.deleteMany({ where: { operatorId, landId: home.id, id: { notIn: improvements.map(work => work.id) } } })
    // Purchase entries describe acquisition cost, never bank repayments or proceeds.
    if (home.purchasePrice > 0 || home.purchasedOn) {
      const acquisitionId = `workspace-purchase-${home.id}`
      await tx.landAcquisition.upsert({ where: { operatorId_id: { operatorId, id: acquisitionId } }, create: { operatorId, id: acquisitionId, landId: home.id, acquisitionType: 'PURCHASE', acquiredAt: asDate(home.purchasedOn) }, update: { acquiredAt: asDate(home.purchasedOn) } })
    }
    const purchaseKey = { operatorId, assetId: home.id, sourceKey: 'workspace-purchase' }
    // Update a corrected price without creating a zero-value acquisition for unknown costs.
    if (home.purchasePrice > 0) await tx.assetTransaction.upsert({ where: { operatorId_assetId_sourceKey: purchaseKey }, create: { ...purchaseKey, transactionType: 'PURCHASE', amountSatang: satang(home.purchasePrice), occurredAt: asDate(home.purchasedOn) }, update: { amountSatang: satang(home.purchasePrice), occurredAt: asDate(home.purchasedOn) } })
    if (home.purchasePrice === 0) await tx.assetTransaction.updateMany({ where: purchaseKey, data: { amountSatang: BigInt(0), occurredAt: asDate(home.purchasedOn) } })
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
  // Preserve known building/parcel links inside each group. Multiple parcels do
  // not imply that every building physically occupies every parcel.
  const groups = (data.properties ?? []).map(propertyAssetIds)
  const previousLinks = await tx.buildingLand.findMany({ where: { operatorId }, select: { landId: true, buildingId: true } })
  const links = previousLinks.filter(link => groups.some(group => group.includes(link.landId) && group.includes(link.buildingId)))
  for (const property of data.properties ?? []) if (!property.assetIds && property.landId && property.buildingId) links.push({ landId: property.landId, buildingId: property.buildingId })
  await tx.buildingLand.deleteMany({ where: { operatorId, ...(links.length ? { NOT: { OR: links } } : {}) } })
  for (const link of links) {
    const key = { operatorId, ...link }
    await tx.buildingLand.upsert({ where: { operatorId_landId_buildingId: key }, create: key, update: {} })
  }
}
