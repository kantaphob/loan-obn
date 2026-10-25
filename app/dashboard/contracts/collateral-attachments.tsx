'use client'

import { useToast } from '@/components/ui/toast'
import { useCallback, useEffect, useState, type FormEvent } from 'react'

type Attachment = { id: number; category: string; originalName: string; mimeType: string; sizeBytes: number; sha256: string; originalStatus: string; originalLocation: string | null; createdAt: string }
const categories = ['สำเนาบัตรประชาชน', 'เอกสารสิทธิทรัพย์', 'หลักฐานกรรมสิทธิ์', 'หนังสือยินยอม', 'ภาพถ่ายทรัพย์', 'หลักฐานรับมอบทรัพย์จำนำ', 'สัญญาจำนองที่จดทะเบียนแล้ว', 'อื่น ๆ']
const fieldClass = 'mt-1 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-sky-500/30'
const formatSize = (bytes: number) => bytes < 1024 * 1024 ? `${Math.max(1, Math.round(bytes / 1024))} KB` : `${(bytes / 1024 / 1024).toFixed(1)} MB`

export function CollateralAttachments({ contractId }: { contractId: number }) {
  const { toast } = useToast()
  const [items, setItems] = useState<Attachment[]>([])
  const [category, setCategory] = useState(categories[0])
  const [originalStatus, setOriginalStatus] = useState('PENDING')
  const [originalLocation, setOriginalLocation] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const endpoint = `/api/contracts/${contractId}/collateral-attachments`

  const refresh = useCallback(async () => {
    const response = await fetch(endpoint, { cache: 'no-store' })
    if (!response.ok) throw new Error('โหลดรายการเอกสารประกอบไม่สำเร็จ')
    setItems(await response.json() as Attachment[])
  }, [endpoint])

  useEffect(() => {
    let active = true
    fetch(endpoint, { cache: 'no-store' })
      .then(async response => { if (!response.ok) throw new Error('โหลดรายการเอกสารประกอบไม่สำเร็จ'); return response.json() as Promise<Attachment[]> })
      .then(values => { if (active) setItems(values) })
      .catch(error => { if (active) { const description = error instanceof Error ? error.message : 'โหลดรายการเอกสารประกอบไม่สำเร็จ'; setMessage(description); toast({ title: 'โหลดเอกสารไม่สำเร็จ', description, variant: 'error' }) } })
    return () => { active = false }
  }, [endpoint, toast])

  async function upload(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = event.currentTarget
    const file = (new FormData(form)).get('file')
    if (!(file instanceof File) || !file.size) { setMessage('เลือกไฟล์ PDF, JPG หรือ PNG ก่อนแนบ'); toast({ title: 'กรุณาเลือกไฟล์ก่อนแนบ', variant: 'warning' }); return }
    setBusy(true); setMessage('')
    const data = new FormData()
    data.set('file', file); data.set('category', category); data.set('originalStatus', originalStatus); data.set('originalLocation', originalLocation)
    try {
      const response = await fetch(endpoint, { method: 'POST', body: data })
      const result = await response.json() as { error?: string }
      if (!response.ok) throw new Error(result.error || 'แนบเอกสารไม่สำเร็จ')
      form.reset(); setOriginalStatus('PENDING'); setOriginalLocation('')
      await refresh(); setMessage('แนบสำเนาสแกนเก็บกับสัญญาแล้ว'); toast({ title: 'แนบเอกสารเรียบร้อยแล้ว', variant: 'success' })
    } catch (error) { setMessage(error instanceof Error ? error.message : 'แนบเอกสารไม่สำเร็จ'); toast({ title: 'แนบเอกสารไม่สำเร็จ', description: error instanceof Error ? error.message : undefined, variant: 'error' }) }
    finally { setBusy(false) }
  }

  return <section className="mt-4 space-y-3 rounded-xl border border-slate-200 bg-white p-3 sm:p-4" aria-labelledby={`collateral-attachments-${contractId}`}>
    <div>
      <h4 id={`collateral-attachments-${contractId}`} className="m-0 text-sm font-semibold">สำเนาเอกสารประกอบ 3.3</h4>
      <p className="mb-0 mt-1 text-xs leading-5 text-slate-600">แนบสำเนาสแกน PDF/JPG/PNG ได้ไม่เกิน 15 MB ต่อไฟล์ (รวมไม่เกิน 50 MB ต่อสัญญา) ระบบเก็บไฟล์ส่วนตัวไว้กับข้อมูลสัญญาในฐานข้อมูลและสำรองไปพร้อมกัน พร้อมบันทึก SHA-256 สำหรับตรวจความเปลี่ยนแปลง ส่วนต้นฉบับจริงให้เก็บในแฟ้มเอกสารตามที่ระบุ</p>
    </div>
    <form onSubmit={upload} className="grid gap-3 rounded-lg bg-slate-50 p-3 sm:grid-cols-2">
      <label className="text-xs font-medium text-slate-700">ประเภทเอกสาร
        <select value={category} onChange={event => setCategory(event.target.value)} className={fieldClass}>{categories.map(item => <option key={item}>{item}</option>)}</select>
      </label>
      <label className="text-xs font-medium text-slate-700">ไฟล์สแกน
        <input className={fieldClass} type="file" name="file" accept="application/pdf,image/jpeg,image/png,.pdf,.jpg,.jpeg,.png" required />
      </label>
      <label className="text-xs font-medium text-slate-700">สถานะต้นฉบับจริง
        <select value={originalStatus} onChange={event => setOriginalStatus(event.target.value)} className={fieldClass}><option value="PENDING">รอจัดเก็บต้นฉบับ</option><option value="STORED">เก็บต้นฉบับแล้ว</option></select>
      </label>
      <label className="text-xs font-medium text-slate-700">ที่เก็บต้นฉบับ {originalStatus === 'STORED' ? '(จำเป็น)' : '(ถ้ามี)'}
        <input value={originalLocation} onChange={event => setOriginalLocation(event.target.value)} className={fieldClass} maxLength={250} placeholder="เช่น แฟ้มสัญญา 3.3 ตู้เอกสาร A ช่อง 2" required={originalStatus === 'STORED'} />
      </label>
      <div className="sm:col-span-2"><button type="submit" disabled={busy} className="action-button action-button--secondary disabled:opacity-50">{busy ? 'กำลังแนบ…' : 'แนบสำเนาเอกสาร'}</button></div>
    </form>
    {message && <p role="status" className="m-0 text-xs text-slate-600">{message}</p>}
    {items.length > 0 ? <ul className="m-0 grid list-none gap-2 p-0">
      {items.map(item => <li key={item.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-200 px-3 py-2 text-xs">
        <div className="min-w-0"><p className="m-0 font-medium">{item.category} · {item.originalName}</p><p className="mb-0 mt-1 text-slate-500">{formatSize(item.sizeBytes)} · SHA-256 {item.sha256.slice(0, 12)}… · {item.originalStatus === 'STORED' ? `ต้นฉบับเก็บที่ ${item.originalLocation}` : 'ต้นฉบับรอจัดเก็บ'}</p></div>
        <div className="flex shrink-0 flex-wrap gap-x-3 gap-y-1"><a className="text-sky-700 underline underline-offset-2" href={`${endpoint}/${item.id}`}>ดาวน์โหลดต้นฉบับสแกน</a>{item.category === 'สำเนาบัตรประชาชน' && <a className="text-sky-700 underline underline-offset-2" href={`${endpoint}/${item.id}?watermark=1`}>ดาวน์โหลดสำเนาพร้อมลายน้ำ</a>}</div>
      </li>)}
    </ul> : <p className="m-0 text-xs text-slate-500">ยังไม่มีไฟล์สแกนแนบ</p>}
  </section>
}
