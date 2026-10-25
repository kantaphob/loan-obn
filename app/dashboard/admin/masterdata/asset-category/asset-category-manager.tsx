'use client'

import { useState, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import { FolderPlus, Pencil, Plus, Trash2 } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Modal } from '@/components/ui/modal'
import { descendantCodes } from '@/lib/asset-category-validation'

export type AssetCategoryItem = { code: string; nameTh: string; nameEn: string; description: string; parentCode: string | null; sortOrder: number }
type Actions = { canEdit: boolean; add: (parentCode?: string) => void; edit: (item: AssetCategoryItem) => void; remove: (item: AssetCategoryItem) => void }
const blank = { code: '', nameTh: '', nameEn: '', description: '', parentCode: '', sortOrder: 0 }
const inputClass = 'mt-1.5 min-h-11 w-full rounded-xl border border-slate-300/30 bg-white/60 px-3 text-sm text-slate-700 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-200/40 disabled:opacity-60'

function CategoryTree({ item, items, actions, root = false }: { item: AssetCategoryItem; items: AssetCategoryItem[]; actions: Actions; root?: boolean }) {
  const children = items.filter((child) => child.parentCode === item.code)
  return <>
    <div className={`flex flex-wrap items-start justify-between gap-3 ${root ? 'border-b border-slate-300/20 p-5' : 'py-3'}`}>
      <div className="min-w-0 flex-1 basis-48">
        {root ? <h2 className="m-0 text-base font-semibold text-slate-100">{item.nameTh}</h2> : <p className="m-0 text-sm font-semibold text-slate-100">{item.nameTh}</p>}
        {item.nameEn && <p className="mb-0 mt-1 text-[11px] text-slate-400">{item.nameEn}</p>}
        {item.description && <p className="mb-0 mt-2 text-xs leading-6 text-slate-400">{item.description}</p>}
      </div>
      {actions.canEdit && <div className="flex flex-wrap gap-1.5">
        <Button aria-label={`เพิ่มหมวดย่อยใน ${item.nameTh}`} onClick={() => actions.add(item.code)}><FolderPlus size={14} aria-hidden="true" /><span>เพิ่มย่อย</span></Button>
        <Button variant="edit" aria-label={`แก้ไข ${item.nameTh}`} onClick={() => actions.edit(item)}><Pencil size={14} aria-hidden="true" /></Button>
        <Button variant="danger" aria-label={`ลบ ${item.nameTh}`} disabled={children.length > 0} title={children.length ? 'ย้ายหรือลบหมวดย่อยก่อนลบหมวดนี้' : `ลบ ${item.nameTh}`} onClick={() => actions.remove(item)}><Trash2 size={14} aria-hidden="true" /></Button>
      </div>}
    </div>
    {children.length > 0 && <ul className={root ? 'divide-y divide-slate-300/15 px-5 pb-3' : 'ml-2 border-l border-slate-300/25 pl-4'}>
      {children.map((child) => <li key={child.code}><CategoryTree item={child} items={items} actions={actions} /></li>)}
    </ul>}
  </>
}

export function AssetCategoryManager({ categories, canEdit }: { categories: AssetCategoryItem[]; canEdit: boolean }) {
  const router = useRouter()
  const [form, setForm] = useState(blank)
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState(false)
  const [deleting, setDeleting] = useState<AssetCategoryItem | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const excluded = editing ? descendantCodes(form.code, categories) : new Set<string>()
  const parentOptions = categories.filter((item) => !excluded.has(item.code))
  function showForm(item?: AssetCategoryItem, parentCode = '') {
    setForm(item ? { ...item, parentCode: item.parentCode ?? '' } : { ...blank, parentCode })
    setEditing(Boolean(item)); setError(''); setOpen(true)
  }
  async function save(method: 'POST' | 'PUT' | 'DELETE') {
    if (busy) return
    setBusy(true); setError(''); setNotice('')
    try {
      const response = await fetch('/api/masterdata/asset-categories', {
        method, headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(method === 'DELETE' ? { code: deleting?.code } : { ...form, parentCode: form.parentCode || null }),
      })
      const result = await response.json()
      if (!response.ok) throw new Error(result.message || 'บันทึกไม่สำเร็จ')
      setOpen(false); setDeleting(null)
      setNotice(method === 'DELETE' ? 'ลบหมวดหมู่สินทรัพย์แล้ว' : 'บันทึกหมวดหมู่สินทรัพย์แล้ว')
      router.refresh()
    } catch (error) { setError(error instanceof Error ? error.message : 'บันทึกไม่สำเร็จ กรุณาลองอีกครั้ง') }
    finally { setBusy(false) }
  }
  function submit(event: FormEvent<HTMLFormElement>) { event.preventDefault(); void save(editing ? 'PUT' : 'POST') }
  const actions: Actions = {
    canEdit, add: (parentCode) => showForm(undefined, parentCode), edit: (item) => showForm(item),
    remove: (item) => { setDeleting(item); setError('') },
  }
  const roots = categories.filter((item) => !item.parentCode)
  function path(item: AssetCategoryItem) {
    const labels = [item.nameTh], visited = new Set([item.code])
    let parentCode = item.parentCode
    while (parentCode && !visited.has(parentCode)) {
      visited.add(parentCode)
      const parent = categories.find((candidate) => candidate.code === parentCode)
      if (!parent) break
      labels.unshift(parent.nameTh); parentCode = parent.parentCode
    }
    return labels.join(' / ')
  }
  return <>
    <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
      <p role="status" className="m-0 text-xs text-slate-600">{notice || `${categories.length} รายการ · ${roots.length} ประเภทหลัก`}</p>
      {canEdit && <Button variant="primary" onClick={() => showForm()}><Plus size={15} aria-hidden="true" />เพิ่มหมวดหมู่สินทรัพย์</Button>}
    </div>
    <div className="space-y-4">
      {roots.map((root) => <Card key={root.code} as="section" className="overflow-hidden"><CategoryTree root item={root} items={categories} actions={actions} /></Card>)}
      {!roots.length && <Card className="p-10 text-center text-sm text-slate-400">ยังไม่มีหมวดหมู่สินทรัพย์</Card>}
    </div>
    <Modal open={open} title={editing ? 'แก้ไขหมวดหมู่สินทรัพย์' : 'เพิ่มหมวดหมู่สินทรัพย์'} description="เลือกหมวดแม่เพื่อสร้างหมวดย่อย หรือเลือกประเภทหลักเพื่อสร้างกลุ่มใหม่" onClose={() => { if (!busy) setOpen(false) }}>
      <form onSubmit={submit} className="space-y-4">
        <label className="block text-xs font-medium">ชื่อภาษาไทย *<input autoFocus required maxLength={120} disabled={busy} value={form.nameTh} onChange={(e) => setForm({ ...form, nameTh: e.target.value })} className={inputClass} /></label>
        <label className="block text-xs font-medium">ชื่อภาษาอังกฤษ<input maxLength={120} disabled={busy} value={form.nameEn} onChange={(e) => setForm({ ...form, nameEn: e.target.value })} className={inputClass} /></label>
        <label className="block text-xs font-medium">หมวดแม่<select disabled={busy} value={form.parentCode} onChange={(e) => setForm({ ...form, parentCode: e.target.value })} className={inputClass}><option value="">ไม่มีหมวดแม่ (ประเภทหลัก)</option>{parentOptions.map((item) => <option key={item.code} value={item.code}>{path(item)}</option>)}</select></label>
        <label className="block text-xs font-medium">คำอธิบาย<textarea rows={3} maxLength={1000} disabled={busy} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className={`${inputClass} py-3`} /></label>
        <label className="block text-xs font-medium">ลำดับแสดงผล<input required type="number" min={0} max={99999} step={1} disabled={busy} value={form.sortOrder} onChange={(e) => setForm({ ...form, sortOrder: e.target.valueAsNumber })} className={inputClass} /></label>
        <p className="text-[11px] text-slate-400">{editing ? `รหัสอ้างอิง: ${form.code} (เปลี่ยนไม่ได้)` : 'ระบบสร้างรหัสอ้างอิงให้อัตโนมัติ'}</p>
        {error && <p role="alert" className="text-xs text-rose-600">{error}</p>}
        <div className="flex justify-end gap-2"><Button disabled={busy} onClick={() => setOpen(false)}>ยกเลิก</Button><Button type="submit" variant="primary" disabled={busy}>{busy ? 'กำลังบันทึก…' : 'บันทึก'}</Button></div>
      </form>
    </Modal>
    <Modal open={Boolean(deleting)} title="ลบหมวดหมู่สินทรัพย์" onClose={() => { if (!busy) setDeleting(null) }}>
      <p className="text-sm leading-6">ต้องการลบ “{deleting?.nameTh}” หรือไม่? รายการจะถูกซ่อนจากตัวเลือก โดยเก็บข้อมูลเดิมไว้</p>
      {error && <p role="alert" className="text-xs text-rose-600">{error}</p>}
      <div className="mt-5 flex justify-end gap-2"><Button disabled={busy} onClick={() => setDeleting(null)}>ยกเลิก</Button><Button variant="danger" disabled={busy} onClick={() => void save('DELETE')}>{busy ? 'กำลังลบ…' : 'ยืนยันลบ'}</Button></div>
    </Modal>
  </>
}
