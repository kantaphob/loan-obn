'use client'

import { useEffect, useId, useRef, useState } from 'react'
import { Card } from '@/components/ui/card'
import Image from 'next/image'
import { DraftSignaturePad } from './draft-signature-pad'
import { Button } from '@/components/ui/button'
import { validContractSchedule, formatContractDate, type DraftContractSignature } from '@/lib/contracts'
import { getContractInterestRates, getContractProvinces, getContractDistricts, getContractSubdistricts, saveContract, signContract } from './actions'
import { ContractDocumentOptions, WitnessCountOptions, signingMethods, documentPackages } from './contract-document-options'
import { CollateralAgreementFields, type CollateralAgreementValues } from './collateral-agreement-fields'
import { collateralAgreementSigners, collateralSignatureSetupReady, type ContractDocumentStage } from '@/lib/contracts'

const contractTypes = [
  { value: 'INTEREST_UPFRONT', label: 'ชำระดอกเบี้ยล่วงหน้า' },
  { value: 'INTEREST_WITH_PRINCIPAL', label: 'ชำระต้นพร้อมดอกเบี้ย' },
] as const

type ContractType = typeof contractTypes[number]['value']
type ContractPhase = 'DETAILS' | 'LOAN' | 'GUARANTEE' | 'COLLATERAL' | 'REVIEW'

export function ContractDetailsStep({ borrowerName, lenderName, onBack, borrowerId, lenderId, onReview, onSaved }: { borrowerName: string; lenderName: string; borrowerId: number; lenderId: number; onBack: () => void; onReview: (reviewing: boolean) => void; onSaved?: (code: string, contractId: number, signingMethod: string | null) => void }) {
  const groupId = useId()
  const [phase, setPhase] = useState<ContractPhase>('DETAILS')
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState('')
  const [savedCode, setSavedCode] = useState('')
  const requestKey = useRef('')
  const saveLock = useRef(false)
  const [signingMethod, setSigningMethod] = useState('')
  const [documentPackage, setDocumentPackage] = useState('')
  const [witnessCount, setWitnessCount] = useState(2)
  const [guaranteeWitnessCount, setGuaranteeWitnessCount] = useState(2)
  const [documentChoice, setDocumentChoice] = useState<'CREATE' | 'NONE' | ''>('')
  const [contractType, setContractType] = useState<ContractType | ''>('')
  const [principal, setPrincipal] = useState('')
  const [draftSignatures, setDraftSignatures] = useState<DraftContractSignature[]>([])
  const [signatureConsent, setSignatureConsent] = useState(false)
  const [collateralDescription, setCollateralDescription] = useState('')
  const [collateralAgreementData, setCollateralAgreementData] = useState<CollateralAgreementValues>({ assetAccount: 'BOTH', providerRole: 'ลูกหนี้' })
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
  const [rateCode, setRateCode] = useState('')
  const [customRate, setCustomRate] = useState('')
  const [rates, setRates] = useState<Awaited<ReturnType<typeof getContractInterestRates>>>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const guarantorName = [guarantorTitle, guarantorFirstName, guarantorLastName].map(value => value.trim()).filter(Boolean).join(' ')

  useEffect(() => {
    let cancelled = false
    Promise.all([getContractInterestRates(), getContractProvinces()]).then(([values, locationValues]) => { if (!cancelled) { setRates(values); setProvinces(locationValues) } })
      .catch(() => { if (!cancelled) setError('โหลดอัตราดอกเบี้ยไม่สำเร็จ กรุณาปิดและเปิดหน้าต่างอีกครั้ง') })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [])

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
  const rate = rates.find(item => item.code === rateCode)
  const validCustomRate = /^\d+(?:\.\d{1,2})?$/.test(customRate) && Number(customRate) >= 0 && Number(customRate) <= 100
  const percent = rateCode === 'CUSTOM' ? (validCustomRate ? Number(customRate) : null) : rate?.percent ?? null
  const principalSatang = Math.round(amount * 100)
  const interestSatang = validPrincipal && percent !== null ? Math.round(principalSatang * percent / 100) : null
  const canCalculate = validPrincipal && interestSatang !== null && contractType !== ''
  const netSatang = canCalculate ? principalSatang - (contractType === 'INTEREST_UPFRONT' ? interestSatang! : 0) : null
  const repaymentSatang = canCalculate ? principalSatang + (contractType === 'INTEREST_UPFRONT' ? 0 : interestSatang!) : null
  const money = (satang: number | null) => satang === null ? '—' : new Intl.NumberFormat('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(satang / 100) + ' บาท'
const fieldClass = 'mt-1.5 w-full rounded-lg border border-slate-300 bg-white/70 px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-slate-400/30'


  const needsGuarantor = documentChoice === 'CREATE' && documentPackage !== '' && documentPackage !== 'LOAN'
  const activeSignatures = documentChoice === 'CREATE' && signingMethod === 'E_SIGNATURE' ? draftSignatures.filter(item => (item.documentStage === 'LOAN' || needsGuarantor && item.documentStage === 'GUARANTEE' || documentPackage === 'LOAN_GUARANTEE_COLLATERAL' && item.documentStage === 'COLLATERAL') && (!item.signer.startsWith('WITNESS_') || Number(item.signer.slice(-1)) <= (item.documentStage === 'GUARANTEE' ? guaranteeWitnessCount : witnessCount))) : []
  const guarantorReady = !needsGuarantor || Boolean(guarantorTitle.trim() && guarantorFirstName.trim() && guarantorLastName.trim() && /^\d{1,3}$/.test(guarantorAge) && Number(guarantorAge) >= 15 && guarantorHouseNumber.trim() && guarantorProvinceId && guarantorDistrictId && guarantorSubdistrictId)
  const detailsReady = validSchedule && canCalculate && Boolean(documentChoice) && (documentChoice !== 'CREATE' || Boolean(signingMethod && documentPackage)) && netSatang !== null && netSatang >= 0
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
  const collateralSignaturesReady = collateralAgreementSigners({ borrowerName, lenderName, guarantorName, witnessCount, collateralAgreementData: JSON.stringify(collateralAgreementData) }).every(required => activeSignatures.some(signature => signature.documentStage === 'COLLATERAL' && signature.signer === required.signer))
  const documentStages: Exclude<ContractPhase, 'DETAILS' | 'REVIEW'>[] = documentChoice !== 'CREATE' ? [] : ['LOAN', ...(needsGuarantor ? ['GUARANTEE' as const] : []), ...(documentPackage === 'LOAN_GUARANTEE_COLLATERAL' ? ['COLLATERAL' as const] : [])]
  const phaseTitle: Record<ContractPhase, string> = { DETAILS: 'Step 3 · รายละเอียดเงินกู้และเลือกชุดเอกสาร', LOAN: 'Step 3.1 · สัญญาเงินกู้', GUARANTEE: 'Step 3.2 · สัญญาค้ำประกัน', COLLATERAL: 'Step 3.3 · สัญญากู้ยืมแบบมีหลักประกัน', REVIEW: 'สรุปรายการและบันทึก' }
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
    if (!ready || (activeSignatures.length > 0 && !signatureConsent) || saveLock.current || savedCode) return
    saveLock.current = true
    setSaving(true)
    setSaveError('')
    if (!requestKey.current) requestKey.current = crypto.randomUUID()
    try {
      const result = await saveContract({ borrowerId, lenderId, requestKey: requestKey.current, witnessCount, guaranteeWitnessCount, documentChoice, signingMethod, documentPackage, interestMethod: contractType, rateCode, customRate, principal, collateralDescription, collateralAgreementData: JSON.stringify(collateralAgreementData), guarantorName, guarantorAge, guarantorHouseNumber, guarantorSoi, guarantorRoad, guarantorProvinceId, guarantorDistrictId, guarantorSubdistrictId, guaranteeCollateralDescription, scheduledDisbursementDate, repaymentDueDate })
      if (result.error) { setSaveError(result.error); return }
      if (result.code && result.id) {
        for (const signature of activeSignatures) {
          const signed = await signContract({ contractId: result.id, ...signature, accepted: signatureConsent })
          if (signed.error) { setSaveError(`บันทึกสัญญาแล้ว แต่ลายเซ็นยังไม่ครบ: ${signed.error}`); break }
        }
        setSavedCode(result.code)
        onSaved?.(result.code, result.id, documentChoice === 'CREATE' && signingMethod === 'E_SIGNATURE' ? 'E_SIGNATURE' : null)
      }
    } catch { setSaveError('เชื่อมต่อไม่สำเร็จ กรุณาลองบันทึกอีกครั้ง') }
    finally { setSaving(false); saveLock.current = false }
  }

  return <div className="space-y-5">
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-white/50 p-4 text-sm">
      
      <Button disabled={saving || Boolean(savedCode)} onClick={previousPhase}>{phase === 'DETAILS' ? 'ย้อนกลับ: เลือกผู้ให้กู้' : phase === 'REVIEW' ? 'ย้อนกลับ: แก้ไข' : 'ย้อนกลับ'}</Button>
    </div>
    <Card as="section" className="p-4 sm:p-5">
      <h2 className="m-0 text-base font-semibold">{phaseTitle[phase]}</h2>
      {phase !== 'REVIEW' && documentChoice === 'CREATE' && documentPackage && <ol aria-label="ขั้นตอนเอกสารสัญญา" className="my-3 flex flex-wrap gap-2 p-0">
        {(['LOAN', ...(needsGuarantor ? ['GUARANTEE' as const] : []), ...(documentPackage === 'LOAN_GUARANTEE_COLLATERAL' ? ['COLLATERAL' as const] : [])] as const).map((item, index) => <li key={item} aria-current={phase === item ? 'step' : undefined} className={`flex-1 basis-56 list-none rounded-lg border px-3 py-2 text-xs ${phase === item ? 'border-slate-500 bg-white font-semibold text-slate-800 shadow-sm' : 'border-slate-200 bg-white/40 text-slate-500'}`}><span className="mr-2 inline-grid h-5 w-5 place-items-center rounded-full bg-slate-100 text-[10px]">3.{index + 1}</span>{item === 'LOAN' ? 'สัญญาเงินกู้' : item === 'GUARANTEE' ? 'สัญญาค้ำประกัน' : 'สัญญาหลักประกัน'}</li>)}
      </ol>}
      {phase === 'DETAILS' && <div>
      <fieldset className="m-0 mt-4 min-w-0 border-0 p-0">
        <legend className="mb-2 text-sm font-medium">1. การจัดทำเอกสารสัญญา</legend>
        <div className="grid gap-2 sm:grid-cols-2">
          {([{ value: 'CREATE', label: 'ทำสัญญา' }, { value: 'NONE', label: 'ไม่ทำสัญญา' }] as const).map(option => <label key={option.value} className={`flex cursor-pointer items-center gap-2.5 rounded-xl border p-3.5 text-sm ${documentChoice === option.value ? 'border-emerald-600 bg-emerald-50/70' : 'border-slate-300 bg-white/40'} focus-within:ring-2 focus-within:ring-slate-400`}>
            <input type="radio" name={`${groupId}-document`} value={option.value} checked={documentChoice === option.value} onChange={() => setDocumentChoice(option.value)} className="h-4 w-4 shrink-0 accent-emerald-700" />
            <span className="font-medium">{option.label}</span>
          </label>)}
        </div>
      </fieldset>
      <div hidden={documentChoice !== 'CREATE'}><ContractDocumentOptions witnessCount={witnessCount} onWitnessChange={setWitnessCount} signingMethod={signingMethod} documentPackage={documentPackage} onSigningChange={setSigningMethod} onPackageChange={setDocumentPackage} /></div>
      <fieldset className="m-0 mt-4 min-w-0 border-0 p-0">
        <legend className="mb-2 text-sm font-medium">2. วิธีชำระดอกเบี้ย</legend>
        <div className="grid gap-2 sm:grid-cols-2">
          {contractTypes.map(type => <label key={type.value} className={`flex cursor-pointer items-center gap-2.5 rounded-xl border p-3.5 text-sm ${contractType === type.value ? 'border-emerald-600 bg-emerald-50/70' : 'border-slate-300 bg-white/40'} focus-within:ring-2 focus-within:ring-slate-400`}>
            <input type="radio" name={groupId} value={type.value} checked={contractType === type.value} onChange={() => setContractType(type.value)} className="h-4 w-4 shrink-0 accent-emerald-700" />
            <span><span className="block font-medium">{type.label}</span>
              <span className="mt-1 block text-xs font-normal leading-4 text-slate-500">{type.value === 'INTEREST_UPFRONT' ? 'หักดอกเบี้ยจากเงินที่จ่าย ชำระคืนเฉพาะเงินต้น' : 'รับเงินต้นเต็มจำนวน ชำระคืนเงินต้นรวมดอกเบี้ย'}</span>
            </span>
          </label>)}
        </div>
      </fieldset>
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <label className="text-sm font-medium">ยอดเงินต้น (บาท)
          <input type="number" min="0.01" max="2000000000" step="0.01" inputMode="decimal" value={principal} onChange={event => setPrincipal(event.target.value)} placeholder="ระบุยอดเงินต้น" aria-invalid={Boolean(principal && !validPrincipal)} className={fieldClass} />
          {principal && !validPrincipal && <span className="mt-1 block text-xs text-red-700">ระบุยอดมากกว่า 0 ถึง 2,000,000,000 บาท ทศนิยมไม่เกิน 2 ตำแหน่ง</span>}
        </label>
        <label className="text-sm font-medium">ดอกร้อยละ (%)
          <select value={rateCode} onChange={event => setRateCode(event.target.value)} className={fieldClass}>
            <option value="">{loading ? 'กำลังโหลด Masterdata…' : 'เลือกอัตราดอกเบี้ย'}</option>
            {rates.map(item => <option key={item.code} value={item.code}>ร้อยละ {item.percent}</option>)}
            <option value="CUSTOM">กำหนดเอง</option>
          </select>
          <span className="mt-1 block text-xs font-normal text-slate-500">อ้างอิงจาก Masterdata · ร้อยละดอกเบี้ย</span>
        </label>
        {rateCode === 'CUSTOM' && <label className="text-sm font-medium">กำหนดดอกร้อยละเอง (%)
          <input type="number" min="0" max="100" step="0.01" inputMode="decimal" value={customRate} onChange={event => setCustomRate(event.target.value)} placeholder="เช่น 7.5" aria-invalid={Boolean(customRate && !validCustomRate)} className={fieldClass} />
          {customRate && !validCustomRate && <span className="mt-1 block text-xs text-red-700">ระบุร้อยละ 0–100 ทศนิยมไม่เกิน 2 ตำแหน่ง</span>}
        </label>}
      </div>
      <fieldset className="m-0 mt-4 min-w-0 border-0 p-0">
        <legend className="mb-2 text-sm font-medium">3. กำหนดรับและจ่ายเงิน</legend>
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
      <section aria-live="polite" aria-label="สรุปยอดเงินกู้" className="mt-4 rounded-xl border border-slate-200 bg-white/60 p-3.5 sm:p-4">
        <h3 className="m-0 text-sm font-semibold">สรุปยอดเงินกู้</h3>
        {canCalculate ? <dl className="mb-0 mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {[
            ['เงินต้น', money(principalSatang)],
            ['ดอกเบี้ย', money(interestSatang)],
            ['ยอดรับเงินจริง', money(netSatang)],
            ['ยอดชำระคืนทั้งหมด', money(repaymentSatang)],
          ].map(([label, value]) => <div key={label} className="rounded-lg bg-slate-50 px-3 py-2.5">
            <dt className="text-xs text-slate-500">{label}</dt>
            <dd className="ml-0 mt-1 text-sm font-semibold tabular-nums">{value}</dd>
          </div>)}
        </dl> : <p className="mb-0 mt-2 text-sm text-slate-500">ระบุเงินต้น เลือกอัตราดอกเบี้ย และวิธีชำระดอกเบี้ย เพื่อดูยอดคำนวณ</p>}
        {canCalculate && <p className="mb-0 mt-3 text-xs text-slate-500">{contractType === 'INTEREST_UPFRONT' ? 'หักดอกเบี้ยจากเงินต้นก่อนจ่าย และชำระคืนเฉพาะเงินต้น' : 'รับเงินต้นเต็มจำนวน และชำระคืนเงินต้นรวมดอกเบี้ย'}</p>}
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
            ['เงินต้น', money(principalSatang)], ['ดอกเบี้ย', money(interestSatang)],
            ['ผู้กู้รับเงินจริง', money(netSatang)], ['ยอดชำระคืน', money(repaymentSatang)],
          ].map(([label, value], index) => <div key={label} className={`rounded-xl border px-4 py-3 ${index === 3 ? 'border-sky-200 bg-sky-50/70' : 'border-slate-200 bg-white'}`}><dt className="text-xs text-slate-500">{label}</dt><dd className="ml-0 mt-1 text-base font-semibold tabular-nums">{value}</dd></div>)}
        </dl>
        <div className="flex flex-wrap gap-x-8 gap-y-2 border-t border-slate-200 pt-4 text-sm text-slate-600"><p className="m-0"><span className="text-slate-500">วันที่จ่ายเงิน:</span> <span className="font-medium text-slate-800">{formatContractDate(scheduledDisbursementDate)}</span></p><p className="m-0"><span className="text-slate-500">ครบกำหนด:</span> <span className="font-medium text-slate-800">{formatContractDate(repaymentDueDate)}</span></p><p className="m-0"><span className="text-slate-500">พยานสัญญาเงินกู้ 3.1:</span> <span className="font-medium text-slate-800">{witnessCount === 0 ? 'ไม่มีพยาน' : `${witnessCount} คน`}</span></p></div>
        {documentPackage !== 'LOAN_GUARANTEE_COLLATERAL' && <label className="block text-sm font-medium">รายละเอียดหลักประกัน (ถ้ามี)<textarea value={collateralDescription} onChange={event => setCollateralDescription(event.target.value)} maxLength={2000} rows={3} placeholder="ระบุทรัพย์สินหรือหลักประกันที่ผู้กู้นำมาให้ไว้…" className={fieldClass} /><span className="mt-1 block text-xs font-normal text-slate-500">ใช้เติมในข้อ ๒ หลังคำว่า “ข้าพเจ้าได้นำ” หากไม่ระบุจะคงช่องว่างตามแบบเดิม</span></label>}
        <p className="mb-0 text-xs text-slate-500">PDF ที่กรอกข้อมูลครบจะเปิดให้ดูหรือดาวน์โหลดหลังบันทึกสัญญา</p>
        {signingMethod === 'PRINT' && <p className="mb-0 rounded-xl bg-slate-100 px-4 py-3 text-sm text-slate-600">พิมพ์เอกสารเพื่อลงลายมือชื่อ{witnessCount > 0 ? ` พร้อมพยาน ${witnessCount} คน` : ' โดยไม่มีพยาน'}</p>}
      </section>}
      {phase === 'LOAN' && signingMethod === 'E_SIGNATURE' && <DraftSignaturePad stage="LOAN" borrowerName={borrowerName} lenderName={lenderName} witnessCount={witnessCount} value={draftSignatures} onChange={values => { setDraftSignatures(values); setSignatureConsent(false) }} />}
      {phase === 'COLLATERAL' && <section className="space-y-4 rounded-2xl border border-slate-200 bg-white/40 p-4"><div><h3 className="m-0 text-sm font-semibold">รายละเอียด · สัญญาหลักประกัน</h3><p className="mb-0 mt-1 text-xs leading-5 text-slate-600">กรอกข้อมูลผู้ให้หลักประกันและทรัพย์ตามบัญชี ก (จำนอง) และ/หรือบัญชี ข (จำนำ) ข้อมูลผู้กู้ ผู้ให้กู้ ผู้ค้ำ ยอดเงิน และกำหนดชำระจะดึงจากขั้นก่อนหน้า</p></div><CollateralAgreementFields value={collateralAgreementData} onChange={next => { setCollateralAgreementData(next); setDraftSignatures(current => current.filter(item => item.documentStage !== 'COLLATERAL')); setSignatureConsent(false) }} /><a href="https://lawdivision.kku.ac.th/wp-content/uploads/2020/11/สัญญากู้ยืมเงินทั่วไป-แบบมีหลักประกัน.doc" target="_blank" rel="noopener noreferrer" className="inline-block text-xs text-sky-700 underline underline-offset-4">เปิดเอกสารอ้างอิงฉบับมีหลักประกัน</a></section>}
      {phase === 'COLLATERAL' && signingMethod === 'E_SIGNATURE' && <DraftSignaturePad stage="COLLATERAL" borrowerName={borrowerName} lenderName={lenderName} guarantorName={guarantorName} witnessCount={witnessCount} providerName={collateralAgreementData.providerName} custodianName={collateralAgreementData.custodianName} collateralAgreementData={JSON.stringify(collateralAgreementData)} value={draftSignatures} onChange={values => { setDraftSignatures(values); setSignatureConsent(false) }} />}
      {phase !== 'REVIEW' && <div className="mt-6 flex justify-end"><Button variant="primary" disabled={phase === 'DETAILS' ? !detailsReady : phase === 'GUARANTEE' ? !guarantorReady || (signingMethod === 'E_SIGNATURE' && !phaseSignaturesReady('GUARANTEE', ['GUARANTOR', 'LENDER', ...Array.from({ length: signerCount }, (_, index) => `WITNESS_${index + 1}`)])) : phase === 'LOAN' && signingMethod === 'E_SIGNATURE' && !phaseSignaturesReady('LOAN', ['BORROWER', 'LENDER', ...Array.from({ length: signerCount }, (_, index) => `WITNESS_${index + 1}`)]) || phase === 'COLLATERAL' && signingMethod === 'E_SIGNATURE' && (!collateralSignatureSetupReady(JSON.stringify(collateralAgreementData)) || !collateralSignaturesReady)} onClick={() => { nextPhase(); if (phase === 'DETAILS') setSaveError('') }}>{phase === 'DETAILS' ? 'ถัดไป: เริ่มเอกสาร 3.1' : phase === 'LOAN' ? documentStages.length > 1 ? 'ถัดไป: สัญญาค้ำประกัน 3.2' : 'ถัดไป: สรุปและบันทึก' : phase === 'GUARANTEE' ? documentPackage === 'LOAN_GUARANTEE_COLLATERAL' ? 'ถัดไป: สัญญาหลักประกัน 3.3' : 'ถัดไป: สรุปและบันทึก' : 'ถัดไป: สรุปและบันทึก'}</Button></div>}
      {phase === 'REVIEW' && <div aria-live="polite" className="mt-6 rounded-2xl border border-slate-200 bg-white/50 p-5">
        <h3 className="m-0 text-sm font-semibold">สรุปรายละเอียดสัญญา</h3>
        <dl className="mb-5 grid gap-4 border-b border-slate-200 pb-5 text-sm sm:grid-cols-2">
          {[
            ['ผู้กู้', borrowerName], ['ผู้ให้กู้', lenderName],
            ...(needsGuarantor ? [['ผู้ค้ำประกัน', guarantorName || '—'], ['ผู้ค้ำอยู่จังหวัด', provinces.find(item => String(item.id) === guarantorProvinceId)?.nameTh ?? '—']] : []),
            ['เอกสารสัญญา', documentChoice ? (documentChoice === 'CREATE' ? 'ทำสัญญา' : 'ไม่ทำสัญญา') : '—'],
            ...(documentChoice === 'CREATE' ? [['วิธีลงนาม', signingMethods.find(item => item.value === signingMethod)?.label ?? '—'], ['ชุดเอกสาร', documentPackages.find(item => item.value === documentPackage)?.label ?? '—'], ['พยานสัญญาเงินกู้ 3.1', witnessCount === 0 ? 'ไม่มีพยาน' : `${witnessCount} คน`], ...(needsGuarantor ? [['พยานสัญญาค้ำประกัน 3.2', guaranteeWitnessCount === 0 ? 'ไม่มีพยาน' : `${guaranteeWitnessCount} คน`]] : [])] : []),
            ['วิธีชำระดอกเบี้ย', contractTypes.find(item => item.value === contractType)?.label ?? '—'],
            ['วันที่จ่ายเงินให้ผู้กู้', formatContractDate(scheduledDisbursementDate)],
            ['วันครบกำหนดรับชำระคืน', formatContractDate(repaymentDueDate)],
            ['รายละเอียดหลักประกัน', collateralDescription.trim() || 'เว้นว่างตามแบบเดิม'],
            ['ยอดเงินต้น', money(validPrincipal ? principalSatang : null)],
            ['ดอกร้อยละ', percent === null ? '—' : `${percent}%`],
          ].map(([label, value]) => <div key={label}><dt className="text-xs text-slate-500">{label}</dt><dd className="ml-0 mt-1 font-medium">{value}</dd></div>)}
        </dl>
        <dl className="mb-0 grid gap-4 sm:grid-cols-3">
          {[
            ['ดอกเบี้ย', money(canCalculate ? interestSatang : null)],
            ['ยอดรับเงินจริง', money(netSatang)],
            ['ยอดชำระเงินกู้', money(repaymentSatang)],
          ].map(([label, value]) => <div key={label}><dt className="text-xs text-slate-500">{label}</dt><dd className="ml-0 mt-2 text-lg font-semibold">{value}</dd></div>)}
        </dl>
        {canCalculate && <p className="mb-0 mt-4 text-xs text-slate-500">คำนวณดอกหนึ่งครั้งจากเงินต้น × ร้อยละที่เลือก{contractType === 'INTEREST_UPFRONT' ? ' · หักดอกจากยอดรับเงินจริง ชำระคืนเฉพาะเงินต้น' : ' · ชำระเงินต้นรวมดอกเบี้ย'}</p>}
        {netSatang !== null && netSatang < 0 && <p role="alert" className="text-sm text-red-700">ดอกเบี้ยเกินเงินต้น กรุณาตรวจสอบอัตราดอกเบี้ย</p>}
      </div>}
      {phase === 'REVIEW' && activeSignatures.length > 0 && <section className="mt-5 rounded-2xl border border-slate-200 p-4">
        <h3 className="m-0 text-sm font-semibold">ลายเซ็นสำหรับประทับในเอกสาร</h3>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">{activeSignatures.map(signature => <figure key={`${signature.documentStage}-${signature.signer}`} className="m-0 rounded-xl bg-white p-3"><figcaption className="text-xs">{signature.documentStage === 'LOAN' ? '3.1 · ' : signature.documentStage === 'GUARANTEE' ? '3.2 · ' : '3.3 · '}{signature.signer === 'BORROWER' ? borrowerName : signature.signer === 'LENDER' ? lenderName : signature.signer === 'GUARANTOR' ? guarantorName : signature.signer === 'PROVIDER' ? signature.signerName : signature.signer === 'CUSTODIAN' ? signature.signerName : signature.witnessName}</figcaption><Image src={signature.signatureData} alt="ตัวอย่างลายเซ็นก่อนยืนยัน" width={480} height={160} unoptimized className="h-20 w-full object-contain" /></figure>)}</div>
        <label className="mt-4 flex items-start gap-3 text-sm leading-6"><input type="checkbox" checked={signatureConsent} onChange={event => setSignatureConsent(event.target.checked)} className="mt-1 h-4 w-4 shrink-0" /><span>ผู้ลงนามตรวจสอบรายละเอียดสัญญาและลายเซ็นของตนข้างต้นแล้ว และยินยอมให้นำลายเซ็นไปประทับในเอกสารสัญญานี้</span></label>
      </section>}
      {phase === 'REVIEW' && signingMethod === 'E_SIGNATURE' && !signaturesReady && <p role="alert" className="mt-4 text-sm text-red-700">กรุณาให้ผู้ลงนามและพยานตามที่เลือกลงลายมือชื่อในขั้นเอกสารให้ครบก่อนบันทึก</p>}
      {saveError && <p role="alert" className="text-sm text-red-700">{saveError}</p>}
      {savedCode ? <p role="status" className="mt-5 text-sm text-emerald-800">บันทึกสัญญา {savedCode} สำเร็จ · รอจ่ายเงิน</p> : phase === 'REVIEW' && <div className="mt-6 flex justify-end">
        <Button variant="primary" disabled={saving || !ready || !signaturesReady || (activeSignatures.length > 0 && !signatureConsent)} onClick={save}>{saving ? 'กำลังบันทึก…' : 'ยืนยันและบันทึกสัญญา'}</Button>
      </div>}
      {phase === 'REVIEW' && !savedCode && <p className="mb-0 mt-3 text-xs text-slate-500">บันทึกเป็นสถานะรอจ่ายเงิน · บันทึกเอกสารและลายเซ็นตามขั้นตอนที่เลือก</p>}
    </Card>
  </div>
}
