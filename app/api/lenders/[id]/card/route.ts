import { getCurrentUser } from '@/lib/auth/current-user'
import { prisma } from '@/lib/prisma'

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!await getCurrentUser()) return Response.json({ message: 'กรุณาเข้าสู่ระบบ' }, { status: 401 })
  const rawId = (await params).id
  const id = Number(rawId)
  if (!/^[0-9]+$/.test(rawId) || !Number.isSafeInteger(id) || id <= 0) return Response.json({ message: 'รหัสผู้ให้กู้ไม่ถูกต้อง' }, { status: 400 })
  const lender = await prisma.lender.findUnique({ where: { id }, select: { cardData: true } })
  if (!lender) return Response.json({ message: 'ไม่พบผู้ให้กู้' }, { status: 404 })
  let card = null
  try { card = lender.cardData ? JSON.parse(lender.cardData) : null } catch { /* Ignore malformed old data. */ }
  return Response.json({ card }, { headers: { 'Cache-Control': 'private, no-store' } })
}
