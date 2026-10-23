import { mkdir } from 'node:fs/promises'
import path from 'node:path'
import Database from 'better-sqlite3'
import { PrismaClient } from '../generated/prisma/client'
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3'
import { getDatabaseUrl } from '../lib/database-config'
import { storeBorrowerImage, removeBorrowerImage } from '../lib/borrower-files'

const url = getDatabaseUrl()
const prisma = new PrismaClient({ adapter: new PrismaBetterSqlite3({ url }) })
async function main() {
  await mkdir(path.join(process.cwd(), 'private/borrower'), { recursive: true, mode: 0o700 })
  await mkdir(path.join(process.cwd(), 'private/backups'), { recursive: true, mode: 0o700 })
  const database = new Database(url.slice(5), { readonly: true, fileMustExist: true })
  try { await database.backup(path.join(process.cwd(), 'private/backups', `before-borrower-images-${Date.now()}.db`)) } finally { database.close() }
  let migrated = 0, images = 0
  for (const row of await prisma.borrower.findMany({ select: { id: true, lineQrImage: true, cardData: true, updatedAt: true } })) {
    const files: string[] = []
    const data: { lineQrImage?: string; cardData?: string; updatedAt: Date } = { updatedAt: row.updatedAt }
    try {
      if (row.lineQrImage.startsWith('data:image/')) { data.lineQrImage = await storeBorrowerImage(row.lineQrImage); files.push(data.lineQrImage) }
      if (row.cardData) {
        const card = JSON.parse(row.cardData)
        if (typeof card.photo === 'string' && card.photo.startsWith('data:image/')) {
          card.photo = await storeBorrowerImage(card.photo); files.push(card.photo); data.cardData = JSON.stringify(card)
        }
      }
      if (!files.length) continue
      const result = await prisma.borrower.updateMany({ where: { id: row.id, lineQrImage: row.lineQrImage, cardData: row.cardData, updatedAt: row.updatedAt }, data })
      if (result.count) { migrated++; images += files.length } else await Promise.all(files.map(removeBorrowerImage))
    } catch (error) { await Promise.allSettled(files.map(removeBorrowerImage)); throw error }
  }
  console.log({ migratedBorrowers: migrated, migratedImages: images, directory: 'private/borrower', databaseUnchanged: true })
}
main().finally(() => prisma.$disconnect())
