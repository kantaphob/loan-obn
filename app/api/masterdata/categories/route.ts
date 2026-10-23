import { getCurrentUser } from '@/lib/auth/current-user'
import { prisma } from '@/lib/prisma'

async function authorize(request: Request) {
  const origin = request.headers.get('origin')
  const host = request.headers.get('host') ?? new URL(request.url).host
  if (origin) {
    try {
      if (new URL(origin).host !== host) return Response.json({ message: 'คำขอไม่ถูกต้อง' }, { status: 403 })
    } catch {
      return Response.json({ message: 'คำขอไม่ถูกต้อง' }, { status: 403 })
    }
  }
  const user = await getCurrentUser()
  if (!user) return Response.json({ message: 'กรุณาเข้าสู่ระบบ' }, { status: 401 })
  if (!['ADMIN', 'SUPER_ADMIN'].includes(user.role)) return Response.json({ message: 'ไม่มีสิทธิ์จัดการหมวดหมู่' }, { status: 403 })
  return null
}

async function mutate(request: Request, method: 'POST' | 'PUT' | 'DELETE') {
  const denied = await authorize(request)
  if (denied) return denied
  let body: Record<string, unknown>
  try {
    const value: unknown = await request.json()
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error()
    body = value as Record<string, unknown>
  } catch {
    return Response.json({ message: 'ข้อมูลคำขอไม่ถูกต้อง' }, { status: 400 })
  }
  const code = typeof body.code === 'string' ? body.code.trim().toUpperCase() : ''
  if (!/^[A-Z0-9_]{2,60}$/.test(code)) return Response.json({ message: 'รหัสต้องมี 2–60 ตัว ใช้ A–Z, 0–9 และ _' }, { status: 400 })
  try {
    if (method === 'DELETE') {
      await prisma.financialCategory.update({ where: { code, isActive: true }, data: { isActive: false } })
      return Response.json({ success: true })
    }
    const nameTh = typeof body.nameTh === 'string' ? body.nameTh.trim() : ''
    const nameEn = typeof body.nameEn === 'string' ? body.nameEn.trim() : ''
    const group = typeof body.group === 'string' ? body.group : ''
    const direction = typeof body.direction === 'string' ? body.direction : ''
    const sortOrder = body.sortOrder
    if (!nameTh || nameTh.length > 120 || nameEn.length > 120) return Response.json({ message: 'กรุณาระบุชื่อไทย และชื่อแต่ละภาษาต้องไม่เกิน 120 ตัวอักษร' }, { status: 400 })
    if (!['CAPITAL', 'LOAN', 'INCOME', 'EXPENSE'].includes(group) || !['IN', 'OUT'].includes(direction)) return Response.json({ message: 'กรุณาเลือกกลุ่มและทิศทางเงินที่ถูกต้อง' }, { status: 400 })
    if (typeof sortOrder !== 'number' || !Number.isInteger(sortOrder) || sortOrder < 0 || sortOrder > 99999) return Response.json({ message: 'ลำดับต้องเป็นจำนวนเต็ม 0–99999' }, { status: 400 })
    const data = { nameTh, nameEn: nameEn || null, group, direction, sortOrder }
    const category = method === 'POST'
      ? await prisma.financialCategory.create({ data: { code, ...data } })
      : await prisma.financialCategory.update({ where: { code, isActive: true }, data })
    return Response.json({ category }, { status: method === 'POST' ? 201 : 200 })
  } catch (error) {
    const code = error && typeof error === 'object' && 'code' in error ? error.code : ''
    if (code === 'P2002') return Response.json({ message: 'รหัสหมวดหมู่นี้ถูกใช้แล้ว กรุณาใช้รหัสอื่น' }, { status: 409 })
    if (code === 'P2025') return Response.json({ message: 'ไม่พบหมวดหมู่นี้ กรุณาโหลดหน้าใหม่' }, { status: 404 })
    console.error('Category mutation failed', error)
    return Response.json({ message: 'บันทึกข้อมูลไม่สำเร็จ กรุณาลองอีกครั้ง' }, { status: 500 })
  }
}
export async function POST(request: Request) { return mutate(request, 'POST') }
export async function PUT(request: Request) { return mutate(request, 'PUT') }
export async function DELETE(request: Request) { return mutate(request, 'DELETE') }
