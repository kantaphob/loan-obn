import type { Prisma } from '@/generated/prisma/client'
import type { AssetData } from '@/app/thing/_shared/model'

const satang = (amount: number) => BigInt(Math.round((amount + Number.EPSILON) * 100))

/** Replace the searchable BOQ projection in the same transaction as its workspace snapshot. */
export async function syncBuildingBoqRegister(tx: Prisma.TransactionClient, operatorId: string, data: AssetData) {
  await tx.buildingBoqItem.deleteMany({ where: { operatorId } })
  const rows = data.homes.flatMap(home => home.boq.map(item => ({
    operatorId, assetId: home.id, id: item.id,
    category: item.category, subcategory: item.subcategory || null, scope: item.scope ?? 'construction',
    name: item.name, spec: item.spec, quantity: item.quantity, unit: item.unit,
    materialRateSatang: satang(item.price),
    materialTotalSatang: item.materialTotal === undefined ? null : satang(item.materialTotal),
    laborRateSatang: item.laborRate === undefined ? null : satang(item.laborRate),
    laborSatang: satang(item.labor),
    boqTotalSatang: item.boqTotal === undefined ? null : satang(item.boqTotal),
    paidSatang: satang(item.paid), vendor: item.vendor, reference: item.reference,
    note: item.note || null, ledgerEntryId: item.ledgerEntryId ?? null, room: item.room || null,
    replacesId: item.replacesId || null, cancelled: item.cancelled ?? false,
  })))
  // Keep below SQLite's bind-variable limit on supported installations.
  for (let index = 0; index < rows.length; index += 25) {
    await tx.buildingBoqItem.createMany({ data: rows.slice(index, index + 25) })
  }
}
