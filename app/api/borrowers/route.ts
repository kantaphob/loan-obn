import { storeBorrowerImage, removeBorrowerImage, cardPhotoReference } from '@/lib/borrower-files'
import { prepareLineQr } from '@/lib/line-qr'
import { socialKeys, socialUrl } from '@/lib/borrower-social'
import { verifyCardRead } from '@/lib/thai-id-token'
import { getCurrentUser } from '@/lib/auth/current-user'
import { prisma } from '@/lib/prisma'
import { borrowerFields, borrowerStatuses, promptPayTypes } from '@/lib/borrower'

export async function POST(request: Request) { return saveBorrower(request, false) }
export async function PUT(request: Request) { return saveBorrower(request, true) }

async function saveBorrower(request: Request, editing: boolean) {
  const user = await getCurrentUser()
  if (!user) return Response.json({ message: 'กรุณาเข้าสู่ระบบ' }, { status: 401 })
  if (user.role === 'REVIEWER') return Response.json({ message: 'ไม่มีสิทธิ์จัดการผู้กู้ยืม' }, { status: 403 })
  let input: Record<string, unknown>
  try {
    const body = await request.json()
    if (!body || typeof body !== 'object' || Array.isArray(body)) throw new Error()
    input = body
  } catch { return Response.json({ message: 'ข้อมูลคำขอไม่ถูกต้อง' }, { status: 400 }) }
  if (editing && (!Number.isSafeInteger(input.id) || Number(input.id) <= 0)) return Response.json({ message: 'รหัสผู้กู้ยืมไม่ถูกต้อง' }, { status: 400 })
  const existing = editing ? await prisma.borrower.findUnique({ where: { id: Number(input.id) } }) : null
  if (editing && !existing) return Response.json({ message: 'ไม่พบผู้กู้ยืม' }, { status: 404 })
  const cardRead = input.cardReadToken ? verifyCardRead(input.cardReadToken, user.id) : null
  if (input.cardReadToken && !cardRead) return Response.json({ message: 'ข้อมูลอ่านบัตรหมดอายุหรือไม่ถูกต้อง กรุณาอ่านบัตรใหม่' }, { status: 400 })
  const data = Object.fromEntries(borrowerFields.map(([key]) => [key, typeof input[key] === 'string' ? input[key].trim() : ''])) as Record<typeof borrowerFields[number][0], string>
  const invalid = (message: string) => Response.json({ message }, { status: 400 })
  if (Object.entries(data).some(([key, value]) => value.length > (socialKeys.includes(key as typeof socialKeys[number]) ? 2048 : 200))) return invalid('ข้อมูลทั่วไปต้องไม่เกิน 200 ตัวอักษร และลิงก์ต้องไม่เกิน 2,048 ตัวอักษร')
  for (const key of socialKeys) {
    if (data[key] && !socialUrl(data[key]) && existing?.[key] !== data[key]) return invalid(`${key === 'facebook' ? 'Facebook' : key === 'instagram' ? 'Instagram' : 'Line'} ต้องเป็นลิงก์ที่ขึ้นต้นด้วย https:// หรือ http://`)
  }
  let qrValues: { lineQrImage?: string } = {}
  if (Object.hasOwn(input, 'lineQrImage')) {
    try { qrValues = { lineQrImage: await prepareLineQr(input.lineQrImage) } }
    catch (error) { return invalid(error instanceof Error ? error.message : 'รูป QR ไม่ถูกต้อง') }
  }
  if (existing && (existing.cardReadAt || existing.cardData) && (existing.nationalId || '') !== data.nationalId) return invalid('เลขบัตรที่อ่านจากบัตรประชาชนแล้วไม่สามารถแก้ไขได้')
  if (cardRead && cardRead.card.nationalId !== data.nationalId) return invalid('เลขบัตรไม่ตรงกับข้อมูลที่อ่าน กรุณาอ่านบัตรใหม่')
  if (!data.nickname) return invalid('กรุณาระบุชื่อเล่น')
  if (data.phone && !/^0\d{8,9}$/.test(data.phone)) return invalid('เบอร์โทรต้องขึ้นต้นด้วย 0 และมี 9–10 หลัก')
  if (data.nationalId && !/^\d{13}$/.test(data.nationalId)) return invalid('เลขบัตรประชาชนต้องมี 13 หลัก')
  if (data.bankAccount && !/^\d{6,20}$/.test(data.bankAccount)) return invalid('เลขบัญชีธนาคารต้องเป็นตัวเลข 6–20 หลัก')
  for (const key of ['birthDate', 'cardIssueDate', 'cardExpiryDate'] as const) {
    if (!data[key]) continue
    const date = new Date(data[key] + 'T00:00:00Z')
    if (!/^\d{4}-\d{2}-\d{2}$/.test(data[key]) || !Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== data[key]) return invalid('วันที่ในข้อมูลบัตรไม่ถูกต้อง')
  }
  if (data.birthDate && data.birthDate > new Date().toISOString().slice(0, 10)) return invalid('วันเกิดต้องไม่เป็นวันในอนาคต')
  if (data.cardIssueDate && data.cardExpiryDate && data.cardIssueDate > data.cardExpiryDate) return invalid('วันหมดอายุต้องไม่ก่อนวันออกบัตร')
  const bankCode = typeof input.bankCode === 'string' ? input.bankCode.trim() : ''
  const promptPayType = typeof input.promptPayType === 'string' ? input.promptPayType : ''
  const promptPayNumber = typeof input.promptPayNumber === 'string' ? input.promptPayNumber.trim() : ''
  if (bankCode && !data.bankAccount) return invalid('กรุณาระบุเลขบัญชีธนาคาร')
  if (data.bankAccount && !bankCode && !(existing?.bankAccount === data.bankAccount && !existing.bankCode)) return invalid('กรุณาเลือกธนาคารของบัญชีนี้')
  if ((promptPayType || promptPayNumber) && !Object.hasOwn(promptPayTypes, promptPayType)) return invalid('กรุณาเลือกประเภทพร้อมเพย์')
  if (promptPayType === 'PHONE' && !/^0[0-9]{9}$/.test(promptPayNumber)) return invalid('พร้อมเพย์แบบเบอร์โทรต้องขึ้นต้นด้วย 0 และมี 10 หลัก')
  if (promptPayType === 'NATIONAL_ID' && !/^[0-9]{13}$/.test(promptPayNumber)) return invalid('พร้อมเพย์แบบเลขบัตรประชาชนต้องมี 13 หลัก')
  const status = typeof input.status === 'string' ? input.status : ''
  if (!Object.hasOwn(borrowerStatuses, status)) return invalid('กรุณาเลือกสถานะที่ถูกต้อง')
  const approved = input.approvedLimit, used = input.usedLimit, months = input.durationMonths
  if (![approved, used].every(value => typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 && value <= 2_000_000_000)) return invalid('วงเงินต้องเป็นจำนวนเต็มตั้งแต่ 0 ถึง 2,000,000,000 บาท')
  if (Number(used) > Number(approved) && !(existing && existing.approvedLimit === approved && existing.usedLimit === used)) return invalid('วงเงินที่ใช้ต้องไม่เกินวงเงินอนุมัติ')
  if (typeof months !== 'number' || !Number.isInteger(months) || months < 0 || months > 1200) return invalid('ระยะเวลาต้องอยู่ระหว่าง 0–1,200 เดือน')
  const date = typeof input.registeredAt === 'string' ? input.registeredAt : ''
  const registeredAt = new Date(`${date}T00:00:00.000Z`)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(registeredAt.getTime()) || registeredAt.toISOString().slice(0, 10) !== date) return invalid('วันที่สมัครไม่ถูกต้อง')
  const paymentChannelCode = typeof input.paymentChannelCode === 'string' ? input.paymentChannelCode : ''
  if (paymentChannelCode === 'PROMPTPAY' && (!promptPayType || !promptPayNumber) && !(existing?.paymentChannelCode === 'PROMPTPAY' && existing.promptPayType === promptPayType && existing.promptPayNumber === promptPayNumber)) return invalid('กรุณาระบุข้อมูลพร้อมเพย์สำหรับช่องรับเงินนี้')
  const riskRatingCode = typeof input.riskRatingCode === 'string' ? input.riskRatingCode : ''
  const provinceId = input.provinceId === null || input.provinceId === undefined || input.provinceId === '' ? null : input.provinceId
  if (provinceId !== null && (typeof provinceId !== 'number' || !Number.isSafeInteger(provinceId) || provinceId <= 0)) return invalid('จังหวัดไม่ถูกต้อง')
  const locationId = (value: unknown) => value === '' || value === null || value === undefined ? null : typeof value === 'number' && Number.isSafeInteger(value) && value > 0 ? value : NaN
  const districtId = locationId(input.districtId), subdistrictId = locationId(input.subdistrictId)
  if (Number.isNaN(districtId) || Number.isNaN(subdistrictId)) return invalid('อำเภอหรือตำบลไม่ถูกต้อง')
  const newFiles: string[] = []
  try {
    if (provinceId !== null && !await prisma.province.findUnique({ where: { id: provinceId as number } })) return invalid('ไม่พบจังหวัดในข้อมูลหลัก')
    if (districtId !== null && !await prisma.district.findFirst({ where: { id: districtId, provinceId: Number(provinceId) } })) return invalid('อำเภอไม่ตรงกับจังหวัดที่เลือก')
    if (subdistrictId !== null && !await prisma.subdistrict.findFirst({ where: { id: subdistrictId, districtId: Number(districtId) } })) return invalid('ตำบลไม่ตรงกับอำเภอที่เลือก')
    const [channel, risk, bank] = await Promise.all([
      paymentChannelCode ? prisma.paymentChannel.findFirst({ where: { code: paymentChannelCode, isActive: true } }) : null,
      riskRatingCode ? prisma.riskRating.findFirst({ where: { code: riskRatingCode, isActive: true } }) : null,
      bankCode ? prisma.bank.findFirst({ where: { code: bankCode, isActive: true } }) : null,
    ])
    if (bankCode && !bank && bankCode !== existing?.bankCode) return invalid('ไม่พบธนาคารที่เลือกในข้อมูลหลัก')
    if (paymentChannelCode && !channel && paymentChannelCode !== existing?.paymentChannelCode) return invalid('ช่องรับเงินไม่ถูกต้อง')
    if (riskRatingCode && !risk && riskRatingCode !== existing?.riskRatingCode) return invalid('Risk Rating ไม่ถูกต้อง')
    if (qrValues.lineQrImage) {
      const reference = await storeBorrowerImage(qrValues.lineQrImage)
      newFiles.push(reference); qrValues.lineQrImage = reference
    }
    if (cardRead) {
      const reference = await storeBorrowerImage(cardRead.card.photo)
      newFiles.push(reference); cardRead.card.photo = reference
    }
    const cardValues = cardRead ? { cardData: JSON.stringify(cardRead.card), cardReadAt: new Date(cardRead.readAt) } : existing && existing.nationalId !== data.nationalId ? { cardData: null, cardReadAt: null } : {}
    const values = { ...data, districtId, subdistrictId, ...qrValues, nationalId: data.nationalId || null, ...cardValues, bankCode, promptPayType, promptPayNumber, provinceId: provinceId as number | null, status, registeredAt, paymentChannelCode, riskRatingCode, approvedLimit: Number(approved), usedLimit: Number(used), durationMonths: months }
    const borrower = editing ? await prisma.borrower.update({ where: { id: Number(input.id) }, data: values }) : await prisma.$transaction(async tx => {
      const created = await tx.borrower.create({ data: values })
      return tx.borrower.update({ where: { id: created.id }, data: { borrowerId: `BR-${String(created.id).padStart(5, '0')}` } })
    })
    const replacedFiles = [
      existing && Object.hasOwn(qrValues, 'lineQrImage') ? existing.lineQrImage : '',
      existing && Object.hasOwn(cardValues, 'cardData') ? cardPhotoReference(existing.cardData) : '',
    ]
    await Promise.allSettled(replacedFiles.filter(Boolean).map(removeBorrowerImage))
    return Response.json({ id: borrower.id }, { status: editing ? 200 : 201 })
  } catch (error) {
    await Promise.allSettled(newFiles.map(removeBorrowerImage))
    if (typeof error === 'object' && error && 'code' in error && error.code === 'P2025') return Response.json({ message: 'ไม่พบผู้กู้ยืม' }, { status: 404 })
    if (typeof error === 'object' && error && 'code' in error && error.code === 'P2002') return Response.json({ message: 'เลขบัตรประชาชนนี้มีในระบบแล้ว' }, { status: 409 })
    console.error('Create borrower failed:', typeof error === 'object' && error && 'code' in error ? error.code : 'Unknown database error')
    return Response.json({ message: 'บันทึกไม่สำเร็จ กรุณาลองอีกครั้ง' }, { status: 500 })
  }
}

export async function DELETE(request: Request) {
  const user = await getCurrentUser()
  if (!user) return Response.json({ message: 'กรุณาเข้าสู่ระบบ' }, { status: 401 })
  if (user.role === 'REVIEWER') return Response.json({ message: 'ไม่มีสิทธิ์จัดการผู้กู้ยืม' }, { status: 403 })
  let id: unknown
  try { id = (await request.json())?.id } catch { return Response.json({ message: 'ข้อมูลคำขอไม่ถูกต้อง' }, { status: 400 }) }
  if (typeof id !== 'number' || !Number.isSafeInteger(id) || id <= 0) return Response.json({ message: 'รหัสผู้กู้ยืมไม่ถูกต้อง' }, { status: 400 })
  try {
    const removed = await prisma.$transaction(async tx => {
      const row = await tx.borrower.findUnique({ where: { id }, select: { lineQrImage: true, cardData: true } })
      const result = await tx.borrower.deleteMany({ where: { id, usedLimit: 0 } })
      return result.count ? row : null
    })
    if (removed) {
      await Promise.allSettled([removed.lineQrImage, cardPhotoReference(removed.cardData)].filter(Boolean).map(removeBorrowerImage))
      return Response.json({ success: true })
    }
    const existing = await prisma.borrower.findUnique({ where: { id } })
    return Response.json({ message: existing ? 'ไม่สามารถลบผู้กู้ยืมที่ยังมีวงเงินใช้งาน กรุณาตรวจสอบยอดก่อน' : 'ไม่พบผู้กู้ยืม' }, { status: existing ? 409 : 404 })
  } catch {
    return Response.json({ message: 'ลบไม่สำเร็จ กรุณาลองอีกครั้ง' }, { status: 500 })
  }
}
