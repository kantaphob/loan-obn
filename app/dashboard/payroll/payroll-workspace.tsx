'use client'

import './payroll.css'
import Link from 'next/link'
import { ArrowDownLeft, ArrowUpRight, Banknote, Check, Plus, RotateCcw, Trash2, Wallet } from 'lucide-react'
import { useState, useTransition, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Modal } from '@/components/ui/modal'
import { bangkokToday } from '@/lib/ledger'
import { incomeFields, deductionFields, payrollReceiptWindow, payrollTotals, type PayrollInput } from '@/lib/payroll'
import { getPayroll, getPayrollCandidates, receivePayroll, savePayroll } from './actions'

type Data = Awaited<ReturnType<typeof getPayroll>>
type Row = Data['records'][number]
const money = (n: number) => (n / 100).toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const field = 'mt-1 block w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm'
const monthLabel = (value: string) => new Date(`${value}-01T00:00:00+07:00`).toLocaleDateString('th-TH', { month: 'long', year: 'numeric', timeZone: 'Asia/Bangkok' })
export function PayrollWorkspace({ data }: { data: Data }) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [draft, setDraft] = useState<PayrollInput | null>(null)
  const [receiving, setReceiving] = useState<Row | null>(null)
  const [candidates, setCandidates] = useState<Awaited<ReturnType<typeof getPayrollCandidates>>>([])
  const [details, setDetails] = useState<Row | null>(null)
  const [receiptMode, setReceiptMode] = useState('LINK')
  const [confirmed, setConfirmed] = useState(false)
  const [year, setYear] = useState('ALL')
  const [status, setStatus] = useState('ALL')
  const [query, setQuery] = useState('')
  const [error, setError] = useState(''), [notice, setNotice] = useState('')
  const rows = data.records.filter(r => (year === 'ALL' || r.month.startsWith(year)) && (status === 'ALL' || (status === 'PAID' ? Boolean(r.receipt) : !r.receipt)) && r.employer.toLowerCase().includes(query.toLowerCase()))
  const total = (key: 'gross' | 'deductions' | 'net') => rows.reduce((n, r) => n + r[key], 0)
  let totals: ReturnType<typeof payrollTotals> | null = null
  try { if (draft) totals = payrollTotals(draft.values, draft.customItems, draft.hiddenFields) } catch { /* Invalid input is reported on save. */ }
  function edit(row?: Row) {
    setError(''); setNotice('')
    setDraft(row ? { id: row.id, month: row.month, employer: row.employer, note: row.note, values: Object.fromEntries(Object.entries(row.amounts).map(([k, v]) => [k, String(v / 100)])), customItems: row.customItems, hiddenFields: row.hiddenFields } : { month: bangkokToday().slice(0, 7), employer: '', note: '', values: {}, customItems: [], hiddenFields: [] })
  }
  function save(event: FormEvent) {
    event.preventDefault()
    if (!draft || pending) return
    setError('')
    startTransition(async () => {
      try {
        const result = await savePayroll(draft)
        if ('error' in result) { setError(result.error); return }
        setDraft(null); setNotice('บันทึกข้อมูลเงินเดือนแล้ว ยังไม่มีการเพิ่มเงินในบัญชี'); router.refresh()
      } catch { setError('เชื่อมต่อไม่สำเร็จ กรุณาลองใหม่') }
    })
  }
  function prepareReceipt(row: Row) {
    setError(''); setNotice(''); setConfirmed(false)
    startTransition(async () => {
      try {
        const matches = await getPayrollCandidates(row.id)
        setCandidates(matches); setReceiptMode('LINK'); setReceiving(row)
      } catch { setNotice('โหลดรายการรับเงินไม่สำเร็จ กรุณาลองใหม่') }
    })
  }
  function receive(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!receiving || pending || !confirmed) return
    const form = new FormData(event.currentTarget)
    setError('')
    startTransition(async () => {
      try {
        const result = await receivePayroll({ id: receiving.id, existingKey: receiptMode === 'LINK' ? String(form.get('existingKey') ?? '') : undefined, occurredOn: String(form.get('occurredOn') ?? ''), channelCode: String(form.get('channelCode') ?? ''), reference: String(form.get('reference') ?? '') })
        if ('error' in result) { setError(result.error); return }
        setReceiving(null); setNotice(receiptMode === 'LINK' ? 'จับคู่รายการรับเงินเดิมแล้ว ไม่มีการเพิ่มรายรับซ้ำ' : 'บันทึกรับเงินสุทธิเข้าบัญชีทั่วไปแล้ว'); router.refresh()
      } catch { setError('เชื่อมต่อไม่สำเร็จ กรุณาลองใหม่') }
    })
  }
  return <div className="payroll-workspace space-y-5">
    {notice && <p role="status" className="rounded-xl bg-emerald-50 p-4 text-sm text-emerald-800">{notice}</p>}
    <div className="payroll-metrics">{[{ label: 'เงินได้รวม', value: total('gross'), Icon: ArrowDownLeft, tone: 'income' }, { label: 'เงินหักรวม', value: total('deductions'), Icon: ArrowUpRight, tone: 'deduction' }, { label: 'เงินรับสุทธิตามงวด', value: total('net'), Icon: Wallet, tone: 'net' }, { label: 'รับเงินจริงแล้ว', value: rows.filter(r => r.receipt).reduce((n, r) => n + r.net, 0), Icon: Check, tone: 'paid' }].map(item => <Card key={item.label} className={`payroll-metric ${item.tone}`}><span className="payroll-metric-icon"><item.Icon size={19} /></span><p>{item.label}</p><strong>{money(item.value)} <small>บาท</small></strong></Card>)}</div>
    <p className="text-xs leading-5 text-slate-500">ยอดสรุปตามงวดและตัวกรอง ไม่ใช่ยอดเงินสดคงเหลือ · เงินเบิกคืนค่าใช้จ่ายนับเป็นเงินได้ในตารางนี้ · ไม่มีการคำนวณภาษีอัตโนมัติ</p>
    <Card className="payroll-directory min-w-0 overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-3 p-5"><h2 className="text-base font-semibold">รายการเงินเดือน <span className="text-sm font-normal text-slate-500">{rows.length} งวด</span></h2><div className="flex flex-wrap items-center gap-3"><Link href="/dashboard/ledger" className="text-sm text-blue-700 underline">ดูบัญชีรับ–จ่าย</Link>{data.canWrite && <Button variant="primary" onClick={() => edit()}>+ เพิ่มรายการเงินเดือน</Button>}</div></div>
      <div className="flex flex-wrap gap-3 px-5 pb-5"><label className="text-xs text-slate-600">ปี<select className={field} value={year} onChange={e => setYear(e.target.value)}><option value="ALL">ทุกปี</option>{[...new Set(data.records.map(r => r.month.slice(0, 4)))].sort().reverse().map(y => <option key={y} value={y}>{Number(y) + 543} ({y})</option>)}</select></label><label className="text-xs text-slate-600">สถานะ<select className={field} value={status} onChange={e => setStatus(e.target.value)}><option value="ALL">ทั้งหมด</option><option value="PENDING">รอรับ / ยังไม่เชื่อมบัญชี</option><option value="PAID">รับเงินแล้ว</option></select></label><label className="min-w-48 flex-1 text-xs text-slate-600">นายจ้าง / แหล่งรายได้<input className={field} value={query} onChange={e => setQuery(e.target.value)} placeholder="ค้นหานายจ้าง" /></label></div>
      <div className="overflow-x-auto"><table className="w-full whitespace-nowrap text-left text-sm"><thead className="bg-slate-50 text-xs text-slate-500"><tr>{['งวดเดือน / นายจ้าง', 'เงินได้', 'เงินหัก', 'สุทธิ', 'สถานะ / วันรับ', 'จัดการ'].map(t => <th key={t} scope="col" className="p-4">{t}</th>)}</tr></thead><tbody>{rows.map(row => <tr key={row.id} className="border-t border-slate-200/60"><td className="p-4"><p className="font-medium">{monthLabel(row.month)}</p><p className="text-xs text-slate-500">{row.employer}</p></td>{[row.gross, row.deductions, row.net].map((n, i) => <td key={i} className="p-4 tabular-nums">{money(n)}</td>)}<td className="p-4"><p className={row.receipt ? 'text-emerald-700' : 'text-amber-700'}>{row.receipt ? 'รับเงินแล้ว' : row.voided ? 'รายการรับถูกยกเลิก' : 'รอรับ / ยังไม่เชื่อมบัญชี'}</p>{row.receipt && <p className="mt-1 text-xs text-slate-500">{row.receipt.date} · {row.receipt.source === 'LEDGER' ? `TX-${String(row.receipt.id).padStart(6, '0')}` : `รายการย้อนหลัง #${row.receipt.id}`}</p>}</td><td className="p-4"><div className="flex gap-2"><Button onClick={() => setDetails(row)}>รายละเอียด</Button>{data.canWrite && !row.receipt && <>{!row.voided && <Button variant="edit" onClick={() => edit(row)}>แก้ไข</Button>}<Button variant="primary" disabled={row.net <= 0 || pending} onClick={() => prepareReceipt(row)}>บันทึกรับเงินจริง</Button></>}</div></td></tr>)}</tbody></table>{!rows.length && <p className="p-10 text-center text-sm text-slate-500">ยังไม่มีรายการตามเงื่อนไข กดเพิ่มรายการเงินเดือนเพื่อเริ่มต้น</p>}</div>
    </Card>
    <Modal open={Boolean(draft)} title={draft?.id ? 'แก้ไขข้อมูลเงินเดือน' : 'เพิ่มรายการเงินเดือน'} description="จัดการเงินได้และเงินหักในงวดเดียว พร้อมคำนวณยอดสุทธิ" onClose={() => { if (!pending) setDraft(null) }} className="payroll-editor">
      {draft && <form onSubmit={save}><fieldset disabled={pending}>
        <div className="payroll-editor-intro"><span><Banknote size={16} /> บัญชีทั่วไป</span><p>บันทึกข้อมูลก่อน แล้วค่อยยืนยันรับเงินจริง</p></div>
        <div className="payroll-period"><label>งวดเดือน<input required type="month" className={field} value={draft.month} onChange={e => setDraft({ ...draft, month: e.target.value })} /></label><label>นายจ้าง / แหล่งรายได้<input required maxLength={200} placeholder="เช่น บริษัท / ร้านค้า / แหล่งรายได้" className={field} value={draft.employer} onChange={e => setDraft({ ...draft, employer: e.target.value })} /></label></div>
        <div className="payroll-sections">
          {[{ title: 'เงินได้', caption: 'เงินเดือนและรายรับเพิ่มเติม', fields: incomeFields, type: 'INCOME' as const, total: totals?.gross ?? 0, Icon: ArrowDownLeft }, { title: 'เงินหัก', caption: 'ภาษีและรายการหักจากเงินเดือน', fields: deductionFields, type: 'DEDUCTION' as const, total: totals?.deductions ?? 0, Icon: ArrowUpRight }].map(section => {
            const standard = section.fields.filter(([key]) => !draft.hiddenFields?.includes(key))
            const custom = (draft.customItems ?? []).filter(item => item.type === section.type)
            return <section className={`payroll-line-section ${section.type === 'INCOME' ? 'income' : 'deduction'}`} key={section.type}>
              <div className="payroll-section-heading"><span className="payroll-section-icon"><section.Icon size={19} /></span><div><h3>{section.title}</h3><p>{section.caption}</p></div><span className="payroll-count">{standard.length + custom.length}</span></div>
              <div className="payroll-line-labels"><span>รายการ</span><span>จำนวนเงิน (บาท)</span><span className="sr-only">ลบ</span></div>
              <div className="payroll-lines">
                {standard.map(([key, label]) => <div className="payroll-line" key={key}><label htmlFor={`payroll-${key}`}>{label}</label><input id={`payroll-${key}`} type="number" inputMode="decimal" min="0" max="2000000000" step="0.01" placeholder="0.00" value={draft.values[key] ?? ''} onChange={e => setDraft({ ...draft, values: { ...draft.values, [key]: e.target.value } })} /><button type="button" className="payroll-remove" aria-label={`ลบหัวข้อ ${label}`} title={`ลบ ${label}`} onClick={() => setDraft({ ...draft, hiddenFields: [...(draft.hiddenFields ?? []), key], values: { ...draft.values, [key]: '' } })}><Trash2 size={14} /></button></div>)}
                {custom.map(item => <div className="payroll-line custom" key={item.id}><input aria-label="ชื่อหัวข้อเพิ่มเติม" required maxLength={100} placeholder="ชื่อรายการ" value={item.label} onChange={e => setDraft({ ...draft, customItems: draft.customItems?.map(i => i.id === item.id ? { ...i, label: e.target.value } : i) })} /><input aria-label={`จำนวนเงิน ${item.label || 'หัวข้อเพิ่มเติม'}`} type="number" inputMode="decimal" min="0" max="2000000000" step="0.01" placeholder="0.00" value={item.amount} onChange={e => setDraft({ ...draft, customItems: draft.customItems?.map(i => i.id === item.id ? { ...i, amount: e.target.value } : i) })} /><button type="button" className="payroll-remove" aria-label={`ลบหัวข้อ ${item.label || 'เพิ่มเติม'}`} onClick={() => setDraft({ ...draft, customItems: draft.customItems?.filter(i => i.id !== item.id) })}><Trash2 size={14} /></button></div>)}
                {!standard.length && !custom.length && <p className="payroll-empty-lines">ยังไม่มีหัวข้อ กดเพิ่มรายการด้านล่าง</p>}
              </div>
              <div className="payroll-line-tools"><button type="button" className="payroll-add" disabled={(draft.customItems?.length ?? 0) >= 50} onClick={() => setDraft({ ...draft, customItems: [...(draft.customItems ?? []), { id: crypto.randomUUID(), label: '', type: section.type, amount: '' }] })}><Plus size={15} />เพิ่ม{section.title}</button>{section.fields.some(([key]) => draft.hiddenFields?.includes(key)) && <button type="button" className="payroll-restore" onClick={() => setDraft({ ...draft, hiddenFields: draft.hiddenFields?.filter(key => !section.fields.some(([id]) => id === key)) })}><RotateCcw size={12} />คืนหัวข้อมาตรฐาน</button>}</div>
              <div className="payroll-section-total"><span>รวม{section.title}</span><strong>{money(section.total)} <small>บาท</small></strong></div>
            </section>
          })}
        </div>
        <div className="payroll-net-panel" aria-live="polite"><div><span className="payroll-net-icon"><Wallet size={21} /></span><div><p>เงินรับสุทธิ</p><small>เงินได้ {money(totals?.gross ?? 0)} − เงินหัก {money(totals?.deductions ?? 0)}</small></div></div><strong className={(totals?.net ?? 0) < 0 ? 'negative' : ''}>{money(totals?.net ?? 0)} <small>บาท</small></strong></div>
        <label className="payroll-note">หมายเหตุ <span>ไม่บังคับ</span><textarea maxLength={1000} className={field} placeholder="รายละเอียดเพิ่มเติมของงวดนี้" value={draft.note} onChange={e => setDraft({ ...draft, note: e.target.value })} /></label>
        {error && <p role="alert" className="payroll-error">{error}</p>}
        <footer className="payroll-editor-footer"><p><Check size={14} />ขั้นตอนนี้ยังไม่เพิ่มเงินเข้าบัญชี</p><div><Button onClick={() => setDraft(null)}>ยกเลิก</Button><Button type="submit" variant="primary">{pending ? 'กำลังบันทึก…' : 'บันทึกข้อมูลเงินเดือน'}</Button></div></footer>
      </fieldset></form>}
    </Modal>
    <Modal open={Boolean(receiving)} title="บันทึกรับเงินเข้าบัญชีทั่วไป" description={receiving ? `${monthLabel(receiving.month)} · ${receiving.employer} · สุทธิ ${money(receiving.net)} บาท` : ''} onClose={() => { if (!pending) setReceiving(null) }} className="!bg-white">
      <form onSubmit={receive}><fieldset disabled={pending} className="space-y-4"><label className="block text-sm">วิธีบันทึก<select className={field} value={receiptMode} onChange={e => { setReceiptMode(e.target.value); setConfirmed(false); setError('') }}><option value="LINK">จับคู่รายการรับเงินที่มีอยู่แล้ว</option><option value="NEW">สร้างรายการรับเงินใหม่</option></select></label>
        {receiptMode === 'LINK' && receiving && <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs"><p>ช่วงค้นหา {payrollReceiptWindow(receiving.month).startOn} ถึง {payrollReceiptWindow(receiving.month).endOn}</p><p className="mt-1 text-slate-500">รายรับทุกหมวดในบัญชีทั่วไปที่ยังไม่จับคู่ ไม่ได้ยืนยันว่าเป็นเงินเดือน</p><div className="mt-3 max-h-64 space-y-2 overflow-y-auto">{candidates.map(c => <div key={c.key} className="border-t border-slate-200 pt-2"><p>{c.date} · {c.label}</p><p className={c.difference === 0 ? 'text-emerald-700' : 'text-amber-700'}>{money(c.amount)} บาท · ส่วนต่าง {money(c.difference)} บาท</p></div>)}</div>{candidates.some(c => c.difference !== 0) && <p className="mt-3 text-amber-800">รายการยอดต่างกันแสดงเพื่อให้ตรวจสอบก่อน ยังจับคู่ไม่ได้จนกว่ายอดสุทธิจะตรง กรุณาตรวจรายละเอียดเงินได้และเงินหักก่อน</p>}</div>}
        {receiptMode === 'LINK' ? <label className="block text-sm">รายรับช่วงสิ้นเดือน ±5 วัน<select required name="existingKey" defaultValue="" className={field}><option value="" disabled>เลือกรายการรับเงินจริง</option>{candidates.map(c => <option key={c.key} value={c.key} disabled={c.difference !== 0}>{c.date} · {money(c.amount)} · {c.label} · {c.difference === 0 ? 'ยอดตรง' : 'ยอดต่างกัน'} ({c.key})</option>)}</select>{!candidates.length && <span className="mt-2 block text-xs text-amber-700">ไม่พบรายรับในช่วงสิ้นเดือน ±5 วัน กรุณาตรวจวันรับจริงก่อนสร้างรายการใหม่</span>}</label> : <><p className="rounded-xl bg-amber-50 p-3 text-xs leading-5 text-amber-900">หากมีรายการเงินเดือนในบัญชีอยู่แล้ว ให้เลือกจับคู่แทน เพื่อไม่เพิ่มรายรับซ้ำ</p><label className="block text-sm">วันที่รับเงินจริง<input name="occurredOn" type="date" required defaultValue={bangkokToday()} max={bangkokToday()} className={field} /></label><label className="block text-sm">ช่องทางรับเงิน<select name="channelCode" required defaultValue="" className={field}><option value="" disabled>เลือกช่องทาง</option>{data.channels.map(c => <option key={c.code} value={c.code}>{c.nameTh}</option>)}</select></label><label className="block text-sm">เลขอ้างอิง / เลขสลิป<input name="reference" maxLength={150} className={field} /></label></>}
        <label className="flex items-start gap-2 text-sm"><input type="checkbox" required checked={confirmed} onChange={e => setConfirmed(e.target.checked)} className="mt-1" />{receiptMode === 'LINK' ? 'ตรวจแล้วว่ารายการที่เลือกเป็นเงินเดือนงวดนี้' : 'ได้รับเงินจริงและตรวจแล้วว่ายังไม่มีรายการนี้ในบัญชี'}</label>{error && <p role="alert" className="text-sm text-rose-700">{error}</p>}<Button type="submit" variant="primary" disabled={!confirmed || (receiptMode === 'LINK' && !candidates.some(c => c.difference === 0))}>{pending ? 'กำลังบันทึก…' : receiptMode === 'LINK' ? 'ยืนยันจับคู่รายการเดิม' : 'บันทึกรับเงินเข้าบัญชีทั่วไป'}</Button></fieldset></form>
    </Modal>
    <Modal open={Boolean(details)} title="รายละเอียดเงินเดือน" description={details ? `${monthLabel(details.month)} · ${details.employer}` : ''} onClose={() => setDetails(null)} className="!bg-white">
      {details && <div className="space-y-4">{[{ label: 'เงินได้', fields: incomeFields }, { label: 'เงินหัก', fields: deductionFields }].map(s => <section key={s.label}><h3 className="mb-2 text-sm font-semibold">{s.label}</h3><dl className="space-y-2">{s.fields.filter(([key]) => !details.hiddenFields.includes(key)).map(([key, label]) => <div key={key} className="flex justify-between gap-4 text-sm"><dt>{label}</dt><dd className="tabular-nums">{money(details.amounts[key] ?? 0)}</dd></div>)}{details.customItems.filter(item => item.type === (s.label === 'เงินได้' ? 'INCOME' : 'DEDUCTION')).map(item => <div key={item.id} className="flex justify-between gap-4 text-sm"><dt className="min-w-0 break-words">{item.label}</dt><dd className="tabular-nums">{money(Math.round(Number(item.amount || 0) * 100))}</dd></div>)}</dl></section>)}<p className="border-t pt-3 text-sm font-semibold">เงินรับสุทธิ {money(details.net)} บาท</p><p className="whitespace-pre-wrap break-words text-sm text-slate-500">{details.note || 'ไม่มีหมายเหตุ'}</p></div>}
    </Modal>
  </div>
}
