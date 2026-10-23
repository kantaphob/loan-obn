import { getCurrentUser } from '@/lib/auth/current-user'
import { prisma } from '@/lib/prisma'
import { readBorrowerImage } from '@/lib/borrower-files'

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!await getCurrentUser()) return new Response(null, { status: 401 })
  const rawId = (await params).id
  const id = Number(rawId)
  if (!/^\d+$/.test(rawId) || !Number.isSafeInteger(id) || id <= 0) return new Response(null, { status: 400 })
  const borrower = await prisma.borrower.findUnique({ where: { id }, select: { cardData: true } })
  let photo: string
  try { photo = JSON.parse(borrower?.cardData || 'null')?.photo } catch { return new Response(null, { status: 404 }) }
  if (!photo) return new Response(null, { status: 404 })
  try {
    const image = await readBorrowerImage(photo)
    return new Response(new Uint8Array(image), { headers: { 'Content-Type': photo.startsWith('data:image/jpeg') ? 'image/jpeg' : 'image/png', 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff' } })
  } catch { return new Response(null, { status: 404 }) }
}
