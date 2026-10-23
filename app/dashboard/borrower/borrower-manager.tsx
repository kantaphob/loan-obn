'use client'

import { useCallback, useMemo, useState, type FormEvent } from 'react'
import Image from 'next/image'
import { cardDate, type ThaiIdCard } from '@/lib/thai-id'
import { useRouter } from 'next/navigation'
import { Plus, Search, UsersRound, Wallet, CircleDollarSign, ArrowUpRight, ChevronLeft, ChevronRight, X, Eye, Pencil, Trash2, CreditCard, LoaderCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { availableBorrowerLimit, borrowerTenure, borrowerFields, borrowerStatuses, promptPayTypes, type BorrowerRow, type BorrowerOption } from '@/lib/borrower'

type Option = BorrowerOption & { isActive: boolean }
const money = (value: number) => new Intl.NumberFormat('th-TH', { maximumFractionDigits: 0 }).format(value)
const fieldClass = 'mt-1.5 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-800 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100'
const headers = ['จัดการ', 'รหัสผู้กู้', 'ชื่อเล่น', 'ชื่อ', 'สกุล', 'เบอร์โทร', 'เลขบัตร', 'ที่ทำงาน', 'จังหวัด', 'สถานะ', 'ธนาคาร', 'เลขบัญชีธนาคาร', 'ชื่อบัญชีธนาคาร', 'ประเภทพร้อมเพย์', 'หมายเลขพร้อมเพย์', 'ช่องรับเงิน', 'วันที่สมัคร', 'ระยะเวลา', 'FB', 'IG', 'Line', 'Risk Rating', 'Approved Limit', 'Used Limit', 'Available Limit', 'คนแนะนำ']
function initialForm() {
  return { bankCode: '', bankAccountName: '', promptPayType: '', promptPayNumber: '', provinceId: '', nickname: '', firstName: '', lastName: '', phone: '', nationalId: '', workplace: '', bankAccount: '', facebook: '', instagram: '', line: '', referrer: '', status: 'ACTIVE', paymentChannelCode: '', riskRatingCode: '', registeredAt: new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Bangkok', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date()), durationMonths: '0', approvedLimit: '0', usedLimit: '0' }
}

export function BorrowerManager({ borrowers, channels, ratings, provinces, banks, today, canCreate }: { today: string; borrowers: BorrowerRow[]; provinces: { id: number; nameTh: string }[]; banks: Option[]; channels: Option[]; ratings: Option[]; canCreate: boolean }) {
  const router = useRouter()
  const openDialog = useCallback((node: HTMLDialogElement | null) => { if (node && !node.open) node.showModal() }, [])
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState('')
  const [page, setPage] = useState(1)
  const [open, setOpen] = useState(false)
  const [selected, setSelected] = useState<BorrowerRow | null>(null)
  const [viewOnly, setViewOnly] = useState(false)
  const [deleting, setDeleting] = useState<BorrowerRow | null>(null)
  const [form, setForm] = useState(initialForm)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [card, setCard] = useState<ThaiIdCard | null>(null)
  const [cardReadToken, setCardReadToken] = useState('')
  const [reading, setReading] = useState(false)
  const filtered = useMemo(() => borrowers.filter(b => (!status || b.status === status) && [b.borrowerId || '', String(b.id), b.nickname, b.firstName, b.lastName, b.phone, b.nationalId || '', b.workplace, b.referrer].some(v => v.toLowerCase().includes(query.trim().toLowerCase()))), [borrowers, query, status])
  const pages = Math.max(1, Math.ceil(filtered.length / 10))
  const currentPage = Math.min(page, pages)
  const visible = filtered.slice((currentPage - 1) * 10, currentPage * 10)
  const approved = borrowers.reduce((sum, b) => sum + b.approvedLimit, 0)
  const available = borrowers.reduce((sum, b) => sum + availableBorrowerLimit(b.approvedLimit, b.usedLimit), 0)
  const used = borrowers.reduce((sum, b) => sum + b.usedLimit, 0)
  const label = (options: BorrowerOption[], code: string) => options.find(o => o.code === code)?.nameTh || code || '—'

  function showForm(borrower?: BorrowerRow, readOnly = false) {
    setSelected(borrower ?? null); setViewOnly(readOnly); setError(''); setNotice(''); setCardReadToken('')
    try { setCard(borrower?.cardData ? JSON.parse(borrower.cardData) : null) } catch { setCard(null) }
    if (borrower) {
      const values = initialForm()
      for (const key of Object.keys(values) as (keyof typeof values)[]) values[key] = borrower[key] === null ? '' : String(borrower[key])
      values.registeredAt = borrower.registeredAt.slice(0, 10)
      setForm(values)
    } else setForm(initialForm())
    setOpen(true)
  }

  async function readCard() {
    if (reading || busy || viewOnly) return
    setReading(true); setError('')
    try {
      const response = await fetch('/api/borrowers/card', { method: 'POST' })
      const result = await response.json()
      if (!response.ok) throw new Error(result.message || 'อ่านบัตรไม่สำเร็จ')
      const incoming: ThaiIdCard = result.card
      setCard(incoming); setCardReadToken(result.token)
      const province = provinces.find(p => incoming.address.replace(/\s/g, '').includes(p.nameTh.replace(/\s/g, '')))
      setForm(current => ({ ...current, nationalId: incoming.nationalId, firstName: incoming.firstName, lastName: incoming.lastName, provinceId: province ? String(province.id) : current.provinceId }))
    } catch (err) { setError(err instanceof Error ? err.message : 'เชื่อมต่อเครื่องอ่านไม่ได้') }
    finally { setReading(false) }
  }

  async function remove() {
    if (!deleting || busy) return
    setBusy(true); setError('')
    try {
      const response = await fetch('/api/borrowers', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: deleting.id }) })
      const result = await response.json()
      if (!response.ok) throw new Error(result.message || 'ลบไม่สำเร็จ')
      setDeleting(null); setNotice('ลบข้อมูลผู้กู้ยืมเรียบร้อยแล้ว'); router.refresh()
    } catch (err) { setError(err instanceof Error ? err.message : 'ไม่สามารถเชื่อมต่อได้') }
    finally { setBusy(false) }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (busy || reading || viewOnly) return
    setBusy(true); setError('')
    try {
      const response = await fetch('/api/borrowers', { method: selected ? 'PUT' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...form, cardReadToken: cardReadToken || undefined, id: selected?.id, provinceId: form.provinceId ? Number(form.provinceId) : null, approvedLimit: Number(form.approvedLimit), usedLimit: Number(form.usedLimit), durationMonths: Number(form.durationMonths) }) })
      const result = await response.json()
      if (!response.ok) throw new Error(result.message || 'บันทึกไม่สำเร็จ')
      setOpen(false); setNotice(selected ? 'แก้ไขข้อมูลผู้กู้ยืมเรียบร้อยแล้ว' : 'เพิ่มข้อมูลผู้กู้ยืมเรียบร้อยแล้ว'); router.refresh()
    } catch (err) { setError(err instanceof Error ? err.message : 'ไม่สามารถเชื่อมต่อ กรุณาลองอีกครั้ง') }
    finally { setBusy(false) }
  }

  return <div className="borrower-workspace space-y-5">
    <div className="borrower-metrics">
      {[
        { icon: UsersRound, title: 'ผู้กู้ยืมทั้งหมด', value: money(borrowers.length), unit: 'คน', detail: `ใช้งาน ${borrowers.filter(b => b.status === 'ACTIVE').length} คน`, tone: 'blue' },
        { icon: CircleDollarSign, title: 'วงเงินอนุมัติรวม', value: money(approved), unit: 'บาท', detail: `ใช้วงเงินแล้ว ${money(used)} บาท`, tone: 'gold' },
        { icon: Wallet, title: 'วงเงินคงเหลือรวม', value: money(available), unit: 'บาท', detail: 'รวมวงเงินคงเหลือของแต่ละคน', tone: 'green' },
      ].map(({ icon: Icon, title, value, unit, detail, tone }) => <Card key={title} className={`borrower-metric borrower-metric--${tone}`}>
        <div className="borrower-metric-top"><span>{title}</span><span className="borrower-metric-icon"><Icon size={21} strokeWidth={1.6} /></span></div>
        <div className="borrower-metric-value">{value}<span>{unit}</span></div>
        <div className="borrower-metric-detail"><span className="borrower-dot" />{detail}</div>
      </Card>)}
    </div>
    <Card className="borrower-directory overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-3 p-5">
        <div><div className="borrower-directory-heading"><h2>รายชื่อผู้กู้ยืม</h2><span className="borrower-count">{borrowers.length}</span></div><p className="mt-1 text-xs text-slate-500">ข้อมูลทั้งหมด {borrowers.length} รายการ · วงเงินเป็นบาท</p></div>
        {canCreate && <Button variant="primary" onClick={() => showForm()}><Plus size={16} />เพิ่มผู้กู้ยืม</Button>}
      </div>
      {notice && <p role="status" className="mx-5 mb-3 rounded-xl bg-emerald-50 p-3 text-sm text-emerald-700">{notice}</p>}
      <div className="borrower-toolbar flex flex-wrap gap-3 px-5 py-4">
        <label className="relative min-w-60 flex-1"><span className="sr-only">ค้นหาผู้กู้ยืม</span><Search className="absolute left-3 top-3 text-slate-400" size={17} /><input className={`${fieldClass} mt-0 pl-10`} placeholder="ค้นหาชื่อ เบอร์โทร เลขบัตร หรือคนแนะนำ" value={query} onChange={e => { setQuery(e.target.value); setPage(1) }} /></label>
        <label><span className="sr-only">กรองสถานะ</span><select className={`${fieldClass} mt-0`} value={status} onChange={e => { setStatus(e.target.value); setPage(1) }}><option value="">ทุกสถานะ</option>{Object.entries(borrowerStatuses).map(([key, title]) => <option key={key} value={key}>{title}</option>)}</select></label>
      </div>
      <div className="borrower-table-scroll overflow-x-auto" role="region" aria-label="ตารางผู้กู้ยืม เลื่อนแนวนอนเพื่อดูทุกคอลัมน์" tabIndex={0}>
        <table className="w-full whitespace-nowrap text-left text-xs">
          <thead><tr>{headers.map(h => <th key={h} scope="col" className="px-4 py-4 font-medium" data-numeric={h.includes("Limit") || undefined}>{h}</th>)}</tr></thead>
          <tbody className="divide-y divide-slate-200/60">{visible.map(b => <tr key={b.id} className="hover:bg-white/50">
            <td className="borrower-row-actions px-4 py-3"><div className="flex gap-2"><Button aria-label={`ดูรายละเอียด ${b.firstName}`} onClick={() => showForm(b, true)}><Eye size={15} /></Button>{canCreate && <><Button variant="edit" aria-label={`แก้ไข ${b.firstName}`} onClick={() => showForm(b)}><Pencil size={15} /></Button><Button variant="danger" aria-label={`ลบ ${b.firstName}`} onClick={() => { setDeleting(b); setError(''); setNotice('') }}><Trash2 size={15} /></Button></>}</div></td>
            {[b.borrowerId || `BR-${String(b.id).padStart(5, '0')}`, b.nickname, b.firstName, b.lastName, b.phone, b.nationalId || '', b.workplace || '—'].map((value, i) => <td key={i} className="px-4 py-4">{value}</td>)}
            <td className="px-4 py-4">{provinces.find(p => p.id === b.provinceId)?.nameTh || '—'}</td>
            <td className="px-4 py-4"><span className={`rounded-full px-2.5 py-1 ${b.status === 'ACTIVE' ? 'bg-emerald-50 text-emerald-700' : b.status === 'BLACKLIST' ? 'bg-rose-50 text-rose-700' : 'bg-slate-100 text-slate-600'}`}>{borrowerStatuses[b.status]}</span></td>
            {[label(banks, b.bankCode), b.bankAccount || '—', b.bankAccountName || '—', promptPayTypes[b.promptPayType] || '—', b.promptPayNumber || '—', label(channels, b.paymentChannelCode), new Intl.DateTimeFormat('th-TH', { timeZone: 'Asia/Bangkok' }).format(new Date(b.registeredAt)), borrowerTenure(b.registeredAt, today), b.facebook || '—', b.instagram || '—', b.line || '—', label(ratings, b.riskRatingCode)].map((value, i) => <td key={i} className="px-4 py-4">{value}</td>)}
            {[b.approvedLimit, b.usedLimit, availableBorrowerLimit(b.approvedLimit, b.usedLimit)].map((value, i) => <td key={i} className={`px-4 py-4 text-right tabular-nums ${i === 2 ? 'borrower-available font-semibold' : ''}`}>{money(value)}</td>)}
            <td className="px-4 py-4">{b.referrer || '—'}</td>
          </tr>)}</tbody>
        </table>
      </div>
      {!visible.length && <div className="borrower-empty">
        <span className="borrower-empty-icon"><UsersRound size={30} strokeWidth={1.3} /></span>
        <h3>{borrowers.length ? 'ไม่พบรายชื่อที่ค้นหา' : 'เริ่มต้นดูแลผู้กู้ยืมของคุณ'}</h3>
        <p>{borrowers.length ? 'ลองเปลี่ยนคำค้นหาหรือเลือกสถานะอื่น' : 'เพิ่มข้อมูลผู้กู้ยืม เพื่อจัดการข้อมูลติดต่อและติดตามวงเงินในที่เดียว'}</p>
        {borrowers.length ? <Button onClick={() => { setQuery(''); setStatus(''); setPage(1) }}>ล้างการค้นหา</Button> : canCreate && <Button variant="primary" onClick={() => showForm()}><Plus size={15} />เพิ่มผู้กู้ยืมคนแรก<ArrowUpRight size={15} /></Button>}
      </div>}
      <div className="borrower-pagination flex flex-wrap items-center justify-between gap-3 border-t border-slate-200/60 p-4 text-xs text-slate-500"><span>พบ {filtered.length} รายการ · หน้า {currentPage} / {pages}</span><div className="flex gap-2"><Button disabled={currentPage === 1} onClick={() => setPage(currentPage - 1)}><ChevronLeft size={14} />ก่อนหน้า</Button><Button disabled={currentPage === pages} onClick={() => setPage(currentPage + 1)}>ถัดไป<ChevronRight size={14} /></Button></div></div>
    </Card>
    {open && <dialog ref={openDialog} onCancel={event => { if (busy || reading) event.preventDefault(); else setOpen(false) }} className="borrower-dialog fixed inset-0 m-auto max-h-[90dvh] w-[calc(100%-2rem)] max-w-3xl overflow-y-auto rounded-3xl p-6" aria-labelledby="borrower-title">
      <button type="button" className="borrower-close" aria-label="ปิดฟอร์ม" disabled={busy || reading} onClick={() => setOpen(false)}><X size={19} /></button>
      <h2 id="borrower-title" className="text-lg font-semibold">{viewOnly ? 'รายละเอียดผู้กู้ยืม' : selected ? 'แก้ไขผู้กู้ยืม' : 'เพิ่มผู้กู้ยืม'}</h2><p className="mb-5 mt-1 text-xs text-slate-500">{selected ? `${selected.borrowerId || `BR-${String(selected.id).padStart(5, '0')}`} · ${viewOnly ? 'ข้อมูลสำหรับอ่านอย่างเดียว' : 'ช่องที่มี * จำเป็นต้องระบุ'}` : 'รหัสผู้กู้ยืมจะสร้างอัตโนมัติหลังบันทึก · ช่องที่มี * จำเป็นต้องระบุ'}</p>
      <section className="borrower-card-panel" aria-label="ข้อมูลบัตรประชาชน">
        <div className="flex flex-wrap items-center justify-between gap-3"><div><h3 className="text-sm font-medium">ข้อมูลจากบัตรประชาชน</h3><p className="mt-1 text-xs text-slate-500">เครื่องอ่าน ACS บน Mac ที่รันระบบ · อ่านชิปและรูปจากบัตร</p></div>{!viewOnly && <Button disabled={busy || reading} onClick={() => void readCard()}>{reading ? <LoaderCircle size={16} className="animate-spin" /> : <CreditCard size={16} />}{reading ? 'กำลังอ่านบัตร…' : card ? 'อ่านบัตรใหม่' : 'อ่านบัตรประชาชน'}</Button>}</div>
        {card ? <div className="borrower-card-result">
          <Image unoptimized src={card.photo} width={100} height={128} alt="รูปผู้กู้ยืมจากชิปบัตรประชาชน" className="borrower-card-photo" />
          <dl className="borrower-card-details">
            {[
              ['ชื่อบนบัตร', card.fullNameTh], ['ชื่อภาษาอังกฤษ', card.fullNameEn], ['เลขบัตรประชาชน', card.nationalId],
              ['วันเกิด', cardDate(card.birthDate)], ['เพศ', card.gender === '1' ? 'ชาย' : card.gender === '2' ? 'หญิง' : card.gender],
              ['วันที่ออกบัตร', cardDate(card.issueDate)], ['วันหมดอายุ', cardDate(card.expiryDate)], ['ผู้ออกบัตร', card.issuer], ['ที่อยู่ตามบัตร', card.address], ['เครื่องอ่าน', card.reader], ['อ่านบัตรเมื่อ', selected?.cardReadAt && !cardReadToken ? new Intl.DateTimeFormat('th-TH', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Bangkok' }).format(new Date(selected.cardReadAt)) : 'อ่านใหม่ รอการบันทึก'],
            ].map(([title, value]) => <div key={title}><dt>{title}</dt><dd>{value || '—'}</dd></div>)}
          </dl>
          <p className="borrower-card-note">อ่านข้อมูลจากชิปแล้ว · ยังไม่ได้ยืนยันตัวบุคคลหรือสถานะบัตรกับหน่วยงานผู้ออกบัตร</p>
          {form.nationalId !== card.nationalId && <p role="alert" className="text-sm text-amber-200">เลขบัตรในฟอร์มไม่ตรงกับข้อมูลชิป กรุณาอ่านบัตรใหม่หากต้องการบันทึกข้อมูลบัตร</p>}
        </div> : <p className="mt-4 text-xs text-slate-500">{viewOnly ? 'ยังไม่มีข้อมูลจากชิปบัตรประชาชน' : 'เสียบเครื่องอ่านและบัตร แล้วกดอ่านบัตร ข้อมูลจะปรากฏให้ตรวจทานก่อนบันทึก'}</p>}
      </section>
      <form onSubmit={submit}>
        <fieldset disabled={busy || reading || viewOnly} className="grid gap-4 sm:grid-cols-2">
          <legend className="borrower-form-section">ข้อมูลผู้กู้ยืม</legend>
          {borrowerFields.filter(([key]) => key !== 'bankAccount' && key !== 'bankAccountName').map(([key, title]) => <label key={key} className="text-xs">{title}{key === 'nickname' ? ' *' : ''}<input autoFocus={key === 'nickname'} className={fieldClass} required={key === 'nickname'} maxLength={key === 'nationalId' ? 13 : key === 'phone' ? 10 : 200} inputMode={['phone', 'nationalId'].includes(key) ? 'numeric' : 'text'} pattern={key === 'nationalId' ? '[0-9]{13}' : key === 'phone' ? '0[0-9]{8,9}' : undefined} value={form[key]} onChange={e => setForm({ ...form, [key]: e.target.value })} /></label>)}
          <label className="text-xs">จังหวัด<select className={fieldClass} value={form.provinceId} onChange={e => setForm({ ...form, provinceId: e.target.value })}><option value="">ยังไม่ระบุจังหวัด</option>{provinces.map(p => <option key={p.id} value={p.id}>{p.nameTh}</option>)}</select></label>
          <div className="borrower-form-section sm:col-span-2">บัญชีธนาคารและพร้อมเพย์</div>
          <label className="text-xs">ธนาคาร<select className={fieldClass} required={Boolean(form.bankAccount) && !(selected?.bankAccount === form.bankAccount && !selected.bankCode)} value={form.bankCode} onChange={e => setForm({ ...form, bankCode: e.target.value })}><option value="">เลือกธนาคาร</option>{banks.filter(bank => bank.isActive || bank.code === form.bankCode).map(bank => <option key={bank.code} value={bank.code}>{bank.nameTh}</option>)}</select></label>
          <label className="text-xs">เลขบัญชีธนาคาร<input className={fieldClass} inputMode="numeric" pattern="[0-9]{6,20}" maxLength={20} required={Boolean(form.bankCode)} placeholder="กรอกเลขบัญชี ไม่ต้องใส่ขีด" value={form.bankAccount} onChange={e => setForm({ ...form, bankAccount: e.target.value })} /></label>
          <label className="text-xs sm:col-span-2">ชื่อบัญชีธนาคาร<input className={fieldClass} maxLength={200} placeholder="ชื่อเจ้าของบัญชี" value={form.bankAccountName} onChange={e => setForm({ ...form, bankAccountName: e.target.value })} /></label>
          <label className="text-xs">ประเภทพร้อมเพย์<select className={fieldClass} value={form.promptPayType} onChange={e => setForm({ ...form, promptPayType: e.target.value, promptPayNumber: '' })}><option value="">ไม่ระบุพร้อมเพย์</option>{Object.entries(promptPayTypes).map(([key, title]) => <option key={key} value={key}>{title}</option>)}</select></label>
          <label className="text-xs">หมายเลขพร้อมเพย์<input className={fieldClass} disabled={!form.promptPayType} required={Boolean(form.promptPayType)} inputMode="numeric" pattern={form.promptPayType === 'PHONE' ? '0[0-9]{9}' : '[0-9]{13}'} maxLength={form.promptPayType === 'PHONE' ? 10 : 13} placeholder={form.promptPayType === 'PHONE' ? 'เบอร์โทรศัพท์ 10 หลัก' : form.promptPayType === 'NATIONAL_ID' ? 'เลขบัตรประชาชน 13 หลัก' : 'เลือกประเภทพร้อมเพย์ก่อน'} value={form.promptPayNumber} onChange={e => setForm({ ...form, promptPayNumber: e.target.value })} /></label>
          <div className="borrower-form-section sm:col-span-2">สถานะและข้อมูลวงเงิน</div>
          <label className="text-xs">สถานะ *<select className={fieldClass} value={form.status} onChange={e => setForm({ ...form, status: e.target.value })}>{Object.entries(borrowerStatuses).map(([key, title]) => <option key={key} value={key}>{title}</option>)}</select></label>
          {([['paymentChannelCode', 'ช่องรับเงิน', channels], ['riskRatingCode', 'Risk Rating', ratings]] as const).map(([key, title, options]) => <label key={key} className="text-xs">{title}<select className={fieldClass} value={form[key]} onChange={e => setForm({ ...form, [key]: e.target.value })}><option value="">ยังไม่ระบุ</option>{options.filter(o => o.isActive || o.code === form[key]).map(o => <option key={o.code} value={o.code}>{o.nameTh}</option>)}</select></label>)}
          <label className="text-xs">วันที่สมัคร *<input required type="date" className={fieldClass} value={form.registeredAt} onChange={e => setForm({ ...form, registeredAt: e.target.value })} /></label>
          {([['durationMonths', 'ระยะเวลาที่กำหนด (เดือน)', 1200], ['approvedLimit', 'Approved Limit (บาท)', 2000000000], ['usedLimit', 'Used Limit (บาท)', selected?.approvedLimit === Number(form.approvedLimit) ? Math.max(Number(form.approvedLimit), selected.usedLimit) : Number(form.approvedLimit)]] as const).map(([key, title, max]) => <label key={key} className="text-xs">{title} *<input required type="number" min={0} max={max} step={1} className={fieldClass} value={form[key]} onChange={e => setForm({ ...form, [key]: e.target.value })} /></label>)}
          {Number(form.usedLimit) > Number(form.approvedLimit) && <p className="text-xs leading-6 text-amber-200 sm:col-span-2">วงเงินที่ใช้เกินอนุมัติ {money(Number(form.usedLimit) - Number(form.approvedLimit))} บาท · วงเงินคงเหลือแสดงเป็น 0 บาท ยอดเดิมจากการนำเข้ายังคงอยู่</p>}
          <div className="borrower-limit-preview rounded-xl p-4 text-sm sm:col-span-2">Available Limit: {money(availableBorrowerLimit(Number(form.approvedLimit), Number(form.usedLimit)))} บาท</div>
        </fieldset>
        {error && <p role="alert" className="mt-4 text-sm text-rose-600">{error}</p>}
        <div className="mt-6 flex justify-end gap-2"><Button disabled={busy || reading} onClick={() => setOpen(false)}>{viewOnly ? 'ปิด' : 'ยกเลิก'}</Button>{viewOnly ? canCreate && <Button variant="primary" onClick={() => setViewOnly(false)}><Pencil size={15} />แก้ไขข้อมูล</Button> : <Button type="submit" variant="primary" disabled={busy || reading}>{busy ? 'กำลังบันทึก…' : 'บันทึกผู้กู้ยืม'}</Button>}</div>
      </form>
    </dialog>}
    {deleting && <dialog ref={openDialog} onCancel={event => { if (busy) event.preventDefault(); else setDeleting(null) }} className="borrower-dialog fixed inset-0 m-auto w-[calc(100%-2rem)] max-w-md rounded-3xl p-6" aria-labelledby="delete-borrower-title">
      <h2 id="delete-borrower-title" className="text-lg font-semibold">ยืนยันลบผู้กู้ยืม</h2>
      <p className="my-4 text-sm leading-7">ต้องการลบ {deleting.borrowerId} · {deleting.firstName} {deleting.lastName} หรือไม่? การลบนี้ไม่สามารถกู้คืนได้</p>
      {deleting.usedLimit > 0 && <p className="text-sm text-amber-200">มีวงเงินใช้งานอยู่ ไม่สามารถลบรายการนี้ได้</p>}
      {error && <p role="alert" className="mt-3 text-sm text-rose-300">{error}</p>}
      <div className="mt-6 flex justify-end gap-2"><Button disabled={busy} onClick={() => setDeleting(null)}>ยกเลิก</Button><Button variant="danger" disabled={busy || deleting.usedLimit > 0} onClick={() => void remove()}>{busy ? 'กำลังลบ…' : 'ยืนยันลบ'}</Button></div>
    </dialog>}
  </div>
}
