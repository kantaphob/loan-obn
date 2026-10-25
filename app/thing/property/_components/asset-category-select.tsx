'use client'

import Link from 'next/link'
import { useId, useState } from 'react'
import { activeCategoryTree, categoryChain, categoryPath, type AssetCategory } from '../categories'

type Props = { categories: AssetCategory[]; initialCode?: string; disabled?: boolean; onChange: (code: string) => void }

export function AssetCategorySelect({ categories, initialCode = '', disabled, onChange }: Props) {
  const id = useId()
  const [selection, setSelection] = useState(() => categoryChain(initialCode, categories).map((item) => item.code))
  const active = activeCategoryTree(categories)
  const levels: { label: string; options: AssetCategory[]; selected: string }[] = []
  let parentCode: string | null = null
  for (let depth = 0; depth <= selection.length; depth++) {
    const options = active.filter((item) => item.parentCode === parentCode)
    const selected = selection[depth] ?? ''
    if (!options.length && !selected) break
    levels.push({ label: depth === 0 ? 'ประเภทสินทรัพย์' : depth === 1 ? 'หมวดหมู่สินทรัพย์' : depth === 2 ? 'หมวดหมู่ย่อย' : `หมวดหมู่ย่อยระดับ ${depth}`, options, selected })
    if (!selected) break
    parentCode = selected
  }
  const code = selection.at(-1) ?? ''
  const complete = Boolean(code && !active.some((item) => item.parentCode === code))
  function select(depth: number, value: string) {
    const next = selection.slice(0, depth)
    if (value) next.push(value)
    setSelection(next)
    onChange(value && !active.some((item) => item.parentCode === value) ? value : '')
  }
  return <fieldset className="space-y-3 rounded-xl border border-slate-300/30 bg-slate-100/40 p-4" disabled={disabled}>
    <legend className="px-1 text-xs font-semibold">การจัดประเภทตาม Masterdata</legend>
    {levels.map((level, depth) => <div key={depth}>
      <label htmlFor={`${id}-${depth}`} className="mb-1.5 block text-xs font-medium">{level.label} *</label>
      <select id={`${id}-${depth}`} required value={level.selected} onChange={(event) => select(depth, event.target.value)} className="min-h-11 w-full rounded-xl border border-slate-300/30 bg-white px-3 text-sm outline-none focus:border-blue-400">
        <option value="">เลือก{level.label}</option>
        {level.selected && !level.options.some((item) => item.code === level.selected) && <option value={level.selected} disabled>{categories.find((item) => item.code === level.selected)?.nameTh ?? level.selected} (ปิดใช้งาน / ไม่มีหมวดแม่)</option>}
        {level.options.map((item) => <option key={item.code} value={item.code}>{item.nameTh}</option>)}
      </select>
    </div>)}
    {!levels.length && <p className="m-0 text-xs text-amber-700">ยังไม่มีประเภทสินทรัพย์ที่เปิดใช้งาน</p>}
    <p className="m-0 text-[11px] leading-6 text-slate-500" aria-live="polite">{complete ? `หมวดที่เลือก: ${categoryPath(code, categories)}` : 'เลือกประเภทหลักก่อน แล้วเลือกหมวดหมู่ตามลำดับ'}</p>
    <Link href="/dashboard/admin/masterdata/asset-category" target="_blank" rel="noopener noreferrer" className="inline-block text-[11px] text-blue-600 underline underline-offset-4">จัดการหมวดหมู่ใน Masterdata</Link>
  </fieldset>
}
