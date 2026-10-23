'use client'

import { useState, useTransition, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, ArrowDownLeft, ArrowUpRight, Wallet, Search, BookOpen } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Modal } from '@/components/ui/modal'
import { contractCode, formatContractMoney as money } from '@/lib/contracts'
import { bangkokToday, type LedgerInput } from '@/lib/ledger'
import { getLedger, saveLedger, voidLedger } from './actions'

type Data = Awaited<ReturnType<typeof getLedger>>
const field = 'w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-500'
const code = (id: number) => `TX-${String(id).padStart(6, '0')}`
export function LedgerWorkspace({ data }: { data: Data }) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [query, setQuery] = useState(''), [direction, setDirection] = useState(''), [from, setFrom] = useState(''), [to, setTo] = useState(''), [showVoids, setShowVoids] = useState(false)
  const [creating, setCreating] = useState(false), [error, setError] = useState(''), [notice, setNotice] = useState('')
  const [voiding, setVoiding] = useState<Data['entries'][number] | null>(null), [reason, setReason] = useState('')
  const [page, setPage] = useState(1)
  const [draft, setDraft] = useState<LedgerInput | null>(null)
  const [contractQuery, setContractQuery] = useState('')
  const selected = data.contracts.find(c => c.id === draft?.contractId)
  const active = data.entries.filter(e => !e.voidedAt)
  const incoming = active.filter(e => e.direction === 'IN').reduce((s, e) => s + e.amountSatang, 0)
  const outgoing = active.filter(e => e.direction === 'OUT').reduce((s, e) => s + e.amountSatang, 0)
  const outstanding = data.contracts.filter(c => c.disbursed).reduce((s, c) => s + c.remaining, 0)
  const filtered = data.entries.filter(e => (showVoids || !e.voidedAt) && (!direction || e.direction === direction) && (!from || e.occurredOn >= from) && (!to || e.occurredOn <= to) && [code(e.id), e.contractId ? contractCode(e.contractId) : '', e.contract?.borrowerName, e.categoryName, e.reference, e.note].some(v => v?.toLowerCase().includes(query.toLowerCase())))
  const current = Math.min(page, Math.max(1, Math.ceil(filtered.length / 25)))
  function open(kind: LedgerInput['kind'] = 'GENERAL', contractId: number | null = null) {
    const c = data.contracts.find(c => c.id === contractId)
    setDraft({ requestKey: crypto.randomUUID(), kind, contractId, direction: kind === 'DISBURSEMENT' ? 'OUT' : 'IN', categoryCode: '', amount: c ? String((kind === 'DISBURSEMENT' ? c.netSatang : c.remaining) / 100) : '', occurredOn: bangkokToday(), channelCode: '', reference: '', note: '' })
    setContractQuery(''); setError(''); setCreating(true)
  }
  function submit(event: FormEvent) {
    event.preventDefault(); if (!draft) return
    setError('')
    startTransition(async () => {
      try {
        const result = await saveLedger(draft)
        if (result.error) { setError(result.error); return }
        setCreating(false); setNotice('บันทึกรายการเรียบร้อยแล้ว'); router.refresh()
      } catch { setError('เชื่อมต่อไม่สำเร็จ กรุณาลองอีกครั้ง') }
    })
  }
  function cancel(event: FormEvent) {
    event.preventDefault(); if (!voiding) return
    startTransition(async () => {
      try {
        const result = await voidLedger(voiding.id, reason)
        if (result.error) { setError(result.error); return }
        setVoiding(null); setNotice('ยกเลิกรายการและปรับยอดแล้ว'); router.refresh()
      } catch { setError('เชื่อมต่อไม่สำเร็จ กรุณาลองอีกครั้ง') }
    })
  }
  return <div className="borrower-workspace space-y-6">
    {notice && <p role="status" className="text-sm text-emerald-700">{notice}</p>}
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {[[ 'รับเงินสะสม', incoming, ArrowDownLeft, 'text-emerald-700'], ['จ่ายเงินสะสม', outgoing, ArrowUpRight, 'text-rose-700'], ['เงินรับสุทธิหลังหักจ่าย', incoming - outgoing, Wallet, 'text-blue-700'], ['ยอดรอรับคืนตามสัญญา', outstanding, BookOpen, 'text-amber-700']].map(([title, amount, Icon, color]) => {
        const MetricIcon = Icon as typeof Wallet
        return <Card key={String(title)} className="p-5"><div className="flex justify-between text-sm text-slate-500">{String(title)}<MetricIcon size={19} /></div><p className={`mt-3 text-2xl font-semibold tabular-nums ${color}`}>{money(Number(amount))}<span className="ml-1 text-xs font-normal">บาท</span></p><p className="mt-2 text-xs text-slate-400">รวมทุกรายการที่ยังไม่ยกเลิก</p></Card>
      })}
    </div>
    <p className="text-sm text-slate-500">รับชำระเงินกู้ได้ที่ <a href="/dashboard/repayments" className="text-blue-700 underline">รับชำระตามสัญญา</a></p>
    <Card className="overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-3 p-5"><h2 className="font-semibold">รายการรับ–จ่าย <span className="ml-2 text-sm font-normal text-slate-500">{filtered.length} รายการ</span></h2>{data.canWrite && <Button variant="primary" onClick={() => open()}><Plus size={16} /> บันทึกรับ–จ่าย</Button>}</div>
      <div className="flex flex-wrap items-end gap-3 border-y border-slate-200/70 p-4">
        <label className="min-w-48 flex-1 text-xs text-slate-500">ค้นหารายการ<div className="relative mt-1"><Search className="absolute right-3 top-3" size={17} /><input className={`${field} pr-10`} value={query} onChange={e => { setQuery(e.target.value); setPage(1) }} placeholder="เลขรายการ สัญญา ชื่อผู้กู้ อ้างอิง" /></div></label>
        <label className="text-xs text-slate-500">ประเภท<select className={`${field} mt-1`} value={direction} onChange={e => { setDirection(e.target.value); setPage(1) }}><option value="">ทั้งหมด</option><option value="IN">รับเงิน</option><option value="OUT">จ่ายเงิน</option></select></label>
        <label className="text-xs text-slate-500">ตั้งแต่<input type="date" className={`${field} mt-1`} value={from} onChange={e => { setFrom(e.target.value); setPage(1) }} /></label><label className="text-xs text-slate-500">ถึง<input type="date" min={from} className={`${field} mt-1`} value={to} onChange={e => { setTo(e.target.value); setPage(1) }} /></label>
        <label className="flex items-center gap-2 py-3 text-sm"><input type="checkbox" checked={showVoids} onChange={e => { setShowVoids(e.target.checked); setPage(1) }} />แสดงรายการยกเลิก</label>
      </div>
      <div className="overflow-x-auto"><table className="w-full whitespace-nowrap text-left text-sm"><thead className="text-xs text-slate-500"><tr>{['วันที่ / เลขรายการ', 'หมวด / สัญญา', 'ช่องทาง / อ้างอิง', 'รับเงิน', 'จ่ายเงิน', 'สถานะ'].map(v => <th key={v} className="p-4">{v}</th>)}</tr></thead><tbody>{filtered.slice((current - 1) * 25, current * 25).map(e => <tr key={e.id} className={`border-t border-slate-200/70 ${e.voidedAt ? 'opacity-55' : ''}`}><td className="p-4"><p>{e.occurredOn}</p><p className="text-xs text-slate-500">{code(e.id)}</p></td><td className="max-w-80 whitespace-normal p-4"><p>{e.categoryName}</p>{e.contractId && <p className="text-xs text-blue-700">{contractCode(e.contractId)} · {e.contract?.borrowerName}</p>}{e.note && <p className="mt-1 text-xs text-slate-500">{e.note}</p>}</td><td className="p-4"><p>{e.channelName}</p><p className="text-xs text-slate-500">{e.reference || '—'}</p></td><td className="p-4 tabular-nums text-emerald-700">{e.direction === 'IN' ? money(e.amountSatang) : '—'}</td><td className="p-4 tabular-nums text-rose-700">{e.direction === 'OUT' ? money(e.amountSatang) : '—'}</td><td className="max-w-56 whitespace-normal p-4">{e.voidedAt ? <><p>ยกเลิกแล้ว</p><p className="text-xs">{e.voidReason}</p></> : <><span className="text-emerald-700">บันทึกแล้ว</span>{data.canWrite && <button className="ml-3 text-xs text-rose-700 underline" onClick={() => { setVoiding(e); setReason(''); setError('') }}>ยกเลิก</button>}</>}</td></tr>)}</tbody></table>{!filtered.length && <p className="p-12 text-center text-sm text-slate-500">ยังไม่มีรายการที่ตรงกับเงื่อนไข</p>}</div>
      <div className="flex items-center justify-between border-t border-slate-200/70 p-4 text-sm"><span>หน้า {current} / {Math.max(1, Math.ceil(filtered.length / 25))}</span><div className="flex gap-2"><Button disabled={current <= 1} onClick={() => setPage(current - 1)}>ก่อนหน้า</Button><Button disabled={current * 25 >= filtered.length} onClick={() => setPage(current + 1)}>ถัดไป</Button></div></div>
    </Card>
    <Modal open={creating && Boolean(draft)} title="บันทึกรับ–จ่าย" onClose={() => { if (!pending) setCreating(false) }} className="max-h-[90vh] overflow-y-auto max-w-xl !bg-white">
      {draft && <form onSubmit={submit}><fieldset disabled={pending} className="space-y-5">
        <div className="grid grid-cols-2 gap-3" role="group" aria-label="ประเภทเงิน">
          {[{ value: 'IN', label: 'รับเงิน', Icon: ArrowDownLeft }, { value: 'OUT', label: 'จ่ายเงิน', Icon: ArrowUpRight }].map(({ value, label, Icon }) => <button key={value} type="button" aria-pressed={draft.direction === value} onClick={() => { setDraft({ ...draft, direction: value, kind: 'GENERAL', categoryCode: '', contractId: null, amount: '' }); setContractQuery(''); setError('') }} className={`flex items-center justify-center gap-2 rounded-2xl border-2 px-4 py-3 font-semibold transition ${draft.direction === value ? value === 'IN' ? 'border-emerald-600 bg-emerald-50 text-emerald-800' : 'border-rose-600 bg-rose-50 text-rose-800' : 'border-slate-200 text-slate-500 hover:bg-slate-50'}`}><Icon size={20} aria-hidden="true" />{label}</button>)}
        </div>
        <label className="block text-sm font-medium">หมวดหมู่<select autoFocus required className={`${field} mt-1.5`} value={draft.categoryCode} onChange={e => {
          const categoryCode = e.target.value
          const kind: LedgerInput['kind'] = categoryCode === 'LOAN_DISBURSEMENT' ? 'DISBURSEMENT' : categoryCode === 'CONTRACT_REPAYMENT' ? 'REPAYMENT' : 'GENERAL'
          setDraft({ ...draft, categoryCode, kind, contractId: null, amount: '' }); setContractQuery(''); setError('')
        }}><option value="">เลือกหมวดหมู่{draft.direction === 'IN' ? 'รับเงิน' : 'จ่ายเงิน'}</option>{data.categories.filter(c => c.direction === draft.direction && (c.group !== 'LOAN' && c.code !== 'INTEREST_RECEIVED' || c.code === 'LOAN_DISBURSEMENT')).map(c => <option key={c.code} value={c.code}>{c.nameTh}</option>)}</select></label>
        {draft.kind !== 'GENERAL' && <div className="space-y-3 rounded-2xl bg-slate-50 p-4">
          <label className="block text-sm font-medium">สัญญา<input type="search" className={`${field} mt-1.5 mb-2`} placeholder="ค้นหาเลขสัญญาหรือชื่อผู้กู้" value={contractQuery} onChange={e => setContractQuery(e.target.value)} /><select required aria-label="เลือกสัญญา" className={field} value={draft.contractId ?? ''} onChange={e => { const c = data.contracts.find(c => c.id === Number(e.target.value)); setDraft({ ...draft, contractId: c?.id ?? null, amount: c ? String((draft.kind === 'DISBURSEMENT' ? c.netSatang : c.remaining) / 100) : '' }) }}><option value="">เลือกสัญญา</option>{data.contracts.filter(c => (draft.kind === 'DISBURSEMENT' ? c.status === 'WAITING_PAYMENT' && !c.disbursed : c.disbursed && c.remaining > 0) && (c.id === draft.contractId || `${contractCode(c.id)} ${c.borrowerName}`.toLowerCase().includes(contractQuery.toLowerCase()))).map(c => <option key={c.id} value={c.id}>{contractCode(c.id)} · {c.borrowerName}</option>)}</select></label>
          {selected ? <div className="flex items-center justify-between gap-3 text-sm"><span className="text-slate-500">{draft.kind === 'REPAYMENT' ? 'ยอดคงค้าง' : 'ยอดจ่ายตามสัญญา'}</span><strong className="text-lg tabular-nums">{money(draft.kind === 'REPAYMENT' ? selected.remaining : selected.netSatang)} <span className="text-xs font-normal">บาท</span></strong></div> : <p className="text-xs text-slate-500">{data.contracts.some(c => draft.kind === 'DISBURSEMENT' ? c.status === 'WAITING_PAYMENT' && !c.disbursed : c.disbursed && c.remaining > 0) ? 'เลือกสัญญาเพื่อเติมยอดเงินอัตโนมัติ' : 'ยังไม่มีสัญญาที่พร้อมทำรายการประเภทนี้'}</p>}
        </div>}
        <label className="block text-sm font-medium">{draft.direction === 'IN' ? 'จำนวนเงินที่รับ' : 'จำนวนเงินที่จ่าย'}<div className="relative mt-1.5"><input required aria-describedby="ledger-amount-help" type="number" inputMode="decimal" min="0.01" step="0.01" placeholder="0.00" max={draft.kind === 'REPAYMENT' && selected ? selected.remaining / 100 : 2000000000} readOnly={draft.kind === 'DISBURSEMENT'} className={`${field} !py-3 !pr-14 !text-2xl font-semibold tabular-nums ${draft.kind === 'DISBURSEMENT' ? '!bg-slate-50' : ''}`} value={draft.amount} onChange={e => setDraft({ ...draft, amount: e.target.value })} /><span className="absolute right-4 top-4 text-sm text-slate-500">บาท</span></div><span id="ledger-amount-help" className="mt-1 block text-xs font-normal text-slate-500">{draft.kind === 'REPAYMENT' ? 'แก้ยอดเพื่อรับบางส่วนได้' : draft.kind === 'DISBURSEMENT' ? 'ใช้ยอดสุทธิตามสัญญา' : 'ระบุยอดที่รับหรือจ่ายจริง'}</span></label>
        <div className="grid gap-3 sm:grid-cols-2"><label className="text-sm font-medium">วันที่<input required type="date" max={bangkokToday()} className={`${field} mt-1.5`} value={draft.occurredOn} onChange={e => setDraft({ ...draft, occurredOn: e.target.value })} /></label><label className="text-sm font-medium">ช่องทาง<select required className={`${field} mt-1.5`} value={draft.channelCode} onChange={e => setDraft({ ...draft, channelCode: e.target.value })}><option value="">เลือกช่องทาง</option>{data.channels.map(c => <option key={c.code} value={c.code}>{c.nameTh}</option>)}</select></label></div>
        <details className="rounded-xl border border-slate-200 px-4 py-3"><summary className="cursor-pointer text-sm text-slate-600">รายละเอียดเพิ่มเติม <span className="text-xs text-slate-400">(ไม่บังคับ)</span></summary><div className="mt-4 space-y-3"><label className="block text-sm">เลขอ้างอิง / เลขสลิป<input maxLength={150} className={`${field} mt-1`} value={draft.reference} onChange={e => setDraft({ ...draft, reference: e.target.value })} /></label><label className="block text-sm">หมายเหตุ<textarea maxLength={1000} rows={2} className={`${field} mt-1`} value={draft.note} onChange={e => setDraft({ ...draft, note: e.target.value })} /></label></div></details>
        {error && <p role="alert" className="rounded-xl bg-rose-50 p-3 text-sm text-rose-700">{error}</p>}
        <div className="sticky -bottom-6 flex items-center justify-end gap-3 border-t border-slate-100 bg-white py-4"><Button onClick={() => setCreating(false)}>ยกเลิก</Button><Button type="submit" variant="primary" disabled={!draft.categoryCode || !draft.amount || !draft.channelCode || draft.kind !== 'GENERAL' && !selected} className="min-w-36">{pending ? 'กำลังบันทึก…' : draft.direction === 'IN' ? 'บันทึกรับเงิน' : 'บันทึกจ่ายเงิน'}</Button></div>
      </fieldset></form>}
    </Modal>
    <Modal open={Boolean(voiding)} title={`ยกเลิกรายการ ${voiding ? code(voiding.id) : ''}`} description="รายการเดิมจะยังอยู่ในประวัติ และยอดสัญญาจะถูกปรับกลับ" onClose={() => { if (!pending) setVoiding(null) }}><form onSubmit={cancel} className="space-y-4"><label className="block text-sm">เหตุผลยกเลิก<textarea required autoFocus maxLength={500} className={`${field} mt-1`} value={reason} onChange={e => setReason(e.target.value)} /></label>{error && <p role="alert" className="text-sm text-rose-700">{error}</p>}<Button type="submit" variant="danger" disabled={pending || !reason.trim()}>{pending ? 'กำลังยกเลิก…' : 'ยืนยันยกเลิกรายการ'}</Button></form></Modal>
  </div>
}
