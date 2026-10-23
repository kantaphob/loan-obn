'use client'

import { useState, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowDownLeft, ArrowUpRight, Pencil, Plus, Trash2 } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Modal } from '@/components/ui/modal'
import { Button } from '@/components/ui/button'

type Category = { code: string; nameTh: string; nameEn: string | null; group: string; direction: string; sortOrder: number }
const groups = { CAPITAL: 'เงินทุน', LOAN: 'สินเชื่อ', INCOME: 'รายรับ', EXPENSE: 'รายจ่าย' }
const empty = { code: '', nameTh: '', nameEn: '', group: 'CAPITAL', direction: 'IN', sortOrder: 0 }
const field = 'mt-1.5 min-h-11 w-full rounded-xl border border-white/15 px-3 text-sm outline-none focus:border-sky-300/60'

export function CategoryManager({ categories, canEdit }: { categories: Category[]; canEdit: boolean }) {
  const router = useRouter()
  const [form, setForm] = useState(empty)
  const [editing, setEditing] = useState(false)
  const [open, setOpen] = useState(false)
  const [deleting, setDeleting] = useState<Category | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  function showForm(category?: Category, group = 'CAPITAL') {
    setForm(category ? { ...category, nameEn: category.nameEn ?? '' } : { ...empty, group })
    setEditing(Boolean(category)); setError(''); setOpen(true)
  }
  async function save(method: 'POST' | 'PUT' | 'DELETE') {
    if (busy) return
    setBusy(true); setError(''); setNotice('')
    try {
      const response = await fetch('/api/masterdata/categories', { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(method === 'DELETE' ? { code: deleting?.code } : form) })
      const result = await response.json()
      if (!response.ok) throw new Error(result.message ?? 'บันทึกไม่สำเร็จ')
      setOpen(false); setDeleting(null)
      setNotice(method === 'DELETE' ? 'ลบหมวดหมู่แล้ว' : 'บันทึกหมวดหมู่แล้ว')
      router.refresh()
    } catch (error) { setError(error instanceof Error ? error.message : 'บันทึกไม่สำเร็จ กรุณาลองอีกครั้ง') }
    finally { setBusy(false) }
  }
  function submit(event: FormEvent<HTMLFormElement>) { event.preventDefault(); void save(editing ? 'PUT' : 'POST') }

  return <>
    <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
      <p role="status" className="m-0 text-xs text-emerald-200">{notice || `${categories.length} หมวดหมู่`}</p>
      {canEdit && <Button variant="primary" onClick={() => showForm()}><Plus size={15} />เพิ่มหมวดหมู่</Button>}
    </div>
    <div className="mb-4 grid gap-4 lg:grid-cols-2">
      {Object.entries(groups).map(([group, label]) => {
        const items = categories.filter((item) => item.group === group)
        return <Card key={group} as="section" className="overflow-hidden">
          <div className="flex items-center justify-between border-b border-white/10 px-5 py-4"><h2 className="m-0 text-sm font-semibold">{label}</h2><span className="text-xs text-slate-400">{items.length} รายการ</span></div>
          {items.map((category) => <div key={category.code} className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 px-5 py-4 last:border-0">
            <div className="min-w-0 flex-1 basis-40"><p className="m-0 break-words text-xs font-medium text-slate-100">{category.nameTh}</p><p className="mb-0 mt-1 break-words text-[10px] text-slate-400">{category.nameEn ? `${category.nameEn} · ` : ''}{category.code}</p></div>
            <div className="flex items-center gap-2">
              <span className={`inline-flex min-h-8 items-center gap-1 rounded-full border px-2.5 text-xs ${category.direction === 'IN' ? 'border-emerald-300/30 bg-emerald-300/10 text-emerald-200' : 'border-orange-300/30 bg-orange-300/10 text-orange-200'}`}>{category.direction === 'IN' ? <ArrowDownLeft size={14} /> : <ArrowUpRight size={14} />}{category.direction === 'IN' ? 'เงินเข้า' : 'เงินออก'}</span>
              {canEdit && <><Button variant="edit" aria-label={`แก้ไข ${category.nameTh}`} onClick={() => showForm(category)}><Pencil size={14} /></Button><Button variant="danger" aria-label={`ลบ ${category.nameTh}`} onClick={() => { setDeleting(category); setError('') }}><Trash2 size={14} /></Button></>}
            </div>
          </div>)}
          {!items.length && <p className="px-5 py-6 text-center text-xs text-slate-400">ยังไม่มีหมวดหมู่</p>}
          {canEdit && <div className="border-t border-white/10 px-5 py-3"><Button onClick={() => showForm(undefined, group)}><Plus size={14} />เพิ่มใน{label}</Button></div>}
        </Card>
      })}
    </div>
    <Modal open={open} title={editing ? 'แก้ไขหมวดหมู่' : 'เพิ่มหมวดหมู่'} onClose={() => { if (!busy) setOpen(false) }}>
      <form onSubmit={submit} className="space-y-4">
        <label className="block text-xs">รหัสหมวดหมู่ *<input autoFocus required disabled={editing || busy} value={form.code} maxLength={60} minLength={2} pattern="[A-Za-z0-9_]{2,60}" onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })} className={field} /><span className="mt-1 block text-[10px] text-slate-400">A–Z, 0–9 และ _ · รหัสเปลี่ยนไม่ได้หลังสร้าง</span></label>
        <label className="block text-xs">ชื่อภาษาไทย *<input required disabled={busy} value={form.nameTh} maxLength={120} onChange={(e) => setForm({ ...form, nameTh: e.target.value })} className={field} /></label>
        <label className="block text-xs">ชื่อภาษาอังกฤษ<input disabled={busy} value={form.nameEn} maxLength={120} onChange={(e) => setForm({ ...form, nameEn: e.target.value })} className={field} /></label>
        <div className="grid grid-cols-2 gap-3"><label className="text-xs">กลุ่ม<select disabled={busy} value={form.group} onChange={(e) => setForm({ ...form, group: e.target.value })} className={field}>{Object.entries(groups).map(([key, value]) => <option key={key} value={key}>{value}</option>)}</select></label><label className="text-xs">ทิศทางเงิน<select disabled={busy} value={form.direction} onChange={(e) => setForm({ ...form, direction: e.target.value })} className={field}><option value="IN">เงินเข้า</option><option value="OUT">เงินออก</option></select></label></div>
        <label className="block text-xs">ลำดับแสดงผล<input required type="number" min={0} max={99999} step={1} disabled={busy} value={form.sortOrder} onChange={(e) => setForm({ ...form, sortOrder: e.target.valueAsNumber })} className={field} /></label>
        {error && <p role="alert" className="text-xs text-rose-200">{error}</p>}
        <div className="flex justify-end gap-2"><Button disabled={busy} onClick={() => setOpen(false)}>ยกเลิก</Button><Button type="submit" variant="primary" disabled={busy}>{busy ? 'กำลังบันทึก…' : 'บันทึก'}</Button></div>
      </form>
    </Modal>
    <Modal open={Boolean(deleting)} title="ลบหมวดหมู่" onClose={() => { if (!busy) setDeleting(null) }}>
      <p className="text-sm leading-6 text-slate-200">ต้องการลบ “{deleting?.nameTh}” หรือไม่? หมวดหมู่นี้จะถูกซ่อนจากรายการ โดยเก็บข้อมูลเดิมไว้และไม่สามารถใช้รหัสซ้ำได้</p>
      {error && <p role="alert" className="text-xs text-rose-200">{error}</p>}
      <div className="mt-5 flex justify-end gap-2"><Button disabled={busy} onClick={() => setDeleting(null)}>ยกเลิก</Button><Button variant="danger" disabled={busy} onClick={() => void save('DELETE')}>{busy ? 'กำลังลบ…' : 'ยืนยันลบ'}</Button></div>
    </Modal>
  </>
}
