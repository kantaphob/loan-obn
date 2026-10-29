'use client'

import { useFeedbackToast } from '@/components/ui/use-feedback-toast'
import { useEffect, useId, useRef, useState } from 'react'
import { Card } from '@/components/ui/card'
import Image from 'next/image'
import { DraftSignaturePad } from './draft-signature-pad'
import { Button } from '@/components/ui/button'
import { Modal } from '@/components/ui/modal'
import { validContractSchedule, formatContractDate, type DraftContractSignature } from '@/lib/contracts'
import { getContractInterestRates, getContractPersuaders, getContractProvinces, getContractDistricts, getContractSubdistricts, saveContract, signContract } from './actions'
import { ContractDocumentOptions, WitnessCountOptions, signingMethods, documentPackages } from './contract-document-options'
import { CollateralAgreementFields, type CollateralAgreementValues } from './collateral-agreement-fields'
import { collateralAgreementSigners, collateralSignatureSetupReady, type ContractDocumentStage } from '@/lib/contracts'
import { DEFAULT_REFERRAL_SHARE_PERCENT, referralShareFromPrincipal } from '@/lib/referral-share'

type ContractPhase = 'DETAILS' | 'LOAN' | 'GUARANTEE' | 'COLLATERAL' | 'REVIEW'

export function ContractDetailsStep({ borrowerName, lenderName, onBack, borrowerId, lenderId, availableLimit, onReview, onSaved, outstandingContracts, outstandingReviewed, borrowerInformed, onOutstandingReviewedChange, onBorrowerInformedChange }: {
  borrowerName: string; lenderName: string; borrowerId: number; lenderId: number; availableLimit: number; onBack: () => void;
  onReview: (reviewing: boolean) => void; onSaved?: (code: string, contractId: number, signingMethod: string | null, limitApprovalRequired: boolean, pdfSaved: boolean | null) => void;
  outstandingContracts: { contractId: number; label: string; amount: string }[]; outstandingReviewed: boolean; borrowerInformed: boolean;
  onOutstandingReviewedChange: (checked: boolean) => void; onBorrowerInformedChange: (checked: boolean) => void;
}) {
  const groupId = useId()
  const [phase, setPhase] = useState<ContractPhase>('DETAILS')
  const [saving, setSaving] = useState(false)
  const [previewLoading, setPreviewLoading] = useState(false)
  const [previewUrl, setPreviewUrl] = useState('')
  const [previewError, setPreviewError] = useState('')
  const [saveError, setSaveError] = useState('')
  const [savedCode, setSavedCode] = useState('')
  const requestKey = useRef('')
  const saveLock = useRef(false)
  const [signingMethod, setSigningMethod] = useState('')
  const [documentPackage, setDocumentPackage] = useState('')
  const [witnessCount, setWitnessCount] = useState(2)
  const [guaranteeWitnessCount, setGuaranteeWitnessCount] = useState(2)
  const [documentChoice, setDocumentChoice] = useState<'CREATE' | 'NONE' | ''>('')
  const [interestMethod, setInterestMethod] = useState<'INTEREST_UPFRONT' | 'INTEREST_WITH_PRINCIPAL'>('INTEREST_UPFRONT')
  const [principal, setPrincipal] = useState('')
  const [persuaders, setPersuaders] = useState<Awaited<ReturnType<typeof getContractPersuaders>>>([])
  const [persuaderId, setPersuaderId] = useState('')
  const [persuaderSharePercent, setPersuaderSharePercent] = useState(DEFAULT_REFERRAL_SHARE_PERCENT)
  const [draftSignatures, setDraftSignatures] = useState<DraftContractSignature[]>([])
  const [signatureConsent, setSignatureConsent] = useState(false)
  const [collateralDescription, setCollateralDescription] = useState('')
  const [collateralAgreementData, setCollateralAgreementData] = useState<CollateralAgreementValues>({ assetAccount: 'BOTH', providerRole: 'ลูกหนี้', custodianRole: 'เจ้าหนี้ผู้รับจำนำ', collateralWitnessCount: '2' })
  const [guarantorTitle, setGuarantorTitle] = useState('')
  const [guarantorFirstName, setGuarantorFirstName] = useState('')
  const [guarantorLastName, setGuarantorLastName] = useState('')
  const [guarantorAge, setGuarantorAge] = useState('')
  const [guarantorHouseNumber, setGuarantorHouseNumber] = useState('')
  const [guarantorSoi, setGuarantorSoi] = useState('')
  const [guarantorRoad, setGuarantorRoad] = useState('')
  const [guarantorProvinceId, setGuarantorProvinceId] = useState('')
  const [guarantorDistrictId, setGuarantorDistrictId] = useState('')
  const [guarantorSubdistrictId, setGuarantorSubdistrictId] = useState('')
  const [provinces, setProvinces] = useState<Awaited<ReturnType<typeof getContractProvinces>>>([])
  const [districts, setDistricts] = useState<Awaited<ReturnType<typeof getContractDistricts>>>([])
  const [subdistricts, setSubdistricts] = useState<Awaited<ReturnType<typeof getContractSubdistricts>>>([])
  const [guaranteeCollateralDescription, setGuaranteeCollateralDescription] = useState('')
  const [scheduledDisbursementDate, setDisbursementDate] = useState('')
  const [repaymentDueDate, setRepaymentDueDate] = useState('')
  const validSchedule = validContractSchedule(scheduledDisbursementDate, repaymentDueDate)
  const [internalRateCode, setInternalRateCode] = useState('')
  const [internalCustomRate, setInternalCustomRate] = useState('')
  const [rates, setRates] = useState<Awaited<ReturnType<typeof getContractInterestRates>>>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  useFeedbackToast({ error })
  const guarantorName = [guarantorTitle, guarantorFirstName, guarantorLastName].map(value => value.trim()).filter(Boolean).join(' ')

  useEffect(() => {
    let cancelled = false
    Promise.all([getContractInterestRates(), getContractProvinces(), getContractPersuaders()]).then(([values, locationValues, persuaderValues]) => { if (!cancelled) { setRates(values); setPersuaderSharePercent(values.some(item => item.percent === 5) ? '5' : values[0] ? String(values[0].percent) : ''); setProvinces(locationValues); setPersuaders(persuaderValues) } })
      .catch(() => { if (!cancelled) setError('โหลดข้อมูลสัญญาไม่สำเร็จ กรุณาปิดและเปิดหน้าต่างอีกครั้ง') })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [])

  useEffect(() => () => { if (previewUrl) URL.revokeObjectURL(previewUrl) }, [previewUrl])

  function chooseGuarantorProvince(value: string) {
    setGuarantorProvinceId(value); setGuarantorDistrictId(''); setGuarantorSubdistrictId(''); setDistricts([]); setSubdistricts([])
    if (value) getContractDistricts(Number(value)).then(setDistricts).catch(() => setSaveError('โหลดรายชื่ออำเภอไม่สำเร็จ'))
  }
  function chooseGuarantorDistrict(value: string) {
    setGuarantorDistrictId(value); setGuarantorSubdistrictId(''); setSubdistricts([])
    if (value) getContractSubdistricts(Number(value)).then(setSubdistricts).catch(() => setSaveError('โหลดรายชื่อตำบลไม่สำเร็จ'))
  }

  const amount = Number(principal)
  const validPrincipal = /^\d+(?:\.\d{1,2})?$/.test(principal) && amount > 0 && amount <= 2_000_000_000
  const validInternalCustomRate = /^\d+(?:\.\d{1,2})?$/.test(internalCustomRate) && Number(internalCustomRate) >= 0 && Number(internalCustomRate) <= 100
  const selectedInternalRate = internalRateCode === 'CUSTOM'
    ? validInternalCustomRate ? Number(internalCustomRate) : null
    : rates.find(item => item.code === internalRateCode)?.percent ?? null
  const principalSatang = Math.round(amount * 100)
  const interestSatang = validPrincipal && selectedInternalRate !== null ? Math.round(principalSatang * selectedInternalRate / 100) : null
  const validPersuaderPercent = rates.some(item => String(item.percent) === persuaderSharePercent)
  const selectedPersuader = persuaders.find(item => String(item.id) === persuaderId)
  const persuaderShareSatang = selectedPersuader && validPrincipal && validPersuaderPercent ? referralShareFromPrincipal(principalSatang, persuaderSharePercent) : null
  const deductionSatang = interestMethod === 'INTEREST_UPFRONT' ? interestSatang : 0
  const netSatang = validPrincipal && interestSatang !== null
    ? principalSatang - deductionSatang!
    : null
  const repaymentSatang = validPrincipal && interestSatang !== null ? principalSatang : null
  const canCalculate = netSatang !== null && repaymentSatang !== null
  const limitApprovalNeeded = validPrincipal && principalSatang > Math.round(availableLimit * 100)
  const money = (satang: number | null) => satang === null ? '—' : new Intl.NumberFormat('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(satang / 100) + ' บาท'
const fieldClass = 'mt-1.5 w-full rounded-lg border border-slate-300 bg-white/70 px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-slate-400/30'


  const needsGuarantor = documentChoice === 'CREATE' && documentPackage !== '' && documentPackage !== 'LOAN'
  const activeSignatures = documentChoice === 'CREATE' && signingMethod === 'E_SIGNATURE' ? draftSignatures.filter(item => (item.documentStage === 'LOAN' || needsGuarantor && item.documentStage === 'GUARANTEE' || documentPackage === 'LOAN_GUARANTEE_COLLATERAL' && item.documentStage === 'COLLATERAL') && (!item.signer.startsWith('WITNESS_') || Number(item.signer.slice(-1)) <= (item.documentStage === 'GUARANTEE' ? guaranteeWitnessCount : witnessCount))) : []
  const guarantorReady = !needsGuarantor || Boolean(guarantorTitle.trim() && guarantorFirstName.trim() && guarantorLastName.trim() && /^\d{1,3}$/.test(guarantorAge) && Number(guarantorAge) >= 15 && guarantorHouseNumber.trim() && guarantorProvinceId && guarantorDistrictId && guarantorSubdistrictId)
  const detailsReady = validSchedule && canCalculate && (internalRateCode !== 'CUSTOM' || validInternalCustomRate) && (!persuaderId || validPersuaderPercent) && Boolean(documentChoice) && (documentChoice !== 'CREATE' || Boolean(signingMethod && documentPackage))
  const ready = detailsReady && guarantorReady
  const signerCount = phase === 'GUARANTEE' ? guaranteeWitnessCount : witnessCount
  const requiredSignatures = documentChoice === 'CREATE' && signingMethod === 'E_SIGNATURE'
    ? [
        ...(['BORROWER', 'LENDER', ...Array.from({ length: signerCount }, (_, index) => `WITNESS_${index + 1}`)].map(signer => ({ documentStage: 'LOAN', signer }))),
        ...(needsGuarantor ? ['GUARANTOR', 'LENDER', ...Array.from({ length: guaranteeWitnessCount }, (_, index) => `WITNESS_${index + 1}`)].map(signer => ({ documentStage: 'GUARANTEE', signer })) : []),
        ...(documentPackage === 'LOAN_GUARANTEE_COLLATERAL' ? collateralAgreementSigners({ borrowerName, lenderName, guarantorName, witnessCount, collateralAgreementData: JSON.stringify(collateralAgreementData) }).map(({ signer }) => ({ documentStage: 'COLLATERAL', signer })) : []),
      ]
    : []
  const signaturesReady = requiredSignatures.every(required => activeSignatures.some(signature => signature.documentStage === required.documentStage && signature.signer === required.signer))
  const phaseSignaturesReady = (stage: ContractDocumentStage, signers: string[]) => signers.every(signer => activeSignatures.some(signature => signature.documentStage === stage && signature.signer === signer))
  const collateralSigners = collateralAgreementSigners({ borrowerName, lenderName, guarantorName, witnessCount, collateralAgreementData: JSON.stringify(collateralAgreementData) })
  const collateralSignaturesReady = collateralSigners.every(required => activeSignatures.some(signature => signature.documentStage === 'COLLATERAL' && signature.signer === required.signer))
  const documentStages: Exclude<ContractPhase, 'DETAILS' | 'REVIEW'>[] = documentChoice !== 'CREATE' ? [] : ['LOAN', ...(needsGuarantor ? ['GUARANTEE' as const] : []), ...(documentPackage === 'LOAN_GUARANTEE_COLLATERAL' ? ['COLLATERAL' as const] : [])]
  const phaseTitle: Record<ContractPhase, string> = { DETAILS: 'Step 3 · รายละเอียดเงินกู้และเลือกชุดเอกสาร', LOAN: 'Step 3.1 · สัญญาเงินกู้', GUARANTEE: 'Step 3.2 · สัญญาค้ำประกัน', COLLATERAL: 'Step 3.3 · ข้อตกลงค้ำประกันและหลักประกัน', REVIEW: 'สรุปรายการและบันทึก' }
  const phaseIndex = documentStages.indexOf(phase as Exclude<ContractPhase, 'DETAILS' | 'REVIEW'>)
  function nextPhase() {
    const next: ContractPhase = phase === 'DETAILS' ? documentStages[0] ?? 'REVIEW' : documentStages[phaseIndex + 1] ?? 'REVIEW'
    setPhase(next)
    if ((next as string) === 'REVIEW') onReview(true)
  }
  function previousPhase() {
    if (phase === 'REVIEW') { setPhase(documentStages[documentStages.length - 1] ?? 'DETAILS'); setSignatureConsent(false); onReview(false) }
    else if (phase === 'DETAILS') onBack()
    else setPhase(documentStages[phaseIndex - 1] ?? 'DETAILS')
  }
  async function save() {
    if (!ready || (outstandingContracts.length > 0 && (!outstandingReviewed || !borrowerInformed)) || (activeSignatures.length > 0 && !signatureConsent) || saveLock.current || savedCode) return
    saveLock.current = true
    setSaving(true)
    setSaveError('')
    if (!requestKey.current) requestKey.current = crypto.randomUUID()
    try {
      const result = await saveContract({ borrowerId, lenderId, requestKey: requestKey.current, persuaderId: persuaderId ? Number(persuaderId) : null, persuaderSharePercent, witnessCount, guaranteeWitnessCount, documentChoice, signingMethod, documentPackage, interestMethod, internalRateCode, internalCustomRate, principal, collateralDescription, collateralAgreementData: JSON.stringify(collateralAgreementData), guarantorName, guarantorAge, guarantorHouseNumber, guarantorSoi, guarantorRoad, guarantorProvinceId, guarantorDistrictId, guarantorSubdistrictId, guaranteeCollateralDescription, scheduledDisbursementDate, repaymentDueDate })
      if (result.error) { setSaveError(result.error); return }
      if (result.code && result.id) {
        for (const signature of activeSignatures) {
          const signed = await signContract({ contractId: result.id, ...signature, accepted: signatureConsent })
          if (signed.error) { setSaveError(`บันทึกสัญญาแล้ว แต่ลายเซ็นยังไม่ครบ: ${signed.error}`); break }
        }
        setSavedCode(result.code)
        onSaved?.(result.code, result.id, documentChoice === 'CREATE' && signingMethod === 'E_SIGNATURE' ? 'E_SIGNATURE' : null, result.limitApprovalRequired ?? false, result.pdfSaved ?? null)
      }
    } catch { setSaveError('เชื่อมต่อไม่สำเร็จ กรุณาลองบันทึกอีกครั้ง') }
    finally { setSaving(false); saveLock.current = false }
  }

  async function previewLoanAgreement() {
    if (!ready || documentChoice !== 'CREATE' || previewLoading) return
    setPreviewLoading(true)
    setPreviewError('')
    try {
      const response = await fetch('/api/contracts/preview', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ borrowerId, lenderId, principal, interestMethod, internalRateCode, internalCustomRate, scheduledDisbursementDate, repaymentDueDate, collateralDescription, signingMethod, witnessCount }),
      })
      if (!response.ok) {
        const result = await response.json().catch(() => null) as { message?: string } | null
        throw new Error(result?.message || 'สร้างตัวอย่างเอกสารไม่สำเร็จ')
      }
      const url = URL.createObjectURL(await response.blob())
      setPreviewUrl(url)
    } catch (error) {
      setPreviewError(error instanceof Error ? error.message : 'สร้างตัวอย่างเอกสารไม่สำเร็จ')
    } finally { setPreviewLoading(false) }
  }

  return <div className="space-y-4">
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-white/50 p-3 text-sm">
      
      <Button disabled={saving || Boolean(savedCode)} onClick={previousPhase}>{phase === 'DETAILS' ? 'ย้อนกลับ: เลือกผู้ให้กู้' : phase === 'REVIEW' ? 'ย้อนกลับ: แก้ไข' : 'ย้อนกลับ'}</Button>
    </div>
    <Card as="section" className="border-slate-200 bg-white p-4 shadow-sm sm:p-5">
      <h2 className="m-0 text-base font-semibold text-slate-800">{phaseTitle[phase]}</h2>
      {phase !== 'REVIEW' && documentChoice === 'CREATE' && documentPackage && <ol aria-label="ขั้นตอนเอกสารสัญญา" className="my-3 flex flex-wrap gap-2 p-0">
        {(['LOAN', ...(needsGuarantor ? ['GUARANTEE' as const] : []), ...(documentPackage === 'LOAN_GUARANTEE_COLLATERAL' ? ['COLLATERAL' as const] : [])] as const).map((item, index) => <li key={item} aria-current={phase === item ? 'step' : undefined} className={`flex-1 basis-48 list-none rounded-xl border px-3 py-2.5 text-xs transition-colors ${phase === item ? 'border-sky-300 bg-sky-50 font-semibold text-sky-950 shadow-sm' : 'border-slate-200 bg-slate-50 text-slate-500'}`}><span className={`mr-2 inline-grid h-5 w-5 place-items-center rounded-full text-[10px] ${phase === item ? 'bg-sky-700 text-white' : 'bg-slate-200 text-slate-600'}`}>3.{index + 1}</span>{item === 'LOAN' ? 'สัญญาเงินกู้' : item === 'GUARANTEE' ? 'สัญญาค้ำประกัน' : 'สัญญาหลักประกัน'}</li>)}
      </ol>}
      {phase === 'DETAILS' && <div>
      <fieldset className="m-0 mt-5 min-w-0 border-0 p-0">
        <legend className="mb-3 flex items-center text-sm font-semibold text-slate-800"><span className="mr-2 grid h-6 w-6 place-items-center rounded-lg bg-sky-100 text-xs font-bold text-sky-800">1</span>การจัดทำเอกสารสัญญา</legend>
        <div className="grid gap-3 sm:grid-cols-2">
          {([{ value: 'CREATE', label: 'ทำสัญญา' }, { value: 'NONE', label: 'ไม่ทำสัญญา' }] as const).map(option => <label key={option.value} className={`flex cursor-pointer items-center gap-2.5 rounded-xl border-2 px-3.5 py-3 text-sm transition-colors ${documentChoice === option.value ? 'border-emerald-600 bg-emerald-50 shadow-sm' : 'border-slate-200 bg-white hover:border-sky-300 hover:bg-sky-50/40'} focus-within:ring-2 focus-within:ring-sky-400`}>
            <input type="radio" name={`${groupId}-document`} value={option.value} checked={documentChoice === option.value} onChange={() => setDocumentChoice(option.value)} className="h-4 w-4 shrink-0 accent-emerald-700" />
            <span className="font-medium">{option.label}</span>
          </label>)}
        </div>
      </fieldset>
      <div hidden={documentChoice !== 'CREATE'}><ContractDocumentOptions witnessCount={witnessCount} onWitnessChange={setWitnessCount} signingMethod={signingMethod} documentPackage={documentPackage} onSigningChange={setSigningMethod} onPackageChange={setDocumentPackage} /></div>
      <fieldset className="m-0 mt-5 min-w-0 border-0 p-0">
        <legend className="mb-2 flex items-center text-sm font-semibold text-slate-800"><span className="mr-2 grid h-6 w-6 place-items-center rounded-lg bg-amber-100 text-xs font-bold text-amber-800">2</span>วิธีจ่ายเงิน</legend>
        <div className="grid gap-3 sm:grid-cols-2">
          {[
            ['INTEREST_UPFRONT', 'หักดอกเบี้ยก่อนจ่าย', 'หักดอกเบี้ย 1 เดือนจากเงินที่จ่าย · ผู้กู้คืนเงินต้น'],
            ['INTEREST_WITH_PRINCIPAL', 'ไม่หักดอกเบี้ยก่อนจ่าย', 'จ่ายเงินต้นเต็มจำนวน · ผู้กู้คืนเงินต้นพร้อมดอกเบี้ย 1 เดือน'],
          ].map(([value, title, description]) => <label key={value} className={`flex cursor-pointer items-start gap-3 rounded-xl border px-4 py-3 text-sm ${interestMethod === value ? 'border-emerald-500 bg-emerald-50 text-emerald-950' : 'border-slate-200 bg-white/50 text-slate-700'}`}>
            <input type="radio" name="contract-interest-method" value={value} checked={interestMethod === value} onChange={() => setInterestMethod(value as 'INTEREST_UPFRONT' | 'INTEREST_WITH_PRINCIPAL')} className="mt-0.5 accent-emerald-600" />
            <span><strong>{title}</strong><span className="mt-1 block text-xs text-slate-500">{description}</span></span>
          </label>)}
        </div>
      </fieldset>
      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        <label className="text-sm font-medium">ยอดเงินต้น (บาท)
          <input type="number" min="0.01" max="2000000000" step="0.01" inputMode="decimal" value={principal} onChange={event => setPrincipal(event.target.value)} placeholder="ระบุยอดเงินต้น" aria-invalid={Boolean(principal && !validPrincipal)} className={fieldClass} />
          {principal && !validPrincipal && <span className="mt-1 block text-xs text-red-700">ระบุยอดมากกว่า 0 ถึง 2,000,000,000 บาท ทศนิยมไม่เกิน 2 ตำแหน่ง</span>}
        </label>
        <label className="text-sm font-medium">อัตราอ้างอิงภายในต่อเดือน (%)
          <select value={internalRateCode} onChange={event => { setInternalRateCode(event.target.value); if (event.target.value !== 'CUSTOM') setInternalCustomRate('') }} className={fieldClass}>
            <option value="">{loading ? 'กำลังโหลด Masterdata…' : 'ไม่ระบุ'}</option>
            {rates.map(item => <option key={item.code} value={item.code}>ร้อยละ {item.percent}</option>)}
            <option value="CUSTOM">กำหนดเอง</option>
          </select>
          <span className="mt-0.5 block text-[11px] font-normal text-slate-500">ใช้คำนวณดอกเบี้ยในระบบตามวิธีจ่ายที่เลือก แต่ไม่แสดงเป็นอัตราดอกเบี้ยในเอกสารสัญญา</span>
        </label>
        {internalRateCode === 'CUSTOM' && <label className="text-sm font-medium">อัตราอ้างอิงภายในที่กำหนดเอง (%)
          <input type="number" min="0" max="100" step="0.01" inputMode="decimal" value={internalCustomRate} onChange={event => setInternalCustomRate(event.target.value)} placeholder="0–100" aria-invalid={Boolean(internalCustomRate && !validInternalCustomRate)} className={fieldClass} />
          <span className="mt-0.5 block text-[11px] font-normal text-slate-500">ใช้อัตรานี้คำนวณดอกเบี้ยในระบบ ไม่พิมพ์อัตราลงในเอกสารสัญญา</span>
          {internalCustomRate && !validInternalCustomRate && <span className="mt-1 block text-xs text-red-700">อัตราอ้างอิงภายในต้องอยู่ระหว่าง 0–100%</span>}
        </label>}
      </div>
      <section className="mt-5 rounded-xl border border-violet-200 bg-violet-50/60 p-4">
        <h3 className="m-0 text-sm font-semibold text-slate-800">ผู้แนะนำและส่วนแบ่งภายใน</h3>
        <p className="mb-3 mt-1 text-xs leading-5 text-slate-600">เลือก Persuader ถ้ามี บันทึกเป็นข้อมูลภายใน ไม่แสดงในเอกสารผู้กู้ และยังไม่บันทึกการจ่ายเงินจริง</p>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="text-sm font-medium">Persuader
            <select value={persuaderId} onChange={event => setPersuaderId(event.target.value)} className={fieldClass}>
              <option value="">ไม่มีผู้แนะนำ</option>
              {persuaders.map(item => <option key={item.id} value={item.id}>{item.name}{item.phone ? ` · ${item.phone}` : ''}</option>)}
            </select>
          </label>
        {persuaderId && <label className="text-sm font-medium">ส่วนแบ่ง (% ของเงินต้น)
            <select value={persuaderSharePercent} onChange={event => setPersuaderSharePercent(event.target.value)} aria-invalid={!validPersuaderPercent} className={fieldClass}>
              <option value="">เลือกอัตราส่วนแบ่ง</option>
              {rates.map(item => <option key={item.code} value={String(item.percent)}>ร้อยละ {item.percent}</option>)}
            </select>
          </label>}
        </div>
        {persuaderId && <div aria-live="polite" className="mt-3 grid gap-2 rounded-lg bg-white px-3 py-2.5 text-sm sm:grid-cols-3">
          <p className="m-0">ดอกเบี้ยรวมตามระบบ <strong className="tabular-nums">{money(interestSatang)}</strong></p>
          <p className="m-0">ดอกเบี้ยส่วนผู้ให้กู้ <strong className="tabular-nums">{money(interestSatang !== null && persuaderShareSatang !== null ? Math.max(0, interestSatang - persuaderShareSatang) : null)}</strong></p>
          <p className="m-0">ส่วนแบ่งตามเงื่อนไข <strong className="tabular-nums">{money(persuaderShareSatang)}</strong></p>
        </div>}
      </section>
      <fieldset className="m-0 mt-6 min-w-0 border-0 p-0">
        <legend className="mb-3 flex items-center text-sm font-semibold text-slate-800"><span className="mr-2 grid h-6 w-6 place-items-center rounded-lg bg-violet-100 text-xs font-bold text-violet-800">3</span>กำหนดรับและจ่ายเงิน</legend>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="text-sm font-medium">วันที่จ่ายเงินให้ผู้กู้
            <input type="date" required value={scheduledDisbursementDate} onChange={event => setDisbursementDate(event.target.value)} className={fieldClass} />
          </label>
          <label className="text-sm font-medium">วันครบกำหนดรับชำระคืน
            <input type="date" required min={scheduledDisbursementDate || undefined} value={repaymentDueDate} onChange={event => setRepaymentDueDate(event.target.value)} aria-invalid={Boolean(scheduledDisbursementDate && repaymentDueDate && !validSchedule)} className={fieldClass} />
          </label>
        </div>
        {scheduledDisbursementDate && repaymentDueDate && !validSchedule && <p role="alert" className="mb-0 mt-2 text-xs text-red-700">วันครบกำหนดต้องไม่ก่อนวันที่จ่ายเงินให้ผู้กู้</p>}
        <p className="mb-0 mt-2 text-xs text-slate-500">วันที่กำหนดไว้ในสัญญา ยังไม่ใช่การยืนยันว่าจ่ายหรือรับเงินจริงแล้ว</p>
      </fieldset>
      <section aria-live="polite" aria-label="สรุปยอดเงินกู้" className="mt-6 rounded-xl border border-sky-200 bg-gradient-to-r from-sky-50 to-emerald-50 p-4">
        <h3 className="m-0 text-sm font-semibold text-slate-800">สรุปยอดเงินกู้</h3>
          {validPrincipal ? <dl className="mb-0 mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {[
            ['เงินต้น', money(principalSatang)],
            ['ดอกเบี้ยอ้างอิงต่อเดือน', money(interestSatang)],
            ['ยอดรับเงินจริง', money(netSatang)],
            ['ยอดชำระคืนทั้งหมด', money(repaymentSatang)],
          ].map(([label, value]) => <div key={label} className="rounded-lg bg-slate-50 px-3 py-2.5">
            <dt className="text-xs text-slate-500">{label}</dt>
            <dd className="ml-0 mt-1 text-sm font-semibold tabular-nums">{value}</dd>
          </div>)}
        </dl> : <p className="mb-0 mt-2 text-sm text-slate-500">ระบุเงินต้นเพื่อดูยอดรับและยอดชำระ</p>}
        {validPrincipal && selectedInternalRate === null && <p role="status" className="mb-0 mt-2 text-xs text-amber-800">เลือกอัตราอ้างอิงภายในเพื่อคำนวณยอดดอกเบี้ยและยอดที่เกี่ยวข้อง</p>}
        {validPrincipal && selectedInternalRate !== null && <p className="mb-0 mt-3 text-xs text-slate-500">{interestMethod === 'INTEREST_UPFRONT' ? 'หักดอกเบี้ย 1 เดือนจากเงินที่จ่าย · คืนเงินต้นเท่านั้น' : 'จ่ายเงินต้นเต็มจำนวน · ชำระคืนเงินต้นพร้อมดอกเบี้ย 1 เดือน'} · ช่องดอกเบี้ยในเอกสารเว้นว่าง</p>}
        {limitApprovalNeeded && <p role="status" className="mb-0 mt-3 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900">ยอดจองเกินวงเงินคงเหลือ {new Intl.NumberFormat('th-TH').format(Math.max(0, amount - availableLimit))} บาท · บันทึกรายการจองได้ แต่ผู้ดูแลต้องอนุมัติก่อนจ่ายเงินจริง</p>}
      </section>
      {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
      {!loading && !error && !rates.length && <p role="status" className="text-sm text-slate-500">ยังไม่มีอัตราดอกเบี้ยที่ใช้งานใน Masterdata</p>}
      </div>}
      {phase === 'GUARANTEE' && needsGuarantor && <fieldset className="rounded-2xl border border-slate-200 p-4"><legend className="px-2 text-sm font-medium">ข้อมูลผู้ค้ำประกันสำหรับสัญญาค้ำเงินกู้</legend><div className="grid gap-4 sm:grid-cols-2">
        <div className="grid gap-4 sm:col-span-2 sm:grid-cols-3">
          <label className="text-sm">คำนำหน้า<select value={guarantorTitle} onChange={e => setGuarantorTitle(e.target.value)} className={fieldClass} required><option value="">เลือกคำนำหน้า</option><option value="นาย">นาย</option><option value="นาง">นาง</option><option value="นางสาว">นางสาว</option></select></label>
          <label className="text-sm">ชื่อ<input value={guarantorFirstName} onChange={e => setGuarantorFirstName(e.target.value)} maxLength={80} className={fieldClass} required /></label>
          <label className="text-sm">นามสกุล<input value={guarantorLastName} onChange={e => setGuarantorLastName(e.target.value)} maxLength={80} className={fieldClass} required /></label>
        </div>
        <label className="text-sm">อายุ (ปี)<input type="number" min="15" max="120" value={guarantorAge} onChange={e => setGuarantorAge(e.target.value)} className={fieldClass} required /></label>
        <div className="flex items-end text-xs leading-5 text-slate-500">กรอกข้อมูลให้ตรงตามเอกสารประจำตัวผู้ค้ำประกัน</div>
        <div className="sm:col-span-2 border-t border-slate-200 pt-4 text-sm font-medium">ที่อยู่ผู้ค้ำประกัน</div>
        <label className="text-sm">บ้านเลขที่<input value={guarantorHouseNumber} onChange={e => setGuarantorHouseNumber(e.target.value)} maxLength={500} className={fieldClass} required /></label>
        <label className="text-sm">ตรอก/ซอย<input value={guarantorSoi} onChange={e => setGuarantorSoi(e.target.value)} maxLength={500} className={fieldClass} /></label>
        <label className="text-sm">ถนน<input value={guarantorRoad} onChange={e => setGuarantorRoad(e.target.value)} maxLength={500} className={fieldClass} /></label>
        <div className="grid gap-4 sm:col-span-2 sm:grid-cols-3">
          <label className="text-sm">จังหวัด<select value={guarantorProvinceId} onChange={e => chooseGuarantorProvince(e.target.value)} className={fieldClass} required><option value="">เลือกจังหวัด</option>{provinces.map(item => <option key={item.id} value={item.id}>{item.nameTh}</option>)}</select></label>
          <label className="text-sm">เขต/อำเภอ<select value={guarantorDistrictId} onChange={e => chooseGuarantorDistrict(e.target.value)} disabled={!guarantorProvinceId} className={fieldClass} required><option value="">เลือกอำเภอ</option>{districts.map(item => <option key={item.id} value={item.id}>{item.nameTh}</option>)}</select></label>
          <label className="text-sm">แขวง/ตำบล<select value={guarantorSubdistrictId} onChange={e => setGuarantorSubdistrictId(e.target.value)} disabled={!guarantorDistrictId} className={fieldClass} required><option value="">เลือกตำบล</option>{subdistricts.map(item => <option key={item.id} value={item.id}>{item.nameTh}</option>)}</select></label>
        </div>
        <label className="text-sm sm:col-span-2">ทรัพย์ที่ผู้ค้ำประกันมอบเป็นประกัน (ถ้ามี)<textarea value={guaranteeCollateralDescription} onChange={e => setGuaranteeCollateralDescription(e.target.value)} maxLength={500} rows={2} className={fieldClass} /></label>
      </div><p className="mb-0 mt-3 text-xs text-slate-500">ชื่อและที่อยู่ผู้ให้กู้ รวมถึงยอดกู้และวันทำสัญญา จะนำจากข้อมูลสัญญาเงินกู้</p></fieldset>}
      {phase === 'GUARANTEE' && needsGuarantor && <section className="mt-5 space-y-4 rounded-2xl border border-slate-200 bg-white/50 p-4 sm:p-5">
        <WitnessCountOptions witnessCount={guaranteeWitnessCount} onWitnessChange={count => { setGuaranteeWitnessCount(count); setSignatureConsent(false) }} documentLabel="สัญญาค้ำประกัน 3.2" />
        {signingMethod === 'E_SIGNATURE' ? <><p className="mb-0 text-sm text-slate-600">ให้ผู้ค้ำประกัน ผู้ให้กู้ และพยานตามจำนวนนี้ลงลายมือชื่ออีกครั้งสำหรับสัญญาค้ำประกัน แยกจากลายเซ็นใน 3.1</p><DraftSignaturePad stage="GUARANTEE" borrowerName={borrowerName} lenderName={lenderName} guarantorName={guarantorName} witnessCount={guaranteeWitnessCount} value={draftSignatures} onChange={values => { setDraftSignatures(values); setSignatureConsent(false) }} /></> : <div><h3 className="m-0 text-sm font-semibold">ช่องลงนามในสัญญาค้ำประกัน</h3><p className="mb-0 mt-2 text-sm text-slate-600">ลงชื่อผู้ค้ำประกันและผู้ให้กู้ พร้อมพยาน {guaranteeWitnessCount === 0 ? 'ไม่มีพยาน' : `${guaranteeWitnessCount} คน`} ตามแบบสัญญา</p></div>}
      </section>}
      {phase === 'LOAN' && <section className="space-y-5 rounded-2xl border border-slate-200 bg-white/50 p-4 sm:p-6">
        <div><h3 className="m-0 text-base font-semibold">ลงรายการสัญญาเงินกู้</h3><p className="mb-0 mt-1 text-sm text-slate-500">ตรวจสอบข้อมูลผู้กู้ ผู้ให้กู้ และยอดเงินก่อนลงนาม</p></div>
        <div className="grid gap-3 sm:grid-cols-2">
          {[['ผู้กู้', borrowerName], ['ผู้ให้กู้', lenderName]].map(([label, value]) => <div key={label} className="rounded-xl border border-slate-200 bg-white px-4 py-3"><p className="m-0 text-xs text-slate-500">{label}</p><p className="mb-0 mt-1 font-semibold">{value}</p></div>)}
        </div>
        <dl className="mb-0 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {[
            ['เงินต้น', money(principalSatang)], ['ดอกเบี้ยอ้างอิงต่อเดือน', money(interestSatang)],
            ['ผู้กู้รับเงินจริง', money(netSatang)], ['ยอดชำระคืน', money(repaymentSatang)],
          ].map(([label, value], index) => <div key={label} className={`rounded-xl border px-4 py-3 ${index === 3 ? 'border-sky-200 bg-sky-50/70' : 'border-slate-200 bg-white'}`}><dt className="text-xs text-slate-500">{label}</dt><dd className="ml-0 mt-1 text-base font-semibold tabular-nums">{value}</dd></div>)}
        </dl>
        {internalRateCode && <p className="mb-0 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-900">อัตราอ้างอิงภายใน: {internalRateCode === 'CUSTOM' ? internalCustomRate || '—' : rates.find(item => item.code === internalRateCode)?.percent ?? '—'}% ต่อเดือน · ใช้คำนวณยอดตามวิธีจ่าย แต่ไม่แสดงในเอกสารสัญญา</p>}
        <div className="flex flex-wrap gap-x-8 gap-y-2 border-t border-slate-200 pt-4 text-sm text-slate-600"><p className="m-0"><span className="text-slate-500">วันที่จ่ายเงิน:</span> <span className="font-medium text-slate-800">{formatContractDate(scheduledDisbursementDate)}</span></p><p className="m-0"><span className="text-slate-500">ครบกำหนด:</span> <span className="font-medium text-slate-800">{formatContractDate(repaymentDueDate)}</span></p><p className="m-0"><span className="text-slate-500">พยานสัญญาเงินกู้ 3.1:</span> <span className="font-medium text-slate-800">{witnessCount === 0 ? 'ไม่มีพยาน' : `${witnessCount} คน`}</span></p></div>
        {documentPackage !== 'LOAN_GUARANTEE_COLLATERAL' && <label className="block text-sm font-medium">รายละเอียดหลักประกัน (ถ้ามี)<textarea value={collateralDescription} onChange={event => setCollateralDescription(event.target.value)} maxLength={2000} rows={3} placeholder="ระบุทรัพย์สินหรือหลักประกันที่ผู้กู้นำมาให้ไว้…" className={fieldClass} /><span className="mt-1 block text-xs font-normal text-slate-500">ใช้เติมในข้อ ๒ หลังคำว่า “ข้าพเจ้าได้นำ” หากไม่ระบุจะคงช่องว่างตามแบบเดิม</span></label>}
        <p className="mb-0 text-xs text-slate-500">PDF ที่กรอกข้อมูลครบจะเปิดให้ดูหรือดาวน์โหลดหลังบันทึกสัญญา</p>
        {signingMethod === 'PRINT' && <p className="mb-0 rounded-xl bg-slate-100 px-4 py-3 text-sm text-slate-600">พิมพ์เอกสารเพื่อลงลายมือชื่อ{witnessCount > 0 ? ` พร้อมพยาน ${witnessCount} คน` : ' โดยไม่มีพยาน'}</p>}
      </section>}
      {phase === 'LOAN' && signingMethod === 'E_SIGNATURE' && <DraftSignaturePad stage="LOAN" borrowerName={borrowerName} lenderName={lenderName} witnessCount={witnessCount} value={draftSignatures} onChange={values => { setDraftSignatures(values); setSignatureConsent(false) }} />}
      {phase === 'COLLATERAL' && <section className="space-y-4 rounded-2xl border border-slate-200 bg-white/40 p-4"><div><h3 className="m-0 text-sm font-semibold">รายละเอียด · สัญญาหลักประกัน</h3><p className="mb-0 mt-1 text-xs leading-5 text-slate-600">กรอกข้อมูลผู้ให้หลักประกันและทรัพย์ตามบัญชี ก (จำนอง) และ/หรือบัญชี ข (จำนำ) ข้อมูลผู้กู้ ผู้ให้กู้ ผู้ค้ำ ยอดเงิน และกำหนดชำระจะดึงจากขั้นก่อนหน้า</p></div><CollateralAgreementFields value={collateralAgreementData} onChange={next => { setCollateralAgreementData(next); setDraftSignatures(current => current.filter(item => item.documentStage !== 'COLLATERAL')); setSignatureConsent(false) }} /><WitnessCountOptions witnessCount={Number(collateralAgreementData.collateralWitnessCount ?? 2)} onWitnessChange={count => { setCollateralAgreementData(current => ({ ...current, collateralWitnessCount: String(count) })); setDraftSignatures(current => current.filter(item => item.documentStage !== 'COLLATERAL')); setSignatureConsent(false) }} documentLabel="สัญญาหลักประกัน 3.3" /><section className="rounded-xl border border-slate-200 bg-white p-3 sm:p-4"><h4 className="m-0 text-sm font-semibold">รายการลงนามในสัญญา 3.3</h4><p className="mb-3 mt-1 text-xs text-slate-500">แสดงผู้มีหน้าที่ลงนามทั้งหมด กรณี e-sign จะเซ็นคนละครั้งและแสดงลายเซ็นซ้ำในทุกตำแหน่งที่เกี่ยวข้อง</p><ul className="m-0 grid list-none gap-2 p-0 sm:grid-cols-2">{collateralSigners.map(person => <li key={person.signer} className="rounded-lg bg-slate-50 px-3 py-2"><span className="block text-xs text-slate-500">{person.label}</span><span className="mt-0.5 block text-sm font-medium text-slate-800">{person.name}</span></li>)}</ul>{(collateralAgreementData.assetAccount === 'PLEDGE' || collateralAgreementData.assetAccount === 'BOTH') && <p className="mb-0 mt-3 rounded-lg bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-900">ผู้คืนและผู้รับคืนลงชื่อในบันทึกคืนทรัพย์เมื่อชำระหนี้เสร็จและคืนทรัพย์จริง จึงไม่ต้องลงนามล่วงหน้าในขั้นนี้</p>}</section><a href="https://lawdivision.kku.ac.th/wp-content/uploads/2020/11/สัญญากู้ยืมเงินทั่วไป-แบบมีหลักประกัน.doc" target="_blank" rel="noopener noreferrer" className="inline-block text-xs text-sky-700 underline underline-offset-4">เปิดเอกสารอ้างอิงฉบับมีหลักประกัน</a></section>}
      {phase === 'COLLATERAL' && signingMethod === 'E_SIGNATURE' && !collateralSignatureSetupReady(JSON.stringify(collateralAgreementData)) && <p role="status" className="mb-0 rounded-xl bg-amber-50 p-3 text-sm text-amber-900">กรุณาระบุชื่อผู้ให้หลักประกันที่เป็นบุคคลภายนอก และเลือกฐานะผู้เก็บรักษาทรัพย์จำนำก่อนลงนาม</p>}
      {phase === 'COLLATERAL' && signingMethod === 'E_SIGNATURE' && <DraftSignaturePad stage="COLLATERAL" borrowerName={borrowerName} lenderName={lenderName} guarantorName={guarantorName} witnessCount={witnessCount} providerName={collateralAgreementData.providerName} custodianName={collateralAgreementData.custodianName} collateralAgreementData={JSON.stringify(collateralAgreementData)} value={draftSignatures} onChange={values => { setDraftSignatures(values); setSignatureConsent(false) }} />}
      {phase !== 'REVIEW' && <div className="mt-6 flex justify-end"><Button variant="primary" disabled={phase === 'DETAILS' ? !detailsReady : phase === 'GUARANTEE' ? !guarantorReady || (signingMethod === 'E_SIGNATURE' && !phaseSignaturesReady('GUARANTEE', ['GUARANTOR', 'LENDER', ...Array.from({ length: signerCount }, (_, index) => `WITNESS_${index + 1}`)])) : phase === 'LOAN' && signingMethod === 'E_SIGNATURE' && !phaseSignaturesReady('LOAN', ['BORROWER', 'LENDER', ...Array.from({ length: signerCount }, (_, index) => `WITNESS_${index + 1}`)]) || phase === 'COLLATERAL' && signingMethod === 'E_SIGNATURE' && (!collateralSignatureSetupReady(JSON.stringify(collateralAgreementData)) || !collateralSignaturesReady)} onClick={() => { nextPhase(); if (phase === 'DETAILS') setSaveError('') }}>{phase === 'DETAILS' ? 'ถัดไป: เริ่มเอกสาร 3.1' : phase === 'LOAN' ? documentStages.length > 1 ? 'ถัดไป: สัญญาค้ำประกัน 3.2' : 'ถัดไป: สรุปและบันทึก' : phase === 'GUARANTEE' ? documentPackage === 'LOAN_GUARANTEE_COLLATERAL' ? 'ถัดไป: สัญญาหลักประกัน 3.3' : 'ถัดไป: สรุปและบันทึก' : 'ถัดไป: สรุปและบันทึก'}</Button></div>}
      {phase === 'REVIEW' && <section aria-labelledby="borrower-outstanding-heading" className="mt-5 rounded-xl border border-amber-200 bg-amber-50/70 p-3.5">
        <div className="flex flex-wrap items-baseline justify-between gap-2"><h3 id="borrower-outstanding-heading" className="m-0 text-sm font-semibold text-amber-950">สัญญาเดิมที่คงค้างของผู้กู้</h3><span className="text-xs text-amber-900">{outstandingContracts.length} สัญญา</span></div>
        <p className="mb-0 mt-1 text-xs text-amber-900">ส่วนนี้แสดงเฉพาะสัญญาที่มีอยู่ก่อนเริ่มทำรายการใหม่</p>
        {outstandingContracts.length ? <ul className="mb-0 mt-2 divide-y divide-amber-200/80 p-0">{outstandingContracts.map(item => <li key={item.contractId} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 py-2 text-sm first:pt-0 last:pb-0"><span className="font-medium text-slate-800">CT-{String(item.contractId).padStart(6, '0')} · {item.label}</span><span className="tabular-nums text-slate-700">{item.amount}</span></li>)}</ul> : <p className="mb-0 mt-2 text-sm text-slate-600">ไม่พบสัญญาเดิมค้างหรือรอจ่าย จึงไม่ต้องยืนยันสถานะสัญญาเดิม</p>}
        {outstandingContracts.length > 0 && <div className="mt-3 grid gap-2 border-t border-amber-200/80 pt-3 text-sm sm:grid-cols-2">
          <label className="flex cursor-pointer items-start gap-2"><input type="checkbox" checked={outstandingReviewed} onChange={event => onOutstandingReviewedChange(event.target.checked)} className="mt-0.5 h-4 w-4 shrink-0 accent-amber-700" /><span>ตรวจสอบข้อมูลผู้กู้และสัญญาคงค้างเรียบร้อยแล้ว</span></label>
          <label className="flex cursor-pointer items-start gap-2"><input type="checkbox" checked={borrowerInformed} onChange={event => onBorrowerInformedChange(event.target.checked)} className="mt-0.5 h-4 w-4 shrink-0 accent-amber-700" /><span>แจ้งผู้กู้รับทราบสถานะสัญญาคงค้างแล้ว</span></label>
        </div>}
      </section>}
      {phase === 'REVIEW' && <div aria-live="polite" className="mt-6 rounded-2xl border border-slate-200 bg-white/50 p-5">
        <h3 className="m-0 text-sm font-semibold">สรุปสัญญาใหม่ที่กำลังจะบันทึก</h3>
        <p className="mb-4 mt-1 text-xs text-slate-500">รายการด้านล่างคือสัญญาใหม่ ยังไม่รวมในจำนวนสัญญาเดิมด้านบน เมื่อบันทึกแล้วจะอยู่ในสถานะรอจ่ายเงินหรือรออนุมัติวงเงิน</p>
        <dl className="mb-5 grid gap-4 border-b border-slate-200 pb-5 text-sm sm:grid-cols-2">
          {[
            ['ผู้กู้', borrowerName], ['ผู้ให้กู้', lenderName],
            ...(needsGuarantor ? [['ผู้ค้ำประกัน', guarantorName || '—'], ['ผู้ค้ำอยู่จังหวัด', provinces.find(item => String(item.id) === guarantorProvinceId)?.nameTh ?? '—']] : []),
            ['เอกสารสัญญา', documentChoice ? (documentChoice === 'CREATE' ? 'ทำสัญญา' : 'ไม่ทำสัญญา') : '—'],
            ...(documentChoice === 'CREATE' ? [['วิธีลงนาม', signingMethods.find(item => item.value === signingMethod)?.label ?? '—'], ['ชุดเอกสาร', documentPackages.find(item => item.value === documentPackage)?.label ?? '—'], ['พยานสัญญาเงินกู้ 3.1', witnessCount === 0 ? 'ไม่มีพยาน' : `${witnessCount} คน`], ...(needsGuarantor ? [['พยานสัญญาค้ำประกัน 3.2', guaranteeWitnessCount === 0 ? 'ไม่มีพยาน' : `${guaranteeWitnessCount} คน`]] : [])] : []),
            ['วันที่จ่ายเงินให้ผู้กู้', formatContractDate(scheduledDisbursementDate)],
            ['วันครบกำหนดรับชำระคืน', formatContractDate(repaymentDueDate)],
            ...(limitApprovalNeeded ? [['สถานะวงเงิน', `เกินวงเงินคงเหลือ ${new Intl.NumberFormat('th-TH').format(Math.max(0, amount - availableLimit))} บาท · รออนุมัติก่อนจ่าย`]] : []),
            ['รายละเอียดหลักประกัน', collateralDescription.trim() || 'เว้นว่างตามแบบเดิม'],
            ['ยอดเงินต้น', money(validPrincipal ? principalSatang : null)],
            ['วิธีจ่ายเงิน', interestMethod === 'INTEREST_UPFRONT' ? 'หักดอกเบี้ยก่อนจ่าย · คืนเงินต้น' : 'รับเงินต้นเต็มจำนวน · คืนเงินต้นพร้อมดอกเบี้ย'],
            ['อัตราอ้างอิงภายใน', internalRateCode ? `${internalRateCode === 'CUSTOM' ? internalCustomRate || '—' : rates.find(item => item.code === internalRateCode)?.percent ?? '—'}% ต่อเดือน` : 'ไม่ระบุ'],
            ['อัตราดอกเบี้ยในเอกสาร', 'เว้นว่าง'],
            ...(selectedPersuader ? [['Persuader', selectedPersuader.name], ['ส่วนแบ่งภายใน', `${persuaderSharePercent}% ของเงินต้น · ${money(persuaderShareSatang)}`]] : []),
          ].map(([label, value]) => <div key={label}><dt className="text-xs text-slate-500">{label}</dt><dd className="ml-0 mt-1 font-medium">{value}</dd></div>)}
        </dl>
        <dl className="mb-0 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {[
            ['เงินต้น', money(validPrincipal ? principalSatang : null)],
            ['ดอกเบี้ยอ้างอิงต่อเดือน', money(validPrincipal ? interestSatang : null)],
            ['ยอดรับเงินจริง', money(netSatang)],
            ['ยอดชำระเงินกู้', money(repaymentSatang)],
          ].map(([label, value]) => <div key={label}><dt className="text-xs text-slate-500">{label}</dt><dd className="ml-0 mt-2 text-lg font-semibold">{value}</dd></div>)}
        </dl>
        {canCalculate && <p className="mb-0 mt-4 text-xs text-slate-500">คำนวณดอกเบี้ยในระบบตามวิธีจ่ายที่เลือก · เอกสารสัญญาอ้างเงินต้นและเว้นช่องอัตราดอกเบี้ย</p>}
        {selectedPersuader && <p className="mb-0 mt-2 rounded-lg bg-violet-50 px-3 py-2 text-xs text-violet-900">ส่วนแบ่ง Persuader เป็นข้อมูลภายใน คำนวณจากเงินต้นและไม่แสดงในเอกสารสัญญา · จะเป็นยอดรอจ่ายเมื่อผู้กู้ชำระครบสัญญา</p>}
      </div>}
      {phase === 'REVIEW' && documentChoice === 'CREATE' && <section className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-sky-200 bg-sky-50/70 p-4">
        <div><h3 className="m-0 text-sm font-semibold text-slate-800">ตรวจหนังสือสัญญาก่อนบันทึก</h3><p className="mb-0 mt-1 text-xs leading-5 text-slate-600">เปิด PDF ตัวอย่างที่กรอกจากข้อมูลนี้ได้ก่อน ยังไม่สร้างเลขที่สัญญาและยังไม่บันทึกข้อมูล</p></div>
        <Button onClick={() => void previewLoanAgreement()} disabled={!ready || previewLoading}>{previewLoading ? 'กำลังสร้างตัวอย่าง…' : 'ดูตัวอย่างหนังสือสัญญา PDF'}</Button>
        {previewError && <p role="alert" className="mb-0 basis-full text-sm text-red-700">{previewError}</p>}
      </section>}
      {phase === 'REVIEW' && activeSignatures.length > 0 && <section className="mt-5 rounded-2xl border border-slate-200 p-4">
        <h3 className="m-0 text-sm font-semibold">ลายเซ็นสำหรับประทับในเอกสาร</h3>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">{activeSignatures.map(signature => <figure key={`${signature.documentStage}-${signature.signer}`} className="m-0 rounded-xl bg-white p-3"><figcaption className="text-xs">{signature.documentStage === 'LOAN' ? '3.1 · ' : signature.documentStage === 'GUARANTEE' ? '3.2 · ' : '3.3 · '}{signature.signer === 'BORROWER' ? borrowerName : signature.signer === 'LENDER' ? lenderName : signature.signer === 'GUARANTOR' ? guarantorName : signature.signer === 'PROVIDER' ? signature.signerName : signature.signer === 'CUSTODIAN' ? signature.signerName : signature.witnessName}</figcaption><Image src={signature.signatureData} alt="ตัวอย่างลายเซ็นก่อนยืนยัน" width={480} height={160} unoptimized className="h-20 w-full object-contain" /></figure>)}</div>
        <label className="mt-4 flex items-start gap-3 text-sm leading-6"><input type="checkbox" checked={signatureConsent} onChange={event => setSignatureConsent(event.target.checked)} className="mt-1 h-4 w-4 shrink-0" /><span>ผู้ลงนามตรวจสอบรายละเอียดสัญญาและลายเซ็นของตนข้างต้นแล้ว และยินยอมให้นำลายเซ็นไปประทับในเอกสารสัญญานี้</span></label>
      </section>}
      {phase === 'REVIEW' && signingMethod === 'E_SIGNATURE' && !signaturesReady && <p role="alert" className="mt-4 text-sm text-red-700">กรุณาให้ผู้ลงนามและพยานตามที่เลือกลงลายมือชื่อในขั้นเอกสารให้ครบก่อนบันทึก</p>}
      {saveError && <p role="alert" className="text-sm text-red-700">{saveError}</p>}
      {savedCode ? <p role="status" className="mt-5 text-sm text-emerald-800">บันทึกสัญญา {savedCode} สำเร็จ · {limitApprovalNeeded ? 'รออนุมัติวงเงินก่อนจ่ายเงินจริง' : 'รอจ่ายเงิน'}</p> : phase === 'REVIEW' && <div className="mt-6 flex justify-end">
        <Button variant="primary" disabled={saving || !ready || (outstandingContracts.length > 0 && (!outstandingReviewed || !borrowerInformed)) || !signaturesReady || (activeSignatures.length > 0 && !signatureConsent)} onClick={save}>{saving ? 'กำลังบันทึก…' : 'ยืนยันและบันทึกสัญญา'}</Button>
      </div>}
      {phase === 'REVIEW' && !savedCode && <p className="mb-0 mt-3 text-xs text-slate-500">บันทึกเป็นสถานะรอจ่ายเงิน · บันทึกเอกสารและลายเซ็นตามขั้นตอนที่เลือก</p>}
      <Modal open={Boolean(previewUrl)} title="ตัวอย่างหนังสือสัญญาเงินกู้" description="ร่างตรวจทานก่อนบันทึก · ยังไม่มีเลขที่สัญญาและยังไม่ลงนาม" onClose={() => setPreviewUrl('')} className="!h-[calc(100dvh-2rem)] !max-w-6xl">
        {previewUrl && <div className="flex h-[calc(100%-5rem)] min-h-0 flex-col gap-3"><iframe src={`${previewUrl}#view=FitH`} title="ตัวอย่างหนังสือสัญญาเงินกู้ก่อนบันทึก" className="min-h-0 flex-1 rounded-xl border border-slate-200 bg-white" /><div className="flex flex-wrap justify-end gap-2"><a href={previewUrl} download="ร่างตรวจทาน-หนังสือสัญญาเงินกู้.pdf" className="action-button action-button--secondary">ดาวน์โหลดร่างตรวจทาน</a><Button onClick={() => setPreviewUrl('')}>กลับไปตรวจข้อมูล</Button></div></div>}
      </Modal>
    </Card>
  </div>
}
