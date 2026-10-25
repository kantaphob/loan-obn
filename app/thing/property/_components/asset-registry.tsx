'use client'

import { useState } from 'react'
import { BadgeDollarSign, Boxes, Pencil, Plus, Trash2, RotateCcw } from 'lucide-react'
import { PageContainer } from '@/components/ui/page-container'
import { Header } from '@/components/ui/header'
import { Card } from '@/components/ui/card'
import { Modal } from '@/components/ui/modal'
import { Button } from '@/components/ui/button'
import { createLandDevelopmentPayment, saveAssetWorkspace } from '@/app/thing/_shared/actions'
import { categoryChain, categoryKind, categoryPath, type AssetCategory } from '../categories'
import { money, newHome, today, type AssetData, type Home } from '@/app/thing/_shared/model'
import { AssetForm, type AssetFormValues } from '@/app/thing/asset/_components/asset-form'
import { LandDevelopmentManager, type DevelopmentPaymentDraft } from '@/app/thing/asset/_components/land-improvement-manager'
import type { LandDevelopment, LedgerOption } from '@/app/thing/_shared/model'

type Props = { initial: AssetData; categories: AssetCategory[]; canWrite: boolean; ledger: LedgerOption[]; financialCategories: { code: string; nameTh: string; direction: string }[]; channels: { code: string; nameTh: string }[]; mode?: 'masterdata' | 'basic'; view?: 'active' | 'archived' }

function landPriceGrowth(item: Home) {
  const comparisonType = item.landDetails?.priceType ?? 'market_appraisal'
  const appraisals = (item.landDetails?.priceHistory ?? [])
    .filter(row => row.type === comparisonType && row.amount > 0)
    .toSorted((a, b) => a.date.localeCompare(b.date))
  const latest = appraisals.at(-1) ?? (item.landValue > 0 && item.landDetails?.priceType === comparisonType && item.landDetails.valuationOn
    ? { amount: item.landValue, date: item.landDetails.valuationOn, source: item.landDetails.valuationSource, type: comparisonType, notes: '' }
    : undefined)
  const previous = appraisals.length > 1 ? appraisals.at(-2) : item.purchasePrice > 0 ? { amount: item.purchasePrice, date: item.purchasedOn, source: '', type: 'purchase' as const, notes: '' } : undefined
  if (!latest) return { message: item.purchasePrice > 0 ? 'บันทึกราคาประเมินเพื่อเทียบกับราคาซื้อ' : 'บันทึกราคาประเมินเพื่อเริ่มดูการเติบโต' }
  if (!previous || previous.amount <= 0) return { message: 'บันทึกราคาประเมินครั้งถัดไปเพื่อดูการเติบโต' }
  const difference = Math.round((latest.amount - previous.amount) * 100) / 100
  return { difference, percent: difference / previous.amount * 100, comparison: previous.type === 'purchase' ? 'เทียบกับราคาซื้อ' : 'เทียบกับราคาประเภทเดียวกันครั้งก่อน' }
}

export function AssetRegistry({ initial, categories, canWrite, ledger, financialCategories, channels, mode = 'masterdata', view = 'active' }: Props) {
  const [data, setData] = useState(initial)
  const [editing, setEditing] = useState<Home | null>(null)
  const [priceOnly, setPriceOnly] = useState(false)
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [deleting, setDeleting] = useState<Home | null>(null)
  const showArchived = view === 'archived'
  const usedLedgerIds = [...data.homes.flatMap(home => [...home.boq.map(row => row.ledgerEntryId), ...(home.landDevelopments ?? []).flatMap(work => work.payments.map(payment => payment.ledgerEntryId))]), ...data.loans.flatMap(loan => loan.payments.map(payment => payment.ledgerEntryId))].filter((id): id is number => Boolean(id))
  const visible = data.homes.filter(item => showArchived ? Boolean(item.archivedOn) : !item.archivedOn)
  const priceGrowth = (item: Home) => {
    const growth = landPriceGrowth(item)
    if ('message' in growth) return <p className="m-0 text-slate-500">{growth.message}</p>
    const direction = growth.difference > 0 ? 'เพิ่มขึ้น' : growth.difference < 0 ? 'ลดลง' : 'ไม่เปลี่ยนแปลง'
    const sign = growth.difference > 0 ? '+' : ''
    return <p className={`m-0 font-medium ${growth.difference > 0 ? 'text-emerald-700' : growth.difference < 0 ? 'text-rose-700' : 'text-slate-600'}`}>{direction} {sign}{money(growth.difference)} บาท ({sign}{growth.percent.toLocaleString('th-TH', { maximumFractionDigits: 2 })}%) · {growth.comparison}</p>
  }
  function show(item?: Home, updatePrice = false) { setEditing(item ?? null); setPriceOnly(updatePrice); setError(''); setOpen(true) }
  async function saveDetails(fields: AssetFormValues) {
    await persist(fields.name, fields.categoryCode, editing?.categoryCode === fields.categoryCode ? editing.vehicleType : undefined, fields.land)
  }
  async function persist(assetName: string, categoryCode: string, vehicleType?: Home['vehicleType'], land?: AssetFormValues['land']) {
    if (!categoryCode || busy || !canWrite) return
    setBusy(true); setError('')
    try {
      const kind = categoryKind(categoryCode, categories)
      if (editing && editing.kind !== kind && (editing.landValue || editing.costSource === 'boq' || editing.valuations?.some((item) => item.landValue) || editing.landDevelopments?.length)) throw new Error('สินทรัพย์นี้มีมูลค่าที่ดิน BOQ หรืองานพัฒนาที่ดินอยู่ กรุณาเลือกหมวดอสังหาริมทรัพย์ที่สอดคล้องกับข้อมูลเดิม')
      const asset: Home = { ...(editing ?? newHome(assetName.trim(), kind)), ...land, name: assetName.trim(), categoryCode, kind, vehicleType: kind === 'vehicle' ? vehicleType : undefined }
      if (land?.landDetails && asset.landDetails) {
        const history = [...(editing?.landDetails?.priceHistory ?? [])]
        const previous = editing?.landDetails
        if (!history.length && editing && editing.landValue > 0 && previous?.valuationOn && previous.valuationSource) history.push({ amount: editing.landValue, date: previous.valuationOn, source: previous.valuationSource, type: previous.priceType ?? 'appraisal', notes: previous.priceNotes ?? '' })
        const detail = asset.landDetails
        if (asset.landValue > 0) {
          const row = { amount: asset.landValue, date: detail.valuationOn, source: detail.valuationSource, type: detail.priceType ?? 'appraisal', notes: detail.priceNotes ?? '' }
          const last = history.at(-1)
          if (!last || JSON.stringify(last) !== JSON.stringify(row)) history.push(row)
        }
        asset.landDetails = { ...detail, priceHistory: history }
      }
      const next = { ...data, homes: editing ? data.homes.map((item) => item.id === asset.id ? asset : item) : [...data.homes, asset] }
      const result = await saveAssetWorkspace(next, editing ? 'แก้ไขรายละเอียดและหมวดหมู่สินทรัพย์' : 'เพิ่มสินทรัพย์และหมวดหมู่จาก Masterdata')
      if (!result.data) throw new Error(result.error || 'บันทึกไม่สำเร็จ')
      setData(result.data); setOpen(false); setNotice(priceOnly ? `อัปเดตราคาของ “${assetName.trim()}” และเก็บประวัติแล้ว` : 'บันทึกสินทรัพย์และหมวดหมู่แล้ว')
    } catch (error) { setError(error instanceof Error ? error.message : 'บันทึกไม่สำเร็จ') }
    finally { setBusy(false) }
  }
  async function archive(item: Home, remove: boolean) {
    if (busy || !canWrite) return
    setBusy(true); setError(''); setNotice('')
    try {
      const next = { ...data, homes: data.homes.map(row => row.id === item.id ? { ...row, archivedOn: remove ? today() : undefined } : row) }
      const result = await saveAssetWorkspace(next, `${remove ? 'ลบสินทรัพย์แบบกู้คืนได้' : 'กู้คืนสินทรัพย์'}: ${item.name}`)
      if (!result.data) throw new Error(result.error || 'บันทึกไม่สำเร็จ')
      setData(result.data); setDeleting(null)
      setNotice(remove ? `ลบ “${item.name}” แล้ว กู้คืนได้จากรายการที่ลบ` : `กู้คืน “${item.name}” แล้ว`)
    } catch (error) { setError(error instanceof Error ? error.message : 'บันทึกไม่สำเร็จ') }
    finally { setBusy(false) }
  }
  async function saveLandDevelopment(landId: string, improvement: LandDevelopment) {
    if (busy || !canWrite) throw new Error('ไม่สามารถบันทึกรายการนี้ได้')
    setBusy(true); setError('')
    try {
      const next = { ...data, homes: data.homes.map(home => home.id === landId ? { ...home, landDevelopments: [...(home.landDevelopments ?? []).filter(row => row.id !== improvement.id), improvement] } : home) }
      const result = await saveAssetWorkspace(next, `บันทึกงานภายนอก/ปรับปรุงที่ดิน: ${improvement.name}`)
      if (!result.data) throw new Error(result.error || 'บันทึกไม่สำเร็จ')
      setData(result.data); setNotice(`บันทึกรายการงาน “${improvement.name}” แล้ว`)
    } catch (caught) { const message = caught instanceof Error ? caught.message : 'บันทึกไม่สำเร็จ'; setError(message); throw new Error(message) }
    finally { setBusy(false) }
  }
  async function createDevelopmentPayment(landId: string, work: LandDevelopment, payment: DevelopmentPaymentDraft) {
    if (busy || !canWrite) throw new Error('ไม่สามารถบันทึกรายการนี้ได้')
    setBusy(true); setError('')
    try {
      const result = await createLandDevelopmentPayment({ requestKey: crypto.randomUUID(), paymentId: crypto.randomUUID(), landId, developmentId: work.id, direction: payment.direction, categoryCode: payment.categoryCode, amount: payment.amount, occurredOn: payment.occurredOn, channelCode: payment.channelCode, reference: payment.reference, note: payment.note, paymentType: payment.paymentType }, payment.slip)
      if ('error' in result) throw new Error(result.error || 'บันทึกรายจ่ายไม่สำเร็จ')
      setData(result.data)
      setNotice(`บันทึก${payment.direction === 'IN' ? 'รายรับคืน' : 'รายจ่าย'} ${money(Number(payment.amount))} บาทในรับ–จ่ายแล้ว · TX-${String(result.entryId).padStart(6, '0')} · ผูกกับ ${work.name}`)
    } catch (caught) { const message = caught instanceof Error ? caught.message : 'บันทึกรายการรับ–จ่ายไม่สำเร็จ'; setError(message); throw new Error(message) }
    finally { setBusy(false) }
  }
  return <PageContainer>
    <Header title={showArchived ? 'รายการที่ลบ' : mode === 'basic' ? 'Asset' : 'สินทรัพย์'} icon={showArchived ? <Trash2 size={21} /> : <Boxes size={21} />} description={showArchived ? 'สินทรัพย์ที่ลบไว้และสามารถกู้คืนได้' : 'แสดงประเภทและหมวดหมู่ตาม Masterdata'} actions={canWrite && !showArchived ? <Button variant="primary" disabled={busy} onClick={() => show()}><Plus size={15} />เพิ่มสินทรัพย์</Button> : undefined} />
    <p role="status" className="mb-4 text-xs text-slate-500">{notice || `${visible.length} รายการ${showArchived ? 'ที่ลบ' : ''}`}</p>
    {error && !open && !deleting ? <p role="alert" className="mb-4 text-sm text-rose-600">{error}</p> : null}
    {!visible.length ? <Card className="p-8 text-center text-sm text-slate-500">{showArchived ? 'ไม่มีรายการที่ลบ' : 'ยังไม่มีสินทรัพย์ที่แสดง'}</Card> : null}
    <div className="space-y-3">{visible.map((item) => {
      const isLand = categoryChain(item.categoryCode, categories).some(category => category.code === 'LAND')
      return <Card key={item.id} className="p-5">
        <div className="flex flex-wrap items-start justify-between gap-3"><div className="min-w-0 flex-1"><h2 className="m-0 text-base font-semibold">{item.name}</h2><p className="mb-0 mt-1 text-xs font-medium text-blue-700">รหัสสินทรัพย์: {item.assetCode ?? 'สร้างอัตโนมัติเมื่อบันทึก'}</p><p className="mb-0 mt-2 text-xs leading-6 text-slate-500">ประเภทและหมวดหมู่: {categoryPath(item.categoryCode, categories)}</p>{item.landDetails ? <div className="mt-3 space-y-1 text-xs leading-6 text-slate-600"><p className="m-0">ราคาซื้อที่ดิน: {item.purchasePrice ? `${money(item.purchasePrice)} บาท` : 'ยังไม่ระบุ'} · ราคาที่บันทึกล่าสุด: {item.landValue ? `${money(item.landValue)} บาท` : 'ยังไม่ระบุ'}</p>{priceGrowth(item)}</div> : null}{item.archivedOn ? <p className="mb-0 mt-2 text-xs text-slate-500">ลบเมื่อ {item.archivedOn}</p> : null}</div>{canWrite && <div className="flex flex-wrap gap-2">{showArchived ? <Button disabled={busy} onClick={() => archive(item, false)} aria-label={`กู้คืน ${item.name}`}><RotateCcw size={14} />กู้คืน</Button> : <>{isLand ? <Button disabled={busy} onClick={() => show(item, true)} aria-label={`อัปเดตราคา ${item.name}`}><BadgeDollarSign size={14} />อัปเดตราคา</Button> : null}<Button disabled={busy} onClick={() => show(item)} aria-label={`แก้ไขหมวดหมู่ ${item.name}`}><Pencil size={14} />แก้ไข</Button><Button variant="danger" disabled={busy} onClick={() => { setError(''); setDeleting(item) }} aria-label={`ลบ ${item.name}`}><Trash2 size={14} />ลบ</Button></>}</div>}</div>
        {isLand && !showArchived ? <LandDevelopmentManager landId={item.id} landName={item.name} rows={item.landDevelopments ?? []} busy={busy} canWrite={canWrite} error={error} ledger={ledger} usedLedgerIds={usedLedgerIds} assets={data.homes} financialCategories={financialCategories} channels={channels} onSave={improvement => saveLandDevelopment(item.id, improvement)} onCreatePayment={(work, payment) => createDevelopmentPayment(item.id, work, payment)} /> : null}
      </Card>
    })}</div>
    <Modal open={open} title={priceOnly ? `อัปเดตราคา · ${editing?.name ?? ''}` : editing ? 'แก้ไขสินทรัพย์' : 'เพิ่มสินทรัพย์'} onClose={() => { if (!busy) setOpen(false) }}>
      <AssetForm key={`${editing?.id ?? 'new'}-${priceOnly ? 'price' : 'full'}`} initial={editing} categories={categories} busy={busy} error={error} priceOnly={priceOnly} onCancel={() => { if (!busy) setOpen(false) }} onSave={saveDetails} />
    </Modal>
    <Modal open={Boolean(deleting)} title="ยืนยันลบสินทรัพย์" onClose={() => { if (!busy) setDeleting(null) }}>
      <p className="text-sm leading-7">ต้องการลบ “{deleting?.name}” ออกจากรายการสินทรัพย์หรือไม่? สามารถกู้คืนได้จาก “รายการที่ลบ”</p>
      {deleting && data.loans.some(loan => loan.assetId === deleting.id) ? <p className="mt-3 rounded-xl bg-amber-50 p-3 text-xs leading-6 text-amber-800">สินทรัพย์นี้เชื่อมกับเงินกู้ธนาคาร ยอดหนี้และประวัติชำระจะยังคงอยู่</p> : null}
      {error ? <p role="alert" className="mt-3 text-xs text-rose-600">{error}</p> : null}
      <div className="mt-5 flex justify-end gap-2"><Button disabled={busy} onClick={() => setDeleting(null)}>ยกเลิก</Button><Button variant="danger" disabled={busy} onClick={() => deleting && archive(deleting, true)}>{busy ? 'กำลังลบ…' : 'ยืนยันลบ'}</Button></div>
    </Modal>
  </PageContainer>
}
