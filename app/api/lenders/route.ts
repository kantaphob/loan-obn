import { promptPayTypes } from '@/lib/borrower'
import { verifyCardRead } from '@/lib/thai-id-token'
import { getCurrentUser } from '@/lib/auth/current-user'
import { prisma } from '@/lib/prisma'
import { lenderFields, lenderRoles, lenderStatuses } from '@/lib/lender'

export async function POST(request: Request) { return save(request, false) }
export async function PUT(request: Request) { return save(request, true) }

async function save(request: Request, editing: boolean) {
  const user = await getCurrentUser()
  if (!user) return Response.json({ message: 'กรุณาเข้าสู่ระบบ' }, { status: 401 })
  if (user.role === 'REVIEWER') return Response.json({ message: 'ไม่มีสิทธิ์จัดการผู้ให้กู้' }, { status: 403 })
  let input: Record<string, unknown>
  try {
    input = await request.json()
    if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error()
  } catch { return Response.json({ message: 'ข้อมูลคำขอไม่ถูกต้อง' }, { status: 400 }) }
  const invalid = (message: string) => Response.json({ message }, { status: 400 })
  if (editing && (!Number.isSafeInteger(input.id) || Number(input.id) <= 0)) return invalid('รหัสผู้ให้กู้ไม่ถูกต้อง')
  const cardRead = input.cardReadToken ? verifyCardRead(input.cardReadToken, user.id) : null
  if (input.cardReadToken && !cardRead) return invalid('ข้อมูลอ่านบัตรหมดอายุหรือไม่ถูกต้อง กรุณาอ่านบัตรใหม่')
  const data = Object.fromEntries(lenderFields.map(([key]) => [key, typeof input[key] === 'string' ? input[key].trim() : ''])) as Record<typeof lenderFields[number][0], string>
  if (cardRead && cardRead.card.nationalId !== data.nationalId) return invalid('เลขบัตรไม่ตรงกับข้อมูลที่อ่าน กรุณาอ่านบัตรใหม่')
  if (!data.nickname) return invalid('กรุณาระบุชื่อเล่น')
  if (Object.entries(data).some(([key, value]) => value.length > (['notes', 'address'].includes(key) ? 2000 : 200))) return invalid('ข้อมูลทั่วไปต้องไม่เกิน 200 ตัวอักษร ที่อยู่และหมายเหตุต้องไม่เกิน 2,000 ตัวอักษร')
  if (data.phone && !/^0[0-9]{8,9}$/.test(data.phone)) return invalid('เบอร์โทรต้องขึ้นต้นด้วย 0 และมี 9–10 หลัก')
  if (data.nationalId && !/^[0-9]{13}$/.test(data.nationalId)) return invalid('เลขบัตรประชาชนต้องมี 13 หลัก')
  if (data.bankAccount && !/^[0-9]{6,20}$/.test(data.bankAccount)) return invalid('เลขบัญชีธนาคารต้องเป็นตัวเลข 6–20 หลัก')
  for (const key of ['birthDate', 'cardIssueDate', 'cardExpiryDate', 'registeredAt'] as const) {
    const value = data[key]
    if (value && (!/^\d{4}-\d{2}-\d{2}$/.test(value) || !Number.isFinite(Date.parse(value + 'T00:00:00Z')) || new Date(value + 'T00:00:00Z').toISOString().slice(0, 10) !== value)) return invalid('วันที่ไม่ถูกต้อง')
  }
  const promptPayType = typeof input.promptPayType === 'string' ? input.promptPayType : ''
  if ((promptPayType || data.promptPayNumber) && !Object.hasOwn(promptPayTypes, promptPayType)) return invalid('กรุณาเลือกประเภทพร้อมเพย์')
  if (promptPayType === 'PHONE' && !/^0[0-9]{9}$/.test(data.promptPayNumber)) return invalid('พร้อมเพย์แบบเบอร์โทรต้องมี 10 หลักและขึ้นต้นด้วย 0')
  if (promptPayType === 'NATIONAL_ID' && !/^[0-9]{13}$/.test(data.promptPayNumber)) return invalid('พร้อมเพย์แบบเลขบัตรต้องมี 13 หลัก')
  const paymentChannelCode = typeof input.paymentChannelCode === 'string' ? input.paymentChannelCode : ''
  if (paymentChannelCode === 'PROMPTPAY' && !promptPayType) return invalid('กรุณาระบุข้อมูลพร้อมเพย์')
  const role = typeof input.role === 'string' ? input.role : ''
  const status = typeof input.status === 'string' ? input.status : ''
  if (!Object.hasOwn(lenderRoles, role) || !Object.hasOwn(lenderStatuses, status)) return invalid('บทบาทหรือสถานะไม่ถูกต้อง')
  const provinceId = input.provinceId === null ? null : input.provinceId
  if (provinceId !== null && (typeof provinceId !== 'number' || !Number.isSafeInteger(provinceId) || provinceId <= 0)) return invalid('จังหวัดไม่ถูกต้อง')
  const bankCode = typeof input.bankCode === 'string' ? input.bankCode.trim() : ''
  if (Boolean(bankCode) !== Boolean(data.bankAccount)) return invalid('กรุณาระบุธนาคารและเลขบัญชีให้ครบ')
  try {
    const existing = editing ? await prisma.lender.findUnique({ where: { id: Number(input.id) } }) : null
    if (editing && !existing) return Response.json({ message: 'ไม่พบผู้ให้กู้' }, { status: 404 })
    if (provinceId !== null && !await prisma.province.findUnique({ where: { id: provinceId as number } })) return invalid('ไม่พบจังหวัดในข้อมูลหลัก')
    if (bankCode && bankCode !== existing?.bankCode && !await prisma.bank.findFirst({ where: { code: bankCode, isActive: true } })) return invalid('ไม่พบธนาคารที่เลือก')
    if (paymentChannelCode && paymentChannelCode !== existing?.paymentChannelCode && !await prisma.paymentChannel.findFirst({ where: { code: paymentChannelCode, isActive: true } })) return invalid('ช่องทางการเงินไม่ถูกต้อง')
    const cardValues = cardRead ? { cardData: JSON.stringify(cardRead.card), cardReadAt: new Date(cardRead.readAt) } : existing && existing.nationalId !== data.nationalId ? { cardData: null, cardReadAt: null } : {}
    const values = { ...data, ...cardValues, promptPayType, paymentChannelCode, nationalId: data.nationalId || null, role, status, bankCode, provinceId: provinceId as number | null }
    const lender = editing ? await prisma.lender.update({ where: { id: Number(input.id) }, data: values }) : await prisma.lender.create({ data: values })
    return Response.json({ id: lender.id }, { status: editing ? 200 : 201 })
  } catch (error) {
    const code = typeof error === 'object' && error && 'code' in error ? error.code : ''
    if (code === 'P2002') return Response.json({ message: 'เลขบัตรประชาชนนี้มีในรายชื่อผู้ให้กู้แล้ว' }, { status: 409 })
    if (code === 'P2025') return Response.json({ message: 'ไม่พบผู้ให้กู้' }, { status: 404 })
    console.error('Save lender failed:', code)
    return Response.json({ message: 'บันทึกไม่สำเร็จ กรุณาลองอีกครั้ง' }, { status: 500 })
  }
}
