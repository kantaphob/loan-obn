'use client'

import { Fragment, useCallback, useEffect, useState, type FormEvent } from 'react'
import { promptPayTypes } from '@/lib/borrower'
import { ReadCardModal } from '@/components/borrower/read-card-modal'
import { cardDateInput, type ThaiIdCard } from '@/lib/thai-id'
import { useRouter } from 'next/navigation'
import { Landmark, Plus, Search, Eye, Pencil, X, CreditCard } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { lenderCode, lenderFields, lenderRoles, lenderStatuses, type LenderRow } from '@/lib/lender'

const emptyForm = () => ({ ...Object.fromEntries(lenderFields.map(([key]) => [key, ''])) as Record<typeof lenderFields[number][0], string>, registeredAt: new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Bangkok', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date()), promptPayType: '', paymentChannelCode: '', role: 'FUNDER', status: 'ACTIVE', bankCode: '', provinceId: '' })
const fieldClass = 'mt-1.5 w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none'

export function LenderManager({ lenders, total, page, query: initialQuery, role: initialRole, status: initialStatus, metrics, provinces, banks, channels, canEdit }: { lenders: LenderRow[]; total: number; page: number; query: string; role: string; status: string; metrics: { total: number; funders: number; representatives: number }; provinces: { id: number; nameTh: string }[]; channels: { code: string; nameTh: string; isActive: boolean }[]; banks: { code: string; nameTh: string; isActive: boolean }[]; canEdit: boolean }) {
  const router = useRouter()
  const [query, setQuery] = useState(initialQuery)
  const [role, setRole] = useState(initialRole)
  const [status, setStatus] = useState(initialStatus)
  const [open, setOpen] = useState(false)
  const [selected, setSelected] = useState<LenderRow | null>(null)
  const [readOnly, setReadOnly] = useState(false)
  const [form, setForm] = useState(emptyForm)
  const [busy, setBusy] = useState(false)
  const [reading, setReading] = useState(false)
  const [readerError, setReaderError] = useState('')
  const [detecting, setDetecting] = useState(false)
  const [readCardOpen, setReadCardOpen] = useState(false)
  const [pendingCardToken, setPendingCardToken] = useState('')
  const [cardLoading, setCardLoading] = useState(false)
  const [card, setCard] = useState<ThaiIdCard | null>(null)
  const [cardReadToken, setCardReadToken] = useState('')
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const openDialog = useCallback((node: HTMLDialogElement | null) => { if (node && !node.open) node.showModal() }, [])
  const pages = Math.max(1, Math.ceil(total / 25))
  const currentPage = page
  const filtered = lenders
  function navigate(nextPage: number, nextQuery = query, nextRole = role, nextStatus = status) {
    const params = new URLSearchParams()
    if (nextQuery.trim()) params.set('q', nextQuery.trim())
    if (nextRole) params.set('role', nextRole)
    if (nextStatus) params.set('status', nextStatus)
    if (nextPage > 1) params.set('page', String(nextPage))
    router.push(`/dashboard/lenders${params.size ? `?${params}` : ''}`)
  }
  useEffect(() => {
    if (!open || !selected?.cardReadAt) return
    const controller = new AbortController()
    fetch(`/api/lenders/${selected.id}/card`, { signal: controller.signal }).then(async response => {
      if (!response.ok) throw new Error('โหลดข้อมูลบัตรไม่สำเร็จ')
      const result = await response.json()
      if (!controller.signal.aborted) setCard(result.card)
    }).catch(() => { if (!controller.signal.aborted) setError('โหลดข้อมูลบัตรเดิมไม่สำเร็จ กรุณาปิดแล้วเปิดใหม่') }).finally(() => { if (!controller.signal.aborted) setCardLoading(false) })
    return () => controller.abort()
  }, [open, selected])
  function show(lender?: LenderRow, viewing = false) {
    setReaderError(''); setPendingCardToken(''); setReadCardOpen(false);
    setCard(null); setCardReadToken(''); setCardLoading(Boolean(lender?.cardReadAt));
    setSelected(lender ?? null); setReadOnly(viewing); setError(''); setNotice('')
    setForm(lender ? { ...emptyForm(), ...lender, provinceId: lender.provinceId === null ? '' : String(lender.provinceId) } : emptyForm())
    setOpen(true)
  }
  async function readCard() {
    if (reading || cardLoading || busy || readOnly || !canEdit) return
    setReadCardOpen(true); setReading(true); setDetecting(true); setError(''); setReaderError('')
    try {
      const detection = await fetch('/api/lenders/card', { cache: 'no-store', signal: AbortSignal.timeout(30000) })
      const detected = await detection.json()
      if (!detection.ok) throw new Error(detected.message || 'ตรวจจับเครื่องอ่านไม่สำเร็จ')
      if (!detected.cardPresent) throw new Error('ยังไม่พบบัตร กรุณาเสียบบัตรให้แน่น แล้วกดอ่านบัตรอีกครั้ง')
      setDetecting(false)
      const response = await fetch('/api/lenders/card', { method: 'POST', signal: AbortSignal.timeout(30000) })
      const result = await response.json()
      if (!response.ok) throw new Error(result.message || 'อ่านบัตรไม่สำเร็จ')
      const incoming: ThaiIdCard = result.card
      setCard(incoming); setPendingCardToken(result.token)

    } catch (err) { setReaderError(err instanceof DOMException && err.name === 'TimeoutError' ? 'เครื่องอ่านไม่ตอบสนอง กรุณาถอดและเสียบเครื่องอ่านใหม่ แล้วลองอีกครั้ง' : err instanceof Error ? err.message : 'เชื่อมต่อเครื่องอ่านไม่ได้') }
    finally { setReading(false); setDetecting(false) }
  }
  function applyCard() {
    if (!card || !pendingCardToken) return
      const province = provinces.find(p => card.address.replace(/\s/g, '').includes(p.nameTh.replace(/\s/g, '')))
      setForm(current => ({ ...current, titleTh: card.titleTh || '', middleNameTh: card.middleNameTh || '', titleEn: card.titleEn || '', firstNameEn: card.firstNameEn || '', middleNameEn: card.middleNameEn || '', lastNameEn: card.lastNameEn || '', birthDate: cardDateInput(card.birthDate), cardIssueDate: cardDateInput(card.issueDate), cardExpiryDate: cardDateInput(card.expiryDate), nationalId: card.nationalId, firstName: card.firstName, lastName: card.lastName, address: card.address, provinceId: province ? String(province.id) : current.provinceId }))
    setCardReadToken(pendingCardToken); setPendingCardToken(''); setReadCardOpen(false)
  }
  async function submit(event: FormEvent) {
    event.preventDefault()
    if (busy || reading || readOnly || !canEdit) return
    setBusy(true); setError('')
    try {
      const response = await fetch('/api/lenders', { method: selected ? 'PUT' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...form, cardReadToken: cardReadToken || undefined, id: selected?.id, provinceId: form.provinceId ? Number(form.provinceId) : null }) })
      const result = await response.json()
      if (!response.ok) throw new Error(result.message || 'บันทึกไม่สำเร็จ')
      setOpen(false); setNotice('บันทึกข้อมูลผู้ให้กู้เรียบร้อยแล้ว'); router.refresh()
    } catch (err) { setError(err instanceof Error ? err.message : 'เชื่อมต่อไม่สำเร็จ กรุณาลองอีกครั้ง') }
    finally { setBusy(false) }
  }
  return <div className="borrower-workspace space-y-3">
    <div className="borrower-metrics">{[['ผู้ให้กู้ทั้งหมด', metrics.total], ['ผู้ปล่อยเงิน', metrics.funders], ['ผู้ทำสัญญาแทน', metrics.representatives]].map(([title, count]) => <Card key={title} className="borrower-metric"><div className="borrower-metric-top">{title}<Landmark size={20} /></div><div className="borrower-metric-value">{count}<span>ราย</span></div><p className="mt-2 text-xs text-slate-400">{title === 'ผู้ให้กู้ทั้งหมด' ? 'รายชื่อที่บันทึกในระบบ' : 'เฉพาะสถานะใช้งาน · รวมผู้มีทั้งสองบทบาท'}</p></Card>)}</div>
    {notice && <p role="status" className="text-sm text-emerald-300">{notice}</p>}
    <Card className="overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-4 px-4 py-3"><div className="borrower-directory-heading"><h2>ทะเบียนผู้ให้กู้</h2><span className="borrower-count">{metrics.total} ราย</span></div>{canEdit && <Button variant="primary" onClick={() => show()}><Plus size={16} />เพิ่มผู้ให้กู้</Button>}</div>
      <div className="borrower-toolbar flex flex-wrap gap-3 p-4"><form className="flex min-w-60 flex-1 gap-2" onSubmit={e => { e.preventDefault(); navigate(1) }}><label className="relative flex-1"><span className="sr-only">ค้นหาผู้ให้กู้</span><Search size={16} className="absolute left-3 top-3.5" /><input className={`${fieldClass} !mt-0 !pl-10`} value={query} onChange={e => setQuery(e.target.value)} placeholder="ค้นหารหัส ชื่อ เบอร์โทร หรือเลขบัตร" /></label><Button type="submit">ค้นหา</Button></form><label><span className="sr-only">กรองบทบาท</span><select className={`${fieldClass} !mt-0`} value={role} onChange={e => { setRole(e.target.value); navigate(1, query, e.target.value, status) }}><option value="">ทุกบทบาท</option>{Object.entries(lenderRoles).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label><label><span className="sr-only">กรองสถานะ</span><select className={`${fieldClass} !mt-0`} value={status} onChange={e => { setStatus(e.target.value); navigate(1, query, role, e.target.value) }}><option value="">ทุกสถานะ</option>{Object.entries(lenderStatuses).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label></div>
      <div className="borrower-table-scroll overflow-x-auto"><table className="w-full whitespace-nowrap text-left text-xs"><thead><tr>{['จัดการ', 'รหัสผู้ให้กู้', 'ชื่อเล่น', 'ชื่อ–นามสกุล', 'บทบาท', 'เบอร์โทร', 'จังหวัด', 'สถานะ', 'ธนาคาร', 'เลขบัญชี'].map(label => <th key={label} className="px-4 py-4 font-medium">{label}</th>)}</tr></thead><tbody>{filtered.map(l => <tr key={l.id}><td className="borrower-row-actions border-b px-4 py-3"><div className="flex gap-2"><Button aria-label={`ดูข้อมูล ${l.nickname}`} onClick={() => show(l, true)}><Eye size={14} /></Button>{canEdit && <Button variant="edit" aria-label={`แก้ไข ${l.nickname}`} onClick={() => show(l)}><Pencil size={14} /></Button>}</div></td>{[lenderCode(l.id), l.nickname, `${l.firstName} ${l.lastName}`.trim() || '—', lenderRoles[l.role], l.phone || '—', provinces.find(p => p.id === l.provinceId)?.nameTh || '—', lenderStatuses[l.status], banks.find(b => b.code === l.bankCode)?.nameTh || '—', l.bankAccount || '—'].map((value, i) => <td key={i} className="border-b px-4 py-4">{value}</td>)}</tr>)}</tbody></table></div>
      {!filtered.length && <div className="borrower-empty"><span className="borrower-empty-icon"><Landmark size={30} /></span><h3>{total ? 'ไม่พบรายชื่อที่ค้นหา' : 'ยังไม่มีรายชื่อผู้ให้กู้'}</h3><p>{total ? 'ลองเปลี่ยนคำค้นหา บทบาท หรือสถานะ' : 'บันทึกผู้ปล่อยเงินหรือผู้ทำสัญญาแทน พร้อมข้อมูลติดต่อและบัญชีธนาคาร'}</p>{!metrics.total && canEdit && <Button variant="primary" onClick={() => show()}><Plus size={15} />เพิ่มผู้ให้กู้คนแรก</Button>}</div>}
      <div className="borrower-pagination flex items-center justify-between gap-3 border-t p-4 text-xs"><span>พบ {total} รายการ · หน้า {currentPage} / {pages}</span><div className="flex gap-2"><Button disabled={currentPage <= 1} onClick={() => navigate(currentPage - 1)}>ก่อนหน้า</Button><Button disabled={currentPage >= pages} onClick={() => navigate(currentPage + 1)}>ถัดไป</Button></div></div>
    </Card>
    {open && <dialog ref={openDialog} onCancel={e => { if (busy || reading) e.preventDefault(); else setOpen(false) }} className="borrower-dialog fixed inset-0 m-auto max-h-[90dvh] w-[calc(100%-2rem)] max-w-3xl overflow-y-auto rounded-3xl p-6" aria-labelledby="lender-title"><button type="button" disabled={busy || reading} className="borrower-close" aria-label="ปิดหน้าต่าง" onClick={() => setOpen(false)}><X size={18} /></button><h2 id="lender-title" className="pr-12 text-lg font-semibold">{readOnly ? 'รายละเอียดผู้ให้กู้' : selected ? 'แก้ไขผู้ให้กู้' : 'เพิ่มผู้ให้กู้'}</h2><p className="mb-6 mt-2 text-xs text-slate-400">{selected ? lenderCode(selected.id) : 'ระบุชื่อเล่นและเลือกบทบาท เพื่อบันทึกรายชื่อผู้ให้กู้'}</p>
      <section className="borrower-card-panel flex flex-wrap items-center justify-between gap-3" aria-label="ข้อมูลบัตรประชาชน">
        <div><h3 className="text-sm font-medium">ข้อมูลจากบัตรประชาชน</h3><p className="mt-1 text-xs text-slate-500">เปิดหน้าต่างอ่านบัตร ตรวจสอบข้อมูล แล้วกด “ใช้ข้อมูลนี้”</p>{cardReadToken && <p role="status" className="mt-2 text-xs">นำข้อมูลบัตรเข้าฟอร์มแล้ว · รอการบันทึก</p>}</div>
        <Button disabled={busy || reading || cardLoading} onClick={() => { if (readOnly || card) setReadCardOpen(true); else void readCard() }}><CreditCard size={16} />{cardLoading ? 'กำลังโหลดข้อมูลบัตร…' : readOnly ? 'ดูข้อมูลบัตร' : 'อ่านบัตรประชาชน'}</Button>
      </section>
      <form onSubmit={submit}><fieldset disabled={busy || reading || readOnly} className="grid gap-4 sm:grid-cols-2"><legend className="borrower-form-section">ข้อมูลผู้ให้กู้และการทำสัญญา</legend>
        <label className="text-xs">บทบาท *<select className={fieldClass} value={form.role} onChange={e => setForm({ ...form, role: e.target.value })}>{Object.entries(lenderRoles).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label>
        <label className="text-xs">สถานะ<select className={fieldClass} value={form.status} onChange={e => setForm({ ...form, status: e.target.value })}>{Object.entries(lenderStatuses).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label>
        {(['nickname','titleTh','firstName','middleNameTh','lastName','titleEn','firstNameEn','middleNameEn','lastNameEn','nationalId','birthDate','cardIssueDate','cardExpiryDate','phone','workplace','address','houseNumber','villageNumber','facebook','instagram','line','bankAccount','bankAccountName','promptPayNumber','registeredAt','referrer','notes'] as const).map(key => { const label = lenderFields.find(([field]) => field === key)![1]; return <Fragment key={key}>{({ nickname: 'ข้อมูลส่วนตัว', phone: 'ข้อมูลติดต่อและที่อยู่', facebook: 'ช่องทาง Social', bankAccount: 'บัญชีธนาคารและพร้อมเพย์', registeredAt: 'ข้อมูลการลงทะเบียนและหมายเหตุ' } as Record<string, string>)[key] && <div className="borrower-form-section sm:col-span-2">{({ nickname: 'ข้อมูลส่วนตัว', phone: 'ข้อมูลติดต่อและที่อยู่', facebook: 'ช่องทาง Social', bankAccount: 'บัญชีธนาคารและพร้อมเพย์', registeredAt: 'ข้อมูลการลงทะเบียนและหมายเหตุ' } as Record<string, string>)[key]}</div>}{key === 'facebook' && (<label className="text-xs">จังหวัด<select className={fieldClass} value={form.provinceId} onChange={e => setForm({ ...form, provinceId: e.target.value })}><option value="">ยังไม่ระบุจังหวัด</option>{provinces.map(p => <option key={p.id} value={p.id}>{p.nameTh}</option>)}</select></label>)}{key === 'bankAccount' && (<label className="text-xs">ธนาคาร<select className={fieldClass} value={form.bankCode} onChange={e => setForm({ ...form, bankCode: e.target.value })}><option value="">ยังไม่ระบุธนาคาร</option>{banks.filter(b => b.isActive || b.code === form.bankCode).map(b => <option key={b.code} value={b.code}>{b.nameTh}{!b.isActive ? ' (ไม่ใช้งาน)' : ''}</option>)}</select></label>)}{key === 'promptPayNumber' && (<label className="text-xs">ประเภทพร้อมเพย์<select className={fieldClass} value={form.promptPayType} onChange={e => setForm({ ...form, promptPayType: e.target.value })}><option value="">ยังไม่ระบุ</option>{Object.entries(promptPayTypes).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label>)}{key === 'registeredAt' && (<label className="text-xs">ช่องทางการเงิน<select className={fieldClass} value={form.paymentChannelCode} onChange={e => setForm({ ...form, paymentChannelCode: e.target.value })}><option value="">ยังไม่ระบุ</option>{channels.filter(c => c.isActive || c.code === form.paymentChannelCode).map(c => <option key={c.code} value={c.code}>{c.nameTh}</option>)}</select></label>)}<label key={key} className={`text-xs ${['address', 'notes'].includes(key) ? 'sm:col-span-2' : ''}`}>{label}{key === 'nickname' ? ' *' : ''}{['address', 'notes'].includes(key) ? <textarea className={`${fieldClass} min-h-24`} maxLength={2000} value={form[key]} onChange={e => setForm({ ...form, [key]: e.target.value })} /> : <input type={['birthDate', 'cardIssueDate', 'cardExpiryDate', 'registeredAt'].includes(key) ? 'date' : 'text'} className={fieldClass} autoFocus={key === 'nickname'} required={key === 'nickname'} maxLength={key === 'nationalId' ? 13 : key === 'phone' ? 10 : key === 'bankAccount' ? 20 : 200} inputMode={['phone', 'nationalId', 'bankAccount'].includes(key) ? 'numeric' : 'text'} pattern={key === 'nationalId' ? '[0-9]{13}' : key === 'phone' ? '0[0-9]{8,9}' : key === 'bankAccount' ? '[0-9]{6,20}' : undefined} value={form[key]} onChange={e => setForm({ ...form, [key]: e.target.value })} />}</label></Fragment> })}




      </fieldset>{error && <p role="alert" className="mt-4 text-sm text-rose-300">{error}</p>}<div className="mt-6 flex justify-end gap-3"><Button disabled={busy || reading} onClick={() => setOpen(false)}>{readOnly ? 'ปิด' : 'ยกเลิก'}</Button>{!readOnly && <Button type="submit" variant="primary" disabled={busy || reading}>{busy ? 'กำลังบันทึก…' : 'บันทึกผู้ให้กู้'}</Button>}</div></form>
    </dialog>}
    {readCardOpen && <ReadCardModal subjectLabel="ผู้ให้กู้" open={readCardOpen} card={card} reading={reading && !detecting} detecting={detecting} error={readerError} pendingSave={Boolean(pendingCardToken)} savedAt={selected?.cardReadAt ?? null} readAllowed={!readOnly} onClose={() => { if (!reading) setReadCardOpen(false) }} onRetry={() => void readCard()} onUse={applyCard} />}
  </div>
}
