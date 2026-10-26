'use client'

import { useMemo, useState, useTransition, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import { AlertCircle, CheckCircle2, CircleDollarSign, Clock3, Plus, Search, Wallet } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Modal } from '@/components/ui/modal'
import { useFeedbackToast } from '@/components/ui/use-feedback-toast'
import { bangkokToday } from '@/lib/ledger'
import { formatContractMoney as money } from '@/lib/contracts'
import { createTradeReceivable, getTradeReceivables, receiveTradeReceivablePayment } from './actions'

type Data = Awaited<ReturnType<typeof getTradeReceivables>>
type Receivable = Data['receivables'][number]
type Borrower = Data['borrowers'][number]
const field = 'w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-500'
const dateLabel = (value: string) => new Date(`${value}T00:00:00+07:00`).toLocaleDateString('th-TH', { timeZone: 'Asia/Bangkok', dateStyle: 'medium' })

export function TradeReceivablesWorkspace({ data }: { data: Data }) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [creating, setCreating] = useState(false)
  const [paying, setPaying] = useState<Receivable | null>(null)
  const [query, setQuery] = useState('')
  const [view, setView] = useState<'OPEN' | 'ALL' | 'CLOSED'>('OPEN')
  const [notice, setNotice] = useState(''), [error, setError] = useState('')
  const [selectedBorrower, setSelectedBorrower] = useState<Borrower | null>(null)
  const [dueDateUndetermined, setDueDateUndetermined] = useState(false)
  const [createForm, setCreateForm] = useState({ description: '', reference: '', amount: '', occurredOn: bangkokToday(), dueDate: bangkokToday() })
  const [paymentForm, setPaymentForm] = useState({ amount: '', occurredOn: bangkokToday(), channelCode: data.channels[0]?.code ?? '', reference: '', note: '' })
  useFeedbackToast({ error, success: notice })

  const filtered = useMemo(() => data.receivables.filter(row => {
    const isClosed = row.remainingSatang <= 0
    if (view === 'OPEN' && isClosed || view === 'CLOSED' && !isClosed) return false
    const text = `${row.customerName} ${row.customerPhone} ${row.description} ${row.reference}`.toLocaleLowerCase('th-TH')
    return text.includes(query.trim().toLocaleLowerCase('th-TH'))
  }), [data.receivables, query, view])
  const openRows = data.receivables.filter(row => row.remainingSatang > 0)
  const outstanding = openRows.reduce((sum, row) => sum + row.remainingSatang, 0)
  const overdue = openRows.filter(row => row.overdue).length
  const paid = data.receivables.reduce((sum, row) => sum + row.receivedSatang, 0)

  function submitCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError(''); setNotice('')
    const requestKey = globalThis.crypto.randomUUID()
    startTransition(async () => {
      const result = await createTradeReceivable({ ...createForm, dueDate: dueDateUndetermined ? '' : createForm.dueDate, borrowerId: selectedBorrower?.id ?? 0, requestKey })
      if (result.error) { setError(result.error); return }
      setCreating(false); setSelectedBorrower(null); setDueDateUndetermined(false); setCreateForm({ description: '', reference: '', amount: '', occurredOn: bangkokToday(), dueDate: bangkokToday() }); setNotice('บันทึกรายการลูกหนี้ค้างรับแล้ว'); router.refresh()
    })
  }

  function openPayment(row: Receivable) {
    setError(''); setNotice(''); setPaying(row)
    setPaymentForm({ amount: (row.remainingSatang / 100).toFixed(2), occurredOn: bangkokToday(), channelCode: data.channels[0]?.code ?? '', reference: '', note: '' })
  }

  function submitPayment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!paying) return
    setError(''); setNotice('')
    const requestKey = globalThis.crypto.randomUUID()
    startTransition(async () => {
      const result = await receiveTradeReceivablePayment({ ...paymentForm, receivableId: paying.id, requestKey })
      if (result.error) { setError(result.error); return }
      setPaying(null); setNotice('บันทึกรับเงินจริงแล้ว และปรับยอดค้างให้เรียบร้อย'); router.refresh()
    })
  }

  return <div className="space-y-4">
    <div className="grid gap-3 sm:grid-cols-3">
      {[
        { label: 'ยอดค้างรับ', value: outstanding, foot: `${openRows.length} รายการยังไม่ปิด`, icon: Wallet, tone: 'text-amber-700' },
        { label: 'เกินกำหนด', value: overdue, foot: 'รายการที่เลยวันครบกำหนด', icon: Clock3, tone: 'text-rose-700', unit: 'รายการ' },
        { label: 'รับเงินจริงแล้ว', value: paid, foot: 'รวมเงินที่รับชำระจากลูกค้า', icon: CircleDollarSign, tone: 'text-emerald-700' },
      ].map(({ label, value, foot, icon: Icon, tone, unit }) => <Card key={label} className="p-4"><div className="flex items-center justify-between text-sm text-slate-500">{label}<Icon size={18} /></div><p className={`mt-2 text-2xl font-semibold tabular-nums ${tone}`}>{unit ? value : money(value)}<span className="ml-1 text-xs font-normal">{unit ?? 'บาท'}</span></p><p className="mt-1 text-xs text-slate-500">{foot}</p></Card>)}
    </div>

    <Card className="overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-3 p-4 sm:p-5"><div><h2 className="m-0 font-semibold">รายการลูกหนี้ค้างรับ <span className="ml-2 text-sm font-normal text-slate-500">{filtered.length}</span></h2><p className="mb-0 mt-1 text-xs text-slate-500">บันทึกยอดค้างได้โดยไม่ลงเงินสด · ลงบัญชีรับเงินเมื่อได้รับเงินจริงเท่านั้น</p></div>{data.canWrite && <Button variant="primary" onClick={() => { setError(''); setCreating(true) }}><Plus size={16} /> เพิ่มรายการค้างรับ</Button>}</div>
      <div className="flex flex-wrap items-end gap-3 border-y border-slate-200 p-3 sm:p-4">
        <label className="min-w-48 flex-1 text-xs text-slate-500">ค้นหาลูกค้า / รายการ<div className="relative mt-1"><Search size={16} className="absolute right-3 top-3 text-slate-400" /><input className={`${field} pr-9`} value={query} onChange={event => setQuery(event.target.value)} placeholder="ชื่อลูกค้า รายละเอียด หรือเลขอ้างอิง" /></div></label>
        <label className="text-xs text-slate-500">แสดง<select className={`${field} mt-1`} value={view} onChange={event => setView(event.target.value as typeof view)}><option value="OPEN">ค้างรับ</option><option value="ALL">ทั้งหมด</option><option value="CLOSED">ชำระครบ</option></select></label>
      </div>
      <div className="overflow-x-auto"><table className="w-full min-w-[900px] text-left text-sm"><thead className="bg-slate-50 text-xs text-slate-500"><tr>{['ลูกค้า / รายการ', 'วันที่เกิดยอด', 'ครบกำหนด', 'ยอดรายการ', 'รับแล้ว', 'คงค้าง', 'สถานะ', 'จัดการ'].map(label => <th key={label} className="px-3 py-3 font-medium first:pl-5 last:pr-5">{label}</th>)}</tr></thead><tbody className="divide-y divide-slate-100">
        {filtered.map(row => { const closed = row.remainingSatang <= 0; return <tr key={row.id} className="align-top"><td className="max-w-64 px-3 py-3.5 first:pl-5"><strong className="block">{row.customerName}</strong>{row.customerPhone && <span className="text-xs text-slate-500">{row.customerPhone}</span>}<span className="mt-1 block text-xs text-slate-600">{row.description}</span>{row.reference && <span className="text-[11px] text-slate-400">อ้างอิง {row.reference}</span>}</td><td className="whitespace-nowrap px-3 py-3.5">{dateLabel(row.occurredOn)}</td><td className="whitespace-nowrap px-3 py-3.5">{row.dueDate ? dateLabel(row.dueDate) : 'ไม่กำหนด'}</td><td className="whitespace-nowrap px-3 py-3.5 tabular-nums">{money(row.amountSatang)}</td><td className="whitespace-nowrap px-3 py-3.5 tabular-nums">{money(row.receivedSatang)}</td><td className="whitespace-nowrap px-3 py-3.5 font-semibold tabular-nums">{money(row.remainingSatang)}</td><td className="px-3 py-3.5"><span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs ${closed ? 'bg-emerald-50 text-emerald-700' : row.overdue ? 'bg-rose-50 text-rose-700' : row.receivedSatang ? 'bg-blue-50 text-blue-700' : 'bg-amber-50 text-amber-800'}`}>{closed ? <><CheckCircle2 size={13} />ชำระครบ</> : row.overdue ? <><AlertCircle size={13} />เกินกำหนด</> : row.receivedSatang ? 'ชำระบางส่วน' : 'ค้างรับ'}</span></td><td className="whitespace-nowrap px-3 py-3.5 last:pr-5">{!closed && data.canWrite && <Button variant="secondary" onClick={() => openPayment(row)}>รับชำระ</Button>}</td></tr> })}
        {!filtered.length && <tr><td colSpan={8} className="px-5 py-14 text-center text-sm text-slate-500">{data.receivables.length ? 'ไม่พบรายการตามเงื่อนไข' : 'ยังไม่มีรายการค้างรับ · กด “เพิ่มรายการค้างรับ” เมื่อลูกค้ารับของหรือใช้บริการแล้วยังไม่ได้ชำระ'}</td></tr>}
      </tbody></table></div>
    </Card>

    <Modal open={creating} title="เพิ่มรายการลูกหนี้ค้างรับ" description="บันทึกยอดที่ลูกค้าต้องจ่ายภายหลัง · ยังไม่ถือเป็นเงินรับจริง" onClose={() => { if (!pending) { setCreating(false); setSelectedBorrower(null); setDueDateUndetermined(false) } }}>
      <form onSubmit={submitCreate} className="space-y-3"><fieldset disabled={pending} className="grid gap-3 sm:grid-cols-2">
        <label htmlFor="receivable-borrower" className="text-sm font-medium sm:col-span-2">เลือกลูกค้าจาก Borrower<select id="receivable-borrower" required autoFocus className={`${field} mt-1`} value={selectedBorrower?.id ?? ''} onChange={event => setSelectedBorrower(data.borrowers.find(borrower => borrower.id === Number(event.target.value)) ?? null)}><option value="">เลือกชื่อลูกค้า</option>{data.borrowers.map(borrower => <option key={borrower.id} value={borrower.id}>{borrower.name} · {borrower.borrowerCode}{borrower.nickname ? ` · ${borrower.nickname}` : ''}{borrower.phone ? ` · ${borrower.phone}` : ''}</option>)}</select>{!data.borrowers.length && <span className="mt-1 block text-xs text-amber-700">ยังไม่มีรายชื่อ Borrower กรุณาเพิ่มรายชื่อก่อน</span>}</label>
        <label className="text-sm font-medium">เลขบิล / อ้างอิง (ถ้ามี)<input maxLength={150} className={`${field} mt-1`} value={createForm.reference} onChange={e => setCreateForm({ ...createForm, reference: e.target.value })} /></label>
        <label className="text-sm font-medium sm:col-span-2">รายการสินค้า / บริการ<input required maxLength={500} className={`${field} mt-1`} placeholder="เช่น ค่าอาหาร หรือค่าบริการ" value={createForm.description} onChange={e => setCreateForm({ ...createForm, description: e.target.value })} /></label>
        <label className="text-sm font-medium">ยอดที่ต้องชำระ (บาท)<input required type="number" min="0.01" max="2000000000" step="0.01" className={`${field} mt-1`} value={createForm.amount} onChange={e => setCreateForm({ ...createForm, amount: e.target.value })} /></label>
        <label className="text-sm font-medium">วันที่เกิดยอดค้าง<input required type="date" max={bangkokToday()} className={`${field} mt-1`} value={createForm.occurredOn} onChange={e => setCreateForm({ ...createForm, occurredOn: e.target.value, dueDate: createForm.dueDate < e.target.value ? e.target.value : createForm.dueDate })} /></label>
        <div className="text-sm font-medium"><label htmlFor="receivable-due-date">วันครบกำหนด</label><input id="receivable-due-date" required={!dueDateUndetermined} disabled={dueDateUndetermined} type="date" min={createForm.occurredOn} className={`${field} mt-1 disabled:bg-slate-100 disabled:text-slate-400`} value={createForm.dueDate} onChange={e => setCreateForm({ ...createForm, dueDate: e.target.value })} /><label className="mt-2 flex items-center gap-2 text-sm font-normal text-slate-700"><input type="checkbox" checked={dueDateUndetermined} onChange={e => setDueDateUndetermined(e.target.checked)} />ไม่กำหนดวันครบกำหนด</label></div>
      </fieldset>{error && creating && <p role="alert" className="text-sm text-rose-700">{error}</p>}<div className="flex justify-end gap-2 pt-2"><Button onClick={() => { setCreating(false); setSelectedBorrower(null); setDueDateUndetermined(false) }} disabled={pending}>ยกเลิก</Button><Button type="submit" variant="primary" disabled={pending || !selectedBorrower}>{pending ? 'กำลังบันทึก…' : 'บันทึกยอดค้างรับ'}</Button></div></form>
    </Modal>

    <Modal open={Boolean(paying)} title="รับชำระลูกหนี้ค้างรับ" description={paying ? `${paying.customerName} · คงค้าง ${money(paying.remainingSatang)} บาท` : ''} onClose={() => { if (!pending) setPaying(null) }}>
      {paying && <form onSubmit={submitPayment} className="space-y-3"><fieldset disabled={pending} className="grid gap-3 sm:grid-cols-2"><label className="text-sm font-medium">ยอดรับเงินจริง (บาท)<input required type="number" min="0.01" max={(paying.remainingSatang / 100).toFixed(2)} step="0.01" className={`${field} mt-1`} value={paymentForm.amount} onChange={e => setPaymentForm({ ...paymentForm, amount: e.target.value })} /></label><label className="text-sm font-medium">วันที่รับเงินจริง<input required type="date" max={bangkokToday()} min={paying.occurredOn} className={`${field} mt-1`} value={paymentForm.occurredOn} onChange={e => setPaymentForm({ ...paymentForm, occurredOn: e.target.value })} /></label><label className="text-sm font-medium">ช่องทางรับเงิน<select required className={`${field} mt-1`} value={paymentForm.channelCode} onChange={e => setPaymentForm({ ...paymentForm, channelCode: e.target.value })}>{data.channels.map(channel => <option key={channel.code} value={channel.code}>{channel.nameTh}</option>)}</select></label><label className="text-sm font-medium">เลขอ้างอิง / สลิป (ถ้ามี)<input maxLength={150} className={`${field} mt-1`} value={paymentForm.reference} onChange={e => setPaymentForm({ ...paymentForm, reference: e.target.value })} /></label><label className="text-sm font-medium sm:col-span-2">หมายเหตุ (ถ้ามี)<textarea rows={2} maxLength={1000} className={`${field} mt-1`} value={paymentForm.note} onChange={e => setPaymentForm({ ...paymentForm, note: e.target.value })} /></label></fieldset>{error && paying && <p role="alert" className="text-sm text-rose-700">{error}</p>}<p className="text-xs text-slate-500">รายการรับเงินจริงจะไปแสดงในบัญชีรับ–จ่าย แยกจากการรับชำระเงินกู้</p><div className="flex justify-end gap-2"><Button onClick={() => setPaying(null)} disabled={pending}>ยกเลิก</Button><Button type="submit" variant="primary" disabled={pending || !paymentForm.channelCode}>{pending ? 'กำลังบันทึก…' : 'ยืนยันรับเงินจริง'}</Button></div></form>}
    </Modal>
  </div>
}
