'use client'

import { useCallback, useEffect, useState, type FormEvent } from 'react'
import Image from 'next/image'
import { cardDate, type ThaiIdCard } from '@/lib/thai-id'
import { useRouter } from 'next/navigation'
import { Landmark, Plus, Search, Eye, Pencil, X, CreditCard, LoaderCircle } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { lenderCode, lenderFields, lenderRoles, lenderStatuses, type LenderRow } from '@/lib/lender'

const emptyForm = () => ({ ...Object.fromEntries(lenderFields.map(([key]) => [key, ''])) as Record<typeof lenderFields[number][0], string>, role: 'FUNDER', status: 'ACTIVE', bankCode: '', provinceId: '' })
const fieldClass = 'mt-1.5 w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none'

export function LenderManager({ lenders, total, page, query: initialQuery, role: initialRole, status: initialStatus, metrics, provinces, banks, canEdit }: { lenders: LenderRow[]; total: number; page: number; query: string; role: string; status: string; metrics: { total: number; funders: number; representatives: number }; provinces: { id: number; nameTh: string }[]; banks: { code: string; nameTh: string; isActive: boolean }[]; canEdit: boolean }) {
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
    setCard(null); setCardReadToken(''); setCardLoading(Boolean(lender?.cardReadAt));
    setSelected(lender ?? null); setReadOnly(viewing); setError(''); setNotice('')
    setForm(lender ? { ...emptyForm(), ...lender, provinceId: lender.provinceId === null ? '' : String(lender.provinceId) } : emptyForm())
    setOpen(true)
  }
  async function readCard() {
    if (reading || cardLoading || busy || readOnly || !canEdit) return
    setReading(true); setError('')
    try {
      const response = await fetch('/api/lenders/card', { method: 'POST' })
      const result = await response.json()
      if (!response.ok) throw new Error(result.message || 'อ่านบัตรไม่สำเร็จ')
      const incoming: ThaiIdCard = result.card
      setCard(incoming); setCardReadToken(result.token)
      const province = provinces.find(p => incoming.address.replace(/\s/g, '').includes(p.nameTh.replace(/\s/g, '')))
      setForm(current => ({ ...current, nationalId: incoming.nationalId, firstName: incoming.firstName, lastName: incoming.lastName, address: incoming.address, provinceId: province ? String(province.id) : current.provinceId }))
    } catch (err) { setError(err instanceof Error ? err.message : 'เชื่อมต่อเครื่องอ่านไม่ได้') }
    finally { setReading(false) }
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
  return <div className="borrower-workspace space-y-6">
    <div className="borrower-metrics">{[['ผู้ให้กู้ทั้งหมด', metrics.total], ['ผู้ปล่อยเงิน', metrics.funders], ['ผู้ทำสัญญาแทน', metrics.representatives]].map(([title, count]) => <Card key={title} className="borrower-metric"><div className="borrower-metric-top">{title}<Landmark size={20} /></div><div className="borrower-metric-value">{count}<span>ราย</span></div><p className="mt-2 text-xs text-slate-400">{title === 'ผู้ให้กู้ทั้งหมด' ? 'รายชื่อที่บันทึกในระบบ' : 'เฉพาะสถานะใช้งาน · รวมผู้มีทั้งสองบทบาท'}</p></Card>)}</div>
    {notice && <p role="status" className="text-sm text-emerald-300">{notice}</p>}
    <Card className="overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-4 p-5"><div className="borrower-directory-heading"><h2>ทะเบียนผู้ให้กู้</h2><span className="borrower-count">{metrics.total} ราย</span></div>{canEdit && <Button variant="primary" onClick={() => show()}><Plus size={16} />เพิ่มผู้ให้กู้</Button>}</div>
      <div className="borrower-toolbar flex flex-wrap gap-3 p-4"><form className="flex min-w-60 flex-1 gap-2" onSubmit={e => { e.preventDefault(); navigate(1) }}><label className="relative flex-1"><span className="sr-only">ค้นหาผู้ให้กู้</span><Search size={16} className="absolute left-3 top-3.5" /><input className={`${fieldClass} !mt-0 !pl-10`} value={query} onChange={e => setQuery(e.target.value)} placeholder="ค้นหารหัส ชื่อ เบอร์โทร หรือเลขบัตร" /></label><Button type="submit">ค้นหา</Button></form><label><span className="sr-only">กรองบทบาท</span><select className={`${fieldClass} !mt-0`} value={role} onChange={e => { setRole(e.target.value); navigate(1, query, e.target.value, status) }}><option value="">ทุกบทบาท</option>{Object.entries(lenderRoles).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label><label><span className="sr-only">กรองสถานะ</span><select className={`${fieldClass} !mt-0`} value={status} onChange={e => { setStatus(e.target.value); navigate(1, query, role, e.target.value) }}><option value="">ทุกสถานะ</option>{Object.entries(lenderStatuses).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label></div>
      <div className="borrower-table-scroll overflow-x-auto"><table className="w-full whitespace-nowrap text-left text-xs"><thead><tr>{['จัดการ', 'รหัสผู้ให้กู้', 'ชื่อเล่น', 'ชื่อ–นามสกุล', 'บทบาท', 'เบอร์โทร', 'จังหวัด', 'สถานะ', 'ธนาคาร', 'เลขบัญชี'].map(label => <th key={label} className="px-4 py-4 font-medium">{label}</th>)}</tr></thead><tbody>{filtered.map(l => <tr key={l.id}><td className="borrower-row-actions border-b px-4 py-3"><div className="flex gap-2"><Button aria-label={`ดูข้อมูล ${l.nickname}`} onClick={() => show(l, true)}><Eye size={14} /></Button>{canEdit && <Button variant="edit" aria-label={`แก้ไข ${l.nickname}`} onClick={() => show(l)}><Pencil size={14} /></Button>}</div></td>{[lenderCode(l.id), l.nickname, `${l.firstName} ${l.lastName}`.trim() || '—', lenderRoles[l.role], l.phone || '—', provinces.find(p => p.id === l.provinceId)?.nameTh || '—', lenderStatuses[l.status], banks.find(b => b.code === l.bankCode)?.nameTh || '—', l.bankAccount || '—'].map((value, i) => <td key={i} className="border-b px-4 py-4">{value}</td>)}</tr>)}</tbody></table></div>
      {!filtered.length && <div className="borrower-empty"><span className="borrower-empty-icon"><Landmark size={30} /></span><h3>{total ? 'ไม่พบรายชื่อที่ค้นหา' : 'ยังไม่มีรายชื่อผู้ให้กู้'}</h3><p>{total ? 'ลองเปลี่ยนคำค้นหา บทบาท หรือสถานะ' : 'บันทึกผู้ปล่อยเงินหรือผู้ทำสัญญาแทน พร้อมข้อมูลติดต่อและบัญชีธนาคาร'}</p>{!metrics.total && canEdit && <Button variant="primary" onClick={() => show()}><Plus size={15} />เพิ่มผู้ให้กู้คนแรก</Button>}</div>}
      <div className="borrower-pagination flex items-center justify-between gap-3 border-t p-4 text-xs"><span>พบ {total} รายการ · หน้า {currentPage} / {pages}</span><div className="flex gap-2"><Button disabled={currentPage <= 1} onClick={() => navigate(currentPage - 1)}>ก่อนหน้า</Button><Button disabled={currentPage >= pages} onClick={() => navigate(currentPage + 1)}>ถัดไป</Button></div></div>
    </Card>
    {open && <dialog ref={openDialog} onCancel={e => { if (busy || reading) e.preventDefault(); else setOpen(false) }} className="borrower-dialog fixed inset-0 m-auto max-h-[90dvh] w-[calc(100%-2rem)] max-w-3xl overflow-y-auto rounded-3xl p-6" aria-labelledby="lender-title"><button type="button" disabled={busy || reading} className="borrower-close" aria-label="ปิดหน้าต่าง" onClick={() => setOpen(false)}><X size={18} /></button><h2 id="lender-title" className="pr-12 text-lg font-semibold">{readOnly ? 'รายละเอียดผู้ให้กู้' : selected ? 'แก้ไขผู้ให้กู้' : 'เพิ่มผู้ให้กู้'}</h2><p className="mb-6 mt-2 text-xs text-slate-400">{selected ? lenderCode(selected.id) : 'ระบุชื่อเล่นและเลือกบทบาท เพื่อบันทึกรายชื่อผู้ให้กู้'}</p>
      <section className="borrower-card-panel" aria-label="ข้อมูลบัตรประชาชน">
        <div className="flex flex-wrap items-center justify-between gap-3"><div><h3 className="text-sm font-medium">ข้อมูลจากบัตรประชาชน</h3><p className="mt-1 text-xs text-slate-500">เสียบบัตรกับเครื่องอ่าน ACS บน Mac ที่รันระบบ แล้วกดอ่านบัตร</p></div>{!readOnly && <Button disabled={busy || reading || cardLoading} onClick={() => void readCard()}>{reading ? <LoaderCircle size={16} className="animate-spin" /> : <CreditCard size={16} />}{reading ? 'กำลังอ่านบัตร…' : card ? 'อ่านบัตรใหม่' : 'อ่านบัตรประชาชน'}</Button>}</div>
        {card ? <div className="borrower-card-result"><Image unoptimized src={card.photo} width={100} height={128} alt="รูปผู้ให้กู้จากชิปบัตรประชาชน" className="borrower-card-photo" /><dl className="borrower-card-details">
          {[[ 'เลขบัตรประชาชน', card.nationalId ], ['ชื่อ–นามสกุล', card.fullNameTh], ['ชื่อภาษาอังกฤษ', card.fullNameEn], ['วันเกิด', cardDate(card.birthDate)], ['วันที่ออกบัตร', cardDate(card.issueDate)], ['วันหมดอายุ', cardDate(card.expiryDate)], ['ที่อยู่ตามบัตร', card.address], ['อ่านบัตรเมื่อ', cardReadToken ? 'อ่านใหม่ รอการบันทึก' : selected?.cardReadAt ? new Intl.DateTimeFormat('th-TH', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Bangkok' }).format(new Date(selected.cardReadAt)) : '—']].map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value || '—'}</dd></div>)}
        </dl><p className="borrower-card-note">ตรวจสอบข้อมูลก่อนบันทึก · การอ่านชิปยังไม่ได้ยืนยันตัวบุคคลหรือสถานะบัตรกับหน่วยงานผู้ออกบัตร</p>{form.nationalId !== card.nationalId && <p role="alert" className="text-sm text-amber-200">เลขบัตรในฟอร์มไม่ตรงกับข้อมูลที่อ่าน กรุณาอ่านบัตรใหม่</p>}</div> : <p className="mt-4 text-xs text-slate-500">{readOnly ? 'ยังไม่มีข้อมูลจากชิปบัตรประชาชน' : 'ข้อมูลชื่อ เลขบัตร และที่อยู่จะเติมให้อัตโนมัติ กรุณาระบุชื่อเล่นก่อนบันทึก'}</p>}
      </section>
      <form onSubmit={submit}><fieldset disabled={busy || reading || readOnly} className="grid gap-4 sm:grid-cols-2"><legend className="borrower-form-section">ข้อมูลผู้ให้กู้และการทำสัญญา</legend>
        <label className="text-xs">บทบาท *<select className={fieldClass} value={form.role} onChange={e => setForm({ ...form, role: e.target.value })}>{Object.entries(lenderRoles).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label>
        <label className="text-xs">สถานะ<select className={fieldClass} value={form.status} onChange={e => setForm({ ...form, status: e.target.value })}>{Object.entries(lenderStatuses).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label>
        {lenderFields.map(([key, label]) => <label key={key} className={`text-xs ${['address', 'notes'].includes(key) ? 'sm:col-span-2' : ''}`}>{label}{key === 'nickname' ? ' *' : ''}{['address', 'notes'].includes(key) ? <textarea className={`${fieldClass} min-h-24`} maxLength={2000} value={form[key]} onChange={e => setForm({ ...form, [key]: e.target.value })} /> : <input className={fieldClass} autoFocus={key === 'nickname'} required={key === 'nickname'} maxLength={key === 'nationalId' ? 13 : key === 'phone' ? 10 : key === 'bankAccount' ? 20 : 200} inputMode={['phone', 'nationalId', 'bankAccount'].includes(key) ? 'numeric' : 'text'} pattern={key === 'nationalId' ? '[0-9]{13}' : key === 'phone' ? '0[0-9]{8,9}' : key === 'bankAccount' ? '[0-9]{6,20}' : undefined} value={form[key]} onChange={e => setForm({ ...form, [key]: e.target.value })} />}</label>)}
        <label className="text-xs">จังหวัด<select className={fieldClass} value={form.provinceId} onChange={e => setForm({ ...form, provinceId: e.target.value })}><option value="">ยังไม่ระบุจังหวัด</option>{provinces.map(p => <option key={p.id} value={p.id}>{p.nameTh}</option>)}</select></label>
        <label className="text-xs">ธนาคาร<select className={fieldClass} value={form.bankCode} onChange={e => setForm({ ...form, bankCode: e.target.value })}><option value="">ยังไม่ระบุธนาคาร</option>{banks.filter(b => b.isActive || b.code === form.bankCode).map(b => <option key={b.code} value={b.code}>{b.nameTh}{!b.isActive ? ' (ไม่ใช้งาน)' : ''}</option>)}</select></label>
      </fieldset>{error && <p role="alert" className="mt-4 text-sm text-rose-300">{error}</p>}<div className="mt-6 flex justify-end gap-3"><Button disabled={busy || reading} onClick={() => setOpen(false)}>{readOnly ? 'ปิด' : 'ยกเลิก'}</Button>{!readOnly && <Button type="submit" variant="primary" disabled={busy || reading}>{busy ? 'กำลังบันทึก…' : 'บันทึกผู้ให้กู้'}</Button>}</div></form>
    </dialog>}
  </div>
}
