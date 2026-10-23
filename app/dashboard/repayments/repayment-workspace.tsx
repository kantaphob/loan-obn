'use client'

import { useState, useTransition, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Search, ArrowDownLeft, FileText, Wallet, Clock3, CircleCheck, History } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Modal } from '@/components/ui/modal'
import { contractCode, formatContractMoney as money } from '@/lib/contracts'
import { bangkokToday, type LedgerInput } from '@/lib/ledger'
import { getLedger, saveLedger } from '../ledger/actions'

type Data = Awaited<ReturnType<typeof getLedger>>
const dateLabel = (value: string | null) => value ? new Intl.DateTimeFormat('th-TH', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Asia/Bangkok' }).format(new Date(`${value}T00:00:00+07:00`)) : 'ไม่ระบุวันครบกำหนด'
const field = 'w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-emerald-500'
export function RepaymentWorkspace({ data }: { data: Data }) {
  const router = useRouter()
  const [query, setQuery] = useState('')
  const [page, setPage] = useState(1)
  const [draft, setDraft] = useState<LedgerInput | null>(null)
  const [error, setError] = useState(''), [notice, setNotice] = useState('')
  const [pending, startTransition] = useTransition()
  const [view, setView] = useState('OPEN')
  const [historyId, setHistoryId] = useState<number | null>(null)
  const today = bangkokToday()
  const historyContract = data.contracts.find(c => c.id === historyId)
  const historyEntries = data.entries.filter(e => e.contractId === historyId && e.kind === 'REPAYMENT')
  const selected = data.contracts.find(c => c.id === draft?.contractId)
  const category = data.categories.find(c => c.code === 'CONTRACT_REPAYMENT' && c.direction === 'IN' && c.group === 'LOAN')
  const openContracts = data.contracts.filter(c => c.disbursed && c.remaining > 0)
  const rows = data.contracts.filter(c => c.disbursed && (view === 'ALL' || (view === 'CLOSED' ? c.remaining === 0 : c.remaining > 0 && (view === 'OVERDUE' ? Boolean(c.repaymentDueDate && c.repaymentDueDate < today) : view === 'TODAY' ? c.repaymentDueDate === today : true))) && `${contractCode(c.id)} ${c.borrowerName} ${c.lenderName}`.toLowerCase().includes(query.trim().toLowerCase()))
  const current = Math.min(page, Math.max(1, Math.ceil(rows.length / 20)))
  function receive(c: Data['contracts'][number]) {
    setError('')
    setDraft({ requestKey: crypto.randomUUID(), kind: 'REPAYMENT', contractId: c.id, direction: 'IN', categoryCode: 'CONTRACT_REPAYMENT', amount: String(c.remaining / 100), occurredOn: bangkokToday(), channelCode: '', reference: '', note: '' })
  }
  function submit(event: FormEvent) {
    event.preventDefault(); if (!draft) return
    setError('')
    startTransition(async () => {
      try {
        const result = await saveLedger(draft)
        if (result.error) { setError(result.error); return }
        setNotice(`รับชำระ ${contractCode(draft.contractId!)} จำนวน ${money(Math.round(Number(draft.amount) * 100))} บาท และลงบัญชีรับเงินแล้ว`)
        setDraft(null); router.refresh()
      } catch { setError('เชื่อมต่อไม่สำเร็จ กรุณาลองอีกครั้ง') }
    })
  }
  return <div className="borrower-workspace repayment-workspace space-y-5">
    {notice && <p role="status" className="rounded-xl bg-emerald-50 p-4 text-sm text-emerald-800">{notice} <Link className="ml-2 underline" href="/dashboard/ledger">ดูรายการบัญชี</Link></p>}
    <div className="repayment-metrics">{[
      { title: 'ยอดคงค้างตามสัญญา', value: money(openContracts.reduce((s, c) => s + c.remaining, 0)), unit: 'บาท', detail: `${openContracts.length} สัญญาที่รอรับชำระ`, icon: Wallet, tone: 'gold' },
      { title: 'เกินกำหนดชำระ', value: String(openContracts.filter(c => c.repaymentDueDate && c.repaymentDueDate < today).length), unit: 'สัญญา', detail: 'ติดตามการรับชำระเป็นลำดับแรก', icon: Clock3, tone: 'rose' },
      { title: 'ครบกำหนดวันนี้', value: String(openContracts.filter(c => c.repaymentDueDate === today).length), unit: 'สัญญา', detail: dateLabel(today), icon: FileText, tone: 'blue' },
      { title: 'รับชำระวันนี้', value: money(data.entries.filter(e => e.kind === 'REPAYMENT' && !e.voidedAt && e.occurredOn === today).reduce((s, e) => s + e.amountSatang, 0)), unit: 'บาท', detail: 'เฉพาะรายการที่ยังไม่ถูกยกเลิก', icon: CircleCheck, tone: 'green' },
    ].map(m => <Card key={m.title} className={`repayment-metric repayment-metric--${m.tone}`}><div className="repayment-metric-top"><span>{m.title}</span><m.icon size={19} aria-hidden="true" /></div><p className="repayment-metric-value">{m.value} <span>{m.unit}</span></p><p className="repayment-metric-detail">{m.detail}</p></Card>)}</div>
    <Card className="overflow-hidden">
      <div className="repayment-directory-heading"><div><h2>รายการชำระตามสัญญา <span>{rows.length}</span></h2><p>ตรวจสอบยอดค้างและประวัติ ก่อนบันทึกรับเงิน</p></div><Link href="/dashboard/ledger">ดูบัญชีรับ–จ่าย ↗</Link></div>
      <div className="repayment-tabs" role="group" aria-label="กรองสถานะสัญญา">{[['OPEN', 'รอรับชำระ'], ['OVERDUE', 'เกินกำหนด'], ['TODAY', 'ครบกำหนดวันนี้'], ['CLOSED', 'ชำระครบแล้ว'], ['ALL', 'ทั้งหมด']].map(([value, label]) => <button type="button" key={value} aria-pressed={view === value} onClick={() => { setView(value); setPage(1) }}>{label}</button>)}</div>
      <div className="flex flex-wrap items-end gap-3 p-5"><label className="min-w-48 flex-1 text-sm">ค้นหาสัญญา<div className="relative mt-1"><Search size={17} aria-hidden="true" className="absolute left-3 top-3" /><input className={`${field} !pl-10`} placeholder="เลขสัญญา ชื่อผู้กู้ หรือผู้ให้กู้" value={query} onChange={e => { setQuery(e.target.value); setPage(1) }} /></div></label></div>
      <div className="overflow-x-auto repayment-table"><table className="w-full whitespace-nowrap text-left text-sm"><thead className="bg-slate-50 text-xs text-slate-500"><tr>{['สัญญา / ผู้กู้', 'ครบกำหนด', 'ยอดต้องชำระ', 'ความคืบหน้า', 'คงค้าง', ''].map((title, i) => <th key={i} scope="col" className="p-4">{title || <span className="sr-only">ทำรายการ</span>}</th>)}</tr></thead><tbody>{rows.slice((current - 1) * 20, current * 20).map(c => <tr key={c.id} className="border-t border-slate-100"><td className="p-4"><p className="font-medium">{c.borrowerName}</p><p className="mt-1 text-xs text-slate-500">{contractCode(c.id)}</p></td><td className="p-4"><p>{dateLabel(c.repaymentDueDate)}</p>{c.remaining > 0 && c.repaymentDueDate && c.repaymentDueDate < bangkokToday() && <span className="text-xs text-rose-700">เกินกำหนด</span>}</td><td className="p-4 tabular-nums">{money(c.repaymentSatang)}</td><td className="p-4 tabular-nums text-slate-500"><p>{money(c.received)} <span className="text-xs">บาท</span></p><div className="repayment-progress" role="progressbar" aria-label={`การชำระ ${contractCode(c.id)}`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={c.repaymentSatang > 0 ? Math.min(100, Math.round(c.received / c.repaymentSatang * 100)) : 0}><span style={{ width: `${c.repaymentSatang > 0 ? Math.min(100, c.received / c.repaymentSatang * 100) : 0}%` }} /></div></td><td className="p-4 font-semibold tabular-nums">{money(c.remaining)}</td><td className="p-4"><div className="flex items-center justify-end gap-2"><Button aria-label={`ประวัติรับชำระ ${contractCode(c.id)}`} onClick={() => setHistoryId(c.id)}><History size={16} aria-hidden="true" />ประวัติ</Button>{c.remaining > 0 ? data.canWrite && <Button variant="primary" onClick={() => receive(c)}><ArrowDownLeft size={16} aria-hidden="true" />รับชำระ</Button> : <span className="text-emerald-700">ชำระครบแล้ว</span>}</div></td></tr>)}</tbody></table>{!rows.length && <div className="p-12 text-center"><p className="font-medium text-slate-600">ไม่พบสัญญาในรายการนี้</p><p className="mt-2 text-sm text-slate-400">ลองเปลี่ยนตัวกรองหรือคำค้นหา · แสดงเฉพาะสัญญาที่จ่ายเงินกู้แล้ว</p></div>}</div>
      <div className="flex items-center justify-between border-t border-slate-100 p-4 text-sm"><span>{rows.length} สัญญา · หน้า {current}</span><div className="flex gap-2"><Button disabled={current <= 1} onClick={() => setPage(current - 1)}>ก่อนหน้า</Button><Button disabled={current * 20 >= rows.length} onClick={() => setPage(current + 1)}>ถัดไป</Button></div></div>
    </Card>
    <Modal open={Boolean(historyContract)} title="ประวัติรับชำระ" onClose={() => setHistoryId(null)} className="repayment-dialog max-h-[90vh] overflow-y-auto">
      {historyContract && <><p className="mb-4 text-sm">{historyContract.borrowerName} · {contractCode(historyContract.id)}</p><div className="repayment-preview"><span>รับชำระสะสม</span><strong>{money(historyContract.received)} บาท</strong></div><div className="mt-4 space-y-3">{historyEntries.length ? historyEntries.map(e => <article key={e.id} className="repayment-history-entry"><div className="flex justify-between gap-3"><strong className={e.voidedAt ? 'line-through opacity-50' : ''}>{money(e.amountSatang)} บาท</strong><span>{e.voidedAt ? 'ยกเลิกแล้ว' : 'รับชำระแล้ว'}</span></div><p>{dateLabel(e.occurredOn)} · {e.channelName}</p>{e.reference && <p>อ้างอิง: {e.reference}</p>}{e.note && <p>{e.note}</p>}{e.voidedAt && <p>เหตุผลยกเลิก: {e.voidReason}</p>}</article>) : <p className="py-8 text-center text-sm">ยังไม่มีรายการรับชำระสำหรับสัญญานี้</p>}</div></>}
    </Modal>
    <Modal open={Boolean(draft && selected)} title="รับชำระตามสัญญา" onClose={() => { if (!pending) setDraft(null) }} className="repayment-dialog max-h-[90vh] overflow-y-auto">
      {draft && selected && <form onSubmit={submit}><fieldset disabled={pending} className="space-y-4">
        <div className="rounded-2xl bg-emerald-50 p-4"><p className="font-semibold">{selected.borrowerName}</p><p className="mt-1 text-xs text-slate-500">{contractCode(selected.id)} · ผู้ให้กู้ {selected.lenderName}</p><div className="mt-4 flex justify-between text-sm"><span>ยอดคงค้าง</span><strong className="text-xl tabular-nums text-emerald-800">{money(selected.remaining)} <span className="text-xs font-normal">บาท</span></strong></div></div>
        <label className="block text-sm font-medium">ยอดรับชำระ (บาท)<input autoFocus required type="number" inputMode="decimal" min="0.01" max={selected.remaining / 100} step="0.01" className={`${field} mt-1 !text-2xl font-semibold`} value={draft.amount} onChange={e => setDraft({ ...draft, amount: e.target.value })} /><span className="mt-1 block text-xs font-normal text-slate-500">แก้ยอดเพื่อรับบางส่วนได้</span></label>
        <div className="grid gap-3 sm:grid-cols-2"><label className="text-sm">วันที่รับเงิน<input required type="date" min={selected.disbursementOn ?? undefined} max={bangkokToday()} className={`${field} mt-1`} value={draft.occurredOn} onChange={e => setDraft({ ...draft, occurredOn: e.target.value })} /></label><label className="text-sm">ช่องทาง<select required className={`${field} mt-1`} value={draft.channelCode} onChange={e => setDraft({ ...draft, channelCode: e.target.value })}><option value="">เลือกช่องทาง</option>{data.channels.map(c => <option key={c.code} value={c.code}>{c.nameTh}</option>)}</select></label></div>
        <div className="repayment-preview"><span>ยอดคงค้างหลังรับชำระ</span><strong>{money(Math.max(0, selected.remaining - (Number.isFinite(Number(draft.amount)) ? Math.round(Number(draft.amount) * 100) : 0)))} บาท</strong></div>
        <details className="rounded-xl border border-slate-200 p-3"><summary className="cursor-pointer text-sm text-slate-500">รายละเอียดเพิ่มเติม (ไม่บังคับ)</summary><div className="mt-3 space-y-3"><label className="block text-sm">เลขอ้างอิง / เลขสลิป<input maxLength={150} className={`${field} mt-1`} value={draft.reference} onChange={e => setDraft({ ...draft, reference: e.target.value })} /></label><label className="block text-sm">หมายเหตุ<textarea rows={2} maxLength={1000} className={`${field} mt-1`} value={draft.note} onChange={e => setDraft({ ...draft, note: e.target.value })} /></label></div></details>
        {!category && <p role="alert" className="text-sm text-rose-700">กรุณาเปิดใช้งานหมวดรับชำระคืนตามสัญญาใน Masterdata</p>}
        {error && <p role="alert" className="text-sm text-rose-700">{error}</p>}
        <p className="text-xs text-slate-500">เมื่อยืนยัน ระบบลงบัญชีรับเงินและปรับยอดคงค้างอัตโนมัติ</p><div className="flex justify-end gap-2"><Button onClick={() => setDraft(null)}>ยกเลิก</Button><Button type="submit" variant="primary" disabled={!category || !draft.channelCode || !draft.amount}>{pending ? 'กำลังบันทึก…' : 'ยืนยันรับชำระ'}</Button></div>
      </fieldset></form>}
    </Modal>
  </div>
}
