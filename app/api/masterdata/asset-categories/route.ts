import { randomUUID } from 'node:crypto'
import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/lib/auth/current-user'
import { AssetCategoryError, parseAssetCategory } from '@/lib/asset-category-validation'

async function mutate(request: Request, method: 'POST' | 'PUT' | 'DELETE') {
  const origin = request.headers.get('origin')
  try {
    if (origin && new URL(origin).host !== (request.headers.get('host') ?? new URL(request.url).host)) return Response.json({ message: 'คำขอไม่ถูกต้อง' }, { status: 403 })
  } catch { return Response.json({ message: 'คำขอไม่ถูกต้อง' }, { status: 403 }) }
  const user = await getCurrentUser()
  if (!user || user.status !== 'ACTIVE' || !['ADMIN', 'SUPER_ADMIN'].includes(user.role)) return Response.json({ message: 'ไม่มีสิทธิ์จัดการหมวดหมู่สินทรัพย์' }, { status: 403 })
  let body: Record<string, unknown>
  try {
    const value: unknown = await request.json()
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error()
    body = value as Record<string, unknown>
  } catch { return Response.json({ message: 'ข้อมูลคำขอไม่ถูกต้อง' }, { status: 400 }) }
  try {
    const code = method === 'POST' ? `ASSET_${randomUUID().replaceAll('-', '').toUpperCase()}` : typeof body.code === 'string' ? body.code.trim() : ''
    if (!/^[A-Z0-9_]{2,80}$/.test(code)) throw new AssetCategoryError('ไม่พบรหัสหมวดหมู่ที่ต้องการ')
    const data = method === 'DELETE' ? null : parseAssetCategory(body)
    const result = await prisma.$transaction(async (tx) => {
      if (method !== 'POST' && !await tx.assetCategory.findFirst({ where: { code, isActive: true }, select: { code: true } })) throw new AssetCategoryError('ไม่พบหมวดหมู่ กรุณาโหลดหน้าใหม่', 404)
      if (method === 'DELETE') {
        if (await tx.assetCategory.count({ where: { parentCode: code, isActive: true } })) throw new AssetCategoryError('ลบไม่ได้ เพราะยังมีหมวดย่อย กรุณาย้ายหรือลบหมวดย่อยก่อน', 409)
        await tx.assetCategory.update({ where: { code }, data: { isActive: false } })
        return { success: true }
      }
      if (!data) throw new AssetCategoryError('ข้อมูลหมวดหมู่ไม่ถูกต้อง')
      let ancestor = data.parentCode
      const visited = new Set([code])
      while (ancestor) {
        if (visited.has(ancestor)) throw new AssetCategoryError('เลือกหมวดแม่ไม่ได้ เพราะจะทำให้หมวดหมู่วนซ้ำ')
        visited.add(ancestor)
        const parent = await tx.assetCategory.findFirst({ where: { code: ancestor, isActive: true }, select: { parentCode: true } })
        if (!parent) throw new AssetCategoryError('ไม่พบหมวดแม่ที่ใช้งานอยู่')
        ancestor = parent.parentCode
      }
      const category = method === 'POST'
        ? await tx.assetCategory.create({ data: { code, ...data } })
        : await tx.assetCategory.update({ where: { code }, data })
      return { category }
    })
    revalidatePath('/dashboard/admin/masterdata')
    revalidatePath('/dashboard/admin/masterdata/asset-category')
    return Response.json(result, { status: method === 'POST' ? 201 : 200 })
  } catch (error) {
    if (error instanceof AssetCategoryError) return Response.json({ message: error.message }, { status: error.status })
    const code = error && typeof error === 'object' && 'code' in error ? error.code : ''
    if (code === 'P2025') return Response.json({ message: 'ไม่พบหมวดหมู่ กรุณาโหลดหน้าใหม่' }, { status: 404 })
    if (code === 'P2002') return Response.json({ message: 'รหัสหมวดหมู่ซ้ำ กรุณาลองอีกครั้ง' }, { status: 409 })
    console.error('Asset category update failed:', error)
    return Response.json({ message: 'บันทึกหมวดหมู่ไม่สำเร็จ กรุณาลองอีกครั้ง' }, { status: 500 })
  }
}
export async function POST(request: Request) { return mutate(request, 'POST') }
export async function PUT(request: Request) { return mutate(request, 'PUT') }
export async function DELETE(request: Request) { return mutate(request, 'DELETE') }
