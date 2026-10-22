import { randomBytes, scrypt as scryptCallback } from 'node:crypto'
import { promisify } from 'node:util'
import { UserRole, UserStatus } from '@/generated/prisma/enums'
import { getCurrentUser } from '@/lib/auth/current-user'
import { prisma } from '@/lib/prisma'

const scrypt = promisify(scryptCallback)
const roles = new Set<string>(Object.values(UserRole))
const statuses = new Set<string>(Object.values(UserStatus))

type UserInput = {
  id?: unknown
  acccode?: unknown
  password?: unknown
  firstName?: unknown
  lastName?: unknown
  email?: unknown
  phone?: unknown
  role?: unknown
  level?: unknown
  status?: unknown
}

function validateUser(input: UserInput, requirePassword: boolean) {
  const acccode = typeof input.acccode === 'string' ? input.acccode.trim().toLowerCase() : ''
  const password = typeof input.password === 'string' ? input.password : ''
  const firstName = typeof input.firstName === 'string' ? input.firstName.trim() : ''
  const lastName = typeof input.lastName === 'string' ? input.lastName.trim() : ''
  const email = typeof input.email === 'string' ? input.email.trim().toLowerCase() : ''
  const phone = typeof input.phone === 'string' ? input.phone.trim() : ''
  const role = typeof input.role === 'string' ? input.role : ''
  const level = input.level
  const status = typeof input.status === 'string' ? input.status : ''

  if (!/^[a-z0-9._-]{3,40}$/.test(acccode)) return { error: 'รหัสผู้ใช้ต้องมี 3–40 ตัว และใช้ได้เฉพาะ a-z, 0-9, จุด, ขีดกลาง หรือขีดล่าง' } as const
  if (requirePassword && password.length < 8) return { error: 'รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร' } as const
  if (!requirePassword && password && password.length < 8) return { error: 'รหัสผ่านใหม่ต้องมีอย่างน้อย 8 ตัวอักษร' } as const
  if (firstName.length < 1 || firstName.length > 80) return { error: 'กรุณาระบุชื่อ 1–80 ตัวอักษร' } as const
  if (lastName.length < 1 || lastName.length > 80) return { error: 'กรุณาระบุนามสกุล 1–80 ตัวอักษร' } as const
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { error: 'กรุณาระบุอีเมลที่ถูกต้อง' } as const
  if (phone.length > 40) return { error: 'เบอร์โทรศัพท์ต้องไม่เกิน 40 ตัวอักษร' } as const
  if (!roles.has(role)) return { error: 'กรุณาเลือกบทบาทที่ถูกต้อง' } as const
  if (!Number.isInteger(level) || Number(level) < 0 || Number(level) > 9) return { error: 'ระดับสิทธิ์ต้องเป็นเลขจำนวนเต็มตั้งแต่ 0 ถึง 9' } as const
  if (!statuses.has(status)) return { error: 'กรุณาเลือกสถานะที่ถูกต้อง' } as const

  return { data: { acccode, password, firstName, lastName, email, phone: phone || null, role: role as keyof typeof UserRole, level: Number(level), status: status as keyof typeof UserStatus } } as const
}

async function hashPassword(password: string) {
  const salt = randomBytes(16).toString('hex')
  const derivedKey = await scrypt(password, salt, 64) as Buffer
  return `scrypt$${salt}$${derivedKey.toString('hex')}`
}

const userSelection = {
  id: true,
  acccode: true,
  role: true,
  level: true,
  status: true,
  createdAt: true,
  updatedAt: true,
  userprofile: { select: { firstName: true, lastName: true, email: true, phone: true } },
} as const

function errorResponse(error: unknown) {
  const code = typeof error === 'object' && error !== null && 'code' in error ? String(error.code) : ''
  if (code === 'P2002') return Response.json({ message: 'รหัสผู้ใช้หรืออีเมลนี้มีบัญชีอยู่แล้ว' }, { status: 409 })
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

async function authorizeAdmin() {
  const user = await getCurrentUser()
  if (!user) return Response.json({ message: 'กรุณาเข้าสู่ระบบก่อน' }, { status: 401 })
  if (user.role !== 'SUPER_ADMIN' && user.role !== 'ADMIN') return Response.json({ message: 'ไม่มีสิทธิ์จัดการบัญชีผู้ใช้' }, { status: 403 })
  return null
}

export async function GET() {
  const denied = await authorizeAdmin()
  if (denied) return denied
  try {
    const users = await prisma.user.findMany({ select: userSelection, orderBy: [{ level: 'asc' }, { createdAt: 'desc' }] })
    return Response.json({ users })
  } catch (error) {
    return errorResponse(error)
  }
}

export async function POST(request: Request) {
  const denied = await authorizeAdmin()
  if (denied) return denied
  const body = await readBody(request)
  if (!body) return Response.json({ message: 'ข้อมูลคำขอไม่ถูกต้อง' }, { status: 400 })
  const validated = validateUser(body, true)
  if ('error' in validated) return Response.json({ message: validated.error }, { status: 400 })

  try {
    const { password, ...data } = validated.data
    const user = await prisma.user.create({
      data: {
        ...data,
        password: await hashPassword(password),
        userprofile: { create: { firstName: data.firstName, lastName: data.lastName, email: data.email, phone: data.phone } },
      },
      select: userSelection,
    })
    return Response.json({ user }, { status: 201 })
  } catch (error) {
    return errorResponse(error)
  }
}

export async function PUT(request: Request) {
  const denied = await authorizeAdmin()
  if (denied) return denied
  const body = await readBody(request)
  if (!body || typeof body.id !== 'string' || !body.id.trim()) return Response.json({ message: 'ไม่พบรหัสผู้ใช้' }, { status: 400 })
  const validated = validateUser(body, false)
  if ('error' in validated) return Response.json({ message: validated.error }, { status: 400 })

  try {
    const { password, ...data } = validated.data
    const user = await prisma.user.update({
      where: { id: body.id },
      data: {
        acccode: data.acccode,
        role: data.role,
        level: data.level,
        status: data.status,
        ...(password ? { password: await hashPassword(password) } : {}),
        userprofile: { upsert: { create: { firstName: data.firstName, lastName: data.lastName, email: data.email, phone: data.phone }, update: { firstName: data.firstName, lastName: data.lastName, email: data.email, phone: data.phone } } },
      },
      select: userSelection,
    })
    return Response.json({ user })
  } catch (error) {
    return errorResponse(error)
  }
}

export async function DELETE(request: Request) {
  const denied = await authorizeAdmin()
  if (denied) return denied
  const body = await readBody(request)
  if (!body || typeof body.id !== 'string' || !body.id.trim()) return Response.json({ message: 'ไม่พบรหัสผู้ใช้' }, { status: 400 })

  try {
    await prisma.user.delete({ where: { id: body.id } })
    return Response.json({ success: true })
  } catch (error) {
    return errorResponse(error)
  }
}
