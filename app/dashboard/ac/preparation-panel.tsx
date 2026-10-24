'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { checklistLabels, emptyChecklist, type Checklist, type ChecklistKey, type ClosingDocumentInfo } from '@/lib/closing-preparation-types'
import { saveMonthPreparation } from './preparation-actions'
export function PreparationPanel({ month, version, initial, initialNote, documents, locked, canWrite }: { month: string; version: number; initial: Checklist | null; initialNote: string; documents: ClosingDocumentInfo[]; locked: boolean; canWrite: boolean }) {
  const router = useRouter()
  const [checklist, setChecklist] = useState(initial ?? emptyChecklist())
  const [note, setNote] = useState(initialNote)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [category, setCategory] = useState('STATEMENT')
  const [uploadKey, setUploadKey] = useState('')
  const field = 'mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm'
  return <div className="space-y-5">
    <div><h3 className="font-semibold">แฟ้ม ปิดดุล / {month.slice(0, 4)} / {month.slice(5)}</h3><p className="mt-2 text-sm text-slate-600">ต้นฉบับยังอยู่กับสัญญาและรายการรับ–จ่าย เมื่อปิดเดือนจะเก็บสำเนาเอกสารชุดนี้พร้อมยอดสรุป เอกสารที่แนบเพิ่มเก็บถาวรพร้อมประวัติผู้แนบ</p></div>
    <details><summary className="cursor-pointer text-sm font-semibold">เอกสารประจำเดือน · {documents.length} รายการ</summary><ul className="mt-3 max-h-80 space-y-2 overflow-y-auto">{documents.map(doc => <li key={doc.sourceKey} className="flex flex-wrap justify-between gap-2 rounded-xl border border-slate-200 p-3 text-sm"><a href={doc.url} target="_blank" rel="noreferrer" className="break-all text-blue-700 underline">{doc.name}</a><span className="text-xs text-slate-500">{doc.archived ? 'เก็บสำเนาแล้ว' : doc.available ? 'เชื่อมจากต้นฉบับ' : 'ตรวจต้นฉบับประกอบ'}</span></li>)}</ul>{!documents.length && <p className="mt-3 text-sm text-slate-500">ยังไม่มีเอกสารที่เกี่ยวข้องกับเดือนนี้ สามารถแนบ Statement หรือหลักฐานเพิ่มเติมด้านล่าง</p>}</details>
    {locked && <a href={`/api/accounting/months/${month}/archive`} className="inline-block rounded-xl border border-slate-300 px-4 py-2 text-sm text-blue-700">ดาวน์โหลดชุดปิดเดือน (.zip)</a>}
    {canWrite && !locked && <form className="space-y-3 rounded-xl bg-slate-50 p-4" onSubmit={async e => {
      e.preventDefault(); if (busy || !file) return; setBusy(true); setMessage('')
      try {
        const key = uploadKey || crypto.randomUUID(); setUploadKey(key)
        const data = new FormData(); data.set('month', month); data.set('category', category); data.set('requestKey', key); data.set('file', file)
        const response = await fetch('/api/accounting/documents', { method: 'POST', body: data })
        const result = await response.json()
        if (!response.ok) { setMessage(result.error ?? 'แนบไฟล์ไม่สำเร็จ'); return }
        setFile(null); setUploadKey(''); setMessage('เก็บเอกสารแล้ว'); router.refresh()
      } catch { setMessage('เชื่อมต่อไม่สำเร็จ กรุณาลองอีกครั้ง') } finally { setBusy(false) }
    }}><fieldset disabled={busy} className="grid gap-3 sm:grid-cols-3"><label className="text-sm">ประเภทเอกสาร<select className={field} value={category} onChange={e => { setCategory(e.target.value); setUploadKey('') }}>{[['STATEMENT', 'Statement ธนาคาร'], ['INVOICE', 'ใบแจ้งหนี้'], ['RECEIPT', 'ใบเสร็จรับเงิน'], ['SIGNED_CONTRACT', 'สัญญาลงนาม'], ['ASSET', 'ทะเบียนทรัพย์สิน'], ['INVENTORY', 'รายงานสินค้าคงเหลือ'], ['OTHER', 'เอกสารอื่น']].map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label><label className="text-sm">ไฟล์ PDF / JPG / PNG ไม่เกิน 5 MB<input required type="file" accept="application/pdf,image/jpeg,image/png" className={field} onChange={e => { setFile(e.target.files?.[0] ?? null); setUploadKey('') }} /></label><button className="self-end rounded-xl bg-slate-800 px-4 py-2 text-sm text-white">{busy ? 'กำลังบันทึก…' : 'แนบเอกสารเดือนนี้'}</button></fieldset></form>}
    <form className="space-y-4" onSubmit={async e => {
      e.preventDefault(); if (busy || locked || !canWrite) return; setBusy(true); setMessage('')
      try { const result = await saveMonthPreparation({ month, expectedVersion: version, checklist, note }); setMessage(result.message); if (result.ok) { router.refresh(); document.getElementById('month-totals')?.scrollIntoView({ behavior: 'smooth', block: 'start' }) } }
      catch { setMessage('บันทึกไม่สำเร็จ กรุณาลองอีกครั้ง') } finally { setBusy(false) }
    }}><h3 className="font-semibold">1. ตรวจเอกสารก่อนปิดเดือน {version > 0 ? '· บันทึกแล้ว' : '· ยังไม่บันทึก'}</h3><fieldset disabled={locked || !canWrite || busy} className="space-y-3">{(Object.keys(checklistLabels) as ChecklistKey[]).map(key => <div key={key} className="grid gap-3 rounded-xl border border-slate-200 p-3 sm:grid-cols-[2fr_1fr_2fr]"><label className="self-center text-sm" htmlFor={`check-${key}`}>{checklistLabels[key]}</label><select id={`check-${key}`} aria-label={`สถานะ ${checklistLabels[key]}`} className={field} value={checklist[key].status} onChange={e => setChecklist(prev => ({ ...prev, [key]: { ...prev[key], status: e.target.value as Checklist[ChecklistKey]['status'] } }))}><option value="PENDING">รอตรวจ</option><option value="DONE">ตรวจแล้ว</option><option value="NA">ไม่เกี่ยวข้อง</option></select><label className="text-xs text-slate-600">หลักฐาน / เหตุผล<input maxLength={1000} required={checklist[key].status === 'NA'} className={field} value={checklist[key].note} onChange={e => setChecklist(prev => ({ ...prev, [key]: { ...prev[key], note: e.target.value } }))} /></label></div>)}<label className="block text-sm">หมายเหตุเตรียมปิดดุล<textarea maxLength={2000} className={field} value={note} onChange={e => setNote(e.target.value)} /></label>{!locked && canWrite && <button className="rounded-xl border border-slate-300 px-4 py-2 text-sm">{busy ? 'กำลังบันทึก…' : 'บันทึกการตรวจ → ไปตรวจยอด'}</button>}</fieldset></form>
    {message && <p role="status" className="text-sm text-blue-800">{message}</p>}
  </div>
}
