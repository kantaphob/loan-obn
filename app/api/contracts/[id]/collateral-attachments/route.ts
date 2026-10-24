import { createHash } from 'node:crypto'
import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth/current-user'
import { prisma } from '@/lib/prisma'

const MAX_FILE_BYTES = 15 * 1024 * 1024
const MAX_TOTAL_BYTES = 50 * 1024 * 1024
const MAX_ATTACHMENTS = 30
const categories = new Set([
  'สำเนาบัตรประชาชน', 'เอกสารสิทธิทรัพย์', 'หลักฐานกรรมสิทธิ์', 'หนังสือยินยอม',
  'ภาพถ่ายทรัพย์', 'หลักฐานรับมอบทรัพย์จำนำ', 'สัญญาจำนองที่จดทะเบียนแล้ว', 'อื่น ๆ',
])

function getContractId(raw: string) {
  const id = Number(raw)
  return Number.isSafeInteger(id) && id > 0 ? id : null
}

function inspectFile(bytes: Buffer) {
  if (bytes.subarray(0, 5).toString() === '%PDF-') return { mimeType: 'application/pdf', extension: 'pdf' }
  if (bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) return { mimeType: 'image/png', extension: 'png' }
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return { mimeType: 'image/jpeg', extension: 'jpg' }
  return null
}

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser()
  if (!user || user.status !== 'ACTIVE') return NextResponse.json({ error: 'ไม่มีสิทธิ์ดูเอกสาร' }, { status: 403 })
  const { id: rawId } = await params
  const contractId = getContractId(rawId)
  if (!contractId) return NextResponse.json({ error: 'ไม่พบสัญญา' }, { status: 404 })
  const contract = await prisma.loanContract.findUnique({ where: { id: contractId }, select: { documentChoice: true, documentPackage: true } })
  if (!contract || contract.documentChoice !== 'CREATE' || contract.documentPackage !== 'LOAN_GUARANTEE_COLLATERAL') return NextResponse.json({ error: 'ไม่พบเอกสารหลักประกัน' }, { status: 404 })
  const attachments = await prisma.contractCollateralAttachment.findMany({ where: { contractId }, orderBy: { createdAt: 'asc' }, select: { id: true, category: true, originalName: true, mimeType: true, sizeBytes: true, sha256: true, originalStatus: true, originalLocation: true, createdAt: true } })
  return NextResponse.json(attachments.map(item => ({ ...item, createdAt: item.createdAt.toISOString() })), { headers: { 'Cache-Control': 'private, no-store' } })
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser()
  if (!user || user.status !== 'ACTIVE' || user.role === 'REVIEWER') return NextResponse.json({ error: 'ไม่มีสิทธิ์แนบเอกสาร' }, { status: 403 })
  const { id: rawId } = await params
  const contractId = getContractId(rawId)
  if (!contractId) return NextResponse.json({ error: 'ไม่พบสัญญา' }, { status: 404 })
  const contract = await prisma.loanContract.findUnique({ where: { id: contractId }, select: { documentChoice: true, documentPackage: true } })
  if (!contract || contract.documentChoice !== 'CREATE' || contract.documentPackage !== 'LOAN_GUARANTEE_COLLATERAL') return NextResponse.json({ error: 'ไม่พบเอกสารหลักประกัน' }, { status: 404 })
  const count = await prisma.contractCollateralAttachment.count({ where: { contractId } })
  if (count >= MAX_ATTACHMENTS) return NextResponse.json({ error: `แนบเอกสารได้ไม่เกิน ${MAX_ATTACHMENTS} ไฟล์ต่อสัญญา` }, { status: 400 })
  const existingBytes = await prisma.contractCollateralAttachment.aggregate({ where: { contractId }, _sum: { sizeBytes: true } })

  let form: FormData
  try { form = await request.formData() } catch { return NextResponse.json({ error: 'ข้อมูลไฟล์ไม่ถูกต้อง' }, { status: 400 }) }
  const upload = form.get('file')
  const category = form.get('category')
  const originalStatus = form.get('originalStatus')
  const originalLocation = form.get('originalLocation')
  if (!(upload instanceof File) || upload.size <= 0 || upload.size > MAX_FILE_BYTES) return NextResponse.json({ error: 'เลือกไฟล์ PDF/JPG/PNG ขนาดไม่เกิน 15 MB' }, { status: 400 })
  if (typeof category !== 'string' || !categories.has(category)) return NextResponse.json({ error: 'กรุณาเลือกประเภทเอกสาร' }, { status: 400 })
  if (originalStatus !== 'PENDING' && originalStatus !== 'STORED') return NextResponse.json({ error: 'กรุณาระบุสถานะเอกสารต้นฉบับ' }, { status: 400 })
  if (typeof originalLocation !== 'string' || originalLocation.length > 250 || originalStatus === 'STORED' && !originalLocation.trim()) return NextResponse.json({ error: 'กรุณาระบุที่เก็บต้นฉบับ หรือเลือกว่ายังไม่ได้เก็บ' }, { status: 400 })
  const bytes = Buffer.from(await upload.arrayBuffer())
  if ((existingBytes._sum.sizeBytes ?? 0) + bytes.length > MAX_TOTAL_BYTES) return NextResponse.json({ error: 'ขนาดไฟล์รวมต่อสัญญาต้องไม่เกิน 50 MB' }, { status: 400 })
  const detected = inspectFile(bytes)
  if (!detected) return NextResponse.json({ error: 'ชนิดไฟล์ไม่รองรับ หรือเนื้อหาไฟล์ไม่ตรงกับ PDF/JPG/PNG' }, { status: 400 })

  try {
    const attachment = await prisma.contractCollateralAttachment.create({ data: {
      contractId, category, originalName: upload.name.slice(0, 240) || `เอกสาร.${detected.extension}`,
      fileData: new Uint8Array(bytes), mimeType: detected.mimeType, sizeBytes: bytes.length,
      sha256: createHash('sha256').update(bytes).digest('hex'),
      originalStatus, originalLocation: originalStatus === 'STORED' ? originalLocation.trim() : null,
      createdBy: user.id,
    }, select: { id: true } })
    return NextResponse.json({ id: attachment.id }, { status: 201, headers: { 'Cache-Control': 'no-store' } })
  } catch (error) {
    console.error('Could not save collateral attachment:', error)
    return NextResponse.json({ error: 'บันทึกไฟล์ไม่สำเร็จ กรุณาลองอีกครั้ง' }, { status: 500 })
  }
}
