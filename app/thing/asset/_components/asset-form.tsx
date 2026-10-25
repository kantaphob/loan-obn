'use client'

import { useRef, useState, type FormEvent } from 'react'
import { Button } from '@/components/ui/button'
import { newHome, type Home } from '@/app/thing/_shared/model'
import { AssetCategorySelect } from '@/app/thing/property/_components/asset-category-select'
import { activeCategoryTree, categoryChain, categoryPath, type AssetCategory } from '@/app/thing/property/categories'
import { LandDetailsFields, readLandFields } from './land-details-fields'

export type AssetFormValues = { name: string; categoryCode: string; land?: Pick<Home, 'address' | 'purchasePrice' | 'purchasedOn' | 'landValue' | 'landDetails'> }

type Props = { initial: Home | null; categories: AssetCategory[]; busy: boolean; error: string; priceOnly?: boolean; onCancel: () => void; onSave: (fields: AssetFormValues) => Promise<void> }

/** One editor for creation and editing. Category-specific sections share its save flow. */
export function AssetForm({ initial, categories, busy, error, priceOnly = false, onCancel, onSave }: Props) {
  const [step, setStep] = useState<'category' | 'details'>(initial?.categoryCode ? 'details' : 'category')
  const [name, setName] = useState(initial?.name ?? '')
  const [categoryCode, setCategoryCode] = useState(initial?.categoryCode ?? '')
  const [landDraft, setLandDraft] = useState<Home | null>(initial)
  const formRef = useRef<HTMLFormElement>(null)
  const active = activeCategoryTree(categories)
  const complete = active.some(c => c.code === categoryCode) && !active.some(c => c.parentCode === categoryCode)
  const unchangedCategory = Boolean(initial?.categoryCode && categoryCode === initial.categoryCode)
  const canSave = complete || unchangedCategory
  const isLand = categoryChain(categoryCode, categories).some(c => c.code === 'LAND')

  function changeCategory() {
    if (busy) return
    if (isLand && formRef.current) {
      const fields = readLandFields(new FormData(formRef.current))
      setLandDraft({ ...(landDraft ?? newHome(name, 'house')), ...fields, landDetails: { ...fields.landDetails!, priceHistory: landDraft?.landDetails?.priceHistory } })
    }
    setStep('category')
  }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (busy) return
    if (step === 'category') { if (complete) setStep('details'); return }
    if (!name.trim() || !canSave) return
    const formLand = isLand ? readLandFields(new FormData(event.currentTarget)) : undefined
    const land = priceOnly && initial && formLand ? {
      ...formLand,
      address: initial.address,
      purchasePrice: initial.purchasePrice,
      purchasedOn: initial.purchasedOn,
      landDetails: {
        ...formLand.landDetails!,
        ...(initial.landDetails ?? {}),
        valuationOn: formLand.landDetails!.valuationOn,
        valuationSource: formLand.landDetails!.valuationSource,
        priceType: formLand.landDetails!.priceType,
        priceNotes: formLand.landDetails!.priceNotes,
        priceHistory: initial.landDetails?.priceHistory,
      },
    } : formLand
    await onSave({ name: name.trim(), categoryCode, land })
  }

  return <form ref={formRef} onSubmit={submit} className="space-y-4">
    {!priceOnly ? <ol aria-label="ขั้นตอนบันทึกสินทรัพย์" className="m-0 flex list-none gap-2 p-0 text-xs">
      <li aria-current={step === 'category' ? 'step' : undefined} className={`flex-1 rounded-lg px-3 py-2 ${step === 'category' ? 'bg-blue-50 font-semibold text-blue-800' : 'bg-slate-100 text-slate-500'}`}>1. เลือกหมวดหมู่</li>
      <li aria-current={step === 'details' ? 'step' : undefined} className={`flex-1 rounded-lg px-3 py-2 ${step === 'details' ? 'bg-blue-50 font-semibold text-blue-800' : 'bg-slate-100 text-slate-500'}`}>2. กรอกรายละเอียด</li>
    </ol> : null}
    {step === 'category' ? <>
      <AssetCategorySelect categories={categories} initialCode={categoryCode} disabled={busy} onChange={setCategoryCode} />
      <div className="flex justify-end gap-2"><Button disabled={busy} onClick={onCancel}>ยกเลิก</Button><Button key="next" variant="primary" type="submit" disabled={busy || !complete}>ถัดไป</Button></div>
    </> : <>
      {!priceOnly ? <><div className="rounded-xl border border-slate-200 bg-slate-50 p-3"><p className="m-0 text-xs leading-6 text-slate-600">หมวดหมู่: {categoryPath(categoryCode, categories)}</p><Button className="mt-2" disabled={busy} onClick={changeCategory}>เปลี่ยนหมวดหมู่</Button></div>
      <p className="text-xs text-slate-600">รหัสสินทรัพย์: {initial?.assetCode ?? 'ระบบสร้างตามหมวดหมู่เมื่อบันทึก'}</p>
      <label className="block text-xs font-medium">ชื่อสินทรัพย์ *<input name="name" autoFocus required maxLength={3000} disabled={busy} value={name} onChange={e => setName(e.target.value)} placeholder="เช่น บ้านของฉัน / รถของฉัน" className="mt-1.5 min-h-11 w-full rounded-xl border border-slate-300/30 px-3 text-sm" /></label></> : <p className="text-sm font-medium">{name}</p>}
      {isLand ? <LandDetailsFields initial={landDraft} busy={busy} priceOnly={priceOnly} /> : null}
      {error ? <p role="alert" className="text-xs text-rose-600">{error}</p> : null}
      <div className="flex justify-end gap-2">{!priceOnly ? <Button disabled={busy} onClick={changeCategory}>ย้อนกลับ</Button> : null}<Button disabled={busy} onClick={onCancel}>ยกเลิก</Button><Button key="save" variant="primary" type="submit" disabled={busy || !name.trim() || !canSave}>{busy ? 'กำลังบันทึก…' : priceOnly ? 'บันทึกราคา' : initial ? 'บันทึกการแก้ไข' : 'บันทึก'}</Button></div>
    </>}
  </form>
}
