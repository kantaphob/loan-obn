import { createHash, randomUUID } from 'node:crypto'
import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/lib/auth/current-user'
import { monthRange } from '@/lib/accounting-period'
import { assertAccountingDateOpen } from '@/lib/monthly-accounting'
import { readRepaymentSlip } from '@/lib/repayment-slip'
export async function POST(request: Request) {
  const user = await getCurrentUser()
  if (!user || user.status !== 'ACTIVE' || !['ADMIN', 'SUPER_ADMIN'].includes(user.role)) return Response.json({ error: 'ไม่มีสิทธิ์แนบเอกสารปิดดุล' }, { status: 403 })
  try {
    if (Number(request.headers.get('content-length')) > 6 * 1024 * 1024) return Response.json({ error: 'ไฟล์ต้องไม่เกิน 5 MB' }, { status: 413 })
    const form = await request.formData()
    const month = String(form.get('month') ?? ''), category = String(form.get('category') ?? '')
    const { startOn } = monthRange(month)
    if (!['STATEMENT', 'INVOICE', 'RECEIPT', 'SIGNED_CONTRACT', 'ASSET', 'INVENTORY', 'OTHER'].includes(category)) throw new Error('กรุณาเลือกประเภทเอกสาร')
    const upload = form.get('file')
    if (!(upload instanceof File)) throw new Error('กรุณาเลือกไฟล์ PDF, JPG หรือ PNG')
    const file = await readRepaymentSlip(upload)
    if (!file) throw new Error('ไม่พบไฟล์')
    const sha256 = createHash('sha256').update(file.fileData).digest('hex')
    const requestKey = String(form.get('requestKey') ?? randomUUID())
    if (!/^[a-f0-9-]{36}$/i.test(requestKey)) throw new Error('รหัสคำขอไม่ถูกต้อง')
    const saved = await prisma.$transaction(async tx => {
      const previous = await tx.accountingDocument.findUnique({ where: { requestKey } })
      if (previous) {
        if (previous.month !== month || previous.category !== category || previous.sha256 !== sha256 || previous.createdBy !== user.id) throw new Error('คำขอนี้ถูกใช้กับไฟล์อื่นแล้ว')
        return { id: previous.id }
      }
      await assertAccountingDateOpen(tx, startOn)
      const existing = await tx.accountingDocument.aggregate({ where: { month }, _sum: { sizeBytes: true }, _count: true })
      if (existing._count >= 100 || (existing._sum.sizeBytes ?? 0) + file.sizeBytes > 50 * 1024 * 1024) throw new Error('ไฟล์แนบเพิ่มต่อเดือนไม่เกิน 100 ไฟล์ หรือรวม 50 MB')
      return tx.accountingDocument.create({ data: { ...file, originalName: file.originalName.replace(/[\x00-\x1f/\\]/g, '_'), requestKey, month, sourceKey: `upload:${requestKey}`, category, sha256, createdBy: user.id }, select: { id: true } })
    })
    return Response.json(saved, { status: 201, headers: { 'Cache-Control': 'no-store' } })
  } catch (error) { return Response.json({ error: error instanceof Error && /^[ก-๙]/.test(error.message) ? error.message : 'บันทึกไฟล์ไม่สำเร็จ กรุณาลองอีกครั้ง' }, { status: 400 }) }
}
