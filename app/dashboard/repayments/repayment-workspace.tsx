'use client'

import { DataLoading } from '@/components/ui/data-loading'
import { useFeedbackToast } from '@/components/ui/use-feedback-toast'
import { useEffect, useRef, useState, useTransition, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Search, ArrowDownLeft, FileText, Wallet, Clock3, CircleCheck, History } from 'lucide-react'
import { SlipPreview } from '@/components/ui/slip-preview'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Modal } from '@/components/ui/modal'
import { slipFileName } from '@/lib/slip-name'
import { contractCode, formatContractMoney as money } from '@/lib/contracts'
import { bangkokToday, contractLedgerBalance, type LedgerInput } from '@/lib/ledger'
import { getRepaymentHistory, type getReceivables } from './actions'

type Data = Awaited<ReturnType<typeof getReceivables>>
const dateLabel = (value: string | null) => value ? new Intl.DateTimeFormat('th-TH', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Asia/Bangkok' }).format(new Date(`${value}T00:00:00+07:00`)) : 'ไม่ระบุวันครบกำหนด'
const recordedLabel = (value: string) => new Intl.DateTimeFormat('th-TH', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Bangkok' }).format(new Date(value))
const field = 'w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-emerald-500'
function ContractNumber({ id, legacy }: { id: number; legacy?: string | null }) {
  return <div className="repayment-contract-number"><span>เลขที่สัญญา</span><strong>{contractCode(id)}</strong>{legacy && <p>เลขสัญญาเดิม <b>{legacy}</b></p>}</div>
}

export function RepaymentWorkspace({ data, initialQuery = '', initialView = 'OPEN' }: { data: Data; initialQuery?: string; initialView?: string; initialPage?: number }) {
  const router = useRouter()
  const [query, setQuery] = useState(initialQuery)
  const [historyEntries, setHistoryEntries] = useState<Awaited<ReturnType<typeof getRepaymentHistory>>>([])
  const [historyLoading, setHistoryLoading] = useState(false)
  const [historyError, setHistoryError] = useState('')
  const [reviewing, setReviewing] = useState(false)
  const slipInput = useRef<HTMLInputElement>(null)
  const [draftOpen, setDraftOpen] = useState(false)
  const [slip, setSlip] = useState<File | null>(null)
  const [draft, setDraft] = useState<LedgerInput | null>(null)
  const [error, setError] = useState(''), [notice, setNotice] = useState('')
  useFeedbackToast({ error, success: notice })
  const [pending, startTransition] = useTransition()
  const view = initialView
  const [historyId, setHistoryId] = useState<number | null>(null)
  const today = data.today
  const historyContract = data.contracts.find(c => c.id === historyId)
  useEffect(() => {
    if (historyId === null) return
    let active = true
    getRepaymentHistory(historyId).then(entries => { if (active) setHistoryEntries(entries) })
      .catch(() => { if (active) setHistoryError('โหลดประวัติไม่สำเร็จ กรุณาปิดแล้วเปิดรายละเอียดใหม่') })
      .finally(() => { if (active) setHistoryLoading(false) })
    return () => { active = false }
  }, [historyId])
  useEffect(() => {
    if (!draft) return
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = '' }
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [draft])
  function openHistory(id: number) { setHistoryEntries([]); setHistoryError(''); setHistoryLoading(true); setHistoryId(id) }
  function listUrl(nextView = view, nextPage = 1) {
    return `/dashboard/repayments?${new URLSearchParams({ q: initialQuery, view: nextView, page: String(nextPage) })}`
  }
  const selected = data.contracts.find(c => c.id === draft?.contractId)
  const selectedBalance = selected && draft ? contractLedgerBalance(selected, data.entries.filter(e => e.contractId === selected.id), draft.occurredOn) : null
  const payable = selectedBalance ? selectedBalance.remaining - (draft?.waivePenalty ? selectedBalance.penaltyRemaining : 0) : 0
  const category = data.categories.find(c => c.code === 'CONTRACT_REPAYMENT' && c.direction === 'IN' && c.group === 'LOAN')
  const rows = data.contracts
  const current = data.page
  function receive(c: Data['contracts'][number]) {
    if (draft) { setDraftOpen(true); setError('มีรายการที่ยังไม่ได้บันทึก กรุณาบันทึกหรือล้างรายการเดิมก่อน'); return }
    setError('')
    setDraftOpen(true)
    setSlip(null)
    setHistoryId(null)
    setReviewing(false)
    setDraft({ requestKey: crypto.randomUUID(), kind: 'REPAYMENT', contractId: c.id, direction: 'IN', categoryCode: 'CONTRACT_REPAYMENT', amount: String(c.remaining / 100), occurredOn: bangkokToday(), channelCode: '', reference: '', note: '' })
  }
  function submit(event: FormEvent) {
    event.preventDefault(); if (!draft || pending) return
    setError('')
    if (!reviewing) { setReviewing(true); return }
    startTransition(async () => {
      try {
        const form = new FormData()
        form.set('input', JSON.stringify(draft))
        if (slip) form.set('file', slip)
        const response = await fetch('/api/repayments', { method: 'POST', body: form })
        const result = await response.json()
        if (!response.ok && !result.error) throw new Error('บันทึกไม่สำเร็จ')
        if (result.error) { setError(result.error); return }
        setNotice(`รับชำระ ${contractCode(draft.contractId!)} จำนวน ${money(Math.round(Number(draft.amount) * 100))} บาท และลงบัญชีรับเงินแล้ว`)
        setDraft(null); setSlip(null); setDraftOpen(false); router.refresh()
      } catch { setError('เชื่อมต่อไม่สำเร็จ กรุณาลองอีกครั้ง') }
    })
  }
  return <div className="borrower-workspace repayment-workspace space-y-3">
    {draft && !draftOpen && <section role="status" className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm"><p>รายการ {contractCode(draft.contractId!)} ยังไม่ได้บันทึก{slip ? ' · เก็บไฟล์สลิปที่เลือกไว้แล้ว' : ''} · เก็บไว้จนกว่าจะออกจากหน้านี้</p><div className="flex gap-2"><Button onClick={() => setDraftOpen(true)}>กลับไปบันทึกต่อ</Button><Button onClick={() => { setDraft(null); setSlip(null); setReviewing(false); setError('') }}>ล้างรายการที่ยังไม่บันทึก</Button></div></section>}
    {notice && <p role="status" className="rounded-xl bg-emerald-50 p-4 text-sm text-emerald-800">{notice} <Link className="ml-2 underline" href="/dashboard/ledger">ดูรายการบัญชี</Link></p>}
    <div className="repayment-metrics">{[
      { title: 'ยอดคงค้างตามสัญญา', value: money(data.summary.remaining), unit: 'บาท', detail: `${data.summary.openCount} สัญญาที่รอรับชำระ`, icon: Wallet, tone: 'gold' },
      { title: 'เกินกำหนดชำระ', value: String(data.summary.overdueCount), unit: 'สัญญา', detail: `ยอดเกินกำหนด ${money(data.summary.overdue)} บาท`, icon: Clock3, tone: 'rose' },
      { title: 'ครบกำหนดวันนี้', value: String(data.summary.todayCount), unit: 'สัญญา', detail: dateLabel(today), icon: FileText, tone: 'blue' },
      { title: 'รับชำระวันนี้', value: money(data.summary.receivedToday), unit: 'บาท', detail: 'เฉพาะรายการที่ยังไม่ถูกยกเลิก', icon: CircleCheck, tone: 'green' },
    ].map(m => <Card key={m.title} className={`repayment-metric repayment-metric--${m.tone}`}><div className="repayment-metric-top"><span>{m.title}</span><m.icon size={19} aria-hidden="true" /></div><p className="repayment-metric-value">{m.value} <span>{m.unit}</span></p><p className="repayment-metric-detail">{m.detail}</p></Card>)}</div>
    <Card className="overflow-hidden">
      <div className="repayment-directory-heading"><div><h2>รายการรับชำระ <span>{data.total}</span></h2><p>เลือกบันทึกชำระ เพื่อตรวจสัญญาและยอดก่อนยืนยัน</p></div><Link href="/dashboard/ledger">ดูบัญชีรับ–จ่าย ↗</Link></div>
      <div className="repayment-tabs" role="group" aria-label="กรองสถานะสัญญา">{[['OPEN', 'รอรับชำระ'], ['OVERDUE', 'เกินกำหนด'], ['TODAY', 'ครบกำหนดวันนี้'], ['UPCOMING', 'ยังไม่ถึงกำหนด'], ['CLOSED', 'ปิดแล้ว'], ['ALL', 'ทั้งหมด']].map(([value, label]) => <Link key={value} href={listUrl(value)} aria-current={view === value ? 'page' : undefined}>{label}</Link>)}</div>
      <form action="/dashboard/repayments" className="repayment-search flex flex-wrap items-end gap-3"><input type="hidden" name="view" value={view} /><label className="min-w-48 flex-1 text-sm">ค้นหาสัญญา<div className="relative mt-1"><Search size={17} aria-hidden="true" className="absolute left-3 top-3" /><input className={`${field} !pl-10`} name="q" maxLength={100} placeholder="เลขสัญญา ชื่อผู้กู้ หรือผู้ให้กู้" value={query} onChange={e => setQuery(e.target.value)} /></div></label><Button type="submit">ค้นหา</Button></form>
      <div className="overflow-x-auto repayment-table"><table className="w-full whitespace-nowrap text-left text-sm"><thead className="bg-slate-50 text-xs text-slate-500"><tr>{['สัญญา / ผู้กู้', 'ครบกำหนด', 'ยอดตามสัญญา', 'ความคืบหน้า', 'คงค้าง', ''].map((title, i) => <th key={i} scope="col" className="p-4">{title || <span className="sr-only">ทำรายการ</span>}</th>)}</tr></thead><tbody>{rows.map(c => <tr key={c.id} className="border-t border-slate-100"><td className="p-4"><p className="font-medium">{c.borrowerName}</p><ContractNumber id={c.id} legacy={c.legacySourceCode} /></td><td className="p-4"><p>{dateLabel(c.repaymentDueDate)}</p>{c.remaining > 0 && c.repaymentDueDate && c.repaymentDueDate < bangkokToday() && <span className="text-xs text-rose-700">เกินกำหนด</span>}</td><td className="p-4 tabular-nums">{money(c.repaymentSatang)}</td><td className="p-4 tabular-nums text-slate-500"><p>รับชำระคืน {money(c.received)} บาท</p>{c.disbursed && c.interestMethod === 'INTEREST_UPFRONT' && c.interestSatang > 0 && <p className="repayment-upfront-received">รับดอกเบี้ยล่วงหน้าแล้ว {money(c.interestSatang)} บาท<span>หักจากเงินจ่ายให้ผู้กู้ · ไม่หักยอดคืนซ้ำ</span></p>}{c.settlementWaived > 0 && <p className="mt-1 text-xs">ยกเว้นส่วนต่าง {money(c.settlementWaived)} บาท</p>}<p className="mt-1 text-xs">ลดหนี้ตามสัญญา {c.repaymentSatang > 0 ? Math.min(100, Math.round((c.repaymentSatang - c.baseRemaining) / c.repaymentSatang * 100)) : 0}%</p><div className="repayment-progress" role="progressbar" aria-label={`การลดหนี้ตามสัญญารวมยอดยกเว้น ${contractCode(c.id)}`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={c.repaymentSatang > 0 ? Math.min(100, Math.round((c.repaymentSatang - c.baseRemaining) / c.repaymentSatang * 100)) : 0}><span style={{ width: `${c.repaymentSatang > 0 ? Math.min(100, (c.repaymentSatang - c.baseRemaining) / c.repaymentSatang * 100) : 0}%` }} /></div></td><td className="p-4 font-semibold tabular-nums">{money(c.remaining)}{c.penaltyRemaining > 0 && <p className="mt-1 text-xs font-normal text-rose-700">รวมค่าปรับ {money(c.penaltyRemaining)}</p>}</td><td className="p-4"><div className="flex items-center justify-end gap-2"><Button variant={c.remaining > 0 ? 'primary' : 'secondary'} aria-label={`${c.remaining > 0 && data.canWrite ? 'บันทึกชำระ' : 'ประวัติชำระ'} ${contractCode(c.id)}`} onClick={() => openHistory(c.id)}><FileText size={16} aria-hidden="true" />{c.remaining > 0 && data.canWrite ? 'บันทึกชำระ' : 'ประวัติชำระ'}</Button>{c.remaining === 0 && <span className="text-emerald-700">ปิดแล้ว</span>}</div></td></tr>)}</tbody></table>{!rows.length && <div className="p-12 text-center"><p className="font-medium text-slate-600">ไม่พบสัญญาในรายการนี้</p><p className="mt-2 text-sm text-slate-400">ลองเปลี่ยนตัวกรองหรือคำค้นหา · แสดงเฉพาะสัญญาที่จ่ายเงินกู้แล้ว</p></div>}</div>
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 p-4 text-sm"><span>{data.total} สัญญา · หน้า {current}/{data.pageCount}</span><nav aria-label="หน้ารายการลูกหนี้" className="flex gap-4">{current > 1 && <Link className="underline" href={listUrl(view, current - 1)}>ก่อนหน้า</Link>}{current < data.pageCount && <Link className="underline" href={listUrl(view, current + 1)}>ถัดไป</Link>}</nav></div>
    </Card>
    <details className="repayment-aging"><summary>รายละเอียดอายุหนี้ที่เกินกำหนด · {data.summary.overdueCount} สัญญา</summary><div className="grid grid-cols-2 gap-3 lg:grid-cols-4">{data.summary.aging.map(bucket => <div key={bucket.label} className="rounded-xl border border-slate-200 p-3"><p className="text-xs text-slate-500">{bucket.label} · {bucket.count} สัญญา</p><p className="mt-2 font-semibold tabular-nums">{money(bucket.amount)} บาท</p></div>)}</div></details>
    <Modal open={Boolean(historyContract)} title={historyContract && historyContract.remaining > 0 && data.canWrite ? 'บันทึกชำระตามสัญญา' : 'ประวัติชำระ'} onClose={() => setHistoryId(null)} className="repayment-dialog max-h-[90vh] overflow-y-auto">
      {historyContract && <>
        <div className="repayment-contract-heading"><strong>{historyContract.borrowerName}</strong><ContractNumber id={historyContract.id} legacy={historyContract.legacySourceCode} /><p>ผู้ให้กู้ {historyContract.lenderName} · ครบกำหนด {dateLabel(historyContract.repaymentDueDate)}</p></div>
        <dl className="repayment-detail-grid">{[
          ['เงินต้น', historyContract.principalSatang], [historyContract.interestMethod === 'INTEREST_UPFRONT' ? 'หักดอกเบี้ยล่วงหน้า' : 'ดอกเบี้ยตามสัญญา', historyContract.interestSatang],
          ['จ่ายเงินจริงตามสัญญา', historyContract.netSatang], ['ยอดต้องคืนตามสัญญา', historyContract.repaymentSatang], ...(historyContract.disbursed && historyContract.interestMethod === 'INTEREST_UPFRONT' ? [['รับดอกเบี้ยล่วงหน้าแล้ว (หักจากเงินจ่าย)', historyContract.interestSatang]] : []), ['รับชำระคืนสะสม', historyContract.received],
          ['ยอดตามสัญญาที่ยังค้าง', historyContract.baseRemaining], ['ค่าปรับค้าง', historyContract.penaltyRemaining],
          ['ยกเว้นค่าปรับสะสม', historyContract.penaltyWaived], ['ยกเว้นส่วนต่างสะสม', historyContract.settlementWaived],
        ].map(([label, amount]) => <div key={String(label)}><dt>{label}</dt><dd>{money(Number(amount))} บาท</dd></div>)}</dl>
        <div className="repayment-preview"><span>คงค้างรวม ณ {dateLabel(today)}</span><strong>{money(historyContract.remaining)} บาท</strong></div>
        {historyContract.remaining > 0 && data.canWrite && <div className="my-4"><Button variant="primary" className="w-full justify-center" onClick={() => receive(historyContract)}><ArrowDownLeft size={16} aria-hidden="true" />บันทึกชำระ</Button></div>}
        <h3 className="mb-3 mt-5 flex items-center gap-2 text-sm font-semibold"><History size={16} aria-hidden="true" />ประวัติการรับชำระ</h3>
        <div className="space-y-3">{historyLoading ? <DataLoading compact label="กำลังโหลดประวัติ…" /> : historyError ? <p role="alert" className="py-6 text-sm text-rose-700">{historyError}</p> : historyEntries.length ? historyEntries.map(e => <article key={e.id} className="repayment-history-entry"><div className="flex justify-between gap-3"><strong className={e.voidedAt ? 'line-through opacity-50' : ''}>{money(e.amountSatang)} บาท</strong><span>{e.voidedAt ? 'ยกเลิกแล้ว' : 'รับชำระแล้ว'}</span></div>{e.principalReceivedSatang !== null && e.interestReceivedSatang !== null && e.penaltyReceivedSatang !== null ? <p>แยกยอดบัญชี: เงินต้น {money(e.principalReceivedSatang)} · ดอกเบี้ย {money(e.interestReceivedSatang)} · ค่าปรับ {money(e.penaltyReceivedSatang)} บาท</p> : !e.voidedAt && <p>ยังไม่ได้ตรวจแยกเงินต้น–ดอกเบี้ย · <Link className="text-blue-700 underline" href={`/dashboard/ac?month=${e.occurredOn.slice(0, 7)}`}>ไปตรวจยอดรายเดือน</Link></p>}<p>รับเงินจริง {dateLabel(e.occurredOn)} · {e.channelName}</p><p>บันทึกเข้าระบบ {recordedLabel(e.createdAt)} · TX-{String(e.id).padStart(6, '0')}</p>{e.slip && <p><SlipPreview entryId={e.id} filename={e.slip.displayName} className="underline text-blue-700">ดูสลิป · {e.slip.displayName}</SlipPreview></p>}{e.reference && <p>อ้างอิง: {e.reference}</p>}{e.note && <p>{e.note}</p>}{e.settlementWaivedSatang > 0 && <p>ยกเว้นส่วนต่าง {money(e.settlementWaivedSatang)} บาท · {e.settlementWaiverReason}</p>}{e.penaltyWaivedSatang > 0 && <p>ยกเว้นค่าปรับ {money(e.penaltyWaivedSatang)} บาท · {e.penaltyWaiverReason}</p>}{e.voidedAt && <p>เหตุผลยกเลิก: {e.voidReason}</p>}</article>) : <p className="py-8 text-center text-sm">ยังไม่มีรายการรับชำระสำหรับสัญญานี้</p>}</div>
      </>}
    </Modal>
    <Modal open={Boolean(draftOpen && draft && selected)} title={reviewing ? 'ตรวจสอบก่อนยืนยันรับชำระ' : 'บันทึกชำระ'} onClose={() => { if (!pending) setDraftOpen(false) }} className="repayment-dialog max-h-[90vh] overflow-y-auto">
      {draft && selected && <form onSubmit={submit}><fieldset disabled={pending} className="space-y-4">
        {!reviewing ? <>
        <div className="rounded-2xl bg-emerald-50 p-4"><p className="font-semibold">{selected.borrowerName}</p><ContractNumber id={selected.id} legacy={selected.legacySourceCode} /><p className="mt-2 text-xs text-slate-500">ผู้ให้กู้ {selected.lenderName}</p><div className="mt-4 flex justify-between text-sm"><span>ยอดคงค้าง</span><strong className="text-xl tabular-nums text-emerald-800">{money(selectedBalance?.remaining ?? selected.remaining)} <span className="text-xs font-normal">บาท</span></strong></div></div>
        <label className="block text-sm font-medium">ยอดชำระเงินจริง (บาท)<input autoFocus required type="number" inputMode="decimal" min="0.01" max={payable / 100} step="0.01" className={`${field} mt-1 !text-2xl font-semibold`} value={draft.amount} onChange={e => setDraft({ ...draft, amount: e.target.value })} /><span className="mt-1 block text-xs font-normal text-slate-500">ระบุยอดโอนจริงตามสลิป ยอดยกเว้นจะไม่รวมเป็นเงินรับ</span></label>
        <div className="grid gap-3 sm:grid-cols-2"><label className="text-sm">วันที่รับเงิน<input required type="date" min={selected.disbursementOn ?? undefined} max={bangkokToday()} className={`${field} mt-1`} value={draft.occurredOn} onChange={e => setDraft({ ...draft, occurredOn: e.target.value })} /></label><label className="text-sm">ช่องทาง<select required className={`${field} mt-1`} value={draft.channelCode} onChange={e => setDraft({ ...draft, channelCode: e.target.value })}><option value="">เลือกช่องทาง</option>{data.channels.map(c => <option key={c.code} value={c.code}>{c.nameTh}</option>)}</select></label></div>
        {selectedBalance && <section className="repayment-penalty"><div className="flex justify-between gap-3 text-sm"><span>ยอดตามสัญญาคงค้าง</span><strong>{money(selectedBalance.baseRemaining)} บาท</strong></div><div className="mt-2 flex justify-between gap-3 text-sm"><span>ค่าปรับค้าง · วันละ 50 บาท (สูงสุด 30 วัน)</span><strong>{money(selectedBalance.penaltyRemaining)} บาท</strong></div><p className="mt-2 text-xs text-slate-500">{selectedBalance.overdueDays > 0 ? `เกินกำหนด ${selectedBalance.overdueDays} วัน ณ ${dateLabel(draft.occurredOn)}` : 'ยังไม่เกินกำหนดชำระ'} · รับชำระค่าปรับก่อนยอดตามสัญญา</p>{selectedBalance.renegotiationRequired && <p role="alert" className="mt-3 rounded-lg bg-amber-100 p-3 text-sm font-medium text-amber-950">เกินกำหนดมากกว่า 1 เดือนแล้ว ควรบันทึกข้อตกลงฉบับใหม่ก่อนกำหนดยอดและรอบชำระถัดไป</p>}{selectedBalance.penaltyRemaining > 0 && <><Button className="mt-3" aria-pressed={Boolean(draft.waivePenalty)} onClick={() => setDraft({ ...draft, waivePenalty: !draft.waivePenalty })}>{draft.waivePenalty ? 'ยกเลิกการยกเว้นค่าปรับ' : 'ยกเว้นค่าปรับทั้งหมด'}</Button>{draft.waivePenalty && <label className="mt-3 block text-sm">เหตุผลยกเว้นค่าปรับ <span className="text-rose-700">*</span><textarea required maxLength={500} rows={2} className={`${field} mt-1`} value={draft.penaltyWaiverReason ?? ''} onChange={e => setDraft({ ...draft, penaltyWaiverReason: e.target.value })} /><span className="mt-1 block text-xs text-slate-500">ยกเว้น {money(selectedBalance.penaltyRemaining)} บาท เมื่อยืนยันรับชำระ · ค่าปรับจะหยุดหลังครบ 30 วัน</span></label>}</>}</section>}
        {Number(draft.amount) > 0 && Math.round(Number(draft.amount) * 100) < payable && <section className="repayment-penalty"><label className="flex items-start gap-2 text-sm"><input type="checkbox" className="mt-1" checked={Boolean(draft.settleRemaining)} onChange={e => setDraft({ ...draft, settleRemaining: e.target.checked })} /><span>ยกเว้นส่วนต่าง {money(payable - Math.round(Number(draft.amount) * 100))} บาท เพื่อปิดสัญญาด้วยยอดชำระเงินจริง</span></label>{draft.settleRemaining && <label className="mt-3 block text-sm">เหตุผลยกเว้นส่วนต่าง<textarea required maxLength={500} rows={2} className={`${field} mt-1`} value={draft.settlementWaiverReason ?? ''} onChange={e => setDraft({ ...draft, settlementWaiverReason: e.target.value })} /><span className="mt-1 block text-xs text-slate-500">บันทึกเป็นยอดยกเว้นแยกจากเงินรับจริง และเก็บผู้ทำรายการไว้ในประวัติ</span></label>}</section>}
        <div className="repayment-preview"><span>ยอดคงค้างหลังรับชำระ</span><strong>{money(Math.max(0, draft.settleRemaining ? 0 : payable - (Number.isFinite(Number(draft.amount)) ? Math.round(Number(draft.amount) * 100) : 0)))} บาท</strong></div>
        <div className="repayment-slip-upload">
          <p className="text-sm font-medium">แนบสลิปการชำระเงิน <span className="font-normal text-slate-500">(ไม่บังคับ)</span></p>
          <input ref={slipInput} type="file" hidden aria-label="เลือกสลิปการชำระเงิน" accept="image/jpeg,image/png,application/pdf" onChange={event => {
            const file = event.target.files?.[0]
            event.target.value = ''
            if (!file) return
            if (file.size <= 0 || file.size > 5 * 1024 * 1024 || !['image/jpeg', 'image/png', 'application/pdf'].includes(file.type)) { setError('เลือกไฟล์ JPG, PNG หรือ PDF ขนาดไม่เกิน 5 MB'); return }
            setError(''); setSlip(file)
          }} />
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <Button onClick={() => slipInput.current?.click()}>{slip ? 'เปลี่ยนไฟล์สลิป' : 'เลือกไฟล์สลิป'}</Button>
            {slip && <Button variant="danger" onClick={() => { setSlip(null); setError(''); if (slipInput.current) slipInput.current.value = '' }}>ลบไฟล์ที่เลือก</Button>}
          </div>
          <p className="mt-2 text-xs text-slate-500">JPG, PNG หรือ PDF ขนาดไม่เกิน 5 MB · เลือกไฟล์แล้วต้องกดยืนยันรับชำระเพื่อบันทึกหลักฐาน</p>
          <p role="status" className="mt-2 break-all text-sm">{slip ? <>ชื่อหลักฐาน: {slipFileName({ contractId: selected.id, legacySourceCode: selected.legacySourceCode, kind: 'REPAYMENT', occurredOn: draft.occurredOn }, slip.type)} · {(slip.size / 1024 / 1024).toFixed(2)} MB</> : 'ยังไม่ได้แนบสลิป'}</p>
        </div>
        <details className="rounded-xl border border-slate-200 p-3"><summary className="cursor-pointer text-sm text-slate-500">รายละเอียดเพิ่มเติม (ไม่บังคับ)</summary><div className="mt-3 space-y-3"><label className="block text-sm">เลขอ้างอิง / เลขสลิป<input maxLength={150} className={`${field} mt-1`} value={draft.reference} onChange={e => setDraft({ ...draft, reference: e.target.value })} /></label><label className="block text-sm">หมายเหตุ<textarea rows={2} maxLength={1000} className={`${field} mt-1`} value={draft.note} onChange={e => setDraft({ ...draft, note: e.target.value })} /></label></div></details>
        {!category && <p role="alert" className="text-sm text-rose-700">กรุณาเปิดใช้งานหมวดรับชำระคืนตามสัญญาใน Masterdata</p>}
        </> : <section className="repayment-confirmation" aria-label="สรุปรายการก่อนบันทึก">
          <div className="repayment-contract-heading"><strong>{selected.borrowerName}</strong><ContractNumber id={selected.id} legacy={selected.legacySourceCode} /><p>ผู้ให้กู้ {selected.lenderName}</p></div>
          <dl className="repayment-review-list">
            <div><dt>รับเงินจริง</dt><dd>{money(Math.round(Number(draft.amount) * 100))} บาท</dd></div>
            <div><dt>วันโอนจริงตามสลิป</dt><dd>{dateLabel(draft.occurredOn)}</dd></div>
            <div><dt>ช่องทาง</dt><dd>{data.channels.find(c => c.code === draft.channelCode)?.nameTh}</dd></div>
            <div><dt>ค่าปรับ ณ วันรับเงิน</dt><dd>{money(selectedBalance?.penaltyRemaining ?? 0)} บาท</dd></div>
            <div><dt>ยกเว้นค่าปรับ</dt><dd>{money(draft.waivePenalty ? selectedBalance?.penaltyRemaining ?? 0 : 0)} บาท</dd></div>
            {draft.waivePenalty && <div><dt>เหตุผลยกเว้นค่าปรับ</dt><dd>{draft.penaltyWaiverReason}</dd></div>}
            <div><dt>ยกเว้นส่วนต่าง</dt><dd>{money(draft.settleRemaining ? Math.max(0, payable - Math.round(Number(draft.amount) * 100)) : 0)} บาท</dd></div>
            {draft.settleRemaining && <div><dt>เหตุผลยกเว้นส่วนต่าง</dt><dd>{draft.settlementWaiverReason}</dd></div>}
            <div><dt>คงเหลือหลังรายการนี้ ณ วันรับเงิน</dt><dd>{money(draft.settleRemaining ? 0 : Math.max(0, payable - Math.round(Number(draft.amount) * 100)))} บาท</dd></div>
            <div><dt>หลักฐาน</dt><dd>{slip ? slipFileName({ contractId: selected.id, legacySourceCode: selected.legacySourceCode, kind: 'REPAYMENT', occurredOn: draft.occurredOn }, slip.type) : 'ไม่ได้แนบสลิป'}</dd></div>
            <div><dt>เลขอ้างอิง</dt><dd>{draft.reference || 'ไม่ระบุ'}</dd></div>
            {draft.note && <div><dt>หมายเหตุ</dt><dd>{draft.note}</dd></div>}
          </dl>
          <p className="mt-3 text-xs text-slate-500">ยอดยกเว้นแยกจากเงินรับจริง ระบบจะลงบัญชีเมื่อกดยืนยันด้านล่าง</p>
        </section>}
        {error && <p role="alert" className="text-sm text-rose-700">{error}</p>}
        <p className="text-xs text-slate-500">คำนวณค่าปรับถึงวันที่รับเงินจริงตามสลิป ไม่ใช่วันที่นำเข้ารายการ</p>
        <p className="text-xs text-slate-500">เมื่อยืนยัน ระบบลงบัญชีรับเงินและปรับยอดคงค้างอัตโนมัติ</p><div className="flex flex-wrap justify-end gap-2"><Button onClick={() => reviewing ? setReviewing(false) : setDraftOpen(false)}>{reviewing ? 'กลับไปแก้ไข' : 'ปิดไว้ก่อน'}</Button><Button type="submit" variant="primary" disabled={!category || !draft.channelCode || !draft.amount}>{pending ? 'กำลังบันทึก…' : reviewing ? `ยืนยันรับชำระ ${selected.legacySourceCode ?? contractCode(selected.id)}` : 'ตรวจสอบก่อนบันทึก'}</Button></div>
      </fieldset></form>}
    </Modal>
  </div>
}
