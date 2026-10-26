import { prisma } from '../lib/prisma'
import { syncBuildingBoqRegister } from '../lib/building-boq-register'
import { migrateAssetData } from '../app/thing/_shared/model'
import { validateAssetData } from '../app/thing/_shared/validation'
import { assignAssetCodes, validateCategories } from '../app/thing/property/categories'

async function main() {
  const workspaces = await prisma.assetWorkspaceState.findMany({ select: { operatorId: true } })
  for (const workspace of workspaces) await prisma.$transaction(async tx => {
    const current = await tx.assetWorkspaceState.findUniqueOrThrow({ where: workspace })
    const data = migrateAssetData(JSON.parse(current.payload))
    validateAssetData(data)
    const categories = await tx.assetCategory.findMany({ select: { code: true, nameTh: true, parentCode: true, isActive: true } })
    validateCategories(data.homes, data.homes, categories)
    const homes = assignAssetCodes(data.homes, data.homes, categories)
    const validCodes = new Set(categories.map(category => category.code))
    for (const home of homes) {
      const fields = {
        code: home.assetCode!, name: home.name, kind: home.kind,
        categoryCode: validCodes.has(home.categoryCode) ? home.categoryCode : null,
        status: home.archivedOn ? 'ARCHIVED' : 'ACTIVE',
        archivedOn: home.archivedOn ? new Date(`${home.archivedOn}T00:00:00.000Z`) : null,
      }
      await tx.asset.upsert({
        where: { operatorId_id: { operatorId: current.operatorId, id: home.id } },
        create: { operatorId: current.operatorId, id: home.id, ...fields }, update: fields,
      })
    }
    const projectionData = { ...data, homes }
    await syncBuildingBoqRegister(tx, current.operatorId, projectionData)
  }, { timeout: 30000 })
  console.log(`Building BOQ synchronized for ${workspaces.length} workspace(s).`)
}

main().catch(error => { console.error(error); process.exitCode = 1 }).finally(() => prisma.$disconnect())
