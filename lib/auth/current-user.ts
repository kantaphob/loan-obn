import 'server-only'
import { prisma } from '@/lib/prisma'

export async function getCurrentUser() {
  // This installation has a single operator, so use that account as the
  // application identity without requiring a login session.
  return prisma.user.findFirst({
    orderBy: [{ level: 'asc' }, { createdAt: 'asc' }],
    select: { id: true, acccode: true, role: true, level: true, status: true },
  })
}
