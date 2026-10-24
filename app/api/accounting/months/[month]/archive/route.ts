import { connection } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/lib/auth/current-user'
import { monthRange } from '@/lib/accounting-period'
import { closingZip } from '@/lib/closing-zip'
export async function GET(_request: Request, { params }: { params: Promise<{ month: string }> }) {
  await connection()
  const user = await getCurrentUser()
  if (!user || user.status !== 'ACTIVE') return Response.json({ error: 'ไม่มีสิทธิ์ดูเอกสาร' }, { status: 403 })
  const { month } = await params
  try { monthRange(month) } catch { return new Response(null, { status: 400 }) }
  const locked = await prisma.accountingMonthLock.findUnique({ where: { month } })
  if (!locked) return Response.json({ error: 'ต้องปิดยอดเดือนก่อนดาวน์โหลดชุดเอกสารที่ตรึงแล้ว' }, { status: 409 })
  const documents = await prisma.accountingDocument.findMany({ where: { month }, orderBy: { id: 'asc' } })
  const zip = closingZip([{ name: `${month}-สรุปปิดยอด.json`, data: Buffer.from(JSON.stringify({ month, note: locked.note, closedAt: locked.createdAt, snapshot: JSON.parse(locked.snapshotJson), documents: JSON.parse(locked.documentsJson) }, null, 2)) }, ...documents.map(doc => ({ name: `${doc.id}-${doc.originalName}`, data: doc.fileData }))])
  return new Response(new Uint8Array(zip), { headers: { 'Content-Type': 'application/zip', 'Content-Disposition': `attachment; filename="closing-${month}.zip"`, 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff' } })
}
