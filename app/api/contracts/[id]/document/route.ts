import { getCurrentUser } from '@/lib/auth/current-user'
import { prisma } from '@/lib/prisma'
import { contractCode, contractDocumentSignaturesComplete, contractSignaturesComplete } from '@/lib/contracts'
import { createLoanAgreementPdf } from '@/lib/loan-agreement-pdf'
import { createGuaranteeAgreementPdf } from '@/lib/guarantee-agreement-pdf'
import { createCollateralAgreementPdf } from '@/lib/collateral-agreement-pdf'

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser()
  if (!user || user.status !== 'ACTIVE') return Response.json({ message: 'ไม่มีสิทธิ์ดูสัญญา' }, { status: 401 })
  const { id: value } = await params
  const id = Number(value)
  if (!/^\d+$/.test(value) || !Number.isSafeInteger(id) || id <= 0) return Response.json({ message: 'เลขสัญญาไม่ถูกต้อง' }, { status: 400 })
  const contract = await prisma.loanContract.findUnique({ where: { id }, include: { witnesses: true, documentSignatures: true, borrower: { include: { province: true } }, lender: true } })
  if (!contract) return Response.json({ message: 'ไม่พบสัญญา' }, { status: 404 })
  if (contract.documentChoice !== 'CREATE') return Response.json({ message: 'รายการนี้เลือกไม่ทำสัญญา' }, { status: 400 })
  const document = new URL(request.url).searchParams.get('document') ?? 'loan'
  if (!['loan', 'guarantee', 'collateral'].includes(document)) return Response.json({ message: 'ชนิดเอกสารไม่ถูกต้อง' }, { status: 400 })
  if (document === 'guarantee' && (!contract.documentPackage || contract.documentPackage === 'LOAN' || !contract.guarantorName || !contract.guarantorAge || !contract.guarantorHouseNumber || !contract.guarantorSubdistrict || !contract.guarantorDistrict || !contract.guarantorProvince)) return Response.json({ message: 'ชุดเอกสารนี้ไม่มีข้อมูลสัญญาค้ำประกันครบถ้วน' }, { status: 400 })
  if (document === 'collateral' && contract.documentPackage !== 'LOAN_GUARANTEE_COLLATERAL') return Response.json({ message: 'ชุดเอกสารนี้ไม่มีสัญญาหลักประกัน' }, { status: 400 })
  const documentStage = document === 'guarantee' ? 'GUARANTEE' : 'LOAN'
  if (contract.signingMethod === 'E_SIGNATURE' && (document === 'collateral' ? !contractSignaturesComplete(contract) : !contractDocumentSignaturesComplete(contract, documentStage))) {
    return Response.json({ message: 'ต้องให้ผู้ลงนามและพยานของเอกสารฉบับนี้ลงนามครบก่อนเปิดเอกสารฉบับลงนาม' }, { status: 409 })
  }
  try {
    const borrower = contract.borrower
    const [district, subdistrict] = await Promise.all([
      borrower.districtId ? prisma.district.findUnique({ where: { id: borrower.districtId }, select: { nameTh: true } }) : null,
      borrower.subdistrictId ? prisma.subdistrict.findUnique({ where: { id: borrower.subdistrictId }, select: { nameTh: true } }) : null,
    ])
    const code = contractCode(contract.id)
    const guaranteeSignatures = contract.documentSignatures.filter(signature => signature.documentStage === 'GUARANTEE')
    const guarantorContract = document === 'guarantee' ? {
      ...contract,
      guarantorName: contract.guarantorName!,
      guarantorAge: contract.guarantorAge!,
      guarantorHouseNumber: contract.guarantorHouseNumber!,
      guarantorSubdistrict: contract.guarantorSubdistrict!,
      guarantorDistrict: contract.guarantorDistrict!,
      guarantorProvince: contract.guarantorProvince!,
      code,
      lenderAddress: contract.lender.address,
      guarantorSignatureData: guaranteeSignatures.find(signature => signature.signer === 'GUARANTOR')?.signatureData ?? null,
      guarantorSignedAt: guaranteeSignatures.find(signature => signature.signer === 'GUARANTOR')?.signedAt ?? null,
      lenderSignatureData: guaranteeSignatures.find(signature => signature.signer === 'LENDER')?.signatureData ?? null,
      lenderSignedAt: guaranteeSignatures.find(signature => signature.signer === 'LENDER')?.signedAt ?? null,
      witnessCount: contract.guaranteeWitnessCount,
      witnesses: guaranteeSignatures.filter(signature => signature.signer.startsWith('WITNESS_')).map(signature => ({ position: Number(signature.signer.slice(-1)), name: signature.name, signatureData: signature.signatureData, signedAt: signature.signedAt })),
    } : null
    const collateralSignatures = contract.documentSignatures.filter(signature => signature.documentStage === 'COLLATERAL')
    const collateralDetails = (() => { try { return JSON.parse(contract.collateralAgreementData || '{"assetAccount":"BOTH"}') as Record<string, string> } catch { return { assetAccount: 'BOTH' } } })()
    const pdf = document === 'loan'
      ? await createLoanAgreementPdf({ ...contract, code, address: borrower.address, houseNumber: borrower.houseNumber,
        birthDate: borrower.birthDate, borrowerNationalId: borrower.nationalId, lenderNationalId: contract.lender.nationalId, lenderAddress: contract.lender.address, province: borrower.province?.nameTh ?? '', district: district?.nameTh ?? '', subdistrict: subdistrict?.nameTh ?? '' })
      : document === 'guarantee'
        ? await createGuaranteeAgreementPdf(guarantorContract!)
        : await createCollateralAgreementPdf({
            code, createdAt: contract.createdAt, borrowerName: contract.borrowerName, borrowerId: borrower.nationalId,
            borrowerAddress: [borrower.address, borrower.houseNumber, borrower.villageNumber, subdistrict?.nameTh, district?.nameTh, borrower.province?.nameTh].filter(Boolean).join(' '), borrowerPhone: borrower.phone,
            lenderName: contract.lenderName, lenderId: contract.lender.nationalId, lenderAddress: contract.lender.address, lenderPhone: contract.lender.phone,
            guarantorName: contract.guarantorName, guarantorAddress: contract.guarantorName ? [contract.guarantorHouseNumber, contract.guarantorSoi, contract.guarantorRoad, contract.guarantorSubdistrict, contract.guarantorDistrict, contract.guarantorProvince].filter(Boolean).join(' ') : null,
            principalSatang: contract.principalSatang, interestPercent: contract.interestPercent, repaymentDueDate: contract.repaymentDueDate, details: collateralDetails,
            borrowerSignature: { name: contract.borrowerName, signatureData: collateralSignatures.find(signature => signature.signer === 'BORROWER')?.signatureData, signedAt: collateralSignatures.find(signature => signature.signer === 'BORROWER')?.signedAt },
            lenderSignature: { name: contract.lenderName, signatureData: collateralSignatures.find(signature => signature.signer === 'LENDER')?.signatureData, signedAt: collateralSignatures.find(signature => signature.signer === 'LENDER')?.signedAt },
            guarantorSignature: contract.guarantorName ? { name: contract.guarantorName, signatureData: collateralSignatures.find(signature => signature.signer === 'GUARANTOR')?.signatureData, signedAt: collateralSignatures.find(signature => signature.signer === 'GUARANTOR')?.signedAt } : undefined,
            providerSignature: collateralSignatures.find(signature => signature.signer === 'PROVIDER') ? { name: collateralSignatures.find(signature => signature.signer === 'PROVIDER')!.name, signatureData: collateralSignatures.find(signature => signature.signer === 'PROVIDER')!.signatureData, signedAt: collateralSignatures.find(signature => signature.signer === 'PROVIDER')!.signedAt } : undefined,
            custodianSignature: collateralSignatures.find(signature => signature.signer === 'CUSTODIAN') ? { name: collateralSignatures.find(signature => signature.signer === 'CUSTODIAN')!.name, signatureData: collateralSignatures.find(signature => signature.signer === 'CUSTODIAN')!.signatureData, signedAt: collateralSignatures.find(signature => signature.signer === 'CUSTODIAN')!.signedAt } : undefined,
            collateralWitnesses: collateralSignatures.filter(signature => signature.signer.startsWith('WITNESS_')).map(signature => ({ name: signature.name, signatureData: signature.signatureData, signedAt: signature.signedAt })),
          })
    const download = new URL(request.url).searchParams.get('download') === '1'
    return new Response(Buffer.from(pdf), { headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `${download ? 'attachment' : 'inline'}; filename="${code}-${document}.pdf"`,
      'Cache-Control': 'private, no-store',
      'X-Content-Type-Options': 'nosniff',
    } })
  } catch (error) {
    console.error('Loan agreement PDF failed:', error)
    return Response.json({ message: 'สร้างเอกสารไม่สำเร็จ กรุณาลองอีกครั้ง' }, { status: 500 })
  }
}
