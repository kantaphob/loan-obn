import 'dotenv/config'
import { readFile } from 'node:fs/promises'
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3'
import { PrismaClient } from '../generated/prisma/client'

type ThailandLocations = {
  provinces: { id: number; nameTh: string; nameEn: string }[]
  districts: { id: number; provinceId: number; nameTh: string; nameEn: string }[]
  subdistricts: {
    id: number
    districtId: number
    nameTh: string
    nameEn: string | null
    latitude: number | null
    longitude: number | null
    postcodeCode: string | null
  }[]
  postcodes: string[]
}

const adapter = new PrismaBetterSqlite3({
  url: process.env.DATABASE_URL ?? 'file:./ProgressSQL.db',
})
const prisma = new PrismaClient({ adapter })

async function main() {
  const locations = JSON.parse(
    await readFile(new URL('./data/thailand-locations.json', import.meta.url), 'utf8'),
  ) as ThailandLocations

  const [provinceCount, districtCount, subdistrictCount, postcodeCount] = await Promise.all([
    prisma.province.count(),
    prisma.district.count(),
    prisma.subdistrict.count(),
    prisma.postcode.count(),
  ])

  if (provinceCount + districtCount + subdistrictCount + postcodeCount > 0) {
    throw new Error('Location masterdata already contains rows; seed was stopped to protect existing data.')
  }

  await prisma.$transaction(async (transaction) => {
    await transaction.postcode.createMany({ data: locations.postcodes.map((code) => ({ code })) })
    await transaction.province.createMany({ data: locations.provinces })
    await transaction.district.createMany({ data: locations.districts })
    await transaction.subdistrict.createMany({ data: locations.subdistricts })
  })

  console.log(
    `Imported ${locations.provinces.length} provinces, ${locations.districts.length} districts, ${locations.subdistricts.length} subdistricts, and ${locations.postcodes.length} postcodes.`,
  )
}

main()
  .catch((error: unknown) => {
    console.error(error)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
