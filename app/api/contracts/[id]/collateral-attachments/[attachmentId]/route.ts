import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth/current-user'
import { contractCode } from '@/lib/contracts'
import { prisma } from '@/lib/prisma'
import { createWatermarkedIdCopy } from '@/lib/id-card-watermark'

export async function GET(request: Request, { params }: { params: Promise<{ id: string; attachmentId: string }> }) {
  const user = await getCurrentUser()
  if (!user || user.status !== 'ACTIVE') return NextResponse.json({ error: 'ไม่มีสิทธิ์ดูเอกสาร' }, { status: 403 })
  const { id: rawId, attachmentId: rawAttachmentId } = await params
  const contractId = Number(rawId), attachmentId = Number(rawAttachmentId)
  if (!Number.isSafeInteger(contractId) || contractId <= 0 || !Number.isSafeInteger(attachmentId) || attachmentId <= 0) return NextResponse.json({ error: 'ไม่พบเอกสาร' }, { status: 404 })
  const attachment = await prisma.contractCollateralAttachment.findFirst({ where: { id: attachmentId, contractId }, select: { contractId: true, category: true, fileData: true, mimeType: true, originalName: true, sizeBytes: true, contract: { select: { createdAt: true } } } })
  if (!attachment) return NextResponse.json({ error: 'ไม่พบเอกสาร' }, { status: 404 })
  const watermark = new URL(request.url).searchParams.get('watermark') === '1'
  if (watermark && attachment.category !== 'สำเนาบัตรประชาชน') return NextResponse.json({ error: 'ลายน้ำใช้ได้เฉพาะเอกสารประเภทสำเนาบัตรประชาชน' }, { status: 400 })
  const safeName = attachment.originalName.replace(/[\r\n\\/";]/g, '_')
  const originalName = watermark ? `${safeName.replace(/\.[^.]+$/, '')}-watermarked.pdf` : safeName
  const bytes = watermark ? await createWatermarkedIdCopy(attachment.fileData, attachment.mimeType, contractCode(attachment.contractId), attachment.contract.createdAt) : new Uint8Array(attachment.fileData)
  const mimeType = watermark ? 'application/pdf' : attachment.mimeType
  return new Response(Buffer.from(bytes), { headers: {
    'Content-Type': mimeType,
    'Content-Disposition': `attachment; filename="attachment"; filename*=UTF-8''${encodeURIComponent(originalName)}`,
    'Content-Length': String(bytes.length),
    'Cache-Control': 'private, no-store',
    'X-Content-Type-Options': 'nosniff',
  } })
}
