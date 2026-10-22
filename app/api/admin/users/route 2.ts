import { UserRole, UserStatus } from '@/generated/prisma/enums'
import { prisma } from '@/lib/prisma'

const roles = new Set<string>(Object.values(UserRole))
const statuses = new Set<string>(Object.values(UserStatus))

type UserInput = {
  id?: unknown
  name?: unknown
  email?: unknown
  role?: unknown
  team?: unknown
  status?: unknown
}

function validateUser(input: UserInput) {
  const name = typeof input.name === 'string' ? input.name.trim() : ''
  const email = typeof input.email === 'string' ? input.email.trim().toLowerCase() : ''
  const team = typeof input.team === 'string' ? input.team.trim() : ''
  const role = typeof input.role === 'string' ? input.role : ''
  const status = typeof input.status === 'string' ? input.status : ''

  if (name.length < 2 || name.length > 120) return { error: 'กรุณาระบุชื่อผู้ใช้ 2–120 ตัวอักษร' } as const
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { error: 'กรุณาระบุอีเมลที่ถูกต้อง' } as const
  if (team.length < 1 || team.length > 100) return { error: 'กรุณาระบุทีม 1–100 ตัวอักษร' } as const
  if (!roles.has(role)) return { error: 'กรุณาเลือกบทบาทที่ถูกต้อง' } as const
  if (!statuses.has(status)) return { error: 'กรุณาเลือกสถานะที่ถูกต้อง' } as const

  return { data: { name, email, team, role: role as keyof typeof UserRole, status: status as keyof typeof UserStatus } } as const
}

function errorResponse(error: unknown) {
  const code = typeof error === 'object' && error !== null && 'code' in error ? String(error.code) : ''
  if (code === 'P2002') return Response.json({ message: 'อีเมลนี้มีบัญชีผู้ใช้อยู่แล้ว' }, { status: 409 })
  if (code === 'P2025') return Response.json({ message: 'ไม่พบบัญชีผู้ใช้ที่ต้องการ' }, { status: 404 })
  console.error('Admin users API error:', error)
  return Response.json({ message: 'เกิดข้อผิดพลาดในการจัดการข้อมูลผู้ใช้' }, { status: 500 })
}

async function readBody(request: Request): Promise<UserInput | null> {
  try {
    const value: unknown = await request.json()
    return typeof value === 'object' && value !== null ? value as UserInput : null
  } catch {
    return null
  }
}

export async function GET() {
  try {
    const users = await prisma.user.findMany({ orderBy: [{ createdAt: 'desc' }, { name: 'asc' }] })
    return Response.json({ users })
  } catch (error) {
    return errorResponse(error)
  }
}

export async function POST(request: Request) {
  const body = await readBody(request)
  if (!body) return Response.json({ message: 'ข้อมูลคำขอไม่ถูกต้อง' }, { status: 400 })
  const validated = validateUser(body)
  if ('error' in validated) return Response.json({ message: validated.error }, { status: 400 })

  try {
    const user = await prisma.user.create({ data: validated.data })
    return Response.json({ user }, { status: 201 })
  } catch (error) {
    return errorResponse(error)
  }
}

export async function PUT(request: Request) {
  const body = await readBody(request)
  if (!body || typeof body.id !== 'string' || !body.id.trim()) return Response.json({ message: 'ไม่พบรหัสผู้ใช้' }, { status: 400 })
  const validated = validateUser(body)
  if ('error' in validated) return Response.json({ message: validated.error }, { status: 400 })

  try {
    const user = await prisma.user.update({ where: { id: body.id }, data: validated.data })
    return Response.json({ user })
  } catch (error) {
    return errorResponse(error)
  }
}

export async function DELETE(request: Request) {
  const body = await readBody(request)
  if (!body || typeof body.id !== 'string' || !body.id.trim()) return Response.json({ message: 'ไม่พบรหัสผู้ใช้' }, { status: 400 })

  try {
    await prisma.user.delete({ where: { id: body.id } })
    return Response.json({ success: true })
  } catch (error) {
    return errorResponse(error)
  }
}
