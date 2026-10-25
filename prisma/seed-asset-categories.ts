import { prisma } from '../lib/prisma'
import { ASSET_CATEGORY_DEFAULTS } from '../lib/asset-category-data'

async function main() {
  await prisma.$transaction(async (tx) => {
    for (const category of ASSET_CATEGORY_DEFAULTS) {
      await tx.assetCategory.upsert({ where: { code: category.code }, create: category, update: {} })
    }
  })
  console.log(`Asset categories ready: ${await prisma.assetCategory.count()} records. Existing categories preserved.`)
}
main().catch((error) => { console.error(error); process.exitCode = 1 }).finally(() => prisma.$disconnect())
