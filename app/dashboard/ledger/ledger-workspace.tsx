'use client'

import './ledger-entry.css'
import './ledger-directory.css'
import Link from 'next/link'
import { useFeedbackToast } from '@/components/ui/use-feedback-toast'
import { useState, useTransition, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, ArrowDownLeft, ArrowUpRight, Wallet, Search, BookOpen, PencilLine, History, Ban, CheckCircle2 } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { SlipPreview } from '@/components/ui/slip-preview'
import { Modal } from '@/components/ui/modal'
import { contractCode, formatContractMoney as money } from '@/lib/contracts'
import { bangkokToday, type LedgerInput } from '@/lib/ledger'
import { EditTransactionModal } from './edit-transaction-modal'
import { getLedger, saveLedger, voidLedger } from './actions'

type Data = Awaited<ReturnType<typeof getLedger>>
const field = 'w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-500'
const code = (id: number) => `TX-${String(id).padStart(6, '0')}`
export function LedgerWorkspace({ data }: { data: Data }) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [query, setQuery] = useState(''), [direction, setDirection] = useState(''), [from, setFrom] = useState(''), [to, setTo] = useState(''), [showVoids, setShowVoids] = useState(false)
  const [creating, setCreating] = useState(false), [error, setError] = useState(''), [notice, setNotice] = useState('')
  useFeedbackToast({ error, success: notice })
  const [voiding, setVoiding] = useState<Data['entries'][number] | null>(null), [reason, setReason] = useState('')
  const [page, setPage] = useState(1)
  const [editing, setEditing] = useState<Data['entries'][number] | null>(null)
  const [draft, setDraft] = useState<LedgerInput | null>(null)
  const active = data.entries.filter(e => !e.voidedAt)
  const incoming = active.filter(e => e.direction === 'IN').reduce((s, e) => s + e.amountSatang, 0)
  const outgoing = active.filter(e => e.direction === 'OUT').reduce((s, e) => s + e.amountSatang, 0)
  const outstanding = data.contracts.filter(c => c.disbursed).reduce((s, c) => s + c.remaining, 0)
  const filtered = data.entries.filter(e => (showVoids || !e.voidedAt) && (!direction || e.direction === direction) && (!from || e.occurredOn >= from) && (!to || e.occurredOn <= to) && [code(e.id), e.contractId ? contractCode(e.contractId) : '', e.contract?.borrowerName, e.categoryName, e.reference, e.note].some(v => v?.toLowerCase().includes(query.toLowerCase())))
  const current = Math.min(page, Math.max(1, Math.ceil(filtered.length / 25)))
  function open() {
    setDraft({ requestKey: crypto.randomUUID(), kind: 'GENERAL', contractId: null, direction: 'IN', categoryCode: '', amount: '', occurredOn: bangkokToday(), channelCode: '', reference: '', note: '' })
    setError(''); setCreating(true)
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
  return <div className="borrower-workspace ledger-directory space-y-5">
    {editing && <EditTransactionModal key={editing.id} entry={editing} data={data} onClose={() => setEditing(null)} />}
    {notice && <p role="status" className="text-sm text-emerald-700">{notice}</p>}
    <div className="ledger-directory-metrics grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {[[ 'รับเงินสะสม', incoming, ArrowDownLeft, 'text-emerald-700'], ['จ่ายเงินสะสม', outgoing, ArrowUpRight, 'text-rose-700'], ['เงินรับสุทธิหลังหักจ่าย', incoming - outgoing, Wallet, 'text-blue-700'], ['ยอดรอรับคืนตามสัญญา', outstanding, BookOpen, 'text-amber-700']].map(([title, amount, Icon, color]) => {
        const MetricIcon = Icon as typeof Wallet
        return <Card key={String(title)} className="p-5"><div className="flex justify-between text-sm text-slate-500">{String(title)}<MetricIcon size={19} /></div><p className={`mt-3 text-2xl font-semibold tabular-nums ${color}`}>{money(Number(amount))}<span className="ml-1 text-xs font-normal">บาท</span></p><p className="mt-2 text-xs text-slate-400">รวมทุกรายการที่ยังไม่ยกเลิก</p></Card>
      })}
    </div>
    <nav className="ledger-directory-shortcuts" aria-label="เริ่มทำรายการตามหน้าที่"><Link href="/dashboard/ap" className="text-blue-700 underline">จ่ายเงินตามสัญญา ↗</Link><Link href="/dashboard/repayments" className="text-blue-700 underline">ลูกหนี้และรับชำระ ↗</Link><Link href="/dashboard/ap/trade" className="text-blue-700 underline">จ่ายเจ้าหนี้การค้า ↗</Link></nav>
    <Card className="ledger-directory-card overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-3 p-5"><h2 className="font-semibold">รายการรับ–จ่าย <span className="ml-2 text-sm font-normal text-slate-500">{filtered.length} รายการ</span></h2>{data.canWrite && <Button variant="primary" onClick={() => open()}><Plus size={16} /> รับ–จ่ายทั่วไป</Button>}</div>
      <div className="flex flex-wrap items-end gap-3 border-y border-slate-200/70 p-4">
        <label className="min-w-48 flex-1 text-xs text-slate-500">ค้นหารายการ<div className="relative mt-1"><Search className="absolute right-3 top-3" size={17} /><input className={`${field} pr-10`} value={query} onChange={e => { setQuery(e.target.value); setPage(1) }} placeholder="เลขรายการ สัญญา ชื่อผู้กู้ อ้างอิง" /></div></label>
        <label className="text-xs text-slate-500">ประเภท<select className={`${field} mt-1`} value={direction} onChange={e => { setDirection(e.target.value); setPage(1) }}><option value="">ทั้งหมด</option><option value="IN">รับเงิน</option><option value="OUT">จ่ายเงิน</option></select></label>
        <label className="text-xs text-slate-500">ตั้งแต่<input type="date" className={`${field} mt-1`} value={from} onChange={e => { setFrom(e.target.value); setPage(1) }} /></label><label className="text-xs text-slate-500">ถึง<input type="date" min={from} className={`${field} mt-1`} value={to} onChange={e => { setTo(e.target.value); setPage(1) }} /></label>
        <label className="flex items-center gap-2 py-3 text-sm"><input type="checkbox" checked={showVoids} onChange={e => { setShowVoids(e.target.checked); setPage(1) }} />แสดงรายการยกเลิก</label>
      </div>
      <div className="ledger-directory-caption"><span>เรียงจากรายการล่าสุด · {filtered.length} รายการ</span><span>หน่วย: บาท</span></div>
      <div className="overflow-x-auto"><table className="ledger-directory-table"><thead><tr>{['วันรับ–จ่ายจริง / เลขรายการ', 'รายการ / บุคคล', 'ช่องทาง', 'รับเงิน', 'จ่ายเงิน', 'จัดการ'].map((v, i) => <th scope="col" key={v} className={i === 3 || i === 4 ? 'ledger-cash-cell' : ''}>{v}</th>)}</tr></thead><tbody>{filtered.slice((current - 1) * 25, current * 25).map(e => <tr key={e.id} className={e.voidedAt ? 'ledger-row-void' : ''}>
        <td className="ledger-date-cell"><p>{new Date(`${e.occurredOn}T00:00:00+07:00`).toLocaleDateString('th-TH', { timeZone: 'Asia/Bangkok', dateStyle: 'medium' })}</p><small>{code(e.id)}</small></td>
        <td className="ledger-description-cell"><div className="ledger-row-title"><span className={`ledger-row-dot ${e.direction === 'IN' ? 'is-in' : 'is-out'}`} /><strong>{e.categoryName}</strong>{e.voidedAt && <span className="ledger-void-label">ยกเลิกแล้ว</span>}</div>{e.contractId && <p className="ledger-row-person">{e.contract?.borrowerName} <span>· {contractCode(e.contractId)}</span></p>}
          {e.kind === 'DISBURSEMENT' && e.contract?.interestMethod === 'INTEREST_UPFRONT' && <div className="ledger-upfront-breakdown" aria-label={`ยอดจ่ายตามสัญญา ${contractCode(e.contractId!)}`}><span className="ledger-upfront-label">หักดอกเบี้ยล่วงหน้าตามสัญญา</span><dl><div><dt>เงินต้น</dt><dd>{money(e.contract.principalSatang)} บาท</dd></div><div><dt>หักดอกล่วงหน้า</dt><dd>−{money(e.contract.interestSatang)} บาท</dd></div><div><dt>จ่ายเงินจริง</dt><dd>{money(e.amountSatang)} บาท</dd></div><div><dt>ยอดต้องคืนตามสัญญา</dt><dd>{money(e.contract.repaymentSatang)} บาท</dd></div></dl></div>}
          {(e.note || e.reference || e.voidedAt || e.settlementWaivedSatang > 0) && <details className="ledger-row-details"><summary>รายละเอียด{e.settlementWaivedSatang > 0 ? ' · มียกเว้นส่วนต่าง' : ''}</summary><div>{e.reference && <p><span>เลขอ้างอิง</span> {e.reference}</p>}{e.note && <p className="whitespace-pre-wrap">{e.note}</p>}{e.settlementWaivedSatang > 0 && <p className="text-amber-700">ยกเว้นส่วนต่าง {money(e.settlementWaivedSatang)} บาท · {e.settlementWaiverReason}</p>}{e.voidedAt && <p>เหตุผลยกเลิก: {e.voidReason}</p>}</div></details>}
        </td>
        <td className="ledger-channel-cell"><p>{e.channelName}</p>{e.slip && <SlipPreview entryId={e.id} filename={e.slip.displayName} className="mt-1 block text-xs text-blue-700 underline">ดูสลิป</SlipPreview>}</td>
        <td className="ledger-cash-cell ledger-cash-in">{e.direction === 'IN' ? money(e.amountSatang) : <span className="ledger-empty-cash">—</span>}</td><td className="ledger-cash-cell ledger-cash-out">{e.direction === 'OUT' ? money(e.amountSatang) : <span className="ledger-empty-cash">—</span>}</td>
        <td><div className="ledger-row-actions"><button type="button" className="ledger-history-action" aria-label={`${e.voidedAt || !data.canWrite ? 'ดูประวัติ' : 'แก้ไขและดูประวัติ'} ${code(e.id)}`} onClick={() => setEditing(e)}>{e.voidedAt || !data.canWrite ? <History size={15} aria-hidden="true" /> : <PencilLine size={15} aria-hidden="true" />}<span>{e.voidedAt || !data.canWrite ? 'ประวัติ' : 'แก้ไข / ประวัติ'}</span></button>{!e.voidedAt && data.canWrite && <button type="button" className="ledger-cancel-action" title="ยกเลิกรายการ" aria-label={`ยกเลิกรายการ ${code(e.id)}`} onClick={() => { setVoiding(e); setReason(''); setError('') }}><Ban size={16} aria-hidden="true" /></button>}</div></td>
      </tr>)}</tbody></table>{!filtered.length && <div className="py-14 text-center"><Search size={24} aria-hidden="true" className="mx-auto mb-3 text-slate-300" /><p className="text-sm text-slate-500">ไม่พบรายการตามเงื่อนไข</p><button className="mt-3 text-xs text-blue-700 underline" onClick={() => { setQuery(''); setDirection(''); setFrom(''); setTo(''); setPage(1) }}>ล้างตัวกรอง</button></div>}</div>
      <div className="flex items-center justify-between border-t border-slate-200/70 p-4 text-sm"><span>หน้า {current} / {Math.max(1, Math.ceil(filtered.length / 25))}</span><div className="flex gap-2"><Button disabled={current <= 1} onClick={() => setPage(current - 1)}>ก่อนหน้า</Button><Button disabled={current * 25 >= filtered.length} onClick={() => setPage(current + 1)}>ถัดไป</Button></div></div>
    </Card>
    <Modal open={creating && Boolean(draft)} title="บันทึกรับ–จ่ายทั่วไป" description="สำหรับเงินทุนและค่าใช้จ่ายทั่วไป รายการตามสัญญาให้เริ่มจากหน้าจ่ายเงินหรือลูกหนี้" onClose={() => { if (!pending) setCreating(false) }} className="ledger-entry-dialog">
      {draft && <form onSubmit={submit}><fieldset disabled={pending} className="ledger-entry-form" data-direction={draft.direction}>
        <div className="ledger-entry-grid">
          <div className="ledger-entry-main">
            <div className="ledger-direction" role="group" aria-label="ประเภทเงิน">{[{ value: 'IN', label: 'รับเงิน', detail: 'เงินเข้าบัญชี', Icon: ArrowDownLeft }, { value: 'OUT', label: 'จ่ายเงิน', detail: 'เงินออกจากบัญชี', Icon: ArrowUpRight }].map(({ value, label, detail, Icon }) => <button key={value} type="button" aria-pressed={draft.direction === value} onClick={() => { if (draft.direction === value) return; setDraft({ ...draft, direction: value, kind: 'GENERAL', categoryCode: '', contractId: null, amount: '' }); setError('') }}><span className="ledger-direction-icon"><Icon size={21} aria-hidden="true" /></span><span><strong>{label}</strong><small>{detail}</small></span><span className="ledger-direction-check">{draft.direction === value && <CheckCircle2 size={18} aria-hidden="true" />}</span></button>)}</div>
            <div className="ledger-amount-box"><label htmlFor="ledger-entry-amount">{draft.direction === 'IN' ? 'ยอดเงินที่รับ' : 'ยอดเงินที่จ่าย'}</label><div className="ledger-amount-input"><input id="ledger-entry-amount" autoFocus required aria-describedby="ledger-amount-help" type="number" inputMode="decimal" min="0.01" step="0.01" placeholder="0.00" max={2000000000} value={draft.amount} onChange={e => setDraft({ ...draft, amount: e.target.value })} /><span>บาท</span></div><p id="ledger-amount-help">ระบุจำนวนเงินที่รับหรือจ่ายจริง</p></div>
        <label className="block text-sm font-medium">หมวดหมู่<select required className={`${field} mt-1.5`} value={draft.categoryCode} onChange={e => {
          setDraft({ ...draft, categoryCode: e.target.value }); setError('')
        }}><option value="">เลือกหมวดหมู่{draft.direction === 'IN' ? 'รับเงิน' : 'จ่ายเงิน'}</option>{data.categories.filter(c => c.direction === draft.direction && c.group !== 'LOAN' && !['INTEREST_RECEIVED', 'TRADE_PAYABLE'].includes(c.code)).map(c => <option key={c.code} value={c.code}>{c.nameTh}</option>)}</select></label>
        <div className="grid gap-3 sm:grid-cols-2"><label className="text-sm font-medium">วันที่<input required type="date" max={bangkokToday()} className={`${field} mt-1.5`} value={draft.occurredOn} onChange={e => setDraft({ ...draft, occurredOn: e.target.value })} /></label><label className="text-sm font-medium">ช่องทาง<select required className={`${field} mt-1.5`} value={draft.channelCode} onChange={e => setDraft({ ...draft, channelCode: e.target.value })}><option value="">เลือกช่องทาง</option>{data.channels.map(c => <option key={c.code} value={c.code}>{c.nameTh}</option>)}</select></label></div>

            {draft.direction === 'IN' && <p className="ledger-repayment-link">รับเงินคืนจากผู้กู้? <Link href="/dashboard/repayments">ไปลูกหนี้และรับชำระ ↗</Link></p>}
          </div>
          <aside className="ledger-entry-summary" aria-label="สรุปรายการก่อนบันทึก">
            <div className="ledger-summary-heading"><span className="ledger-summary-dot" />สรุปรายการ</div>
            <p className="ledger-summary-type">{draft.direction === 'IN' ? 'รับเงินเข้าบัญชี' : 'จ่ายเงินออกจากบัญชี'}</p>
            <p className="ledger-summary-amount">{Number.isFinite(Number(draft.amount)) && Number(draft.amount) > 0 ? money(Math.round(Number(draft.amount) * 100)) : '0.00'} <span>บาท</span></p>
            <dl className="ledger-summary-list"><div><dt>หมวดหมู่</dt><dd>{data.categories.find(c => c.code === draft.categoryCode)?.nameTh || 'ยังไม่เลือก'}</dd></div><div><dt>วันที่</dt><dd>{/^\d{4}-\d{2}-\d{2}$/.test(draft.occurredOn) ? new Date(`${draft.occurredOn}T00:00:00+07:00`).toLocaleDateString('th-TH', { timeZone: 'Asia/Bangkok', dateStyle: 'medium' }) : 'ยังไม่ระบุ'}</dd></div><div><dt>ช่องทาง</dt><dd>{data.channels.find(c => c.code === draft.channelCode)?.nameTh || 'ยังไม่เลือก'}</dd></div></dl>
            <div className="ledger-entry-extras"><p>รายละเอียดเพิ่มเติม <span>ไม่บังคับ</span></p><label>เลขอ้างอิง / เลขสลิป<input maxLength={150} className={field} placeholder="ระบุเลขอ้างอิง" value={draft.reference} onChange={e => setDraft({ ...draft, reference: e.target.value })} /></label><label>หมายเหตุ<textarea maxLength={1000} rows={2} className={field} placeholder="รายละเอียดของรายการนี้" value={draft.note} onChange={e => setDraft({ ...draft, note: e.target.value })} /></label></div>
          </aside>
        </div>
        {error && <p role="alert" className="ledger-entry-error">{error}</p>}
        <div className="ledger-entry-footer"><p><CheckCircle2 size={15} aria-hidden="true" />บันทึกเมื่อรับหรือจ่ายเงินจริงแล้ว</p><div><Button onClick={() => setCreating(false)}>ยกเลิก</Button><Button type="submit" variant="primary" disabled={!draft.categoryCode || !draft.amount || Number(draft.amount) <= 0 || !draft.channelCode} className="ledger-entry-save">{pending ? 'กำลังบันทึก…' : draft.direction === 'IN' ? 'บันทึกรับเงิน' : 'บันทึกจ่ายเงิน'}<CheckCircle2 size={16} aria-hidden="true" /></Button></div></div>
      </fieldset></form>}
    </Modal>
    <Modal open={Boolean(voiding)} title={`ยกเลิกรายการ ${voiding ? code(voiding.id) : ''}`} description="รายการเดิมจะยังอยู่ในประวัติ และยอดสัญญาจะถูกปรับกลับ" onClose={() => { if (!pending) setVoiding(null) }}><form onSubmit={cancel} className="space-y-4"><label className="block text-sm">เหตุผลยกเลิก<textarea required autoFocus maxLength={500} className={`${field} mt-1`} value={reason} onChange={e => setReason(e.target.value)} /></label>{error && <p role="alert" className="text-sm text-rose-700">{error}</p>}<Button type="submit" variant="danger" disabled={pending || !reason.trim()}>{pending ? 'กำลังยกเลิก…' : 'ยืนยันยกเลิกรายการ'}</Button></form></Modal>
  </div>
}
