import { scrypt as scryptCallback, timingSafeEqual } from 'node:crypto'
import { promisify } from 'node:util'
import { cookies } from 'next/headers'
import { prisma } from '@/lib/prisma'
import { createSessionToken, SESSION_COOKIE } from '@/lib/auth/session'

const scrypt = promisify(scryptCallback)
const SHORT_SESSION_SECONDS = 60 * 60 * 8
const REMEMBERED_SESSION_SECONDS = 60 * 60 * 24 * 30

async function verifyPassword(password: string, encoded: string) {
  const [algorithm, salt, expectedHex] = encoded.split('$')
  if (algorithm !== 'scrypt' || !salt || !expectedHex || !/^[a-f0-9]{128}$/i.test(expectedHex)) {
    await scrypt(password, 'invalid-legacy-password', 64)
    return false
  }

  const expected = Buffer.from(expectedHex, 'hex')
  const actual = await scrypt(password, salt, expected.length) as Buffer
  return timingSafeEqual(actual, expected)
}

export async function POST(request: Request) {
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return Response.json({ message: 'กรุณากรอกรหัสผู้ใช้และรหัสผ่าน' }, { status: 400 })
  }

  if (typeof body !== 'object' || body === null) return Response.json({ message: 'กรุณากรอกรหัสผู้ใช้และรหัสผ่าน' }, { status: 400 })
  const { acccode, password, rememberMe } = body as { acccode?: unknown; password?: unknown; rememberMe?: unknown }
  if (typeof acccode !== 'string' || typeof password !== 'string' || !acccode.trim() || !password) {
    return Response.json({ message: 'กรุณากรอกรหัสผู้ใช้และรหัสผ่าน' }, { status: 400 })
  }

  try {
    const loginId = acccode.trim().toLowerCase()
    const user = await prisma.user.findFirst({
      where: {
        OR: [
          { acccode: loginId },
          { userprofile: { is: { email: loginId } } },
        ],
      },
      select: { id: true, password: true, status: true },
    })
    const passwordMatches = await verifyPassword(password, user?.password ?? '!invalid!')
    if (!user || user.status !== 'ACTIVE' || !passwordMatches) {
      return Response.json({ message: 'รหัสผู้ใช้หรือรหัสผ่านไม่ถูกต้อง หรือบัญชีถูกปิดใช้งาน' }, { status: 401 })
    }

    const maxAge = rememberMe === true ? REMEMBERED_SESSION_SECONDS : SHORT_SESSION_SECONDS
    const expiresAt = Date.now() + maxAge * 1000
    const cookieStore = await cookies()
    cookieStore.set(SESSION_COOKIE, createSessionToken(user.id, expiresAt), {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge,
    })

    return Response.json({ success: true })
  } catch (error) {
    console.error('Login API error:', error)
    return Response.json({ message: 'เกิดข้อผิดพลาดในการเข้าสู่ระบบ' }, { status: 500 })
  }
}
