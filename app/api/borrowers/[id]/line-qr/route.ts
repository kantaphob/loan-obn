import { readBorrowerImage } from '@/lib/borrower-files'
import { getCurrentUser } from '@/lib/auth/current-user'
import { prisma } from '@/lib/prisma'

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser()
  if (!user) return new Response(null, { status: 401 })
  const { id } = await context.params
  if (!/^\d+$/.test(id) || !Number.isSafeInteger(Number(id)) || Number(id) <= 0) return new Response(null, { status: 400 })
  const borrower = await prisma.borrower.findUnique({ where: { id: Number(id) }, select: { lineQrImage: true } })
  if (!borrower?.lineQrImage) return new Response(null, { status: 404 })
  let image: Buffer
  try { image = await readBorrowerImage(borrower.lineQrImage) } catch { return new Response(null, { status: 404 }) }
  return new Response(new Uint8Array(image), { headers: {
    'Content-Type': 'image/png', 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff',
  } })
}
