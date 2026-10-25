import type { Prisma } from '@/generated/prisma/client'
import { propertyAssetIds, type AssetData } from '@/app/thing/_shared/model'

/** Projection of the versioned workspace, committed in the same transaction.
 * Asset costs and valuations stay with their original records.
 */
export async function syncPropertyRegister(tx: Prisma.TransactionClient, operatorId: string, data: AssetData) {
  const properties = data.properties ?? []
  const links = properties.flatMap(property => propertyAssetIds(property).map(assetId => ({ propertyId: property.id, assetId })))
  await tx.propertyAsset.deleteMany({ where: { operatorId, ...(links.length ? { NOT: { OR: links } } : {}) } })
  await tx.property.deleteMany({ where: { operatorId, id: { notIn: properties.map(property => property.id) } } })
  for (const property of properties) {
    const key = { operatorId, id: property.id }
    const fields = {
      code: property.code, name: property.name, type: property.type ?? 'RESIDENTIAL', status: property.status ?? 'ACTIVE',
      houseNumber: property.houseNumber || null, moo: property.moo || null, village: property.village || null,
      subdistrict: property.subdistrict || null, district: property.district || null, province: property.province || null,
      postalCode: property.postalCode || null, latitude: property.latitude ?? null, longitude: property.longitude ?? null,
      description: property.description || null,
    }
    await tx.property.upsert({ where: { operatorId_id: key }, create: { ...key, ...fields }, update: fields })
    for (const assetId of propertyAssetIds(property)) {
      const membership = { operatorId, propertyId: property.id, assetId }
      await tx.propertyAsset.upsert({ where: { operatorId_propertyId_assetId: membership }, create: membership, update: {} })
    }
  }
}
