import { prisma } from '../../lib/prisma'
import { createLoanAgreementPdf } from '../../lib/loan-agreement-pdf'
import { contractCode } from '../../lib/contracts'
import { writeFile } from 'node:fs/promises'
async function main() {
 let c = await prisma.loanContract.findFirst({ orderBy: { id: 'desc' }, include: { borrower: { include: { province: true } }, lender: true } })
 if (!c) {
   const borrower = await prisma.borrower.findFirstOrThrow({ orderBy: { id: 'desc' }, include: { province: true } })
   const lender = await prisma.lender.findFirstOrThrow({ where: { status: 'ACTIVE' }, orderBy: { id: 'desc' } })
   const sample = { id: 0, borrower, lender, borrowerName: [borrower.titleTh, borrower.firstName, borrower.middleNameTh, borrower.lastName].filter(Boolean).join(' ') || borrower.nickname, lenderName: [lender.firstName, lender.lastName].filter(Boolean).join(' ') || lender.nickname, createdAt: new Date('2026-10-23T12:00:00Z'), principalSatang: 500000, interestSatang: 100000, netSatang: 400000, repaymentSatang: 500000, interestPercent: 20, interestMethod: 'INTEREST_UPFRONT', paidAt: null, witnessCount: 2 }
   const bytes = await createLoanAgreementPdf({ ...sample, code: contractCode(1), preview: true, address: borrower.address, houseNumber: borrower.houseNumber, birthDate: borrower.birthDate, province: borrower.province?.nameTh ?? '', district: '', subdistrict: '', lenderAddress: lender.address, signingMethod: 'PRINT' })
   await writeFile('output/pdf/loan-agreement-preview.pdf', bytes)
   console.log('Example only, with existing party data and illustrative amounts')
   return
 }
 const [district, subdistrict] = await Promise.all([
   c.borrower.districtId ? prisma.district.findUnique({ where: { id: c.borrower.districtId } }) : null,
   c.borrower.subdistrictId ? prisma.subdistrict.findUnique({ where: { id: c.borrower.subdistrictId } }) : null,
 ])
 const bytes = await createLoanAgreementPdf({ ...c, code: contractCode(c.id), address: c.borrower.address, houseNumber: c.borrower.houseNumber, birthDate: c.borrower.birthDate, province: c.borrower.province?.nameTh ?? '', district: district?.nameTh ?? '', subdistrict: subdistrict?.nameTh ?? '', lenderAddress: c.lender.address, signingMethod: 'PRINT', borrowerSignatureData: null, lenderSignatureData: null })
 await writeFile('output/pdf/loan-agreement-preview.pdf', bytes)
 console.log('Preview generated from saved loan, with signature lines left blank')
}
main().finally(() => prisma.$disconnect())
