import { getCurrentUser } from '@/lib/auth/current-user'
import { prisma } from '@/lib/prisma'

export async function GET(request: Request) {
  if (!await getCurrentUser()) return Response.json({ message: 'กรุณาเข้าสู่ระบบ' }, { status: 401 })
  const params = new URL(request.url).searchParams
  const districtId = Number(params.get('districtId')), provinceId = Number(params.get('provinceId'))
  if (params.has('districtId')) {
    if (!Number.isSafeInteger(districtId) || districtId <= 0) return Response.json({ message: 'อำเภอไม่ถูกต้อง' }, { status: 400 })
    return Response.json({ options: await prisma.subdistrict.findMany({ where: { districtId }, select: { id: true, nameTh: true }, orderBy: { nameTh: 'asc' } }) })
  }
  if (!Number.isSafeInteger(provinceId) || provinceId <= 0) return Response.json({ message: 'จังหวัดไม่ถูกต้อง' }, { status: 400 })
  return Response.json({ options: await prisma.district.findMany({ where: { provinceId }, select: { id: true, nameTh: true }, orderBy: { nameTh: 'asc' } }) })
}
