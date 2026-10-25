import { prisma } from '../lib/prisma'
import { syncLandRegister } from '../lib/land-register'
import { migrateAssetData } from '../app/thing/_shared/model'
import { validateAssetData } from '../app/thing/_shared/validation'

async function main() {
  const workspaces = await prisma.assetWorkspaceState.findMany({ select: { operatorId: true } })
  for (const workspace of workspaces) await prisma.$transaction(async tx => {
    const current = await tx.assetWorkspaceState.findUniqueOrThrow({ where: workspace })
    const data = migrateAssetData(JSON.parse(current.payload))
    validateAssetData(data)
    const categories = await tx.assetCategory.findMany({ select: { code: true, nameTh: true, parentCode: true, isActive: true } })
    await syncLandRegister(tx, current.operatorId, data, categories)
  }, { timeout: 30000 })
  console.log(`Land register synchronized for ${workspaces.length} workspace(s).`)
}
main().catch(error => { console.error(error); process.exitCode = 1 }).finally(() => prisma.$disconnect())
