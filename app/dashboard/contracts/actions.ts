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

export async function getContractInterestRates() {
  const user = await getCurrentUser()
  if (!user || user.status !== 'ACTIVE' || user.role === 'REVIEWER') throw new Error('ไม่มีสิทธิ์สร้างสัญญา')
  return prisma.interestRate.findMany({
    where: { isActive: true }, orderBy: [{ sortOrder: 'asc' }, { percent: 'asc' }],
    select: { code: true, percent: true },
  })
}

export async function saveContract(input: import('@/lib/contracts').ContractDraft) {
  const user = await getCurrentUser()
  if (!user || user.status !== 'ACTIVE' || user.role === 'REVIEWER') return { error: 'ไม่มีสิทธิ์สร้างสัญญา' }
  try {
    const { contractAmounts, contractCode } = await import('@/lib/contracts')
    if (!input || !Number.isSafeInteger(input.borrowerId) || !Number.isSafeInteger(input.lenderId) || typeof input.requestKey !== 'string' || !/^[a-f0-9-]{36}$/i.test(input.requestKey)) throw new Error('ข้อมูลผู้กู้หรือผู้ให้กู้ไม่ถูกต้อง')
    if (!['CREATE', 'NONE'].includes(input.documentChoice)) throw new Error('กรุณาเลือกการจัดทำเอกสาร')
    if (input.documentChoice === 'CREATE' && (!['PRINT', 'E_SIGNATURE'].includes(input.signingMethod) || !['LOAN', 'LOAN_GUARANTEE', 'LOAN_GUARANTEE_COLLATERAL'].includes(input.documentPackage))) throw new Error('กรุณาเลือกวิธีลงนามและชุดเอกสาร')
    if (typeof input.principal !== 'string' || typeof input.customRate !== 'string' || typeof input.rateCode !== 'string') throw new Error('ข้อมูลยอดเงินไม่ถูกต้อง')
    const contract = await prisma.$transaction(async tx => {
      const previous = await tx.loanContract.findUnique({ where: { requestKey: input.requestKey } })
      if (previous) {
        if (previous.createdBy !== user.id) throw new Error('คำขอนี้ถูกใช้แล้ว')
        return previous
      }
      const borrower = await tx.borrower.findUnique({ where: { id: input.borrowerId } })
      const lender = await tx.lender.findUnique({ where: { id: input.lenderId } })
      if (!borrower || ['INACTIVE', 'BLACKLIST'].includes(borrower.status)) throw new Error('ผู้กู้ไม่พร้อมใช้งาน กรุณาเลือกใหม่')
      if (!lender || lender.status !== 'ACTIVE') throw new Error('ผู้ให้กู้ไม่พร้อมใช้งาน กรุณาเลือกใหม่')
      const rate = input.rateCode === 'CUSTOM' ? null : await tx.interestRate.findUnique({ where: { code: input.rateCode } })
      if (input.rateCode !== 'CUSTOM' && (!rate || !rate.isActive)) throw new Error('อัตราดอกเบี้ยไม่พร้อมใช้งาน กรุณาเลือกใหม่')
      if (input.rateCode === 'CUSTOM' && !/^\d+(?:\.\d{1,2})?$/.test(input.customRate)) throw new Error('อัตราดอกเบี้ยกำหนดเองไม่ถูกต้อง')
      const percent = input.rateCode === 'CUSTOM' ? Number(input.customRate) : rate!.percent
      return tx.loanContract.create({ data: {
        requestKey: input.requestKey, borrowerId: borrower.id, lenderId: lender.id,
        borrowerCode: borrower.borrowerId || `BR-${borrower.id}`,
        borrowerName: [borrower.titleTh, borrower.firstName, borrower.middleNameTh, borrower.lastName].filter(Boolean).join(' ') || borrower.nickname,
        lenderName: [lender.firstName, lender.lastName].filter(Boolean).join(' ') || lender.nickname,
        documentChoice: input.documentChoice,
        signingMethod: input.documentChoice === 'CREATE' ? input.signingMethod : null,
        documentPackage: input.documentChoice === 'CREATE' ? input.documentPackage : null,
        interestMethod: input.interestMethod, interestRateCode: rate?.code ?? null,
        interestPercent: percent, ...contractAmounts(input.principal, percent, input.interestMethod),
        createdBy: user.id,
      } })
    })
    return { code: contractCode(contract.id) }
  } catch (error) {
    console.error('Save contract failed:', error)
    // Validation messages are safe; database details stay on the server.
    return { error: error instanceof Error && !error.name.startsWith('Prisma') ? error.message : 'บันทึกไม่สำเร็จ กรุณาลองอีกครั้ง' }
  }
}

export async function listContracts() {
  const user = await getCurrentUser()
  if (!user || user.status !== 'ACTIVE') throw new Error('ไม่มีสิทธิ์ดูสัญญา')
  const rows = await prisma.loanContract.findMany({ orderBy: { id: 'desc' } })
  return rows.map(row => ({ ...row, createdAt: row.createdAt.toISOString(), paidAt: row.paidAt?.toISOString() ?? null }))
}
