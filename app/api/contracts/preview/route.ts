import { getCurrentUser } from '@/lib/auth/current-user'
import { prisma } from '@/lib/prisma'
import { contractAmounts, validContractSchedule } from '@/lib/contracts'
import { createLoanAgreementPdf } from '@/lib/loan-agreement-pdf'

export async function POST(request: Request) {
  const user = await getCurrentUser()
  if (!user || user.status !== 'ACTIVE' || user.role === 'REVIEWER') return Response.json({ message: 'ไม่มีสิทธิ์ดูตัวอย่างสัญญา' }, { status: 401 })

  try {
    const input = await request.json() as Record<string, unknown>
    const borrowerId = Number(input.borrowerId)
    const lenderId = Number(input.lenderId)
    const principal = input.principal
    const interestMethod = input.interestMethod
    const scheduledDisbursementDate = input.scheduledDisbursementDate
    const repaymentDueDate = input.repaymentDueDate
    const signingMethod = input.signingMethod
    const witnessCount = input.witnessCount
    const collateralDescription = input.collateralDescription
    const internalRateCode = input.internalRateCode
    const internalCustomRate = input.internalCustomRate

    if (!Number.isSafeInteger(borrowerId) || borrowerId <= 0 || !Number.isSafeInteger(lenderId) || lenderId <= 0) return Response.json({ message: 'ข้อมูลผู้กู้หรือผู้ให้กู้ไม่ถูกต้อง' }, { status: 400 })
    if (typeof principal !== 'string' || typeof interestMethod !== 'string' || !['INTEREST_UPFRONT', 'INTEREST_WITH_PRINCIPAL'].includes(interestMethod)) return Response.json({ message: 'ข้อมูลเงินกู้ไม่ถูกต้อง' }, { status: 400 })
    if (typeof scheduledDisbursementDate !== 'string' || typeof repaymentDueDate !== 'string' || !validContractSchedule(scheduledDisbursementDate, repaymentDueDate)) return Response.json({ message: 'กรุณาระบุวันที่จ่ายเงินและวันครบกำหนดให้ถูกต้อง' }, { status: 400 })
    if (!['PRINT', 'E_SIGNATURE'].includes(String(signingMethod)) || ![0, 1, 2].includes(Number(witnessCount))) return Response.json({ message: 'กรุณาเลือกวิธีลงนามและจำนวนพยาน' }, { status: 400 })
    if (typeof collateralDescription !== 'string' || collateralDescription.length > 2000) return Response.json({ message: 'รายละเอียดหลักประกันไม่ถูกต้อง' }, { status: 400 })

    let percent = 0
    if (internalRateCode === 'CUSTOM') {
      if (typeof internalCustomRate !== 'string' || !/^\d+(?:\.\d{1,2})?$/.test(internalCustomRate) || Number(internalCustomRate) > 100) return Response.json({ message: 'อัตราอ้างอิงภายในไม่ถูกต้อง' }, { status: 400 })
      percent = Number(internalCustomRate)
    } else if (typeof internalRateCode === 'string' && internalRateCode) {
      const rate = await prisma.interestRate.findUnique({ where: { code: internalRateCode }, select: { percent: true, isActive: true } })
      if (!rate?.isActive) return Response.json({ message: 'อัตราอ้างอิงภายในไม่พร้อมใช้งาน กรุณาเลือกใหม่' }, { status: 400 })
      percent = rate.percent
    } else if (interestMethod === 'INTEREST_UPFRONT') {
      return Response.json({ message: 'กรุณาเลือกอัตราอ้างอิงภายในเพื่อดูยอดรับเงินจริง' }, { status: 400 })
    }

    const [borrower, lender] = await Promise.all([
      prisma.borrower.findUnique({ where: { id: borrowerId }, include: { province: true } }),
      prisma.lender.findUnique({ where: { id: lenderId } }),
    ])
    if (!borrower || ['INACTIVE', 'BLACKLIST'].includes(borrower.status)) return Response.json({ message: 'ผู้กู้ไม่พร้อมใช้งาน กรุณาเลือกใหม่' }, { status: 400 })
    if (!lender || lender.status !== 'ACTIVE') return Response.json({ message: 'ผู้ให้กู้ไม่พร้อมใช้งาน กรุณาเลือกใหม่' }, { status: 400 })

    const [district, subdistrict] = await Promise.all([
      borrower.districtId ? prisma.district.findUnique({ where: { id: borrower.districtId }, select: { nameTh: true } }) : null,
      borrower.subdistrictId ? prisma.subdistrict.findUnique({ where: { id: borrower.subdistrictId }, select: { nameTh: true } }) : null,
    ])
    const amounts = contractAmounts(principal, percent, interestMethod)
    const pdf = await createLoanAgreementPdf({
      code: 'ร่างก่อนบันทึก', createdAt: new Date(), borrowerName: [borrower.titleTh, borrower.firstName, borrower.middleNameTh, borrower.lastName].filter(Boolean).join(' ') || borrower.nickname,
      lenderName: [lender.firstName, lender.lastName].filter(Boolean).join(' ') || lender.nickname,
      address: borrower.address, houseNumber: borrower.houseNumber, subdistrict: subdistrict?.nameTh ?? '', district: district?.nameTh ?? '', province: borrower.province?.nameTh ?? '',
      birthDate: borrower.birthDate, borrowerNationalId: borrower.nationalId, lenderNationalId: lender.nationalId, lenderAddress: lender.address,
      principalSatang: amounts.principalSatang, interestSatang: amounts.interestSatang, netSatang: amounts.netSatang, repaymentSatang: amounts.repaymentSatang,
      interestPercent: 0, interestMethod, scheduledDisbursementDate, repaymentDueDate, collateralDescription, fundsReceived: false, paidAt: null, witnessCount: Number(witnessCount), signingMethod: String(signingMethod), preview: true,
    })

    return new Response(Buffer.from(pdf), { headers: { 'Content-Type': 'application/pdf', 'Content-Disposition': 'inline; filename="loan-agreement-preview.pdf"', 'Cache-Control': 'no-store' } })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'สร้างตัวอย่างเอกสารไม่สำเร็จ'
    return Response.json({ message }, { status: 400 })
  }
}
