'use client'

import { useEffect, useId, useRef, useState } from 'react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { getContractInterestRates, saveContract } from './actions'
import { ContractDocumentOptions, signingMethods, documentPackages } from './contract-document-options'

const contractTypes = [
  { value: 'INTEREST_UPFRONT', label: 'ชำระดอกเบี้ยล่วงหน้า' },
  { value: 'INTEREST_WITH_PRINCIPAL', label: 'ชำระต้นพร้อมดอกเบี้ย' },
] as const

type ContractType = typeof contractTypes[number]['value']

export function ContractDetailsStep({ borrowerName, lenderName, onBack, borrowerId, lenderId, onReview, onSaved }: { borrowerName: string; lenderName: string; borrowerId: number; lenderId: number; onBack: () => void; onReview: (reviewing: boolean) => void; onSaved?: (code: string) => void }) {
  const groupId = useId()
  const [reviewing, setReviewing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState('')
  const [savedCode, setSavedCode] = useState('')
  const requestKey = useRef('')
  const saveLock = useRef(false)
  const [signingMethod, setSigningMethod] = useState('')
  const [documentPackage, setDocumentPackage] = useState('')
  const [documentChoice, setDocumentChoice] = useState<'CREATE' | 'NONE' | ''>('')
  const [contractType, setContractType] = useState<ContractType | ''>('')
  const [principal, setPrincipal] = useState('')
  const [rateCode, setRateCode] = useState('')
  const [customRate, setCustomRate] = useState('')
  const [rates, setRates] = useState<Awaited<ReturnType<typeof getContractInterestRates>>>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    getContractInterestRates().then(values => { if (!cancelled) setRates(values) })
      .catch(() => { if (!cancelled) setError('โหลดอัตราดอกเบี้ยไม่สำเร็จ กรุณาปิดและเปิดหน้าต่างอีกครั้ง') })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [])

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
  const fieldClass = 'mt-2 w-full rounded-xl border border-slate-300 bg-white/70 px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-slate-400/30'


  const ready = canCalculate && Boolean(documentChoice) && (documentChoice !== 'CREATE' || Boolean(signingMethod && documentPackage)) && netSatang !== null && netSatang >= 0
  async function save() {
    if (!ready || saveLock.current || savedCode) return
    saveLock.current = true
    setSaving(true)
    setSaveError('')
    if (!requestKey.current) requestKey.current = crypto.randomUUID()
    try {
      const result = await saveContract({ borrowerId, lenderId, requestKey: requestKey.current, documentChoice, signingMethod, documentPackage, interestMethod: contractType, rateCode, customRate, principal })
      if (result.error) { setSaveError(result.error); return }
      if (result.code) { setSavedCode(result.code); onSaved?.(result.code) }
    } catch { setSaveError('เชื่อมต่อไม่สำเร็จ กรุณาลองบันทึกอีกครั้ง') }
    finally { setSaving(false); saveLock.current = false }
  }

  return <div className="space-y-5">
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-white/50 p-4 text-sm">
      
      <Button disabled={saving || Boolean(savedCode)} onClick={() => { if (reviewing) { setReviewing(false); onReview(false) } else onBack() }}>{reviewing ? 'ย้อนกลับ: แก้ไขรายละเอียด' : 'ย้อนกลับ: เลือกผู้ให้กู้'}</Button>
    </div>
    <Card as="section" className="p-5 sm:p-6">
      <h2 className="m-0 text-base font-semibold">{reviewing ? 'Step 4 · สรุปสัญญาและบันทึก' : 'Step 3 · รายละเอียดสัญญา'}</h2>
      <div hidden={reviewing}>
      <fieldset className="m-0 mt-5 min-w-0 border-0 p-0">
        <legend className="mb-3 text-sm font-medium">1. การจัดทำเอกสารสัญญา</legend>
        <div className="grid gap-3 sm:grid-cols-2">
          {([{ value: 'CREATE', label: 'ทำสัญญา' }, { value: 'NONE', label: 'ไม่ทำสัญญา' }] as const).map(option => <label key={option.value} className={`flex cursor-pointer items-center gap-3 rounded-2xl border p-5 text-sm ${documentChoice === option.value ? 'border-emerald-600 bg-emerald-50/70' : 'border-slate-300 bg-white/40'} focus-within:ring-2 focus-within:ring-slate-400`}>
            <input type="radio" name={`${groupId}-document`} value={option.value} checked={documentChoice === option.value} onChange={() => setDocumentChoice(option.value)} className="h-4 w-4 shrink-0 accent-emerald-700" />
            <span className="font-medium">{option.label}</span>
          </label>)}
        </div>
      </fieldset>
      <div hidden={documentChoice !== 'CREATE'}><ContractDocumentOptions signingMethod={signingMethod} documentPackage={documentPackage} onSigningChange={setSigningMethod} onPackageChange={setDocumentPackage} /></div>
      <fieldset className="m-0 mt-6 min-w-0 border-0 p-0">
        <legend className="mb-3 text-sm font-medium">2. วิธีชำระดอกเบี้ย</legend>
        <div className="grid gap-3 sm:grid-cols-2">
          {contractTypes.map(type => <label key={type.value} className={`flex cursor-pointer items-center gap-3 rounded-2xl border p-5 text-sm ${contractType === type.value ? 'border-emerald-600 bg-emerald-50/70' : 'border-slate-300 bg-white/40'} focus-within:ring-2 focus-within:ring-slate-400`}>
            <input type="radio" name={groupId} value={type.value} checked={contractType === type.value} onChange={() => setContractType(type.value)} className="h-4 w-4 shrink-0 accent-emerald-700" />
            <span><span className="block font-medium">{type.label}</span>
              <span className="mt-2 block text-xs font-normal leading-5 text-slate-500">{type.value === 'INTEREST_UPFRONT' ? 'หักดอกเบี้ยจากเงินที่จ่าย ชำระคืนเฉพาะเงินต้น' : 'รับเงินต้นเต็มจำนวน ชำระคืนเงินต้นรวมดอกเบี้ย'}</span>
            </span>
          </label>)}
        </div>
      </fieldset>
      <div className="mt-6 grid gap-5 sm:grid-cols-2">
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
      {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
      {!loading && !error && !rates.length && <p role="status" className="text-sm text-slate-500">ยังไม่มีอัตราดอกเบี้ยที่ใช้งานใน Masterdata</p>}
      </div>
      <div aria-live="polite" className="mt-6 rounded-2xl border border-slate-200 bg-white/50 p-5">
        <h3 className="m-0 text-sm font-semibold">สรุปรายละเอียดสัญญา</h3>
        <dl className="mb-5 grid gap-4 border-b border-slate-200 pb-5 text-sm sm:grid-cols-2">
          {[
            ['ผู้กู้', borrowerName], ['ผู้ให้กู้', lenderName],
            ['เอกสารสัญญา', documentChoice ? (documentChoice === 'CREATE' ? 'ทำสัญญา' : 'ไม่ทำสัญญา') : '—'],
            ...(documentChoice === 'CREATE' ? [['วิธีลงนาม', signingMethods.find(item => item.value === signingMethod)?.label ?? '—'], ['ชุดเอกสาร', documentPackages.find(item => item.value === documentPackage)?.label ?? '—']] : []),
            ['วิธีชำระดอกเบี้ย', contractTypes.find(item => item.value === contractType)?.label ?? '—'],
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
      </div>
      {saveError && <p role="alert" className="text-sm text-red-700">{saveError}</p>}
      {savedCode ? <p role="status" className="mt-5 text-sm text-emerald-800">บันทึกสัญญา {savedCode} สำเร็จ · รอจ่ายเงิน</p> : <div className="mt-6 flex justify-end">
        {reviewing ? <Button variant="primary" disabled={saving || !ready} onClick={save}>{saving ? 'กำลังบันทึก…' : 'ยืนยันและบันทึกสัญญา'}</Button> : <Button variant="primary" disabled={!ready} onClick={() => { setReviewing(true); onReview(true); setSaveError('') }}>ถัดไป: สรุปสัญญาและบันทึก</Button>}
      </div>}
      {reviewing && !savedCode && <p className="mb-0 mt-3 text-xs text-slate-500">บันทึกเป็นสถานะรอจ่ายเงิน · ยังไม่มีการเบิกจ่ายหรือลงนามเอกสาร</p>}
    </Card>
  </div>
}
