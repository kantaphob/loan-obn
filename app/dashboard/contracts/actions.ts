'use server'

import { borrowerPosition } from '@/lib/borrower-position'

import { createHash } from 'node:crypto'
import { randomUUID } from 'node:crypto'
import { revalidatePath } from 'next/cache'
import { getCurrentUser } from '@/lib/auth/current-user'
import { prisma } from '@/lib/prisma'
import { publishCreditBureauChanged } from '@/lib/realtime'
import { collateralAgreementSigners, type ContractDocumentStage, type ContractDocumentSigner } from '@/lib/contracts'
import { parseLegacyLoanCsv, type LegacyLoanRow } from '@/lib/legacy-loans'
import { syncGoogleContract } from '@/lib/google-sync'
import { referralPercentBasisPoints, referralShareFromPrincipalBasisPoints, DEFAULT_REFERRAL_SHARE_PERCENT } from '@/lib/referral-share'

export async function searchContractBorrowers(query: string) {
  const user = await getCurrentUser()
  if (!user || user.status !== 'ACTIVE' || user.role === 'REVIEWER') throw new Error('ไม่มีสิทธิ์สร้างสัญญา')
  const terms = query.trim().slice(0, 100).split(/\s+/).filter(Boolean)
  const borrowers = await prisma.borrower.findMany({
    where: { AND: terms.map(term => ({ OR: [
      { borrowerId: { contains: term } }, { firstName: { contains: term } },
      { lastName: { contains: term } }, { nickname: { contains: term } },
      { phone: { contains: term } }, { nationalId: { contains: term } },
    ] })) },
    select: {
      id: true, borrowerId: true, titleTh: true, firstName: true, middleNameTh: true,
      lastName: true, nickname: true, phone: true, nationalId: true, address: true,
      status: true, approvedLimit: true, usedLimit: true,
      contracts: { select: {
        id: true, status: true, principalSatang: true, repaymentSatang: true, interestSatang: true,
        paidAt: true, legacyReceivedSatang: true, repaymentDueDate: true, penaltyMaxDays: true, limitApprovalRequired: true,
        ledgerEntries: { where: { voidedAt: null }, select: { id: true, kind: true, amountSatang: true, occurredOn: true, penaltyWaivedSatang: true, penaltyAssessed: true, settlementWaivedSatang: true } },
      } },
      bankCode: true, bankAccount: true, bankAccountName: true,
    },
    orderBy: { id: 'desc' }, take: 20,
  })
  return borrowers.map(({ contracts, ...borrower }) => ({ ...borrower, contracts, usedLimit: borrowerPosition(contracts, borrower.usedLimit).committedLimit }))
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

export async function getContractPersuaders() {
  const user = await getCurrentUser()
  if (!user || user.status !== 'ACTIVE' || user.role === 'REVIEWER') throw new Error('ไม่มีสิทธิ์สร้างสัญญา')
  return prisma.persuader.findMany({ where: { isActive: true }, select: { id: true, name: true, phone: true }, orderBy: [{ name: 'asc' }, { id: 'asc' }] })
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
    if (typeof input.principal !== 'string') throw new Error('ข้อมูลยอดเงินไม่ถูกต้อง')
    if ((input.internalRateCode !== undefined && typeof input.internalRateCode !== 'string') || (input.internalCustomRate !== undefined && typeof input.internalCustomRate !== 'string')) throw new Error('อัตราอ้างอิงภายในไม่ถูกต้อง')
    if (input.persuaderId !== undefined && input.persuaderId !== null && (!Number.isSafeInteger(input.persuaderId) || input.persuaderId <= 0)) throw new Error('ผู้แนะนำไม่ถูกต้อง')
    const sharePercentText = input.persuaderSharePercent ?? DEFAULT_REFERRAL_SHARE_PERCENT
    const shareBasisPoints = input.persuaderId ? referralPercentBasisPoints(sharePercentText) : null
    if (!validContractSchedule(input.scheduledDisbursementDate, input.repaymentDueDate)) throw new Error('กรุณาระบุวันที่จ่ายเงินและวันครบกำหนด โดยวันครบกำหนดต้องไม่ก่อนวันที่จ่ายเงิน')
    if (input.collateralDescription !== undefined && (typeof input.collateralDescription !== 'string' || input.collateralDescription.length > 2000)) throw new Error('รายละเอียดหลักประกันต้องไม่เกิน 2,000 ตัวอักษร')
    const needsGuarantor = input.documentChoice === 'CREATE' && input.documentPackage !== 'LOAN'
    let collateralAgreementData: string | null = null
    if (input.collateralAgreementData !== undefined) {
      if (typeof input.collateralAgreementData !== 'string' || input.collateralAgreementData.length > 30000) throw new Error('รายละเอียดสัญญาหลักประกันยาวเกินกำหนด')
      try {
        const parsed = JSON.parse(input.collateralAgreementData) as unknown
        if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed) || Object.entries(parsed).some(([key, value]) => !/^[a-zA-Z]+$/.test(key) || typeof value !== 'string' || value.length > 1000)) throw new Error()
        const collateral = parsed as Record<string, string>
        const assetAccount = collateral.assetAccount
        if (assetAccount !== undefined && !['MORTGAGE', 'PLEDGE', 'BOTH'].includes(assetAccount)) throw new Error()
        if (input.documentChoice === 'CREATE' && input.documentPackage === 'LOAN_GUARANTEE_COLLATERAL') {
          const futureDebtValues = ['futureDebtType', 'futureDebtPurpose', 'futureDebtStart', 'futureDebtEnd']
          const futureDebtSelected = futureDebtValues.some(key => collateral[key]?.trim())
          if (futureDebtSelected && futureDebtValues.some(key => !collateral[key]?.trim())) throw new Error('กรุณากรอกประเภท วัตถุประสงค์ และช่วงเวลาก่อหนี้ในอนาคตให้ครบ')
          if (futureDebtSelected && (!collateral.maximumSecuredAmount?.trim() || !Number.isFinite(Number(collateral.maximumSecuredAmount)) || Number(collateral.maximumSecuredAmount) <= 0)) throw new Error('หนี้ในอนาคตต้องระบุวงเงินสูงสุดที่ประกัน')
          const mortgageSelected = assetAccount === 'MORTGAGE' || assetAccount === 'BOTH' || !assetAccount
          if (mortgageSelected && ['propertyType', 'propertyOwner', 'titleDeedNumber', 'mortgageAmount'].some(key => !collateral[key]?.trim())) throw new Error('บัญชี ก ต้องระบุประเภททรัพย์ เจ้าของกรรมสิทธิ์ เลขเอกสารสิทธิ และจำนวนเงินจำนอง')
          if (mortgageSelected && (!Number.isFinite(Number(collateral.mortgageAmount)) || Number(collateral.mortgageAmount) <= 0)) throw new Error('จำนวนเงินจำนองต้องมากกว่าศูนย์')
          if (needsGuarantor && (!collateral.maximumSecuredAmount?.trim() || !Number.isFinite(Number(collateral.maximumSecuredAmount)) || Number(collateral.maximumSecuredAmount) <= 0)) throw new Error('เมื่อมีผู้ค้ำประกัน กรุณาระบุวงเงินสูงสุดที่ค้ำประกัน')
        }
        collateralAgreementData = JSON.stringify(parsed)
      } catch (error) { if (error instanceof Error && error.message) throw error; throw new Error('ข้อมูลสัญญาหลักประกันไม่ถูกต้อง') }
    }
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
      const borrower = await tx.borrower.findUnique({ where: { id: input.borrowerId }, include: { contracts: { include: { ledgerEntries: { where: { voidedAt: null } } } } } })
      const lender = await tx.lender.findUnique({ where: { id: input.lenderId } })
      const persuader = input.persuaderId ? await tx.persuader.findUnique({ where: { id: input.persuaderId } }) : null
      if (!borrower || ['INACTIVE', 'BLACKLIST'].includes(borrower.status)) throw new Error('ผู้กู้ไม่พร้อมใช้งาน กรุณาเลือกใหม่')
      if (!lender || lender.status !== 'ACTIVE') throw new Error('ผู้ให้กู้ไม่พร้อมใช้งาน กรุณาเลือกใหม่')
      if (input.persuaderId && !persuader?.isActive) throw new Error('ผู้แนะนำไม่พร้อมใช้งาน กรุณาเลือกใหม่')
      if (persuader && !await tx.interestRate.findFirst({ where: { isActive: true, percent: Number(sharePercentText) }, select: { code: true } })) throw new Error('กรุณาเลือกส่วนแบ่งจาก Masterdata ที่ยังใช้งานอยู่')
      const internalRateCode = input.internalRateCode ?? ''
      const internalRate = internalRateCode && internalRateCode !== 'CUSTOM' ? await tx.interestRate.findUnique({ where: { code: internalRateCode } }) : null
      const provinceId = Number(input.guarantorProvinceId), districtId = Number(input.guarantorDistrictId), subdistrictId = Number(input.guarantorSubdistrictId)
      const guarantorSubdistrict = needsGuarantor ? await tx.subdistrict.findFirst({ where: { id: subdistrictId, districtId, district: { provinceId } }, include: { district: true, postcode: true } }) : null
      if (needsGuarantor && !guarantorSubdistrict) throw new Error('กรุณาเลือกจังหวัด อำเภอ และตำบลจาก Masterdata')
      let internalInterestPercent: number | null = null
      if (internalRateCode === 'CUSTOM') {
        if (!/^\d+(?:\.\d{1,2})?$/.test(input.internalCustomRate ?? '') || Number(input.internalCustomRate) > 100) throw new Error('อัตราอ้างอิงภายในต้องอยู่ระหว่าง 0–100%')
        internalInterestPercent = Number(input.internalCustomRate)
      } else if (internalRateCode) {
        if (!internalRate || !internalRate.isActive) throw new Error('อัตราอ้างอิงภายในไม่พร้อมใช้งาน กรุณาเลือกใหม่')
        internalInterestPercent = internalRate.percent
      } else if ((input.internalCustomRate ?? '').trim()) throw new Error('กรุณาเลือกกำหนดเองสำหรับอัตราอ้างอิงภายใน')
      // The internal reference rate computes the system interest for either payment method.
      // The signed contract's stated interest rate remains blank.
      if (!['INTEREST_UPFRONT', 'INTEREST_WITH_PRINCIPAL'].includes(input.interestMethod ?? '')) throw new Error('กรุณาเลือกวิธีจ่ายเงิน')
      const interestMethod = input.interestMethod!
      if (interestMethod === 'INTEREST_UPFRONT' && internalInterestPercent === null) throw new Error('กรุณาเลือกอัตราอ้างอิงภายในเพื่อคำนวณยอดหักดอกก่อนจ่าย')
      const amounts = contractAmounts(input.principal, internalInterestPercent ?? 0, interestMethod)
      const persuaderShareSatang = persuader && shareBasisPoints !== null
        ? referralShareFromPrincipalBasisPoints(amounts.principalSatang, shareBasisPoints)
        : null
      const percent = 0
      const committed = borrowerPosition(borrower.contracts, borrower.usedLimit).committedLimit
      const limitApprovalRequired = Math.round(committed * 100) + amounts.principalSatang > Math.round(borrower.approvedLimit * 100)
      return tx.loanContract.create({ data: {
        requestKey: input.requestKey, borrowerId: borrower.id, lenderId: lender.id,
        persuaderId: persuader?.id ?? null,
        persuaderNameSnapshot: persuader?.name ?? null,
        persuaderShareBase: persuader ? 'PRINCIPAL' : null,
        persuaderShareBasisPoints: shareBasisPoints,
        persuaderShareSatang,
        borrowerCode: borrower.borrowerId || `BR-${borrower.id}`,
        borrowerName: [borrower.titleTh, borrower.firstName, borrower.middleNameTh, borrower.lastName].filter(Boolean).join(' ') || borrower.nickname,
        lenderName: [lender.firstName, lender.lastName].filter(Boolean).join(' ') || lender.nickname,
        documentChoice: input.documentChoice,
        signingMethod: input.documentChoice === 'CREATE' ? input.signingMethod : null,
        witnessCount: input.documentChoice === 'CREATE' ? input.witnessCount ?? 2 : 2,
        guaranteeWitnessCount: input.documentChoice === 'CREATE' && needsGuarantor ? input.guaranteeWitnessCount ?? 2 : 0,
        documentPackage: input.documentChoice === 'CREATE' ? input.documentPackage : null,
        interestMethod, interestRateCode: null,
        interestPercent: percent, internalInterestPercent, ...amounts,
        penaltyMaxDays: 30,
        limitApprovalRequired,
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
    await syncGoogleContract(contract.id)
    publishCreditBureauChanged()
    return { code: contractCode(contract.id), id: contract.id, limitApprovalRequired: contract.limitApprovalRequired }
  } catch (error) {
    console.error('Save contract failed:', error)
    // Validation messages are safe; database details stay on the server.
    return { error: error instanceof Error && !error.name.startsWith('Prisma') ? error.message : 'บันทึกไม่สำเร็จ กรุณาลองอีกครั้ง' }
  }
}

export async function approveContractLimit(contractId: number, reviewToken?: string) {
  const { approvePendingContract } = await import('../invoice/review-actions')
  return approvePendingContract(contractId, reviewToken ?? '')
}

function borrowerDisplayName(borrower: { titleTh?: string; firstName: string; middleNameTh?: string; lastName: string; nickname: string }) {
  return [borrower.titleTh, borrower.firstName, borrower.middleNameTh, borrower.lastName].filter(Boolean).join(' ') || borrower.nickname
}

export async function previewLegacyLoanImport(csvText: string) {
  const user = await getCurrentUser()
  if (!user || user.status !== 'ACTIVE' || user.role === 'REVIEWER') throw new Error('ไม่มีสิทธิ์นำเข้ารายการย้อนหลัง')
  const { records, skipped } = parseLegacyLoanCsv(csvText)
  const [borrowers, lenders] = await Promise.all([
    prisma.borrower.findMany({ where: { status: { notIn: ['INACTIVE', 'BLACKLIST'] } }, select: { id: true, borrowerId: true, titleTh: true, firstName: true, middleNameTh: true, lastName: true, nickname: true, status: true }, orderBy: { id: 'asc' } }),
    prisma.lender.findMany({ where: { status: 'ACTIVE', role: 'FUNDER' }, select: { id: true, titleTh: true, firstName: true, lastName: true, nickname: true }, orderBy: { id: 'asc' } }),
  ])
  const existing = await prisma.loanContract.findMany({ where: { legacySourceCode: { in: records.map(record => record.sourceCode) } }, select: { legacySourceCode: true } })
  const existingCodes = new Set(existing.map(record => record.legacySourceCode))
  return {
    records: records.map(record => {
      const matches = borrowers.filter(borrower => borrower.nickname.trim() === record.borrowerName)
      return { ...record, suggestedBorrowerId: matches.length === 1 ? matches[0].id : null, matchingBorrowerCount: matches.length, alreadyImported: existingCodes.has(record.sourceCode) }
    }),
    skipped,
    borrowers: borrowers.map(borrower => ({ id: borrower.id, code: borrower.borrowerId || `BR-${String(borrower.id).padStart(5, '0')}`, nickname: borrower.nickname, name: borrowerDisplayName(borrower), status: borrower.status })),
    lenders: lenders.map(lender => ({ id: lender.id, name: borrowerDisplayName(lender) })),
  }
}

export async function importLegacyLoanRows(input: { csvText: string; lenderId: number; mappings: { sourceCode: string; borrowerId: number; confirmed: boolean }[] }) {
  try {
    const user = await getCurrentUser()
    if (!user || user.status !== 'ACTIVE' || user.role === 'REVIEWER') throw new Error('ไม่มีสิทธิ์นำเข้ารายการย้อนหลัง')
    if (!input || typeof input.csvText !== 'string' || !Number.isSafeInteger(input.lenderId) || !Array.isArray(input.mappings)) throw new Error('ข้อมูลนำเข้าไม่ถูกต้อง')
    const { records } = parseLegacyLoanCsv(input.csvText)
    if (records.length > 200) throw new Error('นำเข้าได้ไม่เกิน 200 รายการต่อครั้ง')
    if (input.mappings.length !== records.length || input.mappings.some(mapping => !mapping || typeof mapping.sourceCode !== 'string' || !Number.isSafeInteger(mapping.borrowerId) || typeof mapping.confirmed !== 'boolean')) throw new Error('กรุณายืนยันผู้กู้ของทุกรายการก่อนบันทึก')
    const mappingByCode = new Map(input.mappings.map(mapping => [mapping.sourceCode, mapping]))
    if (mappingByCode.size !== records.length || records.some(record => !mappingByCode.has(record.sourceCode))) throw new Error('รายการที่ยืนยันไม่ตรงกับไฟล์ CSV')
    const existing = await prisma.loanContract.findMany({ where: { legacySourceCode: { in: records.map(record => record.sourceCode) } }, select: { legacySourceCode: true } })
    const existingCodes = new Set(existing.map(record => record.legacySourceCode))
    if (records.some(record => !existingCodes.has(record.sourceCode) && mappingByCode.get(record.sourceCode)?.confirmed !== true)) throw new Error('กรุณายืนยันผู้กู้ของทุกรายการก่อนบันทึก')
    const lender = await prisma.lender.findFirst({ where: { id: input.lenderId, status: 'ACTIVE', role: 'FUNDER' } })
    if (!lender) throw new Error('ไม่พบผู้ให้กู้ที่ใช้งานได้')

    const result = await prisma.$transaction(async tx => {
      const imported: { sourceCode: string; id: number }[] = []
      for (const record of records) {
        if (existingCodes.has(record.sourceCode)) continue
        const mapping = mappingByCode.get(record.sourceCode)!
        const borrower = await tx.borrower.findUnique({ where: { id: mapping.borrowerId } })
        if (!borrower || ['INACTIVE', 'BLACKLIST'].includes(borrower.status) || borrower.nickname.trim() !== record.borrowerName) throw new Error(`${record.sourceCode}: ผู้กู้ที่ยืนยันไม่ตรงกับชื่อ “${record.borrowerName}” ในรายการ`)
        if (await tx.loanContract.findUnique({ where: { legacySourceCode: record.sourceCode }, select: { id: true } })) throw new Error(`${record.sourceCode}: เคยนำเข้าแล้ว ระบบยกเลิกการบันทึกชุดนี้เพื่อป้องกันข้อมูลซ้ำ`)
        const contract = await tx.loanContract.create({ data: legacyContractData(record, borrower, lender, user.id) })
        imported.push({ sourceCode: record.sourceCode, id: contract.id })
      }
      return imported
    })
    revalidatePath('/dashboard/contracts')
    revalidatePath('/dashboard/invoice')
    revalidatePath('/dashboard/ap')
    revalidatePath('/dashboard/ledger')
    revalidatePath('/dashboard/repayments')
    await Promise.all(result.map(row => syncGoogleContract(row.id)))
    if (result.length) publishCreditBureauChanged()
    return { success: true as const, imported: result.map(row => ({ sourceCode: row.sourceCode, contractCode: `CT-${String(row.id).padStart(6, '0')}` })) }
  } catch (error) {
    return { error: error instanceof Error && !error.name.startsWith('Prisma') ? error.message : 'นำเข้ารายการไม่สำเร็จ กรุณาตรวจไฟล์แล้วลองใหม่' }
  }
}

function legacyContractData(record: LegacyLoanRow, borrower: { id: number; borrowerId: string | null; titleTh: string; firstName: string; middleNameTh: string; lastName: string; nickname: string }, lender: { id: number; firstName: string; lastName: string; nickname: string }, createdBy: string) {
  return {
    requestKey: randomUUID(), borrowerId: borrower.id, lenderId: lender.id,
    borrowerCode: borrower.borrowerId || `BR-${String(borrower.id).padStart(5, '0')}`,
    borrowerName: borrowerDisplayName(borrower), lenderName: [lender.firstName, lender.lastName].filter(Boolean).join(' ') || lender.nickname,
    documentChoice: 'NONE', signingMethod: null, documentPackage: null,
    witnessCount: 0, guaranteeWitnessCount: 0,
    interestMethod: 'INTEREST_WITH_PRINCIPAL', interestRateCode: null, interestPercent: record.interestPercent,
    principalSatang: record.principalSatang, interestSatang: record.interestSatang,
    netSatang: record.principalSatang, repaymentSatang: record.totalSatang,
    legacySourceCode: record.sourceCode, legacyReceivedSatang: record.receivedSatang,
    legacyDetails: JSON.stringify({ sourceBorrowerId: record.sourceBorrowerId, sourceBorrowerName: record.borrowerName, sourceStatus: record.sourceStatus, overdueDays: record.overdueDays, overdueSatang: record.overdueSatang, overdueWaived: record.overdueWaived, closedAt: record.closedAt, note: record.note, sourceRow: record.sourceRow }),
    status: record.reservation ? 'WAITING_PAYMENT' : record.remainingSatang === 0 ? 'CLOSED' : 'PAID',
    paidAt: record.reservation ? null : new Date(`${record.loanDate}T00:00:00+07:00`),
    createdBy, scheduledDisbursementDate: record.loanDate, repaymentDueDate: record.dueDate,
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
      revisions: { where: { kind: 'REJECTION' }, orderBy: { id: 'desc' }, take: 1, select: { reason: true, createdBy: true, createdAt: true } },
      witnesses: { select: { position: true, name: true, signedAt: true }, orderBy: { position: 'asc' } },
      documentSignatures: { select: { documentStage: true, signer: true, name: true, signedAt: true } },
      ledgerEntries: { where: { kind: 'REPAYMENT', voidedAt: null }, select: { occurredOn: true }, orderBy: { occurredOn: 'desc' }, take: 1 },
    },
    orderBy: { id: 'desc' },
  })
  return rows.map(row => ({
    ...row,
    closedDate: row.status === 'CLOSED'
      ? row.ledgerEntries[0]?.occurredOn ?? (() => {
        try { return (JSON.parse(row.legacyDetails ?? '{}') as { closedAt?: string | null }).closedAt ?? null } catch { return null }
      })()
      : null,
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
    await syncGoogleContract(input.contractId)
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
