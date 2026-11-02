'use client'

import { useState, type FormEvent } from 'react'
import { Button } from '@/components/ui/button'
import { money, outstanding, type BankLoan, type LoanRound, type RatePeriod } from '@/app/thing/_shared/model'
import { ghbRatePeriods, type InitialLoanSettings } from '../initial-settings'

const field = 'mt-1 min-h-11 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-blue-400'
type Rate = Pick<RatePeriod, 'rate' | 'floating' | 'discount'>
const noRate: Rate = { rate: 0, floating: false, discount: 0 }
function rateAt(periods: RatePeriod[], month: number): Rate { return periods.find(p => p.from <= month && p.to >= month) ?? periods.at(-1) ?? noRate }

export function ContractSettingsForm({ loan, canWrite, busy, onSave }: { loan: BankLoan; canWrite: boolean; busy: boolean; onSave: (settings: InitialLoanSettings) => Promise<void> }) {
  const initial = loan.rounds[0]
  const [section, setSection] = useState<'contract' | 'interest' | 'installments'>('contract')
  const [installmentMode, setInstallmentMode] = useState<'year' | 'month'>(() => initial?.periods.some(p => p.from % 12 !== 1 && initial.periods.some(previous => previous.to === p.from - 1 && previous.installment !== p.installment)) ? 'month' : 'year')
  const [monthlyInstallments, setMonthlyInstallments] = useState<number[]>(() => Array.from({length:600},(_,i) => initial?.periods.find(p => p.from <= i+1 && p.to >= i+1)?.installment ?? initial?.periods.at(-1)?.installment ?? 0))
  const [months, setMonths] = useState(initial?.months ?? 480)
  const [mrr, setMrr] = useState(initial?.mrr ?? 0)
  const [insurance, setInsurance] = useState<LoanRound['insurance']>(initial?.insurance)
  const [customer, setCustomer] = useState<LoanRound['customerType']>(initial?.customerType)
  const [monthlyRates, setMonthlyRates] = useState<Rate[]>(() => Array.from({ length: 12 }, (_, i) => rateAt(initial?.periods ?? [], i + 1)))
  const [annualRates, setAnnualRates] = useState<Rate[]>(() => Array.from({ length: 50 }, (_, i) => rateAt(initial?.periods ?? [], i * 12 + 1)))
  const [ratesDirty, setRatesDirty] = useState(!initial)
  const [installmentsDirty, setInstallmentsDirty] = useState(!initial)
  const years = Math.max(0, Math.min(50, Math.ceil(months / 12)))
  function applyBankTerms() {
    if (!insurance || !customer) return
    const periods = ghbRatePeriods(months, insurance, customer)
    setMonthlyRates(Array.from({ length: 12 }, (_, i) => rateAt(periods, i + 1)))
    setAnnualRates(Array.from({ length: 50 }, (_, i) => rateAt(periods, i * 12 + 1)))
    setRatesDirty(true)
  }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!canWrite || busy || !Number.isInteger(months) || months < 1 || months > 600) return
    const f = new FormData(event.currentTarget)
    const periods: RatePeriod[] = Array.from({ length: months }, (_, i) => ({ ...(i < 12 ? monthlyRates[i] : annualRates[Math.floor(i / 12)]), from: i + 1, to: i + 1, installment: 0 }))
    await onSave({ opening: Number(f.get('opening')), creditLimit: Number(f.get('creditLimit')), months, mrr, effectiveOn: String(f.get('effectiveOn') ?? ''), referenceInterest: initial?.referenceInterest ?? 0, annualInstallments: Array.from({length:years},(_,i) => monthlyInstallments[i*12]), ...(installmentsDirty ? {monthlyInstallments: monthlyInstallments.slice(0,months)} : {}), rate: 0, applyAnnualInstallments: installmentsDirty, ...(ratesDirty ? { ratePeriods: periods } : {}), insurance, customerType: customer, roundName: String(f.get('roundName') ?? '').trim(), fee: Number(f.get('fee') ?? 0), notes: String(f.get('notes') ?? '') })
  }
  return <form onSubmit={submit} onInvalidCapture={event => { const panel = (event.target as HTMLElement).closest<HTMLElement>('[data-contract-section]'); if (panel) setSection(panel.dataset.contractSection as typeof section) }} className="space-y-6">
    <p className="text-sm leading-6 text-slate-500">ข้อมูลการกู้ · กำหนดรายละเอียดสัญญา ดอกเบี้ย และค่างวดที่ธนาคารเรียกเก็บ</p>
    <div role="tablist" aria-label="ข้อมูลการกู้" className="flex flex-wrap gap-2 border-b border-slate-200 pb-4">{([['contract','สัญญา'],['interest','เงื่อนไขอัตราดอกเบี้ย'],['installments','ยอดผ่อนตามธนาคาร']] as const).map(([key,label]) => <button key={key} type="button" role="tab" id={`loan-settings-tab-${key}`} aria-controls={`loan-settings-panel-${key}`} aria-selected={section === key} onClick={() => setSection(key)} className={`min-h-11 rounded-xl px-4 py-2 text-sm font-medium focus-visible:outline-2 focus-visible:outline-blue-500 ${section === key ? 'bg-blue-100 text-blue-800' : 'bg-slate-50 text-slate-600 hover:bg-slate-100'}`}>{label}</button>)}</div>
    <fieldset disabled={busy || !canWrite} className="space-y-6 border-0 p-0">
      <div role="tabpanel" id="loan-settings-panel-contract" aria-labelledby="loan-settings-tab-contract" data-contract-section="contract" hidden={section !== 'contract'} className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <label className="text-xs font-medium">ชื่อสัญญาที่รับ<input className={field} name="roundName" defaultValue={initial?.name ?? 'สัญญาเริ่มต้น'} maxLength={3000} required /></label>
        <label className="text-xs font-medium">ยอดที่กู้ธนาคารทั้งหมด (บาท)<input className={field} name="creditLimit" type="number" min="0.01" max={1e12} step="0.01" defaultValue={initial?.creditLimit ?? initial?.opening ?? ''} required /></label>
        <label className="text-xs font-medium">ยอดหนี้คงเหลือตั้งต้น / สำหรับรีเทนชัน (บาท)<input className={field} name="opening" type="number" min="0" max={1e12} step="0.01" defaultValue={loan.openingBalance ?? initial?.opening ?? ''} required /></label>
        <fieldset className="border-0 p-0"><legend className="text-xs font-medium">อายุสัญญาเงินกู้</legend><div className="grid grid-cols-2 gap-2"><label className="text-xs font-medium">ปี<input className={field} name="contractYears" type="number" min="0" max="50" step="1" value={Math.floor(months / 12)} onChange={e => setMonths(Number(e.target.value) * 12 + months % 12)} required /></label><label className="text-xs font-medium">เดือน<input className={field} name="contractMonths" type="number" min="0" max={Math.floor(months / 12) >= 50 ? 0 : 11} step="1" value={months % 12} onChange={e => setMonths(Math.floor(months / 12) * 12 + Number(e.target.value))} required /></label></div><span className="mt-1 block text-[11px] text-slate-500">รวม {months} เดือน · ระบุได้ 1 เดือนถึง 50 ปี</span>{months < 1 || months > 600 ? <p className="mt-1 text-xs text-red-700" role="alert">ระบุอายุสัญญาตั้งแต่ 1 เดือนถึง 50 ปี</p> : null}</fieldset>
        <label className="text-xs font-medium">วันที่เริ่มมีผล / วันที่ยอดหนี้ตั้งต้น<input className={field} name="effectiveOn" type="date" defaultValue={initial?.effectiveOn ?? ''} /><span className="mt-1 block text-[11px] text-slate-500">ใช้กำหนดช่วงดอกเบี้ยและชำระหนี้ธนาคาร</span></label>
      </div>
      <div className="rounded-xl border border-blue-100 bg-blue-50/50 p-4"><p className="m-0 text-xs text-slate-500">ระยะเวลาผ่อน · เดือนละ 1 งวด</p><output className="mt-2 block text-lg font-semibold tabular-nums" aria-live="polite">{months} งวด</output><p className="mb-0 mt-1 text-xs text-slate-500">{Math.floor(months/12)} ปี × 12{months % 12 ? ` + ${months % 12} เดือน` : ''} = {months} งวด</p></div>
      <label className="block text-xs font-medium">ค่าธรรมเนียมตามสัญญา (บาท)<input className={field} name="fee" type="number" min="0" max={1e12} step="0.01" defaultValue={initial?.fee ?? 0} /></label>
      <label className="block text-xs font-medium">หมายเหตุสัญญา<textarea className={field} name="notes" defaultValue={initial?.notes ?? ''} maxLength={3000} rows={3} /></label>
      <p className="text-xs leading-6 text-slate-500">ยอดหนี้ตั้งต้นเป็นหนี้ที่มีอยู่ก่อนเริ่มใช้ระบบ ไม่สร้างยอดรับเงินใน ledger ซ้ำ ยอดคงเหลือปัจจุบัน {money(outstanding(loan))} บาท จะเปลี่ยนตามการรับและจ่ายจริงหลังจากนี้</p>
      </div>
      <div role="tabpanel" id="loan-settings-panel-interest" aria-labelledby="loan-settings-tab-interest" data-contract-section="interest" hidden={section !== 'interest'} className="space-y-5">
        <label className="text-xs font-medium">MRR อ้างอิงปัจจุบัน (% ต่อปี)<input className={field} name="mrr" type="number" min="0" max="100" step="0.001" value={mrr} onChange={e => setMrr(Number(e.target.value))} required /></label>
      <section className="space-y-4 rounded-2xl border border-blue-100 bg-blue-50/40 p-4">
        <h3 className="text-sm font-semibold">เงื่อนไขอัตราดอกเบี้ยตามธนาคาร</h3>
        <div className="grid gap-4 sm:grid-cols-2"><label className="text-xs font-medium">ประกันชีวิตคุ้มครองสินเชื่อ<select className={field} value={insurance ?? ''} onChange={e => setInsurance(e.target.value as LoanRound['insurance'])}><option value="">เลือกเงื่อนไขประกัน</option><option value="qualifying">ทำประกันตามเงื่อนไขธนาคาร</option><option value="not_qualifying">ไม่ทำประกัน / ไม่เป็นไปตามเงื่อนไข</option></select></label><label className="text-xs font-medium">ประเภทลูกค้า (อัตราตั้งแต่ปีที่ 7)<select className={field} value={customer ?? ''} onChange={e => setCustomer(e.target.value as LoanRound['customerType'])}><option value="">เลือกประเภทลูกค้า</option><option value="welfare">ลูกค้าสวัสดิการ · MRR − 1.00%</option><option value="retail">ลูกค้ารายย่อย · MRR − 0.50%</option><option value="equipment">อุปกรณ์ / ชำระหนี้ · MRR</option></select></label></div>
        <Button disabled={!insurance || !customer} onClick={applyBankTerms}>นำเงื่อนไขธนาคารมาใส่ในตารางดอกเบี้ย</Button>
        <p className="text-[11px] leading-6 text-slate-500">ใช้เงื่อนไขจากข้อมูลที่ให้ เลือกให้ตรงสัญญาจริงแล้วตรวจตารางก่อนบันทึก สูตร MRR จะคำนวณด้วยค่าอ้างอิงที่กรอกด้านบน</p>
      </section>
      <section className="space-y-3"><h3 className="text-sm font-semibold">ดอกเบี้ยปีที่ 1 · แยกรายเดือน</h3><div className="max-h-80 space-y-2 overflow-y-auto rounded-xl border border-slate-200 p-3">{monthlyRates.slice(0, Math.min(12, months)).map((rate, i) => <InterestRow key={i} label={`เดือนที่ ${i + 1}`} value={rate} mrr={mrr} onChange={patch => { setRatesDirty(true); setMonthlyRates(rows => rows.map((row, index) => index === i ? { ...row, ...patch } : row)) }} />)}</div></section>
      {years > 1 ? <section className="space-y-3"><h3 className="text-sm font-semibold">ดอกเบี้ยปีที่ 2 เป็นต้นไป · ตามธนาคารกำหนด</h3><div className="max-h-80 space-y-2 overflow-y-auto rounded-xl border border-slate-200 p-3">{annualRates.slice(1, years).map((rate, i) => <InterestRow key={i + 1} label={`ปีที่ ${i + 2}`} value={rate} mrr={mrr} onChange={patch => { setRatesDirty(true); setAnnualRates(rows => rows.map((row, index) => index === i + 1 ? { ...row, ...patch } : row)) }} />)}</div></section> : null}
      </div>
      <div role="tabpanel" id="loan-settings-panel-installments" aria-labelledby="loan-settings-tab-installments" data-contract-section="installments" hidden={section !== 'installments'} className="space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-3"><div><h3 className="m-0 text-sm font-semibold">ยอดผ่อนต่อเดือนตามที่ธนาคารกำหนด</h3><p className="mb-0 mt-2 text-xs text-slate-500">กำหนดค่างวดล่วงหน้า {months} งวด · ยอดจ่ายจริงบันทึกแยกในรายการชำระธนาคาร</p></div><label className="text-xs font-medium">กำหนดยอดตาม<select className={field} value={installmentMode} onChange={e => setInstallmentMode(e.target.value as typeof installmentMode)}><option value="year">รายปี</option><option value="month">รายเดือน / งวด</option></select></label></div>
        <div className="max-h-[480px] space-y-2 overflow-y-auto rounded-xl border border-slate-200 p-3">{Array.from({length:installmentMode === 'year' ? years : months},(_,i) => { const start=installmentMode === 'year' ? i*12 : i; const end=installmentMode === 'year' ? Math.min(start+12,months) : start+1; const value=monthlyInstallments[start]; const mixed=installmentMode === 'year' && monthlyInstallments.slice(start,end).some(amount => amount !== value); return <label key={`${installmentMode}-${i}`} className="grid items-center gap-2 rounded-lg bg-slate-50 p-3 text-xs sm:grid-cols-[1fr_180px]"><span>{installmentMode === 'year' ? `ปีที่ ${i+1} · งวด ${start+1}–${end}` : `งวดที่ ${i+1} · ปีที่ ${Math.floor(i/12)+1} เดือนที่ ${i%12+1}`}<small className="mt-1 block text-slate-500">{mixed ? 'ยอดต่างกันในปีนี้ · แก้ช่องนี้เพื่อใช้ยอดเดียวทั้งปี' : 'บาท / เดือน'}</small></span><input className={field} aria-label={installmentMode === 'year' ? `ค่างวดธนาคารปีที่ ${i+1}` : `ค่างวดธนาคารงวดที่ ${i+1}`} type="number" min="0.01" max={1e12} step="0.01" value={value || ''} onChange={e => {setInstallmentsDirty(true);setMonthlyInstallments(rows => rows.map((amount,index) => index >= start && index < end ? Number(e.target.value) : amount))}} required /></label>})}</div>
      </div>
      {canWrite ? <Button type="submit" variant="primary" disabled={busy}>{busy ? 'กำลังบันทึก…' : 'บันทึกสัญญาเงินกู้'}</Button> : null}
    </fieldset>
  </form>
}

function InterestRow({ label, value, mrr, onChange }: { label: string; value: Rate; mrr: number; onChange: (patch: Partial<Rate>) => void }) {
  return <div className="grid items-center gap-3 rounded-lg bg-slate-50 p-3 sm:grid-cols-[80px_1fr_1fr_100px]"><span className="text-xs font-medium">{label}</span><label className="text-[11px] text-slate-500">ชนิดอัตรา<select aria-label={`${label} ชนิดดอกเบี้ย`} className={field} value={value.floating ? 'floating' : 'fixed'} onChange={e => onChange({ floating: e.target.value === 'floating' })}><option value="fixed">คงที่</option><option value="floating">MRR − ส่วนลด</option></select></label><label className="text-[11px] text-slate-500">{value.floating ? 'ส่วนลดจาก MRR (%)' : 'อัตราต่อปี (%)'}<input aria-label={`${label} ${value.floating ? 'ส่วนลด' : 'ดอกเบี้ย'}`} className={field} type="number" min="0" max="100" step="0.001" value={value.floating ? value.discount : value.rate} onChange={e => onChange(value.floating ? { discount: Number(e.target.value) } : { rate: Number(e.target.value) })} required /></label><span className="text-right text-xs font-semibold tabular-nums">{(value.floating ? Math.max(0, mrr - value.discount) : value.rate).toFixed(3)}%<span className="block font-normal text-slate-500">ต่อปี</span></span></div>
}
