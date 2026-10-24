import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth/current-user'
import { prisma } from '@/lib/prisma'

export async function GET(_request: Request, { params }: { params: Promise<{ id: string; attachmentId: string }> }) {
  const user = await getCurrentUser()
  if (!user || user.status !== 'ACTIVE') return NextResponse.json({ error: 'ไม่มีสิทธิ์ดูเอกสาร' }, { status: 403 })
  const { id: rawId, attachmentId: rawAttachmentId } = await params
  const contractId = Number(rawId), attachmentId = Number(rawAttachmentId)
  if (!Number.isSafeInteger(contractId) || contractId <= 0 || !Number.isSafeInteger(attachmentId) || attachmentId <= 0) return NextResponse.json({ error: 'ไม่พบเอกสาร' }, { status: 404 })
  const attachment = await prisma.contractCollateralAttachment.findFirst({ where: { id: attachmentId, contractId }, select: { fileData: true, mimeType: true, originalName: true, sizeBytes: true } })
  if (!attachment) return NextResponse.json({ error: 'ไม่พบเอกสาร' }, { status: 404 })
  const safeName = attachment.originalName.replace(/[\r\n\\/";]/g, '_')
  return new Response(new Uint8Array(attachment.fileData), { headers: {
    'Content-Type': attachment.mimeType,
    'Content-Disposition': `attachment; filename="attachment"; filename*=UTF-8''${encodeURIComponent(safeName)}`,
    'Content-Length': String(attachment.sizeBytes),
    'Cache-Control': 'private, no-store',
    'X-Content-Type-Options': 'nosniff',
  } })
}
