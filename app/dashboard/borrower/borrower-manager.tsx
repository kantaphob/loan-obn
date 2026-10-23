'use client'

import { useCallback, useEffect, useState, type FormEvent } from 'react'
import Image from 'next/image'
import { socialKeys, socialUrl, socialStatus, maxLineQrBytes, type SocialKey } from '@/lib/borrower-social'
import { cardDateInput, type ThaiIdCard } from '@/lib/thai-id'
import { useRouter } from 'next/navigation'
import { Plus, Search, UsersRound, Wallet, CircleDollarSign, ArrowUpRight, ChevronLeft, ChevronRight, X, Eye, Pencil, Trash2, CreditCard, ExternalLink, QrCode, Upload } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { useToast } from '@/components/ui/toast'
import { ReadCardModal } from '@/components/borrower/read-card-modal'
import { availableBorrowerLimit, borrowerTenure, borrowerStatuses, promptPayTypes, type BorrowerRow, type BorrowerOption } from '@/lib/borrower'

type Option = BorrowerOption & { isActive: boolean }
const money = (value: number) => new Intl.NumberFormat('th-TH', { maximumFractionDigits: 0 }).format(value)
const fieldClass = 'mt-1.5 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-800 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100'
const headers = ['จัดการ', 'รหัสผู้กู้', 'ชื่อเล่น', 'ชื่อ', 'สกุล', 'เบอร์โทร', 'เลขบัตร', 'ที่ทำงาน', 'จังหวัด', 'สถานะ', 'ธนาคาร', 'เลขบัญชีธนาคาร', 'ชื่อบัญชีธนาคาร', 'ประเภทพร้อมเพย์', 'หมายเลขพร้อมเพย์', 'ช่องรับเงิน', 'วันที่สมัคร', 'ระยะเวลา', 'FB', 'IG', 'Line', 'Risk Rating', 'Approved Limit', 'Used Limit', 'Available Limit', 'คนแนะนำ']
function initialForm() {
  return { titleTh: '', middleNameTh: '', titleEn: '', firstNameEn: '', middleNameEn: '', lastNameEn: '', birthDate: '', address: '', houseNumber: '', villageNumber: '', districtId: '', subdistrictId: '', cardIssueDate: '', cardExpiryDate: '', bankCode: '', bankAccountName: '', promptPayType: '', promptPayNumber: '', provinceId: '', nickname: '', firstName: '', lastName: '', phone: '', nationalId: '', workplace: '', bankAccount: '', facebook: '', instagram: '', line: '', referrer: '', status: 'ACTIVE', paymentChannelCode: '', riskRatingCode: '', registeredAt: new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Bangkok', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date()), durationMonths: '0', approvedLimit: '0', usedLimit: '0' }
}

function LocationSelect({ label, parent, parentKey, value, onChange, className = '' }: { label: string; parent: string; parentKey: 'provinceId' | 'districtId'; value: string; onChange: (value: string) => void; className?: string }) {
  const [result, setResult] = useState<{ parent: string; items: { id: number; nameTh: string }[]; error: boolean }>({ parent: '', items: [], error: false })
  useEffect(() => {
    if (!parent) return
    const controller = new AbortController()
    fetch(`/api/masterdata/locations?${parentKey}=${parent}`, { signal: controller.signal }).then(async response => {
      if (!response.ok) throw new Error()
      const data = await response.json()
      if (!controller.signal.aborted) setResult({ parent, items: data.options, error: false })
    }).catch(() => { if (!controller.signal.aborted) setResult({ parent, items: [], error: true }) })
    return () => controller.abort()
  }, [parent, parentKey])
  const items = result.parent === parent ? result.items : []
  return <label className={`text-xs ${className}`}>{label}<select className={fieldClass} disabled={!parent || result.parent !== parent} value={value} onChange={e => onChange(e.target.value)}><option value="">{!parent ? `เลือก${parentKey === 'provinceId' ? 'จังหวัด' : 'อำเภอ'}ก่อน` : result.parent !== parent ? 'กำลังโหลด…' : `ยังไม่ระบุ${label}`}</option>{items.map(item => <option key={item.id} value={item.id}>{item.nameTh}</option>)}</select>{result.parent === parent && result.error && <span role="alert" className="block mt-1 text-rose-300">โหลดข้อมูลไม่สำเร็จ กรุณาเลือกจังหวัดหรืออำเภอใหม่</span>}</label>
}

function SocialLink({ value, label }: { value: string; label: string }) {
  const url = socialUrl(value)
  return url ? <a className="borrower-social-link" href={url} target="_blank" rel="noopener noreferrer" aria-label={`เปิด ${label} ในแท็บใหม่`}>{label}<ExternalLink size={12} /></a> : <span className="borrower-social-status">{socialStatus(value)}</span>
}

export function BorrowerManager({ borrowers, total, page, query: initialQuery, status: initialStatus, aggregate, channels, ratings, provinces, banks, today, canCreate }: { today: string; borrowers: BorrowerRow[]; total: number; page: number; query: string; status: string; aggregate: { approved: number; used: number; active: number; total: number }; provinces: { id: number; nameTh: string }[]; banks: Option[]; channels: Option[]; ratings: Option[]; canCreate: boolean }) {
  const router = useRouter()
  const { toast } = useToast()
  const openDialog = useCallback((node: HTMLDialogElement | null) => { if (node && !node.open) node.showModal() }, [])
  const [query, setQuery] = useState(initialQuery)
  const [status, setStatus] = useState(initialStatus)
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
  const [cardNationalId, setCardNationalId] = useState<string | null>(null)
  const [reading, setReading] = useState(false)
  const [hasMiddleName, setHasMiddleName] = useState(false)
  const [detectingCard, setDetectingCard] = useState(false)
  const [readCardOpen, setReadCardOpen] = useState(false)
  const [cardDetectionAttempt, setCardDetectionAttempt] = useState(0)
  const [lineQrImage, setLineQrImage] = useState<string | null>(null)
  const [qrLoading, setQrLoading] = useState(false)
  const [socialChanged, setSocialChanged] = useState<SocialKey[]>([])
  const [qrViewing, setQrViewing] = useState<{ src: string; name: string } | null>(null)
  const qrSrc = lineQrImage !== null ? lineQrImage : selected?.hasLineQr ? `/api/borrowers/${selected.id}/line-qr` : ''
  const pages = Math.max(1, Math.ceil(total / 25))
  const currentPage = page
  const visible = borrowers
  const approved = aggregate.approved
  const available = Math.max(0, aggregate.approved - aggregate.used)
  const used = aggregate.used
  function navigate(nextPage: number, nextQuery = query, nextStatus = status) {
    const params = new URLSearchParams()
    if (nextQuery.trim()) params.set('q', nextQuery.trim())
    if (nextStatus) params.set('status', nextStatus)
    if (nextPage > 1) params.set('page', String(nextPage))
    router.push(`/dashboard/borrower${params.size ? `?${params}` : ''}`)
  }
  const label = (options: BorrowerOption[], code: string) => options.find(o => o.code === code)?.nameTh || code || '—'

  async function showForm(borrower?: BorrowerRow, readOnly = false) {
    setCardNationalId(borrower?.cardReadAt ? borrower.nationalId : null)
    setHasMiddleName(Boolean(borrower?.middleNameTh || borrower?.middleNameEn));
    setLineQrImage(null); setSocialChanged([]);
    setSelected(borrower ?? null); setViewOnly(readOnly); setError(''); setNotice(''); setCardReadToken(''); setReadCardOpen(false)
    setCard(null)
    setOpen(true)
    if (borrower?.cardReadAt) {
      try {
        const response = await fetch(`/api/borrowers/${borrower.id}/card`)
        if (response.ok) setCard((await response.json()).card as ThaiIdCard | null)
      } catch { /* Card data is optional; the borrower profile remains available. */ }
    }
    if (borrower) {
      const values = initialForm()
      for (const key of Object.keys(values) as (keyof typeof values)[]) values[key] = borrower[key] === null ? '' : String(borrower[key])
      for (const key of socialKeys) if (!socialUrl(values[key])) values[key] = ''
      values.registeredAt = borrower.registeredAt.slice(0, 10)
      setForm(values)
    } else setForm(initialForm())
  }

  async function chooseLineQr(file?: File) {
    if (!file) return
    setError('')
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) { setError('กรุณาเลือกรูป PNG, JPG หรือ WebP'); return }
    if (file.size > maxLineQrBytes) { setError('รูป QR ต้องมีขนาดไม่เกิน 2 MB'); return }
    setQrLoading(true)
    try {
      const bitmap = await createImageBitmap(file)
      const tooLarge = bitmap.width > 4096 || bitmap.height > 4096
      bitmap.close()
      if (tooLarge) throw new Error('รูป QR ต้องมีขนาดไม่เกิน 4096 × 4096 พิกเซล')
      const image = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => resolve(String(reader.result))
        reader.onerror = () => reject(new Error('อ่านไฟล์ไม่ได้ กรุณาเลือกไฟล์ใหม่'))
        reader.readAsDataURL(file)
      })
      setLineQrImage(image)
    } catch (err) { setError(err instanceof DOMException ? 'ไฟล์รูป QR อ่านไม่ได้ กรุณาเลือก PNG, JPG หรือ WebP ที่ถูกต้อง' : err instanceof Error ? err.message : 'ไฟล์รูป QR ไม่ถูกต้อง') }
    finally { setQrLoading(false) }
  }

  useEffect(() => {
    let active = true
    if (!readCardOpen || viewOnly || cardReadToken) {
      queueMicrotask(() => { if (active) setDetectingCard(false) })
      return () => { active = false }
    }
    let controller: AbortController | null = null
    async function watchReader() {
      await Promise.resolve()
      if (!active) return
      setDetectingCard(true)
      while (active) {
        controller = new AbortController()
        try {
          const response = await fetch('/api/borrowers/card', { signal: controller.signal, cache: 'no-store' })
          const result = await response.json()
          if (!response.ok) throw new Error(result.message || 'ตรวจจับเครื่องอ่านบัตรไม่สำเร็จ')
          if (!active) return
          if (!result.cardPresent) continue

          setDetectingCard(false)
          setReading(true)
          const readResponse = await fetch('/api/borrowers/card', { method: 'POST' })
          const readResult = await readResponse.json()
          if (!readResponse.ok) throw new Error(readResult.message || 'อ่านบัตรไม่สำเร็จ')
          if (selected?.cardReadAt && selected.nationalId !== readResult.card.nationalId) throw new Error('เลขบัตรไม่ตรงกับผู้กู้ที่บันทึกไว้ ไม่สามารถเปลี่ยนเลขบัตรประชาชนได้')
          if (active) {
            setCardNationalId(readResult.card.nationalId)
            setForm(current => ({ ...current, nationalId: readResult.card.nationalId }))
            setCard(readResult.card as ThaiIdCard)
            setCardReadToken(readResult.token)
            toast({ title: 'อ่านบัตรสำเร็จ', description: 'ตรวจสอบข้อมูลก่อนนำไปใช้กับผู้กู้ยืม', variant: 'success' })
          }
          return
        } catch (err) {
          if (!active) return
          const message = err instanceof Error ? err.message : 'ตรวจจับเครื่องอ่านบัตรไม่สำเร็จ'
          toast({ title: 'อ่านบัตรไม่สำเร็จ', description: message, variant: 'error', duration: 7000 })
          return
        } finally {
          setReading(false)
        }
      }
    }

    void watchReader().finally(() => { if (active) setDetectingCard(false) })
    return () => {
      active = false
      controller?.abort()
    }
  }, [readCardOpen, viewOnly, cardReadToken, cardDetectionAttempt, toast, selected])

  function retryCardDetection() {
    if (reading || detectingCard || viewOnly) return
    setCard(null)
    setCardReadToken('')
    setCardDetectionAttempt(attempt => attempt + 1)
  }

  function applyCardToForm() {
    if (!card || !cardReadToken) return
    const province = provinces.find(p => card.address.replace(/\s/g, '').includes(p.nameTh.replace(/\s/g, '')))
    setForm(current => ({ ...current, nationalId: card.nationalId, firstName: card.firstName, lastName: card.lastName, titleTh: card.titleTh, middleNameTh: card.middleNameTh || '', titleEn: card.titleEn || '', firstNameEn: card.firstNameEn || '', middleNameEn: card.middleNameEn || '', lastNameEn: card.lastNameEn || '', birthDate: cardDateInput(card.birthDate), address: card.address, cardIssueDate: cardDateInput(card.issueDate), cardExpiryDate: cardDateInput(card.expiryDate), districtId: '', subdistrictId: '', provinceId: province ? String(province.id) : current.provinceId }))
    setHasMiddleName(Boolean(card.middleNameTh || card.middleNameEn))
    setReadCardOpen(false)
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
    if (busy || reading || qrLoading || viewOnly) return
    setBusy(true); setError('')
    try {
      const response = await fetch('/api/borrowers', { method: selected ? 'PUT' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...form, districtId: form.districtId ? Number(form.districtId) : null, subdistrictId: form.subdistrictId ? Number(form.subdistrictId) : null, ...Object.fromEntries(socialKeys.map(key => [key, !socialChanged.includes(key) && selected && !socialUrl(selected[key]) ? selected[key] : form[key]])), ...(lineQrImage !== null ? { lineQrImage } : {}), cardReadToken: cardReadToken || undefined, id: selected?.id, provinceId: form.provinceId ? Number(form.provinceId) : null, approvedLimit: Number(form.approvedLimit), usedLimit: Number(form.usedLimit), durationMonths: Number(form.durationMonths) }) })
      const result = await response.json()
      if (!response.ok) throw new Error(result.message || 'บันทึกไม่สำเร็จ')
      setOpen(false); setNotice(selected ? 'แก้ไขข้อมูลผู้กู้ยืมเรียบร้อยแล้ว' : 'เพิ่มข้อมูลผู้กู้ยืมเรียบร้อยแล้ว'); router.refresh()
    } catch (err) { setError(err instanceof Error ? err.message : 'ไม่สามารถเชื่อมต่อ กรุณาลองอีกครั้ง') }
    finally { setBusy(false) }
  }

  return <div className="borrower-workspace space-y-5">
    <div className="borrower-metrics">
      {[
        { icon: UsersRound, title: 'ผู้กู้ยืมทั้งหมด', value: money(aggregate.total), unit: 'คน', detail: `ใช้งาน ${money(aggregate.active)} คน`, tone: 'blue' },
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
        <div><div className="borrower-directory-heading"><h2>รายชื่อผู้กู้ยืม</h2><span className="borrower-count">{total}</span></div><p className="mt-1 text-xs text-slate-500">ข้อมูลทั้งหมด {total} รายการ · วงเงินเป็นบาท</p></div>
        {canCreate && <Button variant="primary" onClick={() => showForm()}><Plus size={16} />เพิ่มผู้กู้ยืม</Button>}
      </div>
      {notice && <p role="status" className="mx-5 mb-3 rounded-xl bg-emerald-50 p-3 text-sm text-emerald-700">{notice}</p>}
      <div className="borrower-toolbar flex flex-wrap gap-3 px-5 py-4">
        <form className="flex min-w-60 flex-1 gap-2" onSubmit={e => { e.preventDefault(); navigate(1) }}><label className="relative flex-1"><span className="sr-only">ค้นหาผู้กู้ยืม</span><Search className="absolute left-3 top-3 text-slate-400" size={17} /><input className={`${fieldClass} mt-0 pl-10`} placeholder="ค้นหาชื่อ เบอร์โทร เลขบัตร หรือคนแนะนำ" value={query} onChange={e => setQuery(e.target.value)} /></label><Button type="submit">ค้นหา</Button></form>
        <label><span className="sr-only">กรองสถานะ</span><select className={`${fieldClass} mt-0`} value={status} onChange={e => { setStatus(e.target.value); navigate(1, query, e.target.value) }}><option value="">ทุกสถานะ</option>{Object.entries(borrowerStatuses).map(([key, title]) => <option key={key} value={key}>{title}</option>)}</select></label>
      </div>
      <div className="borrower-table-scroll overflow-x-auto" role="region" aria-label="ตารางผู้กู้ยืม เลื่อนแนวนอนเพื่อดูทุกคอลัมน์" tabIndex={0}>
        <table className="w-full whitespace-nowrap text-left text-xs">
          <thead><tr>{headers.map(h => <th key={h} scope="col" className="px-4 py-4 font-medium" data-numeric={h.includes("Limit") || undefined}>{h}</th>)}</tr></thead>
          <tbody className="divide-y divide-slate-200/60">{visible.map(b => <tr key={b.id} className="hover:bg-white/50">
            <td className="borrower-row-actions px-4 py-3"><div className="flex gap-2"><Button aria-label={`ดูรายละเอียด ${b.firstName}`} onClick={() => showForm(b, true)}><Eye size={15} /></Button>{canCreate && <><Button variant="edit" aria-label={`แก้ไข ${b.firstName}`} onClick={() => showForm(b)}><Pencil size={15} /></Button><Button variant="danger" aria-label={`ลบ ${b.firstName}`} onClick={() => { setDeleting(b); setError(''); setNotice('') }}><Trash2 size={15} /></Button></>}</div></td>
            {[b.borrowerId || `BR-${String(b.id).padStart(5, '0')}`, b.nickname, b.firstName, b.lastName, b.phone, b.nationalId || '', b.workplace || '—'].map((value, i) => <td key={i} className="px-4 py-4">{value}</td>)}
            <td className="px-4 py-4">{provinces.find(p => p.id === b.provinceId)?.nameTh || '—'}</td>
            <td className="px-4 py-4"><span className={`rounded-full px-2.5 py-1 ${b.status === 'ACTIVE' ? 'bg-emerald-50 text-emerald-700' : b.status === 'BLACKLIST' ? 'bg-rose-50 text-rose-700' : 'bg-slate-100 text-slate-600'}`}>{borrowerStatuses[b.status]}</span></td>
            {[label(banks, b.bankCode), b.bankAccount || '—', b.bankAccountName || '—', promptPayTypes[b.promptPayType] || '—', b.promptPayNumber || '—', label(channels, b.paymentChannelCode), new Intl.DateTimeFormat('th-TH', { timeZone: 'Asia/Bangkok' }).format(new Date(b.registeredAt)), borrowerTenure(b.registeredAt, today)].map((value, i) => <td key={i} className="px-4 py-4">{value}</td>)}
            <td className="px-4 py-4"><SocialLink value={b.facebook} label="Facebook" /></td>
            <td className="px-4 py-4"><SocialLink value={b.instagram} label="Instagram" /></td>
            <td className="px-4 py-4"><div className="flex items-center gap-2">{b.line && <SocialLink value={b.line} label="Line" />}{b.hasLineQr && <Button onClick={() => setQrViewing({ src: `/api/borrowers/${b.id}/line-qr`, name: b.nickname })} aria-label={`ดู QR Line ของ ${b.nickname}`}><QrCode size={14} />QR</Button>}{!b.line && !b.hasLineQr && '—'}</div></td>
            <td className="px-4 py-4">{label(ratings, b.riskRatingCode)}</td>
            {[b.approvedLimit, b.usedLimit, availableBorrowerLimit(b.approvedLimit, b.usedLimit)].map((value, i) => <td key={i} className={`px-4 py-4 text-right tabular-nums ${i === 2 ? 'borrower-available font-semibold' : ''}`}>{money(value)}</td>)}
            <td className="px-4 py-4">{b.referrer || '—'}</td>
          </tr>)}</tbody>
        </table>
      </div>
      {!visible.length && <div className="borrower-empty">
        <span className="borrower-empty-icon"><UsersRound size={30} strokeWidth={1.3} /></span>
        <h3>{total ? 'ไม่พบรายชื่อที่ค้นหา' : 'เริ่มต้นดูแลผู้กู้ยืมของคุณ'}</h3>
        <p>{total ? 'ลองเปลี่ยนคำค้นหาหรือเลือกสถานะอื่น' : 'เพิ่มข้อมูลผู้กู้ยืม เพื่อจัดการข้อมูลติดต่อและติดตามวงเงินในที่เดียว'}</p>
        {total ? <Button onClick={() => { setQuery(''); setStatus(''); navigate(1, '', '') }}>ล้างการค้นหา</Button> : canCreate && <Button variant="primary" onClick={() => showForm()}><Plus size={15} />เพิ่มผู้กู้ยืมคนแรก<ArrowUpRight size={15} /></Button>}
      </div>}
      <div className="borrower-pagination flex flex-wrap items-center justify-between gap-3 border-t border-slate-200/60 p-4 text-xs text-slate-500"><span>พบ {total} รายการ · หน้า {currentPage} / {pages}</span><div className="flex gap-2"><Button disabled={currentPage === 1} onClick={() => navigate(currentPage - 1)}><ChevronLeft size={14} />ก่อนหน้า</Button><Button disabled={currentPage === pages} onClick={() => navigate(currentPage + 1)}>ถัดไป<ChevronRight size={14} /></Button></div></div>
    </Card>
    {open && <dialog ref={openDialog} onCancel={event => { if (busy || reading || qrLoading) event.preventDefault(); else setOpen(false) }} className="borrower-dialog fixed inset-0 m-auto max-h-[90dvh] w-[calc(100%-2rem)] max-w-3xl overflow-y-auto rounded-3xl p-6" aria-labelledby="borrower-title">
      <div className="borrower-dialog-heading">
        <h2 id="borrower-title" className="text-lg font-semibold">{viewOnly ? 'รายละเอียดผู้กู้ยืม' : selected ? 'แก้ไขผู้กู้ยืม' : 'เพิ่มผู้กู้ยืม'}</h2>
        <div className="borrower-dialog-tools">
          {(card || !viewOnly) && <button type="button" className="borrower-card-trigger" aria-label={card ? 'ดูข้อมูลบัตรประชาชน' : 'อ่านบัตรประชาชน'} title={card ? 'ดูข้อมูลบัตรประชาชน' : 'อ่านบัตรประชาชน'} disabled={busy || reading || qrLoading} onClick={() => setReadCardOpen(true)}><CreditCard size={20} /><span className="sr-only">{card ? 'ดูข้อมูลบัตรประชาชน' : 'อ่านบัตรประชาชน'}</span>{card && <span className="borrower-card-indicator" aria-hidden="true" />}</button>}
          <button type="button" className="borrower-close" aria-label="ปิดฟอร์ม" disabled={busy || reading || qrLoading} onClick={() => setOpen(false)}><X size={19} /></button>
        </div>
      </div>
      <p className="mb-5 mt-1 text-xs text-slate-500">{selected ? `${selected.borrowerId || `BR-${String(selected.id).padStart(5, '0')}`} · ${viewOnly ? 'ข้อมูลสำหรับอ่านอย่างเดียว' : 'ช่องที่มี * จำเป็นต้องระบุ'}` : 'รหัสผู้กู้ยืมจะสร้างอัตโนมัติหลังบันทึก · ช่องที่มี * จำเป็นต้องระบุ'}</p>
      <form onSubmit={submit}>
        <fieldset disabled={busy || reading || qrLoading || viewOnly} className="grid gap-4 sm:grid-cols-2">
          <legend className="borrower-form-section">ข้อมูลบัตรประชาชน</legend>
          <div className="borrower-identity-photo sm:col-span-2">{card?.photo ? <Image unoptimized src={card.photo} alt="รูปผู้กู้จากบัตรประชาชน" width={120} height={152} className="rounded-xl object-cover" /> : <div className="borrower-identity-placeholder"><CreditCard size={30} /><span>ยังไม่มีรูป</span></div>}<div><p className="text-sm font-medium">รูป</p><p className="mt-2 text-xs text-slate-500">อ่านบัตรจากไอคอนด้านบนเพื่อนำรูปและข้อมูลจากชิปมาใช้</p></div></div>
          <label className="text-xs sm:col-span-2">เลขบัตรประชาชน<input className={fieldClass} inputMode="numeric" pattern="[0-9]{13}" maxLength={13} readOnly={cardNationalId !== null} aria-describedby={cardNationalId !== null ? 'borrower-national-id-locked' : undefined} value={form.nationalId} onChange={e => setForm({ ...form, nationalId: e.target.value })} />{cardNationalId !== null && <span id="borrower-national-id-locked" className="mt-2 block text-xs text-slate-500">เลขบัตรจากชิปบัตรประชาชน · ไม่สามารถแก้ไขได้</span>}</label>
          {([
            { title: 'titleTh', first: 'firstName', last: 'lastName', language: 'ภาษาไทย', options: ['นาย', 'นาง', 'นางสาว', 'เด็กชาย', 'เด็กหญิง', 'ดร.', 'ศ.', 'รศ.', 'ผศ.'] },
            { title: 'titleEn', first: 'firstNameEn', last: 'lastNameEn', language: 'ภาษาอังกฤษ', options: ['Mr.', 'Mrs.', 'Ms.', 'Miss', 'Master', 'Dr.', 'Prof.', 'Assoc. Prof.', 'Asst. Prof.'] },
          ] as const).map(({ title, first, last, language, options }) => <div key={title} className="borrower-name-row sm:col-span-2">
            <label className="text-xs">คำนำหน้า{language}<select className={fieldClass} value={form[title]} onChange={e => setForm({ ...form, [title]: e.target.value })}><option value="">เลือกคำนำหน้า</option>{form[title] && !(options as readonly string[]).includes(form[title]) && <option value={form[title]}>{form[title]}</option>}{options.map(value => <option key={value} value={value}>{value}</option>)}</select></label>
            <label className="text-xs">ชื่อ{language}<input className={fieldClass} maxLength={200} value={form[first]} onChange={e => setForm({ ...form, [first]: e.target.value })} /></label>
            <label className="text-xs">สกุล{language}<input className={fieldClass} maxLength={200} value={form[last]} onChange={e => setForm({ ...form, [last]: e.target.value })} /></label>
          </div>)}
          <label className="borrower-middle-toggle sm:col-span-2"><input type="checkbox" checked={hasMiddleName} onChange={e => { setHasMiddleName(e.target.checked); if (!e.target.checked) setForm({ ...form, middleNameTh: '', middleNameEn: '' }) }} aria-controls="borrower-middle-names" />มีชื่อกลาง</label>
          {hasMiddleName && <div id="borrower-middle-names" className="grid gap-4 sm:grid-cols-2 sm:col-span-2"><label className="text-xs">ชื่อกลางภาษาไทย<input className={fieldClass} maxLength={200} value={form.middleNameTh} onChange={e => setForm({ ...form, middleNameTh: e.target.value })} /></label><label className="text-xs">ชื่อกลางภาษาอังกฤษ<input className={fieldClass} maxLength={200} value={form.middleNameEn} onChange={e => setForm({ ...form, middleNameEn: e.target.value })} /></label></div>}
          <label className="text-xs">วันเกิด<input type="date" max={today} className={fieldClass} value={form.birthDate} onChange={e => setForm({ ...form, birthDate: e.target.value })} /></label>
          <div className="borrower-form-section sm:col-span-2">ที่อยู่</div>
          <label className="text-xs sm:col-span-2">ที่อยู่ตามบัตร<textarea className={fieldClass} rows={2} maxLength={200} value={form.address} onChange={e => setForm({ ...form, address: e.target.value })} /></label>
          <label className="text-xs">เลขที่บ้าน<input className={fieldClass} maxLength={200} value={form.houseNumber} onChange={e => setForm({ ...form, houseNumber: e.target.value })} /></label>
          <label className="text-xs">หมู่ที่<input className={fieldClass} maxLength={200} value={form.villageNumber} onChange={e => setForm({ ...form, villageNumber: e.target.value })} /></label>
          <p className="text-xs text-slate-500 sm:col-span-2">เลือกจังหวัดก่อน ตามด้วยอำเภอและตำบลจากข้อมูลหลัก</p>
          <label className="text-xs sm:col-span-2">จังหวัด<select className={fieldClass} value={form.provinceId} onChange={e => setForm({ ...form, provinceId: e.target.value, districtId: '', subdistrictId: '' })}><option value="">ยังไม่ระบุจังหวัด</option>{provinces.map(p => <option key={p.id} value={p.id}>{p.nameTh}</option>)}</select></label>
          <LocationSelect label="อำเภอ" parent={form.provinceId} parentKey="provinceId" value={form.districtId} onChange={value => setForm({ ...form, districtId: value, subdistrictId: '' })} />
          <LocationSelect label="ตำบล" parent={form.districtId} parentKey="districtId" value={form.subdistrictId} onChange={value => setForm({ ...form, subdistrictId: value })} />
          <label className="text-xs">วันออกบัตร<input type="date" className={fieldClass} value={form.cardIssueDate} onChange={e => setForm({ ...form, cardIssueDate: e.target.value })} /></label>
          <label className="text-xs">วันหมดอายุ<input type="date" min={form.cardIssueDate || undefined} className={fieldClass} value={form.cardExpiryDate} onChange={e => setForm({ ...form, cardExpiryDate: e.target.value })} /></label>
          <div className="borrower-form-section sm:col-span-2">การติดต่อ</div>
          <label className="text-xs">เบอร์มือถือ<input type="tel" inputMode="numeric" className={fieldClass} maxLength={10} pattern="0[0-9]{8,9}" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} /></label>
          <label className="text-xs">ชื่อเล่น *<input required className={fieldClass} maxLength={200} value={form.nickname} onChange={e => setForm({ ...form, nickname: e.target.value })} /></label>
          <label className="text-xs">ที่ทำงาน<input className={fieldClass} maxLength={200} value={form.workplace} onChange={e => setForm({ ...form, workplace: e.target.value })} /></label>
          <label className="text-xs">คนแนะนำ<input className={fieldClass} maxLength={200} value={form.referrer} onChange={e => setForm({ ...form, referrer: e.target.value })} /></label>
          <div className="borrower-form-section sm:col-span-2">ช่องทาง Social และ Line QR</div>
          {socialKeys.map(key => <label key={key} className="text-xs">{key === 'facebook' ? 'ลิงก์ Facebook' : key === 'instagram' ? 'ลิงก์ Instagram' : 'ลิงก์ Line'}<input type="url" className={fieldClass} maxLength={2048} placeholder={key === 'facebook' ? 'https://www.facebook.com/...' : key === 'instagram' ? 'https://www.instagram.com/...' : 'https://line.me/ti/p/...'} value={form[key]} onChange={e => { setForm({ ...form, [key]: e.target.value }); setSocialChanged(current => current.includes(key) ? current : [...current, key]) }} />{selected?.[key] && !socialUrl(selected[key]) && !socialChanged.includes(key) && <span className="mt-1 block text-xs text-slate-500">ข้อมูลเดิม: {socialStatus(selected[key])}</span>}{viewOnly && socialUrl(form[key]) && <span className="mt-2 block"><SocialLink value={form[key]} label={key === 'facebook' ? 'Facebook' : key === 'instagram' ? 'Instagram' : 'Line'} /></span>}</label>)}
          <div className="borrower-qr-upload sm:col-span-2">
            <div><h3 className="text-sm font-medium">QR สำหรับเพิ่มเพื่อนใน Line</h3><p className="mt-1 text-xs text-slate-500">PNG, JPG หรือ WebP · สูงสุด 2 MB · บันทึกรูปเมื่อบันทึกผู้กู้ยืม</p></div>
            {qrSrc ? <div className="mt-4 flex flex-wrap items-start gap-4"><button type="button" aria-label="ขยายรูป QR Line" onClick={() => setQrViewing({ src: qrSrc, name: form.nickname })}><Image unoptimized src={qrSrc} alt="QR สำหรับเพิ่มเพื่อนใน Line" width={152} height={152} className="borrower-qr-image" /></button>{!viewOnly && <Button variant="danger" onClick={() => setLineQrImage('')}><Trash2 size={14} />ลบรูป QR</Button>}</div> : <p className="my-3 text-xs text-slate-500">ยังไม่มีรูป QR Line</p>}
            {!viewOnly && <label className="mt-4 block text-xs">{qrLoading ? 'กำลังอ่านรูป…' : qrSrc ? 'เปลี่ยนรูป QR' : 'อัปโหลดรูป QR'}<span className="mt-2 flex items-center gap-2"><Upload size={16} /><input type="file" accept="image/png,image/jpeg,image/webp" aria-label="อัปโหลดรูป QR Line" disabled={busy || reading || qrLoading} onChange={e => { const file = e.target.files?.[0]; e.target.value = ''; void chooseLineQr(file) }} className="min-w-0 max-w-full text-xs" /></span></label>}
          </div>
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
        <div className="mt-6 flex justify-end gap-2"><Button disabled={busy || reading || qrLoading} onClick={() => setOpen(false)}>{viewOnly ? 'ปิด' : 'ยกเลิก'}</Button>{viewOnly ? canCreate && <Button variant="primary" onClick={() => setViewOnly(false)}><Pencil size={15} />แก้ไขข้อมูล</Button> : <Button type="submit" variant="primary" disabled={busy || reading || qrLoading}>{busy ? 'กำลังบันทึก…' : 'บันทึกผู้กู้ยืม'}</Button>}</div>
      </form>
    </dialog>}
    <ReadCardModal
      open={readCardOpen}
      card={card}
      reading={reading}
      detecting={detectingCard}
      pendingSave={Boolean(cardReadToken)}
      savedAt={selected?.cardReadAt ?? null}
      readAllowed={!viewOnly}
      onClose={() => { if (!reading) setReadCardOpen(false) }}
      onRetry={retryCardDetection}
      onUse={applyCardToForm}
    />
    {qrViewing && <dialog ref={openDialog} onCancel={() => setQrViewing(null)} className="borrower-dialog borrower-qr-dialog fixed inset-0 m-auto w-[calc(100%-2rem)] max-w-md rounded-3xl p-6" aria-labelledby="line-qr-title"><button type="button" className="borrower-close" aria-label="ปิดรูป QR" onClick={() => setQrViewing(null)}><X size={19} /></button><h2 id="line-qr-title" className="pr-10 text-lg font-semibold">Line QR · {qrViewing.name}</h2><Image unoptimized src={qrViewing.src} alt={`QR Line ของ ${qrViewing.name}`} width={360} height={360} className="borrower-qr-image mt-5 w-full" /><p className="mt-4 text-center text-xs text-slate-500">เปิด Line แล้วสแกน QR เพื่อเพิ่มเพื่อน</p></dialog>}
    {deleting && <dialog ref={openDialog} onCancel={event => { if (busy) event.preventDefault(); else setDeleting(null) }} className="borrower-dialog fixed inset-0 m-auto w-[calc(100%-2rem)] max-w-md rounded-3xl p-6" aria-labelledby="delete-borrower-title">
      <h2 id="delete-borrower-title" className="text-lg font-semibold">ยืนยันลบผู้กู้ยืม</h2>
      <p className="my-4 text-sm leading-7">ต้องการลบ {deleting.borrowerId} · {deleting.firstName} {deleting.lastName} หรือไม่? การลบนี้ไม่สามารถกู้คืนได้</p>
      {deleting.usedLimit > 0 && <p className="text-sm text-amber-200">มีวงเงินใช้งานอยู่ ไม่สามารถลบรายการนี้ได้</p>}
      {error && <p role="alert" className="mt-3 text-sm text-rose-300">{error}</p>}
      <div className="mt-6 flex justify-end gap-2"><Button disabled={busy} onClick={() => setDeleting(null)}>ยกเลิก</Button><Button variant="danger" disabled={busy || deleting.usedLimit > 0} onClick={() => void remove()}>{busy ? 'กำลังลบ…' : 'ยืนยันลบ'}</Button></div>
    </dialog>}
  </div>
}
