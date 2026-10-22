import 'server-only'
import { cookies } from 'next/headers'
import { prisma } from '@/lib/prisma'
import { SESSION_COOKIE, verifySessionToken } from '@/lib/auth/session'

export async function getCurrentUser() {
  const token = (await cookies()).get(SESSION_COOKIE)?.value
  const session = verifySessionToken(token)
  if (!session) return null

  return prisma.user.findFirst({
    where: { id: session.userId, status: 'ACTIVE' },
    select: { id: true, acccode: true, role: true, level: true, status: true },
  })
}
