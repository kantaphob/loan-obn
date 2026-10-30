import { connection } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/lib/auth/current-user'
import { claimCode, voucherCode } from '@/lib/reimbursements'
import { canceledReimbursementPdf } from '@/lib/reimbursement-pdf'
export async function GET(_request: Request, { params }: { params: Promise<{ kind: string; id: string }> }) {
  await connection()
  const user = await getCurrentUser()
  if (!user || user.status !== 'ACTIVE') return new Response('Unauthorized', { status: 401 })
  const { kind, id } = await params
  if (!/^\d+$/.test(id) || !Number.isSafeInteger(Number(id)) || Number(id) <= 0 || !['claims', 'vouchers', 'files'].includes(kind)) return new Response('Not found', { status: 404 })
  let bytes: Uint8Array, name: string, mime = 'application/pdf'
  if (kind === 'files') {
    const file = await prisma.reimbursementFile.findUnique({ where: { id: Number(id) } })
    if (!file) return new Response('Not found', { status: 404 })
    bytes = file.fileData; name = file.originalName; mime = file.mimeType
  } else if (kind === 'claims') {
    const c = await prisma.expenseClaim.findUnique({ where: { id: Number(id) } })
    if (!c) return new Response('Not found', { status: 404 })
    bytes = c.voidedAt ? await canceledReimbursementPdf(c.pdfData) : c.pdfData; name = claimCode(c.id, c.spentOn) + '.pdf'
  } else {
    const v = await prisma.reimbursementVoucher.findUnique({ where: { id: Number(id) } })
    if (!v) return new Response('Not found', { status: 404 })
    bytes = v.voidedAt ? await canceledReimbursementPdf(v.pdfData) : v.pdfData; name = voucherCode(v.id, v.paidOn) + '.pdf'
  }
  return new Response(new Uint8Array(bytes), { headers: { 'Content-Type': mime, 'Content-Disposition': `inline; filename*=UTF-8''${encodeURIComponent(name)}`, 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff', 'Content-Security-Policy': "default-src 'none'; sandbox" } })
}
