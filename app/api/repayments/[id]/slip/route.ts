import { getCurrentUser } from '@/lib/auth/current-user'
import { prisma } from '@/lib/prisma'

import { slipFileName } from '@/lib/slip-name'
import { connection } from 'next/server'

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  await connection()
  const user = await getCurrentUser()
  if (!user || user.status !== 'ACTIVE') return Response.json({ error: 'ไม่มีสิทธิ์ดูสลิป' }, { status: 403 })
  const id = Number((await params).id)
  if (!Number.isSafeInteger(id) || id <= 0) return new Response(null, { status: 404 })
  const slip = await prisma.ledgerSlip.findUnique({ where: { entryId: id }, include: { entry: { include: { contract: { select: { legacySourceCode: true } } } } } })
  if (!slip) return new Response(null, { status: 404 })
  const filename = slipFileName({ ...slip.entry, legacySourceCode: slip.entry.contract?.legacySourceCode }, slip.mimeType)
  return new Response(new Uint8Array(slip.fileData), { headers: {
    'Content-Type': slip.mimeType,
    'Content-Disposition': `inline; filename="slip"; filename*=UTF-8''${encodeURIComponent(filename)}`,
    'Cache-Control': 'private, no-store',
    'X-Content-Type-Options': 'nosniff',
    'Content-Security-Policy': "default-src 'none'; sandbox",
  } })
}
