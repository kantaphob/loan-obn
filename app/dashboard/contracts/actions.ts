'use server'

import { getCurrentUser } from '@/lib/auth/current-user'
import { prisma } from '@/lib/prisma'

export async function searchContractBorrowers(query: string) {
  const user = await getCurrentUser()
  if (!user || user.status !== 'ACTIVE' || user.role === 'REVIEWER') throw new Error('ไม่มีสิทธิ์สร้างสัญญา')
  const terms = query.trim().slice(0, 100).split(/\s+/).filter(Boolean)
  return prisma.borrower.findMany({
    where: { AND: terms.map(term => ({ OR: [
      { borrowerId: { contains: term } }, { firstName: { contains: term } },
      { lastName: { contains: term } }, { nickname: { contains: term } },
      { phone: { contains: term } }, { nationalId: { contains: term } },
    ] })) },
    select: {
      id: true, borrowerId: true, titleTh: true, firstName: true, middleNameTh: true,
      lastName: true, nickname: true, phone: true, nationalId: true, address: true,
      status: true, approvedLimit: true, usedLimit: true,
      bankCode: true, bankAccount: true, bankAccountName: true,
    },
    orderBy: { id: 'desc' }, take: 20,
  })
}

export async function searchContractLenders(query: string) {
  const user = await getCurrentUser()
  if (!user || user.status !== 'ACTIVE' || user.role === 'REVIEWER') throw new Error('ไม่มีสิทธิ์สร้างสัญญา')
  const terms = query.trim().slice(0, 100).split(/\s+/).filter(Boolean)
  return prisma.lender.findMany({
    where: { AND: terms.map(term => {
      const code = /^LN-0*(\d+)$/i.exec(term)
      return { OR: [
        ...(code && Number.isSafeInteger(Number(code[1])) && Number(code[1]) <= 2147483647 ? [{ id: Number(code[1]) }] : []),
        { firstName: { contains: term } }, { lastName: { contains: term } },
        { nickname: { contains: term } }, { phone: { contains: term } },
        { nationalId: { contains: term } },
      ] }
    }) },
    select: { id: true, firstName: true, lastName: true, nickname: true, phone: true,
      role: true, status: true, address: true },
    orderBy: { id: 'desc' }, take: 20,
  })
}
