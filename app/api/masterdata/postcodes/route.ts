import { prisma } from '@/lib/prisma'

const PAGE_SIZE = 20

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const query = searchParams.get('q')?.trim().slice(0, 100) ?? ''
  const requestedPage = Number(searchParams.get('page') ?? '1')
  const page = Number.isInteger(requestedPage) && requestedPage > 0 ? requestedPage : 1

  const where = query
    ? {
        OR: [
          { code: { contains: query } },
          { subdistricts: { some: { nameTh: { contains: query } } } },
          { subdistricts: { some: { nameEn: { contains: query } } } },
          { subdistricts: { some: { district: { nameTh: { contains: query } } } } },
          { subdistricts: { some: { district: { nameEn: { contains: query } } } } },
          { subdistricts: { some: { district: { province: { nameTh: { contains: query } } } } } },
          { subdistricts: { some: { district: { province: { nameEn: { contains: query } } } } } },
        ],
      }
    : {}

  try {
    const [total, postcodes] = await Promise.all([
      prisma.postcode.count({ where }),
      prisma.postcode.findMany({
        where,
        orderBy: { code: 'asc' },
        skip: (page - 1) * PAGE_SIZE,
        take: PAGE_SIZE,
        select: {
          code: true,
          subdistricts: {
            orderBy: { id: 'asc' },
            select: {
              nameTh: true,
              nameEn: true,
              district: {
                select: {
                  nameTh: true,
                  nameEn: true,
                  province: { select: { nameTh: true, nameEn: true } },
                },
              },
            },
          },
        },
      }),
    ])

    return Response.json({ postcodes, total, page, pageSize: PAGE_SIZE })
  } catch (error) {
    console.error('Masterdata postcodes API error:', error)
    return Response.json({ message: 'โหลดข้อมูลรหัสไปรษณีย์ไม่สำเร็จ' }, { status: 500 })
  }
}
