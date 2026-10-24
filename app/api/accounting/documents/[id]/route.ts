import { connection } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/lib/auth/current-user'
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  await connection()
  const user = await getCurrentUser()
  if (!user || user.status !== 'ACTIVE') return Response.json({ error: 'ไม่มีสิทธิ์ดูเอกสาร' }, { status: 403 })
  const id = Number((await params).id)
  if (!Number.isSafeInteger(id) || id <= 0) return new Response(null, { status: 404 })
  const document = await prisma.accountingDocument.findUnique({ where: { id } })
  if (!document) return new Response(null, { status: 404 })
  return new Response(new Uint8Array(document.fileData), { headers: { 'Content-Type': document.mimeType, 'Content-Disposition': `inline; filename="document"; filename*=UTF-8''${encodeURIComponent(document.originalName)}`, 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff', 'Content-Security-Policy': "default-src 'none'; sandbox" } })
}
