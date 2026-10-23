import { createLoanAgreementPdf } from '../../lib/loan-agreement-pdf'
import { writeFile } from 'node:fs/promises'
import sharp from 'sharp'
async function main() {
  const signature = await sharp(Buffer.from('<svg width="300" height="70" xmlns="http://www.w3.org/2000/svg"><path d="M10 45 Q50 0 70 40 T130 25 Q160 10 180 40 L260 20" stroke="#123b35" stroke-width="3" fill="none"/></svg>')).png().toBuffer()
  const image = 'data:image/png;base64,' + signature.toString('base64')
  const bytes = await createLoanAgreementPdf({code:'CT-TEST',createdAt:new Date('2026-10-23T12:00:00Z'),borrowerName:'ผู้กู้ทดสอบ',lenderName:'ผู้ให้กู้ทดสอบ',address:'ที่อยู่ทดสอบ',houseNumber:'',subdistrict:'',district:'',province:'',birthDate:'',principalSatang:500000,interestSatang:100000,netSatang:400000,repaymentSatang:500000,interestPercent:20,interestMethod:'INTEREST_UPFRONT',paidAt:null,signingMethod:'E_SIGNATURE',witnessCount:2,witnesses:[{position:1,name:'พยานทดสอบหนึ่ง',signatureData:image,signedAt:new Date('2026-10-23T12:02:00Z')},{position:2,name:'พยานทดสอบสอง',signatureData:image,signedAt:new Date('2026-10-23T12:03:00Z')}],borrowerSignatureData:image,lenderSignatureData:image,borrowerSignedAt:new Date('2026-10-23T12:00:00Z'),lenderSignedAt:new Date('2026-10-23T12:01:00Z')})
  await writeFile('tmp/pdfs/signed-witness-test.pdf', bytes)
}
main()
