import assert from 'node:assert/strict'
import { after, test } from 'node:test'
import { randomUUID } from 'node:crypto'
import { prisma } from '../lib/prisma'
import { collateralAgreementSigners, contractAmounts, contractSignaturesComplete, type ContractDraft } from '../lib/contracts'
import { saveContract, listContracts } from '../app/dashboard/contracts/actions'

if (!process.env.DATABASE_URL?.includes('loan-contract-test-')) throw new Error('Tests require an isolated loan-contract-test database')
after(() => prisma.$disconnect())

test('interest timing and rounding', () => {
  assert.deepEqual(contractAmounts('5000', 20, 'INTEREST_UPFRONT'), { principalSatang: 500000, interestSatang: 100000, netSatang: 400000, repaymentSatang: 500000 })
  assert.equal(contractAmounts('5000', 20, 'INTEREST_WITH_PRINCIPAL').repaymentSatang, 600000)
  assert.equal(contractAmounts('100.01', 7.5, 'INTEREST_UPFRONT').interestSatang, 750)
  assert.equal(contractAmounts('5000', 0, 'INTEREST_WITH_PRINCIPAL').repaymentSatang, 500000)
  assert.throws(() => contractAmounts('-10', 20, 'INTEREST_UPFRONT'))
  assert.throws(() => contractAmounts('100.001', 20, 'INTEREST_UPFRONT'))
  assert.throws(() => contractAmounts('100', Number.NaN, 'INTEREST_UPFRONT'))
})

test('collateral signers cover selected annex roles and deduplicate people', () => {
  const signers = collateralAgreementSigners({
    borrowerName: 'ผู้กู้ ตัวอย่าง', lenderName: 'ผู้ให้กู้ ตัวอย่าง', guarantorName: 'ผู้ค้ำ ตัวอย่าง', witnessCount: 0,
    collateralAgreementData: JSON.stringify({ assetAccount: 'BOTH', providerRole: 'บุคคลภายนอก', providerName: 'ผู้ค้ำ ตัวอย่าง', custodianRole: 'บุคคลภายนอกที่คู่สัญญาตกลงร่วมกัน', custodianName: 'ผู้เก็บรักษา ตัวอย่าง', collateralWitnessCount: '1' }),
  })
  assert.deepEqual(signers.map(person => person.signer), ['BORROWER', 'LENDER', 'GUARANTOR', 'CUSTODIAN', 'WITNESS_1'])
  assert.match(signers.find(person => person.signer === 'GUARANTOR')!.label, /ผู้จำนอง · บัญชี ก.*ผู้จำนำ · บัญชี ข/)
  assert.match(signers.find(person => person.signer === 'CUSTODIAN')!.label, /ผู้รับมอบ\/ผู้เก็บรักษาทรัพย์ · บัญชี ข/)
  assert.match(signers.find(person => person.signer === 'WITNESS_1')!.label, /ข้อ 9 \/ บัญชี ข/)
})

test('save, retry, validation and persisted listing', async () => {
  await prisma.user.create({ data: { acccode: 'test-admin', password: 'test-only', role: 'ADMIN', level: 0 } })
  const borrower = await prisma.borrower.create({ data: { nickname: 'Test', firstName: 'Test', lastName: 'Borrower', phone: '', status: 'WAITING_PAYMENT', borrowerId: 'BR-TEST' } })
  const lender = await prisma.lender.create({ data: { nickname: 'Test lender', firstName: 'Test', lastName: 'Lender' } })
  await prisma.province.create({ data: { id: 1, nameTh: 'จังหวัดทดสอบ', nameEn: 'Test Province' } })
  await prisma.district.create({ data: { id: 1, provinceId: 1, nameTh: 'อำเภอทดสอบ', nameEn: 'Test District' } })
  await prisma.postcode.create({ data: { code: '10000' } })
  await prisma.subdistrict.create({ data: { id: 1, districtId: 1, nameTh: 'ตำบลทดสอบ', postcodeCode: '10000' } })
  await prisma.interestRate.create({ data: { code: 'TEST20', percent: 20 } })
  const draft: ContractDraft = { borrowerId: borrower.id, lenderId: lender.id, requestKey: randomUUID(), documentChoice: 'NONE', signingMethod: 'PRINT', documentPackage: 'LOAN', interestMethod: 'INTEREST_UPFRONT', rateCode: 'TEST20', customRate: '', principal: '5000', scheduledDisbursementDate: '2026-10-23', repaymentDueDate: '2026-11-23' }
  const result = await saveContract(draft)
  assert.equal(result.code, 'CT-000001')
  assert.deepEqual(await saveContract(draft), result)
  assert.equal(await prisma.loanContract.count(), 1)
  const [saved] = await listContracts()
  assert.equal(saved.status, 'WAITING_PAYMENT')
  assert.equal(saved.netSatang, 400000)
  assert.equal(saved.repaymentSatang, 500000)
  assert.equal(saved.signingMethod, null)
  assert.equal(saved.paidAt, null)
  assert.equal((await prisma.borrower.findUniqueOrThrow({ where: { id: borrower.id } })).usedLimit, 0)
  const custom = await saveContract({ ...draft, requestKey: randomUUID(), rateCode: 'CUSTOM', customRate: '7.5', interestMethod: 'INTEREST_WITH_PRINCIPAL', documentChoice: 'CREATE', signingMethod: 'E_SIGNATURE', documentPackage: 'LOAN_GUARANTEE', guarantorName: 'นาง ทดสอบ ระบบ', guarantorAge: '35', guarantorHouseNumber: '1', guarantorProvinceId: '1', guarantorDistrictId: '1', guarantorSubdistrictId: '1' })
  assert.ok(custom.code)
  assert.equal((await prisma.loanContract.findFirstOrThrow({ orderBy: { id: 'desc' } })).repaymentSatang, 537500)
  assert.ok((await saveContract({ ...draft, requestKey: randomUUID(), documentChoice: 'CREATE', signingMethod: '' })).error)
  await prisma.interestRate.update({ where: { code: 'TEST20' }, data: { isActive: false } })
  assert.ok((await saveContract({ ...draft, requestKey: randomUUID() })).error)
  assert.equal(await prisma.loanContract.count(), 2)
})

test('filled contract document endpoint returns a private PDF and rejects invalid documents', async () => {
  const { GET } = await import('../app/api/contracts/[id]/document/route')
  const { PDFDocument } = await import('pdf-lib')
  const contract = await prisma.loanContract.findFirstOrThrow({ where: { documentChoice: 'CREATE' } })
  await prisma.loanContract.update({ where: { id: contract.id }, data: { signingMethod: 'PRINT' } })
  const response = await GET(new Request(`http://localhost/api/contracts/${contract.id}/document`), { params: Promise.resolve({ id: String(contract.id) }) })
  assert.equal(response.status, 200)
  assert.equal(response.headers.get('content-type'), 'application/pdf')
  assert.equal(response.headers.get('cache-control'), 'private, no-store')
  const pdf = await PDFDocument.load(await response.arrayBuffer())
  assert.ok(pdf.getPageCount() >= 1)
  assert.equal(pdf.getTitle(), `สัญญากู้ยืมเงิน CT-${String(contract.id).padStart(6, '0')}`)
  const withoutDocument = await prisma.loanContract.findFirstOrThrow({ where: { documentChoice: 'NONE' } })
  assert.equal((await GET(new Request('http://localhost/'), { params: Promise.resolve({ id: String(withoutDocument.id) }) })).status, 400)
  assert.equal((await GET(new Request('http://localhost/'), { params: Promise.resolve({ id: 'invalid' }) })).status, 400)
  assert.equal((await GET(new Request('http://localhost/'), { params: Promise.resolve({ id: '999999' }) })).status, 404)
})

test('on-screen signatures are persisted and embedded in the downloadable PDF', async () => {
  const { signContract } = await import('../app/dashboard/contracts/actions')
  const { GET } = await import('../app/api/contracts/[id]/document/route')
  const { PDFDocument, PDFName, PDFDict, PDFRawStream } = await import('pdf-lib')
  const sharp = (await import('sharp')).default
  const png = await sharp(Buffer.from('<svg width="300" height="70" xmlns="http://www.w3.org/2000/svg"><path d="M10 45 Q50 0 70 40 T130 25 Q160 10 180 40 L260 20" stroke="#123b35" stroke-width="3" fill="none"/></svg>')).png().toBuffer()
  const contract = await prisma.loanContract.findFirstOrThrow({ where: { documentChoice: 'CREATE' } })
  await prisma.loanContract.update({ where: { id: contract.id }, data: { signingMethod: 'E_SIGNATURE', witnessCount: 0, guaranteeWitnessCount: 1 } })
  const context = { params: Promise.resolve({ id: String(contract.id) }) }
  const request = () => new Request(`http://localhost/api/contracts/${contract.id}/document?download=1`)
  assert.equal((await GET(request(), context)).status, 409)
  const signatureData = 'data:image/png;base64,' + png.toString('base64')
  assert.ok((await signContract({ contractId: contract.id, signer: 'BORROWER', signatureData, accepted: false })).error)
  assert.ok((await signContract({ contractId: contract.id, signer: 'BORROWER', signatureData, accepted: true })).success)
  assert.equal((await GET(request(), context)).status, 409)
  assert.ok((await signContract({ contractId: contract.id, signer: 'BORROWER', signatureData, accepted: true })).error)
  assert.ok((await signContract({ contractId: contract.id, signer: 'LENDER', signatureData, accepted: true })).success)
  assert.ok((await signContract({ contractId: contract.id, signer: 'GUARANTOR', signatureData, accepted: true })).success)
  const guaranteeRequest = () => new Request(`http://localhost/api/contracts/${contract.id}/document?document=guarantee&download=1`)
  assert.equal((await GET(guaranteeRequest(), context)).status, 409, 'loan signatures must not satisfy the separate guarantee document')
  const response = await GET(request(), context)
  assert.equal(response.status, 200)
  assert.match(response.headers.get('content-disposition') ?? '', /^attachment;/)
  const pdf = await PDFDocument.load(await response.arrayBuffer())
  let images = 0
  for (const page of pdf.getPages()) {
    const objects = page.node.Resources()?.lookup(PDFName.of('XObject'), PDFDict)
    for (const [, ref] of objects?.entries() ?? []) {
      const object = pdf.context.lookup(ref)
      if (object instanceof PDFRawStream && object.dict.get(PDFName.of('Subtype')) === PDFName.of('Image')) images++
    }
  }
  assert.equal(images, 2)

  for (const signer of ['LENDER', 'GUARANTOR'] as const) {
    assert.ok((await signContract({ contractId: contract.id, documentStage: 'GUARANTEE', signer, signatureData, accepted: true })).success)
  }
  assert.equal((await GET(guaranteeRequest(), context)).status, 409, 'the guarantee-specific witness must sign when selected')
  assert.ok((await signContract({ contractId: contract.id, documentStage: 'GUARANTEE', signer: 'WITNESS_1', witnessName: 'พยานของสัญญาค้ำ', signatureData, accepted: true })).success)
  const guaranteeResponse = await GET(guaranteeRequest(), context)
  assert.equal(guaranteeResponse.status, 200)
  const guaranteePdf = await PDFDocument.load(await guaranteeResponse.arrayBuffer())
  let guaranteeImages = 0
  for (const page of guaranteePdf.getPages()) {
    const objects = page.node.Resources()?.lookup(PDFName.of('XObject'), PDFDict)
    for (const [, ref] of objects?.entries() ?? []) {
      const object = guaranteePdf.context.lookup(ref)
      if (object instanceof PDFRawStream && object.dict.get(PDFName.of('Subtype')) === PDFName.of('Image')) guaranteeImages++
    }
  }
  assert.equal(guaranteeImages, 3)
  const signatureRecords = await (await import('../app/dashboard/contracts/actions')).getContractSignatureRecords(contract.id)
  assert.equal(signatureRecords?.documentSignatures.filter(signature => signature.documentStage === 'GUARANTEE').length, 3)
})

test('witness choices persist for each document package and invalid counts are rejected', async () => {
  const contract = await prisma.loanContract.findFirstOrThrow()
  for (const documentPackage of ['LOAN', 'LOAN_GUARANTEE'] as const) {
    for (const witnessCount of [0, 1, 2]) {
      const guaranteeWitnessCount = witnessCount === 2 ? 0 : 2
      const result = await saveContract({ borrowerId: contract.borrowerId, lenderId: contract.lenderId, requestKey: randomUUID(), documentChoice: 'CREATE', signingMethod: 'PRINT', documentPackage, witnessCount, guaranteeWitnessCount, interestMethod: 'INTEREST_UPFRONT', rateCode: 'CUSTOM', customRate: '20', principal: '5000', scheduledDisbursementDate: '2026-10-23', repaymentDueDate: '2026-11-23', ...(documentPackage === 'LOAN_GUARANTEE' ? { guarantorName: 'นาย ทดสอบ ผู้ค้ำ', guarantorAge: '35', guarantorHouseNumber: '1', guarantorProvinceId: '1', guarantorDistrictId: '1', guarantorSubdistrictId: '1' } : {}) })
      assert.ok(result.code)
      assert.equal((await prisma.loanContract.findFirstOrThrow({ where: { id: result.id } })).witnessCount, witnessCount)
      if (documentPackage === 'LOAN_GUARANTEE') assert.equal((await prisma.loanContract.findFirstOrThrow({ where: { id: result.id } })).guaranteeWitnessCount, guaranteeWitnessCount)
    }
  }
  assert.ok((await saveContract({ borrowerId: contract.borrowerId, lenderId: contract.lenderId, requestKey: randomUUID(), documentChoice: 'CREATE', signingMethod: 'PRINT', documentPackage: 'LOAN', witnessCount: 3, interestMethod: 'INTEREST_UPFRONT', rateCode: 'CUSTOM', customRate: '20', principal: '5000', scheduledDisbursementDate: '2026-10-23', repaymentDueDate: '2026-11-23' })).error)
  assert.ok((await saveContract({ borrowerId: contract.borrowerId, lenderId: contract.lenderId, requestKey: randomUUID(), documentChoice: 'CREATE', signingMethod: 'PRINT', documentPackage: 'LOAN_GUARANTEE', witnessCount: 0, guaranteeWitnessCount: 3, guarantorName: 'นาย ทดสอบ ผู้ค้ำ', guarantorAge: '35', guarantorHouseNumber: '1', guarantorProvinceId: '1', guarantorDistrictId: '1', guarantorSubdistrictId: '1', interestMethod: 'INTEREST_UPFRONT', rateCode: 'CUSTOM', customRate: '20', principal: '5000', scheduledDisbursementDate: '2026-10-23', repaymentDueDate: '2026-11-23' })).error)
})

test('witnesses sign by name and are required before signed PDF download', async () => {
  const { signContract } = await import('../app/dashboard/contracts/actions')
  const { GET } = await import('../app/api/contracts/[id]/document/route')
  const { PDFDocument, PDFName, PDFDict, PDFRawStream } = await import('pdf-lib')
  const sharp = (await import('sharp')).default
  const source = await prisma.loanContract.findFirstOrThrow()
  const result = await saveContract({ borrowerId: source.borrowerId, lenderId: source.lenderId, requestKey: randomUUID(), documentChoice: 'CREATE', signingMethod: 'E_SIGNATURE', documentPackage: 'LOAN', witnessCount: 2, interestMethod: 'INTEREST_UPFRONT', rateCode: 'CUSTOM', customRate: '20', principal: '5000', scheduledDisbursementDate: '2026-10-23', repaymentDueDate: '2026-11-23' })
  assert.ok(result.code)
  const contract = await prisma.loanContract.findFirstOrThrow({ orderBy: { id: 'desc' } })
  const png = await sharp(Buffer.from('<svg width="300" height="70" xmlns="http://www.w3.org/2000/svg"><path d="M10 45 Q50 0 70 40 T130 25 L260 20" stroke="#123b35" stroke-width="3" fill="none"/></svg>')).png().toBuffer()
  const signatureData = 'data:image/png;base64,' + png.toString('base64')
  const context = { params: Promise.resolve({ id: String(contract.id) }) }
  const request = () => new Request(`http://localhost/api/contracts/${contract.id}/document?download=1`)
  for (const signer of ['BORROWER', 'LENDER'] as const) assert.ok((await signContract({ contractId: contract.id, signer, signatureData, accepted: true })).success)
  assert.equal((await GET(request(), context)).status, 409)
  assert.ok((await signContract({ contractId: contract.id, signer: 'WITNESS_1', signatureData, accepted: true })).error)
  for (const [index, signer] of (['WITNESS_1', 'WITNESS_2'] as const).entries()) {
    assert.ok((await signContract({ contractId: contract.id, signer, signatureData, accepted: true, witnessName: `Test Witness ${index + 1}` })).success)
  }
  assert.ok((await signContract({ contractId: contract.id, signer: 'WITNESS_1', signatureData, accepted: true, witnessName: 'Overwrite' })).error)
  const rows = await listContracts()
  assert.equal(rows.find(row => row.id === contract.id)?.witnesses.length, 2)
  const response = await GET(request(), context)
  assert.equal(response.status, 200)
  const pdf = await PDFDocument.load(await response.arrayBuffer())
  let images = 0
  for (const page of pdf.getPages()) {
    const objects = page.node.Resources()?.lookup(PDFName.of('XObject'), PDFDict)
    for (const [, ref] of objects?.entries() ?? []) {
      const object = pdf.context.lookup(ref)
      if (object instanceof PDFRawStream && object.dict.get(PDFName.of('Subtype')) === PDFName.of('Image')) images++
    }
  }
  assert.equal(images, 4)
  const noWitnessResult = await saveContract({ borrowerId: source.borrowerId, lenderId: source.lenderId, requestKey: randomUUID(), documentChoice: 'CREATE', signingMethod: 'E_SIGNATURE', documentPackage: 'LOAN', witnessCount: 0, interestMethod: 'INTEREST_UPFRONT', rateCode: 'CUSTOM', customRate: '20', principal: '5000', scheduledDisbursementDate: '2026-10-23', repaymentDueDate: '2026-11-23' })
  assert.ok(noWitnessResult.code)
  const noWitness = await prisma.loanContract.findUniqueOrThrow({ where: { id: noWitnessResult.id } })
  assert.ok((await signContract({ contractId: noWitness.id, signer: 'WITNESS_1', signatureData, accepted: true, witnessName: 'Unexpected' })).error)
})

test('payment schedules reject invalid dates and persist without recording payment', async () => {
  const { validContractSchedule } = await import('../lib/contracts')
  assert.equal(validContractSchedule('2026-10-23', '2026-10-23'), true)
  assert.equal(validContractSchedule('2026-10-23', '2026-10-22'), false)
  assert.equal(validContractSchedule('2026-02-30', '2026-03-01'), false)
  assert.equal(validContractSchedule('', '2026-11-23'), false)
  const source = await prisma.loanContract.findFirstOrThrow()
  const draft: ContractDraft = { borrowerId: source.borrowerId, lenderId: source.lenderId, requestKey: randomUUID(), documentChoice: 'NONE', signingMethod: '', documentPackage: '', interestMethod: 'INTEREST_WITH_PRINCIPAL', rateCode: 'CUSTOM', customRate: '20', principal: '5000', scheduledDisbursementDate: '2026-10-23', repaymentDueDate: '2026-11-23' }
  assert.ok((await saveContract(draft)).code)
  const saved = await prisma.loanContract.findFirstOrThrow({ orderBy: { id: 'desc' } })
  assert.equal(saved.scheduledDisbursementDate, '2026-10-23')
  assert.equal(saved.repaymentDueDate, '2026-11-23')
  assert.equal(saved.status, 'WAITING_PAYMENT')
  assert.equal(saved.paidAt, null)
  assert.ok((await saveContract({ ...draft, requestKey: randomUUID(), repaymentDueDate: '2026-10-22' })).error)
})

test('optional collateral text persists and empty text stays blank', async () => {
  const source = await prisma.loanContract.findFirstOrThrow()
  const draft: ContractDraft = { borrowerId: source.borrowerId, lenderId: source.lenderId, requestKey: randomUUID(), documentChoice: 'CREATE', signingMethod: 'PRINT', documentPackage: 'LOAN', witnessCount: 0, interestMethod: 'INTEREST_UPFRONT', rateCode: 'CUSTOM', customRate: '20', principal: '5000', scheduledDisbursementDate: '2026-10-23', repaymentDueDate: '2026-11-23' }
  assert.ok((await saveContract({ ...draft, collateralDescription: '  รถจักรยานยนต์ ทะเบียนทดสอบ 1234  ' })).code)
  assert.equal((await prisma.loanContract.findFirstOrThrow({ orderBy: { id: 'desc' } })).collateralDescription, 'รถจักรยานยนต์ ทะเบียนทดสอบ 1234')
  assert.ok((await saveContract({ ...draft, requestKey: randomUUID(), collateralDescription: '  ' })).code)
  assert.equal((await prisma.loanContract.findFirstOrThrow({ orderBy: { id: 'desc' } })).collateralDescription, null)
  assert.ok((await saveContract({ ...draft, requestKey: randomUUID(), collateralDescription: 'x'.repeat(2001) })).error)
})

test('structured collateral agreement details persist with the contract', async () => {
  const source = await prisma.loanContract.findFirstOrThrow()
  const { saveContract } = await import('../app/dashboard/contracts/actions')
  const details = JSON.stringify({ assetAccount: 'MORTGAGE', providerRole: 'ลูกหนี้', titleDeedNumber: '12345', mortgageAmount: '500000' })
  const result = await saveContract({ borrowerId: source.borrowerId, lenderId: source.lenderId, requestKey: randomUUID(), documentChoice: 'CREATE', signingMethod: 'PRINT', documentPackage: 'LOAN_GUARANTEE_COLLATERAL', witnessCount: 0, guaranteeWitnessCount: 0, interestMethod: 'INTEREST_UPFRONT', rateCode: 'CUSTOM', customRate: '20', principal: '5000', collateralAgreementData: details, guarantorName: 'นาย ทดสอบ ผู้ค้ำ', guarantorAge: '35', guarantorHouseNumber: '1', guarantorProvinceId: '1', guarantorDistrictId: '1', guarantorSubdistrictId: '1', scheduledDisbursementDate: '2026-10-23', repaymentDueDate: '2026-11-23' })
  assert.ok(result.id)
  assert.equal((await prisma.loanContract.findUniqueOrThrow({ where: { id: result.id } })).collateralAgreementData, details)
  const { GET } = await import('../app/api/contracts/[id]/document/route')
  const response = await GET(new Request(`http://localhost/api/contracts/${result.id}/document?document=collateral`), { params: Promise.resolve({ id: String(result.id) }) })
  assert.equal(response.status, 200)
  const { PDFDocument } = await import('pdf-lib')
  assert.equal((await PDFDocument.load(await response.arrayBuffer())).getTitle(), `สัญญาหลักประกัน CT-${String(result.id).padStart(6, '0')}`)
})

test('collateral agreement has a separate e-signature set based on its selected parties', async () => {
  const source = await prisma.loanContract.findFirstOrThrow()
  const { saveContract, signContract } = await import('../app/dashboard/contracts/actions')
  const details = JSON.stringify({ assetAccount: 'BOTH', providerRole: 'บุคคลภายนอก', providerName: 'นาย สมบัติ เจ้าของทรัพย์', custodianRole: 'บุคคลภายนอกที่คู่สัญญาตกลงร่วมกัน', custodianName: 'นาง รักษาทรัพย์' })
  const result = await saveContract({ borrowerId: source.borrowerId, lenderId: source.lenderId, requestKey: randomUUID(), documentChoice: 'CREATE', signingMethod: 'E_SIGNATURE', documentPackage: 'LOAN_GUARANTEE_COLLATERAL', witnessCount: 1, guaranteeWitnessCount: 1, interestMethod: 'INTEREST_UPFRONT', rateCode: 'CUSTOM', customRate: '20', principal: '5000', collateralAgreementData: details, guarantorName: 'นาย ทดสอบ ผู้ค้ำ', guarantorAge: '35', guarantorHouseNumber: '1', guarantorProvinceId: '1', guarantorDistrictId: '1', guarantorSubdistrictId: '1', scheduledDisbursementDate: '2026-10-23', repaymentDueDate: '2026-11-23' })
  assert.ok(result.id)
  const { GET } = await import('../app/api/contracts/[id]/document/route')
  const context = { params: Promise.resolve({ id: String(result.id) }) }
  const request = () => new Request(`http://localhost/api/contracts/${result.id}/document?document=collateral`)
  assert.equal((await GET(request(), context)).status, 409, 'the collateral PDF stays unavailable until the separate 3.3 signatures are complete')
  const sharp = (await import('sharp')).default
  const png = await sharp(Buffer.from('<svg width="300" height="70" xmlns="http://www.w3.org/2000/svg"><path d="M10 45 Q50 0 70 40 T130 25 Q160 10 180 40 L260 20" stroke="#123b35" stroke-width="3" fill="none"/></svg>')).png().toBuffer()
  const signatureData = `data:image/png;base64,${png.toString('base64')}`
  for (const signer of ['BORROWER', 'LENDER', 'WITNESS_1'] as const) assert.ok((await signContract({ contractId: result.id, documentStage: 'LOAN', signer, signatureData, accepted: true, ...(signer === 'WITNESS_1' ? { witnessName: 'พยานเงินกู้' } : {}) })).success)
  for (const signer of ['GUARANTOR', 'LENDER', 'WITNESS_1'] as const) assert.ok((await signContract({ contractId: result.id, documentStage: 'GUARANTEE', signer, signatureData, accepted: true, ...(signer === 'WITNESS_1' ? { witnessName: 'พยานค้ำประกัน' } : {}) })).success)
  assert.equal((await GET(request(), context)).status, 409, '3.1 and 3.2 signatures do not replace the separate 3.3 signature set')
  for (const signer of ['BORROWER', 'LENDER', 'GUARANTOR', 'PROVIDER', 'CUSTODIAN', 'WITNESS_1'] as const) assert.ok((await signContract({ contractId: result.id, documentStage: 'COLLATERAL', signer, signatureData, accepted: true, ...(signer === 'WITNESS_1' ? { witnessName: 'พยานหลักประกัน' } : {}) })).success)
  assert.equal(contractSignaturesComplete(await prisma.loanContract.findUniqueOrThrow({ where: { id: result.id }, include: { witnesses: true, documentSignatures: true } })), true)
  const response = await GET(request(), context)
  assert.equal(response.status, 200)
  const { PDFDocument, PDFName, PDFDict, PDFRawStream } = await import('pdf-lib')
  const pdf = await PDFDocument.load(await response.arrayBuffer())
  assert.ok(pdf.getPageCount() >= 1)
  let signatureImages = 0
  for (const page of pdf.getPages()) {
    const objects = page.node.Resources()?.lookup(PDFName.of('XObject'), PDFDict)
    for (const [, ref] of objects?.entries() ?? []) {
      const object = pdf.context.lookup(ref)
      if (object instanceof PDFRawStream && object.dict.get(PDFName.of('Subtype')) === PDFName.of('Image')) signatureImages++
    }
  }
  assert.ok(signatureImages >= 11, '3.3 signature images are embedded at the contract and selected annex signature lines')
  const saved = await prisma.contractDocumentSignature.findMany({ where: { contractId: result.id, documentStage: 'COLLATERAL' } })
  assert.equal(saved.length, 6)
  assert.deepEqual(saved.map(signature => signature.signer).sort(), ['BORROWER', 'CUSTODIAN', 'GUARANTOR', 'LENDER', 'PROVIDER', 'WITNESS_1'])
})
