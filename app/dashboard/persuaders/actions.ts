'use server'

import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/lib/auth/current-user'
import { revalidatePath } from 'next/cache'

async function authorize() {
  const user = await getCurrentUser()
  if (!user || user.status !== 'ACTIVE' || user.role === 'REVIEWER') throw new Error('ไม่มีสิทธิ์จัดการผู้แนะนำ')
}
export async function searchPersuaderBorrowers(query: string) {
  await authorize()
  const q = query.trim().slice(0, 100)
  return prisma.borrower.findMany({ where: { OR: [{ nickname: { contains: q } }, { firstName: { contains: q } }, { lastName: { contains: q } }, { borrowerId: { contains: q } }] }, select: { id: true, borrowerId: true, nickname: true, firstName: true, lastName: true, phone: true, bankCode: true, bankAccount: true, bankAccountName: true }, orderBy: { id: 'desc' }, take: 20 })
}
export async function savePersuader(input: { id?: number; name: string; phone: string; bankCode: string; bankAccount: string; bankAccountName: string; notes: string; isActive: boolean; borrowerId: number | null }) {
  await authorize()
  if (input.id !== undefined && (!Number.isSafeInteger(input.id) || input.id <= 0)) throw new Error('รหัสผู้แนะนำไม่ถูกต้อง')
  const name = typeof input.name === 'string' ? input.name.trim() : ''
  const phone = typeof input.phone === 'string' ? input.phone.trim() : ''
  const bankCode = typeof input.bankCode === 'string' ? input.bankCode.trim() : ''
  const bankAccount = typeof input.bankAccount === 'string' ? input.bankAccount.trim() : ''
  const bankAccountName = typeof input.bankAccountName === 'string' ? input.bankAccountName.trim() : ''
  const notes = typeof input.notes === 'string' ? input.notes.trim() : ''
  if (!name || name.length > 200 || bankAccountName.length > 200 || notes.length > 2000) throw new Error('กรุณาระบุชื่อไม่เกิน 200 ตัวอักษร และหมายเหตุไม่เกิน 2,000 ตัวอักษร')
  if (phone && !/^0[0-9]{8,9}$/.test(phone)) throw new Error('เบอร์โทรต้องขึ้นต้นด้วย 0 และมี 9–10 หลัก')
  if (Boolean(bankCode) !== Boolean(bankAccount) || bankAccount && !/^[0-9]{6,20}$/.test(bankAccount)) throw new Error('กรุณาระบุธนาคารและเลขบัญชี 6–20 หลักให้ครบ')
  if (typeof input.isActive !== 'boolean') throw new Error('สถานะไม่ถูกต้อง')
  if (input.borrowerId !== null && (!Number.isSafeInteger(input.borrowerId) || input.borrowerId <= 0)) throw new Error('รหัส Borrower ไม่ถูกต้อง')
  try {
    const row = await prisma.$transaction(async tx => {
      const existing = input.id ? await tx.persuader.findUnique({ where: { id: input.id } }) : null
      if (input.id && !existing) throw new Error('ไม่พบผู้แนะนำ')
      if (existing && existing.borrowerId !== input.borrowerId) throw new Error('ไม่สามารถเปลี่ยน Borrower ที่เชื่อมไว้ กรุณาสร้างรายชื่อใหม่')
      if (input.borrowerId !== null && !await tx.borrower.findUnique({ where: { id: input.borrowerId }, select: { id: true } })) throw new Error('ไม่พบ Borrower ที่เลือก')
      if (bankCode && bankCode !== existing?.bankCode && !await tx.bank.findFirst({ where: { code: bankCode, isActive: true } })) throw new Error('ธนาคารที่เลือกไม่พร้อมใช้งาน')
      const data = { name, phone, bankCode, bankAccount, bankAccountName, notes, isActive: input.isActive, borrowerId: input.borrowerId }
      return input.id ? tx.persuader.update({ where: { id: input.id }, data }) : tx.persuader.create({ data })
    })
    revalidatePath('/dashboard/persuaders')
    revalidatePath('/dashboard/contracts')
    return { id: row.id }
  } catch (error) {
    if (error && typeof error === 'object' && 'code' in error && error.code === 'P2002') throw new Error('Borrower นี้เป็น Persuader แล้ว กรุณาแก้ไขรายชื่อเดิม')
    throw error
  }
}
