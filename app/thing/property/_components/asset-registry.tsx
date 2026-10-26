'use client'

import { loanAssetIds } from '@/app/thing/_shared/model'

import { useState } from 'react'
import { BadgeDollarSign, Boxes, Pencil, Plus, Trash2, RotateCcw, History, Search } from 'lucide-react'
import { PageContainer } from '@/components/ui/page-container'
import { Header } from '@/components/ui/header'
import { Card } from '@/components/ui/card'
import { Modal } from '@/components/ui/modal'
import { Button } from '@/components/ui/button'
import { createBuildingProjectPayment, createLandDevelopmentPayment, saveAssetWorkspace } from '@/app/thing/_shared/actions'
import { categoryChain, categoryKind, categoryPath, type AssetCategory } from '../categories'
import { money, newHome, today, type AssetData, type Home } from '@/app/thing/_shared/model'
import { AssetForm, type AssetFormValues } from '@/app/thing/asset/_components/asset-form'
import { LandDevelopmentManager, type DevelopmentPaymentDraft } from '@/app/thing/asset/_components/land-improvement-manager'
import { VehicleManager } from '@/app/thing/asset/_components/vehicle-manager'
import { BuildingManager, type BuildingProjectPaymentDraft } from '@/app/thing/asset/_components/building-manager'
import type { BuildingProject, LandDevelopment, LedgerOption } from '@/app/thing/_shared/model'

type Props = { initial: AssetData; categories: AssetCategory[]; canWrite: boolean; ledger: LedgerOption[]; financialCategories: { code: string; nameTh: string; direction: string }[]; channels: { code: string; nameTh: string }[]; mode?: 'masterdata' | 'basic'; view?: 'active' | 'archived' }

function landPriceGrowth(item: Home) {
  const comparisonType = item.landDetails?.priceType ?? 'market_appraisal'
  const appraisals = landPriceHistory(item).filter(row => row.type === comparisonType && row.amount > 0)
  const latest = appraisals.at(-1)
  const previous = appraisals.length > 1 ? appraisals.at(-2) : item.purchasePrice > 0 ? { amount: item.purchasePrice, date: item.purchasedOn, source: '', type: 'purchase' as const, notes: '' } : undefined
  if (!latest) return { message: item.purchasePrice > 0 ? 'บันทึกราคาประเมินเพื่อเทียบกับราคาซื้อ' : 'บันทึกราคาประเมินเพื่อเริ่มดูการเติบโต' }
  if (!previous || previous.amount <= 0) return { message: 'บันทึกราคาประเมินครั้งถัดไปเพื่อดูการเติบโต' }
  const difference = Math.round((latest.amount - previous.amount) * 100) / 100
  return { difference, percent: difference / previous.amount * 100, comparison: previous.type === 'purchase' ? 'เทียบกับราคาซื้อ' : 'เทียบกับราคาประเภทเดียวกันครั้งก่อน' }
}

function latestLandPrice(item: Home) {
  const priceType = item.landDetails?.priceType ?? 'market_appraisal'
  const history = landPriceHistory(item).filter(row => row.type === priceType && row.amount > 0)
  return history.at(-1)?.amount ?? (item.landValue > 0 ? item.landValue : undefined)
}

function landPriceHistory(item: Home) {
  const details = item.landDetails
  const rows = [...(details?.priceHistory ?? [])]
  if (item.landValue > 0 && details?.valuationOn && details.valuationSource) {
    const current = { amount: item.landValue, date: details.valuationOn, source: details.valuationSource, type: details.priceType ?? 'appraisal', notes: details.priceNotes ?? '' }
    if (!rows.some(row => row.amount === current.amount && row.date === current.date && row.source === current.source && row.type === current.type)) rows.push(current)
  }
  return [
    ...(item.purchasePrice > 0 ? [{ amount: item.purchasePrice, date: item.purchasedOn, source: 'ราคาซื้อ', type: 'purchase' as const, notes: '' }] : []),
    ...rows,
  ].sort((a, b) => a.date.localeCompare(b.date))
}

function landAssetCostTotal(item: Home) {
  const capitalImprovements = (item.landDevelopments ?? []).filter(work => work.treatment === 'capital').reduce((sum, work) => sum + work.actualCost, 0)
  return { purchase: item.purchasePrice, improvements: capitalImprovements, total: item.purchasePrice + capitalImprovements }
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
  const [priceHistoryAsset, setPriceHistoryAsset] = useState<Home | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [assetFilter, setAssetFilter] = useState<'all' | 'land' | 'building' | 'vehicle' | 'other'>('all')
  const [selectedAssetId, setSelectedAssetId] = useState(initial.homes[0]?.id ?? '')
  const showArchived = view === 'archived'
  const usedLedgerIds = [...data.homes.flatMap(home => [...home.boq.map(row => row.ledgerEntryId), ...(home.landDevelopments ?? []).flatMap(work => work.payments.map(payment => payment.ledgerEntryId)), ...(home.buildingProjects ?? []).flatMap(project => project.payments.map(payment => payment.ledgerEntryId))]), ...data.loans.flatMap(loan => loan.payments.map(payment => payment.ledgerEntryId))].filter((id): id is number => Boolean(id))
  const activeAssets = data.homes.filter(item => showArchived ? Boolean(item.archivedOn) : !item.archivedOn)
  const visible = activeAssets.filter(item => {
    const isLand = categoryChain(item.categoryCode, categories).some(category => category.code === 'LAND')
    const matchesType = assetFilter === 'all' || assetFilter === 'land' && isLand || assetFilter === 'building' && item.kind === 'house' && !isLand || assetFilter === 'vehicle' && item.kind === 'vehicle' || assetFilter === 'other' && item.kind === 'other'
    const needle = searchQuery.trim().toLocaleLowerCase('th-TH')
    const matchesSearch = !needle || [item.name, item.assetCode ?? '', categoryPath(item.categoryCode, categories)].some(value => value.toLocaleLowerCase('th-TH').includes(needle))
    return matchesType && matchesSearch
  })
  const selectedAsset = visible.find(item => item.id === selectedAssetId) ?? visible[0]
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
  async function recordDevelopmentCost(landId: string, workId: string, record: { amount: number; date: string; note: string }) {
    if (busy || !canWrite) throw new Error('ไม่สามารถบันทึกต้นทุนจริงได้')
    setBusy(true); setError('')
    try {
      const work = data.homes.find(home => home.id === landId)?.landDevelopments?.find(row => row.id === workId)
      if (!work) throw new Error('ไม่พบรายการพัฒนาที่ดิน')
      const event = { id: crypto.randomUUID(), ...record }
      const next = { ...data, homes: data.homes.map(home => home.id === landId ? { ...home, landDevelopments: (home.landDevelopments ?? []).map(row => row.id === workId ? { ...row, actualCost: Math.round((row.actualCost + record.amount + Number.EPSILON) * 100) / 100, actualCostHistory: [...(row.actualCostHistory ?? []), event] } : row) } : home) }
      const result = await saveAssetWorkspace(next, `บันทึกต้นทุนจริงงานที่ดิน: ${work.name}`)
      if (!result.data) throw new Error(result.error || 'บันทึกไม่สำเร็จ')
      setData(result.data); setNotice(`บันทึก${work.treatment === 'expense' ? 'ค่าใช้จ่าย' : 'ต้นทุนปรับปรุง'}จริง ${money(record.amount)} บาทแล้ว`)
    } catch (caught) { const message = caught instanceof Error ? caught.message : 'บันทึกไม่สำเร็จ'; setError(message); throw new Error(message) }
    finally { setBusy(false) }
  }
  async function saveAssetPatch(assetId: string, patch: Partial<Home>, reason: string) {
    if (busy || !canWrite) throw new Error('ไม่สามารถบันทึกรายการสินทรัพย์ได้')
    setBusy(true); setError('')
    try {
      const next = { ...data, homes: data.homes.map(home => home.id === assetId ? { ...home, ...patch } : home) }
      const result = await saveAssetWorkspace(next, reason)
      if (!result.data) throw new Error(result.error || 'บันทึกไม่สำเร็จ')
      setData(result.data); setNotice(reason.startsWith('นำเข้า BOQ') ? 'นำเข้าและบันทึก BOQ จากไฟล์แล้ว' : reason.includes('BOQ') ? 'บันทึก BOQ แล้ว' : 'บันทึกรายการสินทรัพย์แล้ว')
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
  async function createProjectPayment(buildingId: string, project: BuildingProject, payment: BuildingProjectPaymentDraft) {
    if (busy || !canWrite) throw new Error('ไม่สามารถบันทึกรายการนี้ได้')
    setBusy(true); setError('')
    try {
      const result = await createBuildingProjectPayment({ requestKey: crypto.randomUUID(), paymentId: crypto.randomUUID(), buildingId, projectId: project.id, direction: payment.direction, categoryCode: payment.categoryCode, amount: payment.amount, occurredOn: payment.occurredOn, channelCode: payment.channelCode, reference: payment.reference, note: payment.note, paymentType: payment.paymentType }, payment.slip)
      if ('error' in result) throw new Error(result.error || 'บันทึกรายการรับ–จ่ายไม่สำเร็จ')
      setData(result.data)
      setNotice(`บันทึก${payment.direction === 'IN' ? 'รายรับคืน' : 'รายจ่าย'} ${money(Number(payment.amount))} บาทในรับ–จ่ายแล้ว · TX-${String(result.entryId).padStart(6, '0')} · ผูกกับ ${project.name}`)
    } catch (caught) { const message = caught instanceof Error ? caught.message : 'บันทึกรายการรับ–จ่ายไม่สำเร็จ'; setError(message); throw new Error(message) }
    finally { setBusy(false) }
  }
  return <PageContainer>
    <Header title={showArchived ? 'รายการที่ลบ' : mode === 'basic' ? 'Asset' : 'สินทรัพย์'} icon={showArchived ? <Trash2 size={21} /> : <Boxes size={21} />} description={showArchived ? 'สินทรัพย์ที่ลบไว้และสามารถกู้คืนได้' : 'แสดงประเภทและหมวดหมู่ตาม Masterdata'} actions={canWrite && !showArchived ? <Button variant="primary" disabled={busy} onClick={() => show()}><Plus size={15} />เพิ่มสินทรัพย์</Button> : undefined} />
    <p role="status" className="mb-3 text-xs text-slate-500">{notice || `${visible.length}${visible.length !== activeAssets.length ? ` จาก ${activeAssets.length}` : ''} รายการ${showArchived ? 'ที่ลบ' : ''}`}</p>
    {error && !open && !deleting ? <p role="alert" className="mb-4 text-sm text-rose-600">{error}</p> : null}
    {activeAssets.length ? <div className="mb-4 flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 bg-white p-2.5"><label className="relative min-w-[220px] flex-1"><Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" /><input aria-label="ค้นหาสินทรัพย์" value={searchQuery} onChange={event => setSearchQuery(event.target.value)} placeholder="ค้นหาชื่อหรือรหัสสินทรัพย์" className="w-full rounded-lg border border-slate-200 py-2 pl-9 pr-3 text-sm outline-none focus:border-emerald-500" /></label><div className="flex flex-wrap gap-1" role="group" aria-label="กรองประเภทสินทรัพย์">{([['all','ทั้งหมด'],['land','ที่ดิน'],['building','อาคาร'],['vehicle','ยานพาหนะ'],['other','อื่น ๆ']] as const).map(([value,label]) => <button key={value} type="button" aria-pressed={assetFilter === value} onClick={() => setAssetFilter(value)} className={`rounded-lg px-3 py-2 text-xs transition ${assetFilter === value ? 'bg-emerald-700 font-medium text-white' : 'text-slate-600 hover:bg-slate-100'}`}>{label}</button>)}</div></div> : null}
    {!visible.length ? <Card className="p-8 text-center text-sm text-slate-500">{activeAssets.length ? 'ไม่พบสินทรัพย์ที่ตรงกับคำค้นหาหรือตัวกรอง' : showArchived ? 'ไม่มีรายการที่ลบ' : 'ยังไม่มีสินทรัพย์ที่แสดง'}</Card> : null}
    {visible.length ? <div className="grid overflow-hidden rounded-2xl border border-slate-300 bg-white lg:grid-cols-[280px_minmax(0,1fr)]">
      <aside className="border-b border-slate-300 bg-slate-50/70 lg:border-b-0 lg:border-r" aria-label="รายการสินทรัพย์">
        <div className="border-b border-slate-200 px-4 py-3"><h2 className="m-0 text-sm font-semibold text-slate-800">รายการสินทรัพย์</h2><p className="mb-0 mt-1 text-xs text-slate-500">{visible.length} รายการ</p></div>
        <ul className="m-0 max-h-[320px] space-y-1 overflow-y-auto p-2 lg:max-h-[720px]">
          {visible.map(item => { const category = categoryChain(item.categoryCode, categories).at(-1)?.nameTh ?? 'ไม่ระบุหมวดหมู่'; const selected = selectedAsset?.id === item.id; return <li key={item.id}><button type="button" aria-current={selected ? 'true' : undefined} onClick={() => setSelectedAssetId(item.id)} className={`w-full rounded-xl border-l-4 px-3 py-3 text-left transition ${selected ? 'border-l-emerald-700 bg-white shadow-sm' : 'border-l-transparent hover:bg-white'}`}><span className="block truncate text-sm font-semibold text-slate-800">{item.name}</span><span className="mt-1 flex flex-wrap gap-1.5"><span className="rounded bg-blue-50 px-1.5 py-0.5 text-[10px] font-semibold text-blue-700">{item.assetCode ?? 'รอสร้างรหัส'}</span><span title={categoryPath(item.categoryCode, categories)} className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] text-slate-600">{category}</span></span></button></li> })}
        </ul>
      </aside>
      {selectedAsset ? (() => {
        const item = selectedAsset
        const chain = categoryChain(item.categoryCode, categories)
        const isLand = chain.some(category => category.code === 'LAND')
        const categoryLabel = chain.at(-1)?.nameTh ?? 'ไม่ระบุหมวดหมู่'
        const assetActions = <div className="flex flex-wrap gap-2">{isLand && !showArchived ? <Button disabled={busy} onClick={() => setPriceHistoryAsset(item)} aria-label={`ประวัติราคา ${item.name}`}><History size={14} />ประวัติราคา</Button> : null}{canWrite && <>{showArchived ? <Button disabled={busy} onClick={() => archive(item, false)} aria-label={`กู้คืน ${item.name}`}><RotateCcw size={14} />กู้คืน</Button> : <>{isLand ? <Button disabled={busy} onClick={() => show(item, true)} aria-label={`อัปเดตราคา ${item.name}`}><BadgeDollarSign size={14} />อัปเดตราคา</Button> : null}<Button disabled={busy} onClick={() => show(item)} aria-label={`แก้ไขหมวดหมู่ ${item.name}`}><Pencil size={14} />แก้ไข</Button><Button variant="danger" disabled={busy} onClick={() => { setError(''); setDeleting(item) }} aria-label={`ลบ ${item.name}`}><Trash2 size={14} />ลบ</Button></>}</>}</div>
        const assetSummary = <div className="min-w-0 flex-1"><h2 className="m-0 text-base font-semibold text-slate-900">{item.name}</h2><div className="mt-1.5 flex flex-wrap items-center gap-1.5"><span className="rounded-md bg-blue-50 px-2 py-0.5 text-[11px] font-semibold text-blue-700">{item.assetCode ?? 'รอสร้างรหัส'}</span><span title={categoryPath(item.categoryCode, categories)} className="max-w-full truncate rounded-md bg-slate-100 px-2 py-0.5 text-[11px] text-slate-600">{categoryLabel}</span></div>{isLand ? <div className="mt-3 rounded-xl bg-slate-50 px-3 py-2.5 text-sm text-slate-600"><div className="flex flex-wrap items-baseline gap-x-2 gap-y-1"><span className="text-xs text-slate-500">มูลค่าประเมิน</span><strong className="text-base text-slate-900">{latestLandPrice(item) ? `${money(latestLandPrice(item)!)} บาท` : 'ยังไม่ระบุ'}</strong>{(() => { const growth = landPriceGrowth(item); return typeof growth.difference === 'number' && typeof growth.percent === 'number' ? <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${growth.difference > 0 ? 'bg-emerald-50 text-emerald-700' : growth.difference < 0 ? 'bg-rose-50 text-rose-700' : 'bg-slate-200 text-slate-600'}`}>{growth.difference > 0 ? '+' : ''}{growth.percent.toLocaleString('th-TH', { maximumFractionDigits: 2 })}%</span> : <span className="text-xs text-slate-500">{growth.message}</span> })()}</div><p className="mb-0 mt-1 text-xs text-slate-500">ต้นทุนรวม {money(landAssetCostTotal(item).total)} · ราคาซื้อ {money(item.purchasePrice)} + ปรับปรุง {money(landAssetCostTotal(item).improvements)} บาท</p></div> : null}{item.archivedOn ? <p className="mb-0 mt-2 text-xs text-slate-500">ลบเมื่อ {item.archivedOn}</p> : null}</div>
        return <section className="min-w-0 p-4 sm:p-5" aria-label={`รายละเอียด ${item.name}`}>{isLand && !showArchived ? <div className="grid gap-4 lg:grid-cols-[minmax(220px,0.72fr)_minmax(0,1.5fr)]"><div className="flex flex-col items-start gap-3">{assetSummary}{assetActions}</div><LandDevelopmentManager compact landId={item.id} landName={item.name} rows={item.landDevelopments ?? []} busy={busy} canWrite={canWrite} error={error} ledger={ledger} usedLedgerIds={usedLedgerIds} assets={data.homes} financialCategories={financialCategories} channels={channels} onSave={improvement => saveLandDevelopment(item.id, improvement)} onCreatePayment={(work, payment) => createDevelopmentPayment(item.id, work, payment)} onRecordActualCost={(workId, record) => recordDevelopmentCost(item.id, workId, record)} /></div> : <><div className="flex flex-wrap items-start justify-between gap-3">{assetSummary}{assetActions}</div>{item.kind === 'house' && !showArchived ? <BuildingManager asset={item} canWrite={canWrite} busy={busy} ledger={ledger} usedLedgerIds={usedLedgerIds} financialCategories={financialCategories} channels={channels} onCreateProjectPayment={(project, payment) => createProjectPayment(item.id, project, payment)} onSave={(patch, reason) => saveAssetPatch(item.id, patch, reason)} /> : null}{item.kind === 'vehicle' && !showArchived ? <VehicleManager asset={item} canWrite={canWrite} busy={busy} onSave={(patch, reason) => saveAssetPatch(item.id, patch, reason)} /> : null}</>}</section>
      })() : <section className="grid min-h-48 place-items-center p-6 text-sm text-slate-500">เลือกสินทรัพย์จากรายการทางซ้าย</section>}
    </div> : null}
    <Modal open={open} title={priceOnly ? `อัปเดตราคา · ${editing?.name ?? ''}` : editing ? 'แก้ไขสินทรัพย์' : 'เพิ่มสินทรัพย์'} onClose={() => { if (!busy) setOpen(false) }}>
      <AssetForm key={`${editing?.id ?? 'new'}-${priceOnly ? 'price' : 'full'}`} initial={editing} categories={categories} busy={busy} error={error} priceOnly={priceOnly} onCancel={() => { if (!busy) setOpen(false) }} onSave={saveDetails} />
    </Modal>
    <Modal open={Boolean(priceHistoryAsset)} title={`ประวัติราคา · ${priceHistoryAsset?.name ?? ''}`} description="เปรียบเทียบราคาซื้อกับราคาที่บันทึกหรือประเมินไว้ตามลำดับเวลา" onClose={() => setPriceHistoryAsset(null)}>
      {priceHistoryAsset ? <div className="space-y-2">{landPriceHistory(priceHistoryAsset).length ? landPriceHistory(priceHistoryAsset).map((row, index, rows) => { const previous = rows.slice(0, index).filter(candidate => candidate.type === row.type || candidate.type === 'purchase' && row.type !== 'purchase').at(-1); const difference = previous ? row.amount - previous.amount : undefined; const percent = previous?.amount ? difference! / previous.amount * 100 : undefined; return <article key={`${row.date}-${row.type}-${row.amount}-${index}`} className="rounded-xl border border-slate-100 bg-slate-50 p-3"><div className="flex flex-wrap items-baseline justify-between gap-2"><strong className="text-sm text-slate-800">{money(row.amount)} บาท</strong><span className="text-xs text-slate-500">{row.date || 'ไม่ระบุวันที่'} · {row.type === 'purchase' ? 'ราคาซื้อ' : row.type === 'official_appraisal' ? 'ประเมินราชการ' : row.type === 'market_appraisal' ? 'ประเมินตลาด' : row.type === 'asking' ? 'ราคาตั้งขาย' : row.type === 'sale' ? 'ราคาขาย' : 'ประเมิน'}</span></div>{difference !== undefined ? <p className={`mb-0 mt-1 text-xs font-medium ${difference > 0 ? 'text-emerald-700' : difference < 0 ? 'text-rose-700' : 'text-slate-500'}`}>{difference > 0 ? '+' : ''}{money(difference)} บาท ({difference > 0 ? '+' : ''}{percent!.toLocaleString('th-TH', { maximumFractionDigits: 2 })}%) เทียบกับรายการก่อนหน้า</p> : null}{row.source && row.type !== 'purchase' ? <p className="mb-0 mt-1 text-xs text-slate-500">แหล่งประเมิน: {row.source}</p> : null}{row.notes ? <p className="mb-0 mt-1 text-xs text-slate-500">{row.notes}</p> : null}</article> }) : <p className="text-sm text-slate-500">ยังไม่มีประวัติราคา</p>}</div> : null}
    </Modal>
    <Modal open={Boolean(deleting)} title="ยืนยันลบสินทรัพย์" onClose={() => { if (!busy) setDeleting(null) }}>
      <p className="text-sm leading-7">ต้องการลบ “{deleting?.name}” ออกจากรายการสินทรัพย์หรือไม่? สามารถกู้คืนได้จาก “รายการที่ลบ”</p>
      {deleting && data.loans.some(loan => loanAssetIds(loan).includes(deleting.id)) ? <p className="mt-3 rounded-xl bg-amber-50 p-3 text-xs leading-6 text-amber-800">สินทรัพย์นี้เชื่อมกับเงินกู้ธนาคาร ยอดหนี้และประวัติชำระจะยังคงอยู่</p> : null}
      {error ? <p role="alert" className="mt-3 text-xs text-rose-600">{error}</p> : null}
      <div className="mt-5 flex justify-end gap-2"><Button disabled={busy} onClick={() => setDeleting(null)}>ยกเลิก</Button><Button variant="danger" disabled={busy} onClick={() => deleting && archive(deleting, true)}>{busy ? 'กำลังลบ…' : 'ยืนยันลบ'}</Button></div>
    </Modal>
  </PageContainer>
}
