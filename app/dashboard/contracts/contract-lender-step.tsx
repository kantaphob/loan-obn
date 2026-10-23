'use client'

import { useEffect, useState, type FormEvent } from 'react'
import { Check, Landmark, Search } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { lenderCode, lenderRoles, lenderStatuses } from '@/lib/lender'
import { searchContractLenders } from './actions'

type Lender = Awaited<ReturnType<typeof searchContractLenders>>[number]
const name = (lender: Lender) => [lender.firstName, lender.lastName].filter(Boolean).join(' ') || lender.nickname

export function ContractLenderStep({ borrowerName, onBack }: { borrowerName: string; onBack: () => void }) {
  const [query, setQuery] = useState('')
  const [rows, setRows] = useState<Lender[]>([])
  const [selected, setSelected] = useState<Lender | null>(null)
  const [pending, setPending] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    searchContractLenders('').then(result => {
      if (!cancelled) setRows(result)
    }).catch(() => {
      if (!cancelled) setError('โหลดข้อมูลผู้ให้กู้ไม่สำเร็จ กรุณาลองค้นหาอีกครั้ง')
    }).finally(() => { if (!cancelled) setPending(false) })
    return () => { cancelled = true }
  }, [])

  async function search(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (pending) return
    setPending(true)
    setError('')
    setRows([])
    try { setRows(await searchContractLenders(query)) }
    catch { setError('ค้นหาผู้ให้กู้ไม่สำเร็จ กรุณาลองอีกครั้ง') }
    finally { setPending(false) }
  }

  return <div className="space-y-5">
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-white/50 p-4 text-sm">
      <span>ผู้กู้ที่เลือก: <strong>{borrowerName}</strong></span>
      <Button onClick={onBack}>ย้อนกลับ: เลือกผู้กู้</Button>
    </div>
    <Card as="section" className="p-5 sm:p-6">
      <h2 className="m-0 text-base font-semibold">Step 2 · เลือกผู้ให้กู้</h2>
      <p className="mt-2 text-sm text-slate-500">ค้นหาและเลือกผู้ให้กู้จากข้อมูล Lenders สำหรับสัญญานี้</p>
      <form onSubmit={search} className="mt-5 flex flex-wrap gap-3">
        <label className="min-w-0 flex-1 basis-60 text-sm font-medium">รหัสผู้ให้กู้ ชื่อ ชื่อเล่น เบอร์โทร หรือเลขบัตรประชาชน
          <input value={query} onChange={event => setQuery(event.target.value)} disabled={pending} maxLength={100} autoComplete="off" placeholder="ค้นหาผู้ให้กู้…" className="mt-2 w-full rounded-xl border border-slate-300 bg-white/70 px-4 py-3 text-sm outline-none focus:border-slate-600 focus:ring-2 focus:ring-slate-400/30" />
        </label>
        <Button type="submit" variant="primary" disabled={pending} className="self-end"><Search size={16} aria-hidden="true" />ค้นหา</Button>
      </form>
      {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
      <div aria-live="polite" aria-busy={pending} className="mt-5">
        {pending ? <p role="status" className="text-sm text-slate-500">กำลังโหลดผู้ให้กู้…</p> : !error && <p className="text-xs text-slate-500">{rows.length ? `พบ ${rows.length} รายการ${rows.length === 20 ? ' · แสดงสูงสุด 20 รายการ กรุณาระบุคำค้นให้เจาะจงขึ้น' : ''}` : 'ไม่พบผู้ให้กู้ ลองเปลี่ยนคำค้นหาหรือเพิ่มข้อมูลในเมนูผู้ให้กู้'}</p>}
        <div className="max-h-80 space-y-3 overflow-y-auto">{rows.map(lender => <article key={lender.id} className={`flex flex-wrap items-center gap-3 rounded-2xl border p-4 ${selected?.id === lender.id ? 'border-emerald-600 bg-emerald-50/70' : 'border-white/70 bg-white/40'}`}>
          <Landmark size={22} aria-hidden="true" />
          <div className="min-w-0 flex-1"><h3 className="m-0 text-sm font-semibold">{name(lender)} {lender.nickname && `(${lender.nickname})`}</h3>
            <p className="mb-0 mt-1 text-xs text-slate-500">{lenderCode(lender.id)} · {lender.phone || 'ไม่มีเบอร์โทร'} · {lenderRoles[lender.role] || lender.role} · {lenderStatuses[lender.status] || lender.status}</p>
          </div>
          <Button disabled={lender.status !== 'ACTIVE'} aria-pressed={selected?.id === lender.id} aria-label={`เลือกผู้ให้กู้ ${name(lender)}`} onClick={() => setSelected(lender)}>
            {selected?.id === lender.id && <Check size={15} aria-hidden="true" />}{selected?.id === lender.id ? 'เลือกแล้ว' : 'เลือกผู้ให้กู้'}
          </Button>
        </article>)}</div>
      </div>
    </Card>
    {selected && <Card as="section" className="p-5 sm:p-6">
      <div className="flex items-center justify-between gap-3"><h2 className="m-0 text-base font-semibold">ผู้ให้กู้ที่เลือก</h2><Button onClick={() => setSelected(null)}>ยกเลิกการเลือกผู้ให้กู้</Button></div>
      <dl className="grid gap-4 text-sm sm:grid-cols-2">
        {[
          ['ชื่อผู้ให้กู้', name(selected)], ['รหัสผู้ให้กู้', lenderCode(selected.id)],
          ['บทบาท', lenderRoles[selected.role]], ['เบอร์โทร', selected.phone], ['ที่อยู่', selected.address],
        ].map(([label, value]) => <div key={label}><dt className="text-xs text-slate-500">{label}</dt><dd className="ml-0 mt-1">{value || '—'}</dd></div>)}
      </dl>
    </Card>}
  </div>
}
