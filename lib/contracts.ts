export type ContractDraft = {
  borrowerId: number; lenderId: number; requestKey: string;
  documentChoice: string; signingMethod: string; documentPackage: string; witnessCount?: number; guaranteeWitnessCount?: number;
  collateralDescription?: string;
  collateralAgreementData?: string;
  guarantorName?: string; guarantorAge?: string; guarantorHouseNumber?: string;
  guarantorSoi?: string; guarantorRoad?: string; guarantorSubdistrict?: string;
  guarantorDistrict?: string; guarantorProvince?: string; guaranteeCollateralDescription?: string;
  guarantorProvinceId?: string; guarantorDistrictId?: string; guarantorSubdistrictId?: string;
  scheduledDisbursementDate: string; repaymentDueDate: string;
  interestMethod: string; rateCode: string; customRate: string; principal: string;
}
export const contractCode = (id: number) => `CT-${String(id).padStart(6, '0')}`
export const formatContractMoney = (satang: number) => new Intl.NumberFormat('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(satang / 100)
export function contractAmounts(principal: string, percent: number, method: string) {
  if (!/^\d+(?:\.\d{1,2})?$/.test(principal) || Number(principal) <= 0 || Number(principal) > 2_000_000_000) throw new Error('ยอดเงินต้นไม่ถูกต้อง')
  if (!Number.isFinite(percent) || percent < 0 || percent > 100) throw new Error('อัตราดอกเบี้ยไม่ถูกต้อง')
  if (!['INTEREST_UPFRONT', 'INTEREST_WITH_PRINCIPAL'].includes(method)) throw new Error('กรุณาเลือกวิธีชำระดอกเบี้ย')
  const principalSatang = Math.round(Number(principal) * 100)
  const interestSatang = Math.round(principalSatang * percent / 100)
  return { principalSatang, interestSatang, netSatang: principalSatang - (method === 'INTEREST_UPFRONT' ? interestSatang : 0), repaymentSatang: principalSatang + (method === 'INTEREST_UPFRONT' ? 0 : interestSatang) }
}

export type ContractDocumentSignatureRecord = { documentStage: string; signer: string; name?: string; signedAt: unknown }
export type ContractSignatureStatus = {
  borrowerSignedAt: unknown; lenderSignedAt: unknown; guarantorSignedAt?: unknown; documentPackage?: string | null
  borrowerName?: string; lenderName?: string; guarantorName?: string | null; collateralAgreementData?: string | null
  witnessCount: number; guaranteeWitnessCount?: number; witnesses: { position: number; signedAt: unknown }[]; documentSignatures?: ContractDocumentSignatureRecord[]
}

export type ContractDocumentStage = 'LOAN' | 'GUARANTEE' | 'COLLATERAL'
export type ContractDocumentSigner = 'BORROWER' | 'LENDER' | 'GUARANTOR' | 'PROVIDER' | 'CUSTODIAN' | 'WITNESS_1' | 'WITNESS_2'
export type RequiredContractSigner = { signer: ContractDocumentSigner; name: string; label: string }

export function collateralSignatureSetupReady(collateralAgreementData?: string | null) {
  const details = (() => { try { return JSON.parse(collateralAgreementData || '{}') as Record<string, string> } catch { return {} } })()
  if (details.providerRole === 'บุคคลภายนอก' && !details.providerName?.trim()) return false
  if ((details.assetAccount === 'PLEDGE' || details.assetAccount === 'BOTH') && (!details.custodianRole || details.custodianRole === 'บุคคลภายนอกที่คู่สัญญาตกลงร่วมกัน' && !details.custodianName?.trim())) return false
  return true
}

export function collateralAgreementSigners(contract: Pick<ContractSignatureStatus, 'borrowerName' | 'lenderName' | 'guarantorName' | 'witnessCount' | 'collateralAgreementData'>): RequiredContractSigner[] {
  const details = (() => { try { return JSON.parse(contract.collateralAgreementData || '{}') as Record<string, string> } catch { return {} } })()
  const signers: RequiredContractSigner[] = [
    { signer: 'BORROWER', name: contract.borrowerName ?? 'ผู้กู้', label: 'ลูกหนี้/ผู้กู้' },
    { signer: 'LENDER', name: contract.lenderName ?? 'ผู้ให้กู้', label: 'เจ้าหนี้/ผู้ให้กู้' },
  ]
  if (contract.guarantorName) signers.push({ signer: 'GUARANTOR', name: contract.guarantorName, label: 'ผู้ค้ำประกัน' })
  const knownPeople = new Set([contract.borrowerName, contract.lenderName, contract.guarantorName].filter(Boolean).map(name => name!.trim()))
  const providerName = details.providerName?.trim() || (details.providerRole === 'บุคคลภายนอก' ? '' : contract.borrowerName ?? '')
  if (details.providerRole === 'บุคคลภายนอก' && providerName && !knownPeople.has(providerName)) {
    signers.push({ signer: 'PROVIDER', name: providerName, label: 'ผู้ให้หลักประกัน/ผู้จำนอง/ผู้จำนำ' })
    knownPeople.add(providerName)
  }
  const account = details.assetAccount || 'BOTH'
  const custodianName = details.custodianName?.trim() || ''
  if ((account === 'PLEDGE' || account === 'BOTH') && details.custodianRole === 'บุคคลภายนอกที่คู่สัญญาตกลงร่วมกัน' && custodianName && !knownPeople.has(custodianName)) {
    signers.push({ signer: 'CUSTODIAN', name: custodianName, label: 'ผู้รับมอบ/ผู้เก็บรักษาทรัพย์' })
  }
  for (let index = 0; index < contract.witnessCount; index++) {
    const signer = `WITNESS_${index + 1}` as 'WITNESS_1' | 'WITNESS_2'
    signers.push({ signer, name: `พยานคนที่ ${index + 1}`, label: `พยานคนที่ ${index + 1}` })
  }
  return signers
}

export function contractDocumentSignaturesComplete(contract: ContractSignatureStatus, stage: ContractDocumentStage) {
  const requiredWitnesses = Array.from({ length: stage === 'GUARANTEE' ? contract.guaranteeWitnessCount ?? contract.witnessCount : contract.witnessCount }, (_, index) => index + 1)
  if (stage === 'LOAN') return Boolean(contract.borrowerSignedAt && contract.lenderSignedAt) && requiredWitnesses.every(position => contract.witnesses.some(witness => witness.position === position && witness.signedAt))

  const signatures = contract.documentSignatures?.filter(signature => signature.documentStage === stage) ?? []
  const required = stage === 'GUARANTEE'
    ? ['LENDER', 'GUARANTOR', ...requiredWitnesses.map(position => `WITNESS_${position}`)]
    : collateralAgreementSigners(contract).map(item => item.signer)
  return required.every(signer => signatures.some(signature => signature.signer === signer && signature.signedAt))
}

export function contractSignaturesComplete(contract: ContractSignatureStatus) {
  return contractDocumentSignaturesComplete(contract, 'LOAN') && (contract.documentPackage === 'LOAN' || contractDocumentSignaturesComplete(contract, 'GUARANTEE')) && (contract.documentPackage !== 'LOAN_GUARANTEE_COLLATERAL' || contractDocumentSignaturesComplete(contract, 'COLLATERAL'))
}

export function validContractSchedule(disbursement: string, due: string) {
  const valid = (value: string) => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(`${value}T00:00:00Z`)) && new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) === value
  return valid(disbursement) && valid(due) && due >= disbursement
}
export function formatContractDate(value: string | null | undefined) {
  return value ? new Intl.DateTimeFormat('th-TH', { timeZone: 'Asia/Bangkok', dateStyle: 'long' }).format(new Date(`${value}T00:00:00Z`)) : '—'
}

export type DraftContractSignature = {
  signer: ContractDocumentSigner
  documentStage: ContractDocumentStage
  signatureData: string
  witnessName?: string
  signerName?: string
}
