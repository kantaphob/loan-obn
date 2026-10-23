import { getCurrentUser } from '@/lib/auth/current-user'
import { prisma } from '@/lib/prisma'

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!await getCurrentUser()) return Response.json({ message: 'ไม่พบผู้ใช้' }, { status: 401 })
  const id = Number((await params).id)
  if (!Number.isSafeInteger(id) || id <= 0) return Response.json({ message: 'รหัสผู้กู้ยืมไม่ถูกต้อง' }, { status: 400 })
  const borrower = await prisma.borrower.findUnique({ where: { id }, select: { cardData: true } })
  if (!borrower) return Response.json({ message: 'ไม่พบผู้กู้ยืม' }, { status: 404 })
  let card = null
  try { card = borrower.cardData ? JSON.parse(borrower.cardData) : null } catch { /* Ignore malformed legacy card data. */ }
  return Response.json({ card })
}
