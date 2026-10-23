'use client'

import { useEffect, useState, type FormEvent } from 'react'
import { Check, Search, UserRound } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { availableBorrowerLimit, borrowerStatuses } from '@/lib/borrower'
import { searchContractBorrowers } from './actions'
import { ContractLenderStep, type ContractLender } from './contract-lender-step'
import { ContractDetailsStep } from './contract-details-step'

type Borrower = Awaited<ReturnType<typeof searchContractBorrowers>>[number]
const money = (value: number) => new Intl.NumberFormat('th-TH').format(value) + ' บาท'
const fullName = (b: Borrower) => [b.titleTh, b.firstName, b.middleNameTh, b.lastName].filter(Boolean).join(' ') || b.nickname
const maskedId = (value: string | null) => value ? '•'.repeat(Math.max(0, value.length - 4)) + value.slice(-4) : '—'

export function ContractBorrowerStep({ onSaved }: { onSaved?: (code: string, contractId: number, signingMethod: string | null) => void } = {}) {
  const [step, setStep] = useState(0)
  const [lender, setLender] = useState<ContractLender | null>(null)
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<Borrower[]>([])
  const [selected, setSelected] = useState<Borrower | null>(null)
  const [pending, setPending] = useState(true)
  const [searched, setSearched] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    searchContractBorrowers('').then(rows => {
      if (cancelled) return
      setResults(rows)
      setSearched(true)
    }).catch(() => {
      if (!cancelled) setError('โหลดข้อมูลผู้กู้ไม่สำเร็จ กรุณากดค้นหาเพื่อลองอีกครั้ง')
    }).finally(() => {
      if (!cancelled) setPending(false)
    })
    return () => { cancelled = true }
  }, [])

  async function search(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (pending) return
    setSelected(null)
    setError('')
    setResults([])
    setSearched(false)
    setPending(true)
    try {
      setResults(await searchContractBorrowers(query))
      setSearched(true)
    } catch {
      setError('ค้นหาไม่สำเร็จ กรุณาลองอีกครั้ง หากยังไม่สำเร็จให้รีเฟรชหน้าเว็บ')
    } finally { setPending(false) }
  }

  return <div className="space-y-5 text-[#202a3c]">
    <ol aria-label="ขั้นตอนสร้างสัญญา" className="grid grid-cols-1 gap-3 p-0 sm:grid-cols-4">
      {['เลือกผู้กู้ยืม', 'เลือกผู้ให้กู้', 'รายละเอียดสัญญา', 'ตรวจสอบและยืนยัน'].map((label, index) => <li key={label} aria-current={index === step ? 'step' : undefined} className={`flex list-none items-center gap-3 rounded-2xl border p-4 text-sm ${index === step ? 'border-slate-500 bg-white/70 font-semibold' : 'border-white/40 bg-white/20 text-slate-500'}`}>
        <span className={`grid h-7 w-7 shrink-0 place-items-center rounded-full ${index === step ? 'bg-slate-800 text-white' : 'bg-white/40'}`}>{index + 1}</span>{label}
      </li>)}
    </ol>
    <div hidden={step !== 0} className="space-y-5">
    <Card as="section" className="p-5 sm:p-6">
      <h2 className="m-0 text-base font-semibold">Step 1 · ค้นหาผู้กู้ยืม</h2>
      <p className="mt-2 text-sm text-slate-500">เลือกผู้กู้จากข้อมูล Borrowers เพื่อใช้เป็นข้อมูลในสัญญา</p>
      <form onSubmit={search} className="mt-5 flex flex-col gap-3 sm:flex-row">
        <div className="flex-1">
          <label htmlFor="contract-borrower-search" className="mb-2 block text-sm font-medium">ชื่อ ชื่อเล่น รหัสผู้กู้ เบอร์โทร หรือเลขบัตรประชาชน</label>
          <input id="contract-borrower-search" value={query} disabled={pending} onChange={event => setQuery(event.target.value)} maxLength={100} autoComplete="off" placeholder="ค้นหาผู้กู้ยืม…" className="w-full rounded-xl border border-slate-300 bg-white/70 px-4 py-3 text-sm outline-none focus:border-slate-600 focus:ring-2 focus:ring-slate-400/30" />
        </div>
        <Button type="submit" variant="primary" disabled={pending} className="self-end disabled:opacity-50"><Search size={16} aria-hidden="true" />{pending ? 'กำลังค้นหา…' : 'ค้นหา'}</Button>
      </form>
      {error && <p role="alert" className="mt-4 text-sm text-red-700">{error}</p>}
      <div aria-live="polite" aria-busy={pending} className="mt-5">
        {pending && <p role="status" className="rounded-xl bg-white/30 p-6 text-center text-sm text-slate-500">กำลังโหลดรายชื่อผู้กู้จาก Borrowers…</p>}
        {searched && results.length === 0 && <p className="rounded-xl bg-white/30 p-6 text-center text-sm text-slate-500">ไม่พบผู้กู้ยืม ลองค้นหาด้วยชื่อ เบอร์โทร หรือรหัสผู้กู้อีกครั้ง</p>}
        {searched && results.length > 0 && <p className="text-xs text-slate-500">พบ {results.length} รายการ{results.length === 20 ? ' (แสดงสูงสุด 20 รายการ กรุณาระบุคำค้นให้เจาะจงขึ้น)' : ''}</p>}
        <div className="max-h-80 space-y-3 overflow-y-auto">{results.map(b => {
          const chosen = selected?.id === b.id
          const eligible = !['INACTIVE', 'BLACKLIST'].includes(b.status)
          return <article key={b.id} className={`flex flex-col gap-4 rounded-2xl border p-4 sm:flex-row sm:items-center ${chosen ? 'border-emerald-600 bg-emerald-50/70' : 'border-white/70 bg-white/40'}`}>
            <div className="flex flex-1 items-start gap-3">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-white/70"><UserRound size={19} aria-hidden="true" /></span>
              <div><h3 className="m-0 text-sm font-semibold">{fullName(b)} {b.nickname && <span className="font-normal text-slate-500">({b.nickname})</span>}</h3>
                <p className="mb-1 mt-1 text-xs text-slate-600">{b.borrowerId || `#${b.id}`} · {b.phone || 'ไม่มีเบอร์โทร'} · {maskedId(b.nationalId)}</p>
                <p className="m-0 text-xs text-slate-500">{borrowerStatuses[b.status] || b.status} · วงเงินคงเหลือ {money(availableBorrowerLimit(b.approvedLimit, b.usedLimit))}</p>
                {!eligible && <p className="mb-0 mt-2 text-xs text-red-700">เลือกไม่ได้: ผู้กู้มีสถานะ{borrowerStatuses[b.status]}</p>}
              </div>
            </div>
            <Button disabled={!eligible} onClick={() => { if (selected?.id !== b.id) setLender(null); setSelected(b) }} aria-label={`เลือก ${fullName(b)} เพื่อทำสัญญา`} aria-pressed={chosen} className="disabled:cursor-not-allowed disabled:opacity-50">{chosen && <Check size={15} aria-hidden="true" />}{chosen ? 'เลือกแล้ว' : 'เลือกทำสัญญา'}</Button>
          </article>
        })}</div>
      </div>
    </Card>
    {selected && <Card as="section" className="p-5 sm:p-6">
      <div className="flex items-center justify-between gap-3"><h2 className="m-0 text-base font-semibold">ข้อมูลผู้กู้ที่เลือก</h2><Button onClick={() => setSelected(null)}>ยกเลิกการเลือก</Button></div>
      <dl className="mb-0 grid grid-cols-1 gap-5 text-sm sm:grid-cols-2 lg:grid-cols-3">
        {[
          ['ชื่อผู้กู้', fullName(selected)], ['รหัสผู้กู้', selected.borrowerId || `#${selected.id}`],
          ['เบอร์โทร', selected.phone], ['เลขบัตรประชาชน', maskedId(selected.nationalId)],
          ['ที่อยู่', selected.address], ['ชื่อบัญชีรับเงิน', selected.bankAccountName],
          ['บัญชีรับเงิน', selected.bankAccount ? `${selected.bankCode} · ${selected.bankAccount}` : ''],
          ['วงเงินอนุมัติ', money(selected.approvedLimit)],
          ['วงเงินคงเหลือ', money(availableBorrowerLimit(selected.approvedLimit, selected.usedLimit))],
        ].map(([label, value]) => <div key={label}><dt className="text-xs text-slate-500">{label}</dt><dd className="ml-0 mt-1 break-words font-medium">{value || '—'}</dd></div>)}
      </dl>
      <div className="mt-6 flex justify-end"><Button variant="primary" onClick={() => setStep(1)}>ถัดไป: เลือกผู้ให้กู้</Button></div>
    </Card>}
    </div>
    {selected && <div hidden={step !== 1}><ContractLenderStep key={selected.id} borrowerName={fullName(selected)} onBack={() => setStep(0)} selected={lender} onSelect={setLender} onNext={() => setStep(2)} /></div>}
    {selected && lender && <div hidden={step < 2}><ContractDetailsStep borrowerId={selected.id} lenderId={lender.id} onReview={(reviewing) => setStep(reviewing ? 3 : 2)} onSaved={onSaved} borrowerName={fullName(selected)} lenderName={[lender.firstName, lender.lastName].filter(Boolean).join(' ') || lender.nickname} onBack={() => setStep(1)} /></div>}
  </div>
}
