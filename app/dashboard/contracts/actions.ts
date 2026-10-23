'use server'

import { createHash } from 'node:crypto'
import { getCurrentUser } from '@/lib/auth/current-user'
import { prisma } from '@/lib/prisma'
import { collateralAgreementSigners, type ContractDocumentStage, type ContractDocumentSigner } from '@/lib/contracts'

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

export async function getContractProvinces() {
  const user = await getCurrentUser()
  if (!user || user.status !== 'ACTIVE' || user.role === 'REVIEWER') throw new Error('ไม่มีสิทธิ์สร้างสัญญา')
  return prisma.province.findMany({ select: { id: true, nameTh: true }, orderBy: { nameTh: 'asc' } })
}
export async function getContractDistricts(provinceId: number) {
  const user = await getCurrentUser()
  if (!user || user.status !== 'ACTIVE' || user.role === 'REVIEWER') throw new Error('ไม่มีสิทธิ์สร้างสัญญา')
  if (!Number.isSafeInteger(provinceId) || provinceId <= 0) return []
  return prisma.district.findMany({ where: { provinceId }, select: { id: true, nameTh: true }, orderBy: { nameTh: 'asc' } })
}
export async function getContractSubdistricts(districtId: number) {
  const user = await getCurrentUser()
  if (!user || user.status !== 'ACTIVE' || user.role === 'REVIEWER') throw new Error('ไม่มีสิทธิ์สร้างสัญญา')
  if (!Number.isSafeInteger(districtId) || districtId <= 0) return []
  return prisma.subdistrict.findMany({ where: { districtId }, select: { id: true, nameTh: true, postcode: { select: { code: true } } }, orderBy: { nameTh: 'asc' } })
}

export async function saveContract(input: import('@/lib/contracts').ContractDraft) {
  const user = await getCurrentUser()
  if (!user || user.status !== 'ACTIVE' || user.role === 'REVIEWER') return { error: 'ไม่มีสิทธิ์สร้างสัญญา' }
  try {
    const { contractAmounts, contractCode, validContractSchedule } = await import('@/lib/contracts')
    if (!input || !Number.isSafeInteger(input.borrowerId) || !Number.isSafeInteger(input.lenderId) || typeof input.requestKey !== 'string' || !/^[a-f0-9-]{36}$/i.test(input.requestKey)) throw new Error('ข้อมูลผู้กู้หรือผู้ให้กู้ไม่ถูกต้อง')
    if (!['CREATE', 'NONE'].includes(input.documentChoice)) throw new Error('กรุณาเลือกการจัดทำเอกสาร')
    if (input.documentChoice === 'CREATE' && (!['PRINT', 'E_SIGNATURE'].includes(input.signingMethod) || !['LOAN', 'LOAN_GUARANTEE', 'LOAN_GUARANTEE_COLLATERAL'].includes(input.documentPackage))) throw new Error('กรุณาเลือกวิธีลงนามและชุดเอกสาร')
    if (input.witnessCount !== undefined && ![0, 1, 2].includes(input.witnessCount)) throw new Error('จำนวนพยานไม่ถูกต้อง')
    if (input.guaranteeWitnessCount !== undefined && ![0, 1, 2].includes(input.guaranteeWitnessCount)) throw new Error('จำนวนพยานในสัญญาค้ำประกันไม่ถูกต้อง')
    if (typeof input.principal !== 'string' || typeof input.customRate !== 'string' || typeof input.rateCode !== 'string') throw new Error('ข้อมูลยอดเงินไม่ถูกต้อง')
    if (!validContractSchedule(input.scheduledDisbursementDate, input.repaymentDueDate)) throw new Error('กรุณาระบุวันที่จ่ายเงินและวันครบกำหนด โดยวันครบกำหนดต้องไม่ก่อนวันที่จ่ายเงิน')
    if (input.collateralDescription !== undefined && (typeof input.collateralDescription !== 'string' || input.collateralDescription.length > 2000)) throw new Error('รายละเอียดหลักประกันต้องไม่เกิน 2,000 ตัวอักษร')
    let collateralAgreementData: string | null = null
    if (input.collateralAgreementData !== undefined) {
      if (typeof input.collateralAgreementData !== 'string' || input.collateralAgreementData.length > 30000) throw new Error('รายละเอียดสัญญาหลักประกันยาวเกินกำหนด')
      try {
        const parsed = JSON.parse(input.collateralAgreementData) as unknown
        if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed) || Object.entries(parsed).some(([key, value]) => !/^[a-zA-Z]+$/.test(key) || typeof value !== 'string' || value.length > 1000)) throw new Error()
        const assetAccount = (parsed as Record<string, string>).assetAccount
        if (assetAccount !== undefined && !['MORTGAGE', 'PLEDGE', 'BOTH'].includes(assetAccount)) throw new Error()
        collateralAgreementData = JSON.stringify(parsed)
      } catch { throw new Error('ข้อมูลสัญญาหลักประกันไม่ถูกต้อง') }
    }
    const needsGuarantor = input.documentChoice === 'CREATE' && input.documentPackage !== 'LOAN'
    if (needsGuarantor) {
      if (!input.guarantorName?.trim() || input.guarantorName.trim().length > 150 || !/^\d{1,3}$/.test(input.guarantorAge ?? '') || Number(input.guarantorAge) < 15 || Number(input.guarantorAge) > 120 || !input.guarantorHouseNumber?.trim() || !input.guarantorProvinceId || !input.guarantorDistrictId || !input.guarantorSubdistrictId) throw new Error('กรุณากรอกชื่อ อายุ และที่อยู่ผู้ค้ำประกันให้ครบ')
      if ([input.guarantorHouseNumber, input.guarantorSoi, input.guarantorRoad, input.guaranteeCollateralDescription].some(value => (value?.length ?? 0) > 500)) throw new Error('ข้อมูลผู้ค้ำประกันหรือทรัพย์ประกันยาวเกินกำหนด')
    }
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
      const provinceId = Number(input.guarantorProvinceId), districtId = Number(input.guarantorDistrictId), subdistrictId = Number(input.guarantorSubdistrictId)
      const guarantorSubdistrict = needsGuarantor ? await tx.subdistrict.findFirst({ where: { id: subdistrictId, districtId, district: { provinceId } }, include: { district: true, postcode: true } }) : null
      if (needsGuarantor && !guarantorSubdistrict) throw new Error('กรุณาเลือกจังหวัด อำเภอ และตำบลจาก Masterdata')
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
        witnessCount: input.documentChoice === 'CREATE' ? input.witnessCount ?? 2 : 2,
        guaranteeWitnessCount: input.documentChoice === 'CREATE' && needsGuarantor ? input.guaranteeWitnessCount ?? 2 : 0,
        documentPackage: input.documentChoice === 'CREATE' ? input.documentPackage : null,
        interestMethod: input.interestMethod, interestRateCode: rate?.code ?? null,
        interestPercent: percent, ...contractAmounts(input.principal, percent, input.interestMethod),
        collateralDescription: input.collateralDescription?.trim() || null,
        collateralAgreementData: input.documentChoice === 'CREATE' && input.documentPackage === 'LOAN_GUARANTEE_COLLATERAL' ? collateralAgreementData : null,
        guarantorName: needsGuarantor ? input.guarantorName!.trim() : null,
        guarantorAge: needsGuarantor ? Number(input.guarantorAge) : null,
        guarantorHouseNumber: needsGuarantor ? input.guarantorHouseNumber!.trim() : null,
        guarantorSoi: needsGuarantor ? input.guarantorSoi?.trim() || null : null,
        guarantorRoad: needsGuarantor ? input.guarantorRoad?.trim() || null : null,
        guarantorSubdistrict: guarantorSubdistrict?.nameTh ?? null,
        guarantorDistrict: guarantorSubdistrict?.district.nameTh ?? null,
        guarantorProvince: needsGuarantor ? (await tx.province.findUniqueOrThrow({ where: { id: provinceId }, select: { nameTh: true } })).nameTh : null,
        guarantorProvinceId: needsGuarantor ? provinceId : null,
        guarantorDistrictId: needsGuarantor ? districtId : null,
        guarantorSubdistrictId: needsGuarantor ? subdistrictId : null,
        guarantorPostcode: guarantorSubdistrict?.postcode?.code ?? null,
        guaranteeCollateralDescription: needsGuarantor ? input.guaranteeCollateralDescription?.trim() || null : null,
        createdBy: user.id, scheduledDisbursementDate: input.scheduledDisbursementDate, repaymentDueDate: input.repaymentDueDate,
      } })
    })
    return { code: contractCode(contract.id), id: contract.id }
  } catch (error) {
    console.error('Save contract failed:', error)
    // Validation messages are safe; database details stay on the server.
    return { error: error instanceof Error && !error.name.startsWith('Prisma') ? error.message : 'บันทึกไม่สำเร็จ กรุณาลองอีกครั้ง' }
  }
}

export async function listContracts() {
  const user = await getCurrentUser()
  if (!user || user.status !== 'ACTIVE') throw new Error('ไม่มีสิทธิ์ดูสัญญา')
  const rows = await prisma.loanContract.findMany({
    omit: {
      borrowerSignatureData: true, borrowerCapturedBy: true,
      borrowerConsentAt: true,
      lenderSignatureData: true, lenderCapturedBy: true, signatureTermsHash: true,
      lenderConsentAt: true,
      guarantorSignatureData: true, guarantorCapturedBy: true, guarantorConsentAt: true,
    },
    include: {
      witnesses: { select: { position: true, name: true, signedAt: true }, orderBy: { position: 'asc' } },
      documentSignatures: { select: { documentStage: true, signer: true, name: true, signedAt: true } },
    },
    orderBy: { id: 'desc' },
  })
  return rows.map(row => ({
    ...row,
    witnesses: row.witnesses.map(witness => ({ ...witness, signedAt: witness.signedAt.toISOString() })),
    documentSignatures: row.documentSignatures.map(signature => ({ ...signature, signedAt: signature.signedAt.toISOString() })),
    createdAt: row.createdAt.toISOString(),
    paidAt: row.paidAt?.toISOString() ?? null,
    borrowerSignedAt: row.borrowerSignedAt?.toISOString() ?? null,
    lenderSignedAt: row.lenderSignedAt?.toISOString() ?? null,
    guarantorSignedAt: row.guarantorSignedAt?.toISOString() ?? null,
  }))
}

type ContractSigner = ContractDocumentSigner

function termsHash(contract: {
  id: number; borrowerCode: string; borrowerName: string; lenderName: string
  documentChoice: string; signingMethod: string | null; documentPackage: string | null
  interestMethod: string; interestRateCode: string | null; interestPercent: number; createdAt: Date; witnessCount: number; guaranteeWitnessCount: number; scheduledDisbursementDate: string | null; repaymentDueDate: string | null; collateralDescription: string | null; collateralAgreementData: string | null
  guarantorName: string | null; guarantorAge: number | null; guarantorHouseNumber: string | null; guarantorSoi: string | null; guarantorRoad: string | null; guarantorSubdistrict: string | null; guarantorDistrict: string | null; guarantorProvince: string | null; guarantorPostcode: string | null; guaranteeCollateralDescription: string | null
  principalSatang: number; interestSatang: number; netSatang: number; repaymentSatang: number
}) {
  const terms = [contract.id, contract.createdAt.toISOString(), contract.borrowerCode, contract.borrowerName, contract.lenderName,
    contract.documentChoice, contract.signingMethod, contract.documentPackage, contract.interestMethod, contract.interestRateCode, contract.interestPercent,
    contract.principalSatang, contract.interestSatang, contract.netSatang, contract.repaymentSatang]
  if (contract.collateralDescription) terms.push(`collateral:${contract.collateralDescription}`)
  if (contract.collateralAgreementData) terms.push(`collateralAgreement:${contract.collateralAgreementData}`)
  for (const field of ['guarantorName', 'guarantorAge', 'guarantorHouseNumber', 'guarantorSoi', 'guarantorRoad', 'guarantorSubdistrict', 'guarantorDistrict', 'guarantorProvince', 'guarantorPostcode', 'guaranteeCollateralDescription'] as const) if (contract[field] !== null) terms.push(`${field}:${contract[field]}`)
  if (contract.scheduledDisbursementDate || contract.repaymentDueDate) terms.push(`schedule:${contract.scheduledDisbursementDate}:${contract.repaymentDueDate}`)
  if (contract.witnessCount !== 2) terms.push(`witnesses:${contract.witnessCount}`)
  if (contract.guaranteeWitnessCount !== 2) terms.push(`guaranteeWitnesses:${contract.guaranteeWitnessCount}`)
  return createHash('sha256').update(JSON.stringify(terms)).digest('hex')
}

export async function signContract(input: {
  contractId: number
  signer: ContractSigner
  documentStage?: ContractDocumentStage
  signatureData: string
  witnessName?: string
  signerName?: string
  accepted: boolean
}) {
  const user = await getCurrentUser()
  if (!user || user.status !== 'ACTIVE' || user.role === 'REVIEWER') return { error: 'ไม่มีสิทธิ์ลงนามสัญญา' }
  if (!Number.isSafeInteger(input?.contractId) || input.contractId <= 0) return { error: 'เลขสัญญาไม่ถูกต้อง' }
  if (!['BORROWER', 'LENDER', 'GUARANTOR', 'PROVIDER', 'CUSTODIAN', 'WITNESS_1', 'WITNESS_2'].includes(input.signer)) return { error: 'ผู้ลงนามไม่ถูกต้อง' }
  if (input.accepted !== true) return { error: 'กรุณายืนยันว่าตรวจสอบรายละเอียดและยินยอมลงนาม' }
  if (typeof input.signatureData !== 'string' || input.signatureData.length > 512_000 || !/^data:image\/png;base64,[A-Za-z0-9+/]+={0,2}$/.test(input.signatureData)) return { error: 'ข้อมูลลายมือชื่อไม่ถูกต้อง กรุณาเซ็นใหม่' }
  const signatureBytes = Buffer.from(input.signatureData.slice('data:image/png;base64,'.length), 'base64')
  if (!signatureBytes.length || signatureBytes.length > 384_000 || !signatureDataIsPng(signatureBytes)) return { error: 'ข้อมูลลายมือชื่อไม่ถูกต้อง กรุณาเซ็นใหม่' }

  try {
    const result = await prisma.$transaction(async tx => {
      const contract = await tx.loanContract.findUnique({ where: { id: input.contractId } })
      if (!contract) throw new Error('ไม่พบสัญญา')
      if (contract.documentChoice !== 'CREATE' || contract.signingMethod !== 'E_SIGNATURE') throw new Error('สัญญานี้ไม่ได้เลือกลงนามแบบ e-signature')
      if (input.signer === 'GUARANTOR' && (!contract.documentPackage || contract.documentPackage === 'LOAN' || !contract.guarantorName)) throw new Error('สัญญานี้ไม่มีผู้ค้ำประกัน')
      const documentStage = input.documentStage ?? 'LOAN'
      if (documentStage === 'COLLATERAL') {
        if (contract.documentPackage !== 'LOAN_GUARANTEE_COLLATERAL') throw new Error('สัญญานี้ไม่มีเอกสารหลักประกัน 3.3')
        const expectedSigner = collateralAgreementSigners(contract).find(item => item.signer === input.signer)
        if (!expectedSigner) throw new Error('ผู้ลงนามนี้ไม่มีในเอกสารหลักประกัน 3.3')
        const witness = input.signer.startsWith('WITNESS_')
        const witnessName = input.witnessName?.trim()
        if (witness && (!witnessName || witnessName.length > 150 || /[\r\n]/.test(witnessName))) throw new Error('กรุณาระบุชื่อ-นามสกุลพยานไม่เกิน 150 ตัวอักษร')
        const previousSignature = await tx.contractDocumentSignature.findUnique({ where: { contractId_documentStage_signer: { contractId: contract.id, documentStage, signer: input.signer } } })
        if (previousSignature) throw new Error('ผู้ลงนามรายนี้ลงนามในสัญญาหลักประกันแล้ว')
        const digest = termsHash(contract)
        if (contract.signatureTermsHash && contract.signatureTermsHash !== digest) throw new Error('รายละเอียดสัญญาเปลี่ยนแปลงหลังการลงนาม กรุณาตรวจสอบ')
        const signedAt = new Date()
        await tx.contractDocumentSignature.create({ data: { contractId: contract.id, documentStage, signer: input.signer, name: witness ? witnessName! : expectedSigner.name, signatureData: input.signatureData, signedAt, consentAt: signedAt, capturedBy: user.id } })
        await tx.loanContract.update({ where: { id: contract.id }, data: { signatureTermsHash: digest } })
        return { signer: input.signer, documentStage, signedAt: signedAt.toISOString() }
      }
      if (documentStage === 'GUARANTEE') {
        if (!contract.documentPackage || contract.documentPackage === 'LOAN' || !contract.guarantorName) throw new Error('สัญญานี้ไม่มีเอกสารค้ำประกัน')
        if (!['LENDER', 'GUARANTOR', 'WITNESS_1', 'WITNESS_2'].includes(input.signer)) throw new Error('ผู้ลงนามไม่ถูกต้องสำหรับสัญญาค้ำประกัน')
        const witness = input.signer.startsWith('WITNESS_')
        const position = input.signer === 'WITNESS_1' ? 1 : input.signer === 'WITNESS_2' ? 2 : 0
        if (witness && position > contract.guaranteeWitnessCount) throw new Error('สัญญาค้ำประกันนี้ไม่มีพยานตำแหน่งนี้')
        const witnessName = input.witnessName?.trim()
        if (witness && (!witnessName || witnessName.length > 150 || /[\r\n]/.test(witnessName))) throw new Error('กรุณาระบุชื่อ-นามสกุลพยานไม่เกิน 150 ตัวอักษร')
        const previousSignature = await tx.contractDocumentSignature.findUnique({ where: { contractId_documentStage_signer: { contractId: contract.id, documentStage, signer: input.signer } } })
        if (previousSignature) throw new Error('ผู้ลงนามรายนี้ลงนามในสัญญาค้ำแล้ว')
        const digest = termsHash(contract)
        if (contract.signatureTermsHash && contract.signatureTermsHash !== digest) throw new Error('รายละเอียดสัญญาเปลี่ยนแปลงหลังการลงนาม กรุณาตรวจสอบ')
        const signedAt = new Date()
        const name = witness ? witnessName! : input.signer === 'GUARANTOR' ? contract.guarantorName : contract.lenderName
        await tx.contractDocumentSignature.create({ data: { contractId: contract.id, documentStage, signer: input.signer, name, signatureData: input.signatureData, signedAt, consentAt: signedAt, capturedBy: user.id } })
        await tx.loanContract.update({ where: { id: contract.id }, data: { signatureTermsHash: digest } })
        return { signer: input.signer, documentStage, signedAt: signedAt.toISOString() }
      }
      if (documentStage !== 'LOAN') throw new Error('ขั้นเอกสารไม่ถูกต้อง')
      if (!['BORROWER', 'LENDER', 'GUARANTOR', 'WITNESS_1', 'WITNESS_2'].includes(input.signer)) throw new Error('ผู้ลงนามไม่ถูกต้องสำหรับสัญญาเงินกู้')
      if (input.signer.startsWith('WITNESS_')) {
        const position = input.signer === 'WITNESS_1' ? 1 : 2
        if (position > contract.witnessCount) throw new Error('สัญญานี้ไม่มีพยานตำแหน่งนี้')
        const name = input.witnessName?.trim()
        if (!name || name.length > 150 || /[\r\n]/.test(name)) throw new Error('กรุณาระบุชื่อ-นามสกุลพยานไม่เกิน 150 ตัวอักษร')
        if (await tx.contractWitness.findUnique({ where: { contractId_position: { contractId: contract.id, position } } })) throw new Error('พยานคนนี้ลงนามแล้ว')
        const digest = termsHash(contract)
        if (contract.signatureTermsHash && contract.signatureTermsHash !== digest) throw new Error('รายละเอียดสัญญาเปลี่ยนแปลงหลังการลงนาม')
        const signedAt = new Date()
        await tx.contractWitness.create({ data: { contractId: contract.id, position, name, signatureData: input.signatureData, signedAt, consentAt: signedAt, capturedBy: user.id } })
        await tx.loanContract.update({ where: { id: contract.id }, data: { signatureTermsHash: digest } })
        return { signer: input.signer, signedAt: signedAt.toISOString() }
      }
      const prefix = input.signer === 'BORROWER' ? 'borrower' : input.signer === 'LENDER' ? 'lender' : 'guarantor'
      const signatureField = `${prefix}SignatureData` as 'borrowerSignatureData' | 'lenderSignatureData' | 'guarantorSignatureData'
      const dateField = `${prefix}SignedAt` as 'borrowerSignedAt' | 'lenderSignedAt' | 'guarantorSignedAt'
      const consentField = `${prefix}ConsentAt` as 'borrowerConsentAt' | 'lenderConsentAt' | 'guarantorConsentAt'
      const capturedByField = `${prefix}CapturedBy` as 'borrowerCapturedBy' | 'lenderCapturedBy' | 'guarantorCapturedBy'
      if (contract[signatureField]) throw new Error('ผู้ลงนามรายนี้ลงนามแล้ว')
      const digest = termsHash(contract)
      if (contract.signatureTermsHash && contract.signatureTermsHash !== digest) throw new Error('รายละเอียดสัญญาเปลี่ยนแปลงหลังการลงนาม กรุณาตรวจสอบ')
      const signedAt = new Date()
      await tx.loanContract.update({
        where: { id: contract.id },
        data: {
          [signatureField]: input.signatureData,
          [dateField]: signedAt,
          [consentField]: signedAt,
          [capturedByField]: user.id,
          signatureTermsHash: digest,
        },
      })
      return { signer: input.signer, signedAt: signedAt.toISOString() }
    })
    return { success: result }
  } catch (error) {
    console.error('Contract e-signature capture failed:', error instanceof Error ? error.message : 'Unknown error')
    return { error: error instanceof Error && !error.name.startsWith('Prisma') ? error.message : 'บันทึกลายมือชื่อไม่สำเร็จ กรุณาลองใหม่' }
  }
}

export async function getContractSignatureRecords(contractId: number) {
  const user = await getCurrentUser()
  if (!user || user.status !== 'ACTIVE') throw new Error('กรุณาเข้าสู่ระบบ')
  if (!Number.isSafeInteger(contractId) || contractId <= 0) throw new Error('เลขสัญญาไม่ถูกต้อง')
  const contract = await prisma.loanContract.findUnique({
    where: { id: contractId },
    select: {
      signingMethod: true, witnesses: { orderBy: { position: 'asc' } },
      borrowerSignatureData: true, borrowerSignedAt: true, borrowerCapturedBy: true,
      borrowerConsentAt: true,
      lenderSignatureData: true, lenderSignedAt: true, lenderCapturedBy: true,
      lenderConsentAt: true,
      guarantorSignatureData: true, guarantorSignedAt: true, guarantorCapturedBy: true,
      guarantorConsentAt: true,
      signatureTermsHash: true,
      documentSignatures: { select: { documentStage: true, signer: true, name: true, signatureData: true, signedAt: true, consentAt: true, capturedBy: true }, orderBy: { signer: 'asc' } },
    },
  })
  if (!contract) throw new Error('ไม่พบสัญญา')
  if (contract.signingMethod !== 'E_SIGNATURE') return null
  return {
    borrower: {
      image: contract.borrowerSignatureData,
      signedAt: contract.borrowerSignedAt?.toISOString() ?? null,
      consentAt: contract.borrowerConsentAt?.toISOString() ?? null,
      capturedBy: contract.borrowerCapturedBy,
    },
    lender: {
      image: contract.lenderSignatureData,
      signedAt: contract.lenderSignedAt?.toISOString() ?? null,
      consentAt: contract.lenderConsentAt?.toISOString() ?? null,
      capturedBy: contract.lenderCapturedBy,
    },
    guarantor: {
      image: contract.guarantorSignatureData,
      signedAt: contract.guarantorSignedAt?.toISOString() ?? null,
      consentAt: contract.guarantorConsentAt?.toISOString() ?? null,
      capturedBy: contract.guarantorCapturedBy,
    },
    witnesses: contract.witnesses.map(witness => ({ name: witness.name, position: witness.position, image: witness.signatureData, signedAt: witness.signedAt.toISOString(), consentAt: witness.consentAt.toISOString(), capturedBy: witness.capturedBy })),
    documentSignatures: contract.documentSignatures.map(signature => ({ ...signature, signedAt: signature.signedAt.toISOString(), consentAt: signature.consentAt.toISOString() })),
    termsHash: contract.signatureTermsHash,
  }
}

function signatureDataIsPng(data: Buffer) {
  return data.length >= 8 && data.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
}
