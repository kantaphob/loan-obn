'use client'

import { assetAcquisitionCost, assetCosts, loanAssetIds, propertyAssetIds, type HomeSale } from '@/app/thing/_shared/model'

import { useState, type FormEvent } from 'react'
import Link from 'next/link'
import { BadgeDollarSign, Boxes, Pencil, Plus, Trash2, RotateCcw, History, Search } from 'lucide-react'
import { PageContainer } from '@/components/ui/page-container'
import { Header } from '@/components/ui/header'
import { Card } from '@/components/ui/card'
import { Modal } from '@/components/ui/modal'
import { Button } from '@/components/ui/button'
import { createBuildingProjectPayment, createHomeSaleReceipt, createLandDevelopmentPayment, saveAssetWorkspace } from '@/app/thing/_shared/actions'
import { categoryChain, categoryKind, categoryPath, type AssetCategory } from '../categories'
import { money, newHome, today, type AssetData, type Home } from '@/app/thing/_shared/model'
import { AssetForm, type AssetFormValues } from '@/app/thing/asset/_components/asset-form'
import { LandDevelopmentManager, type DevelopmentPaymentDraft } from '@/app/thing/asset/_components/land-improvement-manager'
import { VehicleManager } from '@/app/thing/asset/_components/vehicle-manager'
import { BuildingManager, type BuildingProjectPaymentDraft } from '@/app/thing/asset/_components/building-manager'
import type { BuildingChangeOrder, BuildingProject, LandDevelopment, LedgerOption } from '@/app/thing/_shared/model'

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

function PropertyAssetLink({ property }: { property: { code: string; name: string } }) {
  return <div className="flex min-h-32 flex-col items-start justify-center gap-2 rounded-xl border border-emerald-100 bg-emerald-50/60 p-4">
    <strong className="text-sm text-emerald-900">สินทรัพย์นี้อยู่ใน Property {property.code}</strong>
    <span className="text-xs text-emerald-800">{property.name} · งานและรับ–จ่ายจัดการจาก Property เพื่อรวมภาพบ้านพร้อมที่ดิน</span>
    <Link href="/thing/property" className="mt-1 inline-flex items-center rounded-lg border border-emerald-200 bg-white px-3 py-2 text-xs font-medium text-emerald-800">เปิด Property</Link>
  </div>
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
  const [saleAsset, setSaleAsset] = useState<Home | null>(null)
  const [saleDraft, setSaleDraft] = useState<{ date: string; salePrice: string; sellingCosts: string; buyer: string; reference: string; notes: string; includedAssetIds: string[] } | null>(null)
  const [saleReceiptAsset, setSaleReceiptAsset] = useState<Home | null>(null)
  const [saleReceiptDraft, setSaleReceiptDraft] = useState<{ amount: string; occurredOn: string; categoryCode: string; channelCode: string; reference: string; note: string; slip: File | null } | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [assetFilter, setAssetFilter] = useState<'all' | 'land' | 'building' | 'vehicle' | 'other'>('all')
  const [showSold, setShowSold] = useState(false)
  const [selectedAssetId, setSelectedAssetId] = useState(initial.homes[0]?.id ?? '')
  const showArchived = view === 'archived'
  const isAssetSold = (item: Home) => Boolean(item.disposedOn || item.saleDeclaration) || Boolean(data.properties?.some(property => property.status === 'DISPOSED' && propertyAssetIds(property).includes(item.id)))
  const usedLedgerIds = [...data.homes.flatMap(home => [...home.boq.map(row => row.ledgerEntryId), ...(home.landDevelopments ?? []).flatMap(work => work.payments.map(payment => payment.ledgerEntryId)), ...(home.buildingProjects ?? []).flatMap(project => project.payments.map(payment => payment.ledgerEntryId)), ...(home.buildingChangeOrders ?? []).flatMap(order => (order.payments ?? []).map(payment => payment.ledgerEntryId)), ...(home.sale?.payments ?? []).map(payment => payment.ledgerEntryId)]), ...data.loans.flatMap(loan => loan.payments.map(payment => payment.ledgerEntryId))].filter((id): id is number => Boolean(id))
  const activeAssets = data.homes.filter(item => showArchived ? Boolean(item.archivedOn) : !item.archivedOn && (showSold ? isAssetSold(item) : !isAssetSold(item)))
  const ownedAssets = data.homes.filter(item => !item.archivedOn && !isAssetSold(item))
  const ownedAssetCost = ownedAssets.reduce((sum, item) => {
    const isLand = categoryChain(item.categoryCode, categories).some(category => category.code === 'LAND')
    return sum + assetCosts(item).total + (isLand ? landAssetCostTotal(item).improvements : 0)
  }, 0)
  const recordedSaleTotal = data.homes.reduce((sum, item) => sum + (item.sale?.salePrice ?? 0), 0)
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
  function openSale(item: Home) {
    const linked = data.properties?.find(property => propertyAssetIds(property).includes(item.id))
    const includedAssetIds = (linked ? propertyAssetIds(linked) : [item.id]).filter(id => data.homes.some(home => home.id === id && !home.archivedOn && !home.disposedOn && (home.kind === 'house' || categoryChain(home.categoryCode, categories).some(category => category.code === 'LAND'))))
    setSaleAsset(item); setSaleDraft({ date: today(), salePrice: '', sellingCosts: '0', buyer: '', reference: '', notes: '', includedAssetIds: includedAssetIds.includes(item.id) ? includedAssetIds : [item.id] }); setError('')
  }
  async function saveSale(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!saleAsset || !saleDraft || busy || !canWrite) return
    const salePrice = Number(saleDraft.salePrice); const sellingCosts = Number(saleDraft.sellingCosts || 0)
    if (!Number.isFinite(salePrice) || salePrice <= 0 || !Number.isFinite(sellingCosts) || sellingCosts < 0 || !saleDraft.includedAssetIds.includes(saleAsset.id)) { setError('ตรวจสอบราคาขาย ค่าใช้จ่ายขาย และสินทรัพย์ในรายการ'); return }
    setBusy(true); setError('')
    try {
      const sale: HomeSale = { id: crypto.randomUUID(), date: saleDraft.date, salePrice, sellingCosts, buyer: saleDraft.buyer.trim(), reference: saleDraft.reference.trim(), notes: saleDraft.notes.trim(), includedAssetIds: saleDraft.includedAssetIds, payments: [] }
      const included = new Set(sale.includedAssetIds)
      const properties = (data.properties ?? []).map(property => propertyAssetIds(property).some(id => included.has(id)) ? { ...property, status: 'DISPOSED' as const } : property)
      const next = { ...data, properties, homes: data.homes.map(home => included.has(home.id) ? home.id === saleAsset.id ? { ...home, sale, disposedOn: sale.date, disposalSaleId: undefined } : { ...home, disposedOn: sale.date, disposalSaleId: sale.id } : home) }
      const result = await saveAssetWorkspace(next, `บันทึกขายสินทรัพย์: ${saleAsset.name}`)
      if (!result.data) throw new Error(result.error || 'บันทึกการขายไม่สำเร็จ')
      setData(result.data); setSaleAsset(null); setSaleDraft(null); setNotice(`บันทึกการขาย “${saleAsset.name}” แล้ว · ราคาขาย ${money(salePrice)} บาท · บันทึกรับเงินจริงแยกในรายการขาย`)
    } catch (caught) { setError(caught instanceof Error ? caught.message : 'บันทึกการขายไม่สำเร็จ') }
    finally { setBusy(false) }
  }
  function openSaleReceipt(item: Home) {
    setSaleReceiptAsset(item); setSaleReceiptDraft({ amount: '', occurredOn: today() < (item.sale?.date ?? today()) ? item.sale?.date ?? today() : today(), categoryCode: financialCategories.find(row => row.direction === 'IN' && row.code === 'OTHER_INCOME')?.code ?? financialCategories.find(row => row.direction === 'IN')?.code ?? '', channelCode: '', reference: '', note: '', slip: null }); setError('')
  }
  async function saveSaleReceipt(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!saleReceiptAsset?.sale || !saleReceiptDraft || busy || !canWrite) return
    setBusy(true); setError('')
    try {
      const result = await createHomeSaleReceipt({ requestKey: crypto.randomUUID(), homeId: saleReceiptAsset.id, saleId: saleReceiptAsset.sale.id, paymentId: crypto.randomUUID(), categoryCode: saleReceiptDraft.categoryCode, amount: saleReceiptDraft.amount, occurredOn: saleReceiptDraft.occurredOn, channelCode: saleReceiptDraft.channelCode, reference: saleReceiptDraft.reference, note: saleReceiptDraft.note }, saleReceiptDraft.slip)
      if ('error' in result) throw new Error(result.error || 'บันทึกรับเงินไม่สำเร็จ')
      setData(result.data); setSaleReceiptAsset(null); setSaleReceiptDraft(null); setNotice(`บันทึกรับเงินค่าขาย ${money(Number(saleReceiptDraft.amount))} บาทในรับ–จ่ายแล้ว · TX-${String(result.entryId).padStart(6, '0')}`)
    } catch (caught) { setError(caught instanceof Error ? caught.message : 'บันทึกรับเงินไม่สำเร็จ') }
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
  async function createProjectPayment(buildingId: string, project: BuildingProject | BuildingChangeOrder, payment: BuildingProjectPaymentDraft) {
    if (busy || !canWrite) throw new Error('ไม่สามารถบันทึกรายการนี้ได้')
    setBusy(true); setError('')
    try {
      const result = await createBuildingProjectPayment({ requestKey: crypto.randomUUID(), paymentId: crypto.randomUUID(), buildingId, ...('title' in project ? { changeOrderId: project.id } : { projectId: project.id }), direction: payment.direction, categoryCode: payment.categoryCode, amount: payment.amount, occurredOn: payment.occurredOn, channelCode: payment.channelCode, reference: payment.reference, note: payment.note, paymentType: payment.paymentType }, payment.slip)
      if ('error' in result) throw new Error(result.error || 'บันทึกรายการรับ–จ่ายไม่สำเร็จ')
      setData(result.data)
      setNotice(`บันทึก${payment.direction === 'IN' ? 'รายรับคืน' : 'รายจ่าย'} ${money(Number(payment.amount))} บาทในรับ–จ่ายแล้ว · TX-${String(result.entryId).padStart(6, '0')} · ผูกกับ ${'title' in project ? `ใบงาน ${project.number} · ${project.title}` : project.name}`)
    } catch (caught) { const message = caught instanceof Error ? caught.message : 'บันทึกรายการรับ–จ่ายไม่สำเร็จ'; setError(message); throw new Error(message) }
    finally { setBusy(false) }
  }
  return <PageContainer>
    <Header title={showArchived ? 'รายการที่ลบ' : mode === 'basic' ? 'Asset' : 'สินทรัพย์'} icon={showArchived ? <Trash2 size={21} /> : <Boxes size={21} />} description={showArchived ? 'สินทรัพย์ที่ลบไว้และสามารถกู้คืนได้' : 'แสดงประเภทและหมวดหมู่ตาม Masterdata'} actions={canWrite && !showArchived ? <Button variant="primary" disabled={busy} onClick={() => show()}><Plus size={15} />เพิ่มสินทรัพย์</Button> : undefined} />
    <p role="status" className="mb-3 text-xs text-slate-500">{notice || `${visible.length}${visible.length !== activeAssets.length ? ` จาก ${activeAssets.length}` : ''} รายการ${showArchived ? 'ที่ลบ' : ''}`}</p>
    {!showArchived ? <section aria-label="สรุปมูลค่าสินทรัพย์" className="mb-4 grid gap-3 sm:grid-cols-3">
      <Card className="p-4"><p className="m-0 text-xs text-slate-500">สินทรัพย์ที่ถือครอง</p><p className="mb-0 mt-2 text-xl font-semibold text-slate-800">{ownedAssets.length} รายการ</p><p className="mb-0 mt-1 text-[11px] text-slate-400">ไม่นับรายการขายแล้วหรือลบ</p></Card>
      <Card className="p-4"><p className="m-0 text-xs text-slate-500">ต้นทุนสินทรัพย์รวม</p><p className="mb-0 mt-2 text-xl font-semibold tabular-nums text-slate-800">{money(ownedAssetCost)} บาท</p><p className="mb-0 mt-1 text-[11px] text-slate-400">รวมราคาซื้อ / BOQ และงานเพิ่มทุน ไม่รวมซ่อมบำรุง</p></Card>
      <Card className="p-4"><p className="m-0 text-xs text-slate-500">ราคาขายที่บันทึกแล้ว</p><p className="mb-0 mt-2 text-xl font-semibold tabular-nums text-emerald-700">{money(recordedSaleTotal)} บาท</p><p className="mb-0 mt-1 text-[11px] text-slate-400">แยกจากต้นทุนสินทรัพย์ที่ยังถือครอง</p></Card>
    </section> : null}
    {error && !open && !deleting ? <p role="alert" className="mb-4 text-sm text-rose-600">{error}</p> : null}
    {data.homes.length > 0 && !showArchived ? <div className="mb-4 flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 bg-white p-2.5"><label className="relative min-w-[220px] flex-1"><Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" /><input aria-label="ค้นหาสินทรัพย์" value={searchQuery} onChange={event => setSearchQuery(event.target.value)} placeholder="ค้นหาชื่อหรือรหัสสินทรัพย์" className="w-full rounded-lg border border-slate-200 py-2 pl-9 pr-3 text-sm outline-none focus:border-emerald-500" /></label><div className="flex flex-wrap gap-1" role="group" aria-label="กรองประเภทสินทรัพย์">{([['all','ทั้งหมด'],['land','ที่ดิน'],['building','อาคาร'],['vehicle','ยานพาหนะ'],['other','อื่น ๆ']] as const).map(([value,label]) => <button key={value} type="button" aria-pressed={assetFilter === value} onClick={() => setAssetFilter(value)} className={`rounded-lg px-3 py-2 text-xs transition ${assetFilter === value ? 'bg-emerald-700 font-medium text-white' : 'text-slate-600 hover:bg-slate-100'}`}>{label}</button>)}</div><button type="button" aria-pressed={showSold} onClick={() => setShowSold(value => !value)} className={`rounded-lg px-3 py-2 text-xs transition ${showSold ? 'bg-emerald-700 font-medium text-white' : 'text-slate-600 hover:bg-slate-100'}`}>{showSold ? 'กำลังดูรายการขายแล้ว' : `ขายแล้ว ${data.homes.filter(home => isAssetSold(home) && !home.archivedOn).length}`}</button></div> : null}
    {!visible.length ? <Card className="p-8 text-center text-sm text-slate-500">{activeAssets.length ? 'ไม่พบสินทรัพย์ที่ตรงกับคำค้นหาหรือตัวกรอง' : showArchived ? 'ไม่มีรายการที่ลบ' : 'ยังไม่มีสินทรัพย์ที่แสดง'}</Card> : null}
    {visible.length ? <div className="grid overflow-hidden rounded-2xl border border-slate-300 bg-white lg:grid-cols-[280px_minmax(0,1fr)]">
      <aside className="border-b border-slate-300 bg-slate-50/70 lg:border-b-0 lg:border-r" aria-label="รายการสินทรัพย์">
        <div className="border-b border-slate-200 px-4 py-3"><h2 className="m-0 text-sm font-semibold text-slate-800">รายการสินทรัพย์</h2><p className="mb-0 mt-1 text-xs text-slate-500">{visible.length} รายการ</p></div>
        <ul className="m-0 max-h-[320px] space-y-1 overflow-y-auto p-2 lg:max-h-[720px]">
          {visible.map(item => { const category = categoryChain(item.categoryCode, categories).at(-1)?.nameTh ?? 'ไม่ระบุหมวดหมู่'; const selected = selectedAsset?.id === item.id; const sold = isAssetSold(item); return <li key={item.id}><button type="button" aria-current={selected ? 'true' : undefined} onClick={() => setSelectedAssetId(item.id)} className={`w-full rounded-xl border-l-4 px-3 py-3 text-left transition ${selected ? 'border-l-emerald-700 bg-white shadow-sm' : 'border-l-transparent hover:bg-white'}`}><span className="block truncate text-sm font-semibold text-slate-800">{item.name}</span><span className="mt-1 flex flex-wrap gap-1.5"><span className="rounded bg-blue-50 px-1.5 py-0.5 text-[10px] font-semibold text-blue-700">{item.assetCode ?? 'รอสร้างรหัส'}</span><span title={categoryPath(item.categoryCode, categories)} className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] text-slate-600">{category}</span>{sold ? <span className="rounded bg-emerald-100 px-1.5 py-0.5 text-[10px] font-medium text-emerald-800">ขายแล้ว</span> : null}</span></button></li> })}
        </ul>
      </aside>
      {selectedAsset ? (() => {
        const item = selectedAsset
        const linkedProperty = data.properties?.find(property => propertyAssetIds(property).includes(item.id))
        const chain = categoryChain(item.categoryCode, categories)
        const isLand = chain.some(category => category.code === 'LAND')
        const categoryLabel = chain.at(-1)?.nameTh ?? 'ไม่ระบุหมวดหมู่'
        const assetActions = <div className="flex flex-wrap gap-2">{isLand && !item.disposedOn && !showArchived ? <Button disabled={busy} onClick={() => setPriceHistoryAsset(item)} aria-label={`ประวัติราคา ${item.name}`}><History size={14} />ประวัติราคา</Button> : null}{canWrite && <>{showArchived ? <Button disabled={busy} onClick={() => archive(item, false)} aria-label={`กู้คืน ${item.name}`}><RotateCcw size={14} />กู้คืน</Button> : <>{isLand && !item.disposedOn ? <Button disabled={busy} onClick={() => show(item, true)} aria-label={`อัปเดตราคา ${item.name}`}><BadgeDollarSign size={14} />อัปเดตราคา</Button> : null}{item.kind === 'house' && !item.disposedOn ? <Button disabled={busy} onClick={() => openSale(item)} aria-label={`บันทึกขาย ${item.name}`}><BadgeDollarSign size={14} />บันทึกขาย</Button> : null}{item.sale && item.sale.payments.reduce((sum, row) => sum + row.amount, 0) + 0.009 < item.sale.salePrice ? <Button disabled={busy} onClick={() => openSaleReceipt(item)}><Plus size={14} />บันทึกรับเงิน</Button> : null}{!item.disposedOn ? <Button disabled={busy} onClick={() => show(item)} aria-label={`แก้ไขหมวดหมู่ ${item.name}`}><Pencil size={14} />แก้ไข</Button> : null}<Button variant="danger" disabled={busy} onClick={() => { setError(''); setDeleting(item) }} aria-label={`ลบ ${item.name}`}><Trash2 size={14} />ลบ</Button></>}</>}</div>
        const assetSummary = <div className="min-w-0 flex-1"><h2 className="m-0 text-base font-semibold text-slate-900">{item.name}</h2><div className="mt-1.5 flex flex-wrap items-center gap-1.5"><span className="rounded-md bg-blue-50 px-2 py-0.5 text-[11px] font-semibold text-blue-700">{item.assetCode ?? 'รอสร้างรหัส'}</span><span title={categoryPath(item.categoryCode, categories)} className="max-w-full truncate rounded-md bg-slate-100 px-2 py-0.5 text-[11px] text-slate-600">{categoryLabel}</span>{isAssetSold(item) ? <span className="rounded-md bg-emerald-100 px-2 py-0.5 text-[11px] font-semibold text-emerald-800">ขายแล้ว{item.disposedOn ? ` · ${item.disposedOn}` : ''}</span> : null}</div>{isLand ? <div className="mt-3 rounded-xl bg-slate-50 px-3 py-2.5 text-sm text-slate-600"><div className="flex flex-wrap items-baseline gap-x-2 gap-y-1"><span className="text-xs text-slate-500">มูลค่าประเมิน</span><strong className="text-base text-slate-900">{latestLandPrice(item) ? `${money(latestLandPrice(item)!)} บาท` : 'ยังไม่ระบุ'}</strong>{(() => { const growth = landPriceGrowth(item); return typeof growth.difference === 'number' && typeof growth.percent === 'number' ? <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${growth.difference > 0 ? 'bg-emerald-50 text-emerald-700' : growth.difference < 0 ? 'bg-rose-50 text-rose-700' : 'bg-slate-200 text-slate-600'}`}>{growth.difference > 0 ? '+' : ''}{growth.percent.toLocaleString('th-TH', { maximumFractionDigits: 2 })}%</span> : <span className="text-xs text-slate-500">{growth.message}</span> })()}</div><p className="mb-0 mt-1 text-xs text-slate-500">ต้นทุนรวม {money(landAssetCostTotal(item).total)} · ราคาซื้อ {money(item.purchasePrice)} + ปรับปรุง {money(landAssetCostTotal(item).improvements)} บาท</p></div> : null}{item.sale ? <div className="mt-3 rounded-xl border border-emerald-100 bg-emerald-50/60 p-3 text-xs text-slate-700"><p className="mb-1 font-semibold text-emerald-800">ขายแล้ว · {item.sale.date}</p><p className="mb-1">ราคาขาย {money(item.sale.salePrice)} · ค่าใช้จ่ายขาย {money(item.sale.sellingCosts)} บาท</p><p className="mb-1">รับเงินจริง {money(item.sale.payments.reduce((sum, row) => sum + row.amount, 0))} · คงเหลือ {money(Math.max(0, item.sale.salePrice - item.sale.payments.reduce((sum, row) => sum + row.amount, 0)))} บาท{item.sale.buyer ? ` · ผู้ซื้อ ${item.sale.buyer}` : ''}</p><p className="mb-0 text-slate-500">ส่วนต่างเทียบต้นทุนอ้างอิง {money(item.sale.salePrice - item.sale.sellingCosts - item.sale.includedAssetIds.reduce((sum, assetId) => sum + assetAcquisitionCost(data.homes.find(home => home.id === assetId)!), 0))} บาท</p></div> : item.disposedOn ? <p className="mb-0 mt-2 text-xs text-emerald-700">ขายรวมในใบขาย {item.disposalSaleId ? data.homes.find(home => home.sale?.id === item.disposalSaleId)?.name : 'สินทรัพย์'} · {item.disposedOn}</p> : null}{item.archivedOn ? <p className="mb-0 mt-2 text-xs text-slate-500">ลบเมื่อ {item.archivedOn}</p> : null}</div>

        return <section className="min-w-0 p-4 sm:p-5" aria-label={`รายละเอียด ${item.name}`}>{isLand && !showArchived ? <div className="grid gap-4 lg:grid-cols-[minmax(220px,0.72fr)_minmax(0,1.5fr)]"><div className="flex flex-col items-start gap-3">{assetSummary}{assetActions}</div>{linkedProperty ? <PropertyAssetLink property={linkedProperty} /> : <LandDevelopmentManager compact landId={item.id} landName={item.name} rows={item.landDevelopments ?? []} busy={busy} canWrite={canWrite && !item.disposedOn} error={error} ledger={ledger} usedLedgerIds={usedLedgerIds} assets={data.homes} financialCategories={financialCategories} channels={channels} onSave={improvement => saveLandDevelopment(item.id, improvement)} onCreatePayment={(work, payment) => createDevelopmentPayment(item.id, work, payment)} onRecordActualCost={(workId, record) => recordDevelopmentCost(item.id, workId, record)} />}</div> : <><div className="flex flex-wrap items-start justify-between gap-3">{assetSummary}{assetActions}</div>{item.kind === 'house' && !showArchived ? linkedProperty ? <PropertyAssetLink property={linkedProperty} /> : <BuildingManager asset={item} canWrite={canWrite && !item.disposedOn} busy={busy} ledger={ledger} usedLedgerIds={usedLedgerIds} financialCategories={financialCategories} channels={channels} onCreateProjectPayment={(project, payment) => createProjectPayment(item.id, project, payment)} onSave={(patch, reason) => saveAssetPatch(item.id, patch, reason)} /> : null}{item.kind === 'vehicle' && !showArchived ? <VehicleManager asset={item} canWrite={canWrite} busy={busy} onSave={(patch, reason) => saveAssetPatch(item.id, patch, reason)} /> : null}</>}</section>
      })() : <section className="grid min-h-48 place-items-center p-6 text-sm text-slate-500">เลือกสินทรัพย์จากรายการทางซ้าย</section>}
    </div> : null}
    <Modal open={open} title={priceOnly ? `อัปเดตราคา · ${editing?.name ?? ''}` : editing ? 'แก้ไขสินทรัพย์' : 'เพิ่มสินทรัพย์'} onClose={() => { if (!busy) setOpen(false) }}>
      <AssetForm key={`${editing?.id ?? 'new'}-${priceOnly ? 'price' : 'full'}`} initial={editing} categories={categories} busy={busy} error={error} priceOnly={priceOnly} onCancel={() => { if (!busy) setOpen(false) }} onSave={saveDetails} />
    </Modal>
    <Modal open={Boolean(saleAsset && saleDraft)} title={`บันทึกขายสินทรัพย์ · ${saleAsset?.name ?? ''}`} description="ปิดสถานะสินทรัพย์เป็นขายแล้ว และแยกยอดขายออกจากยอดรับเงินจริง" onClose={() => { if (!busy) { setSaleAsset(null); setSaleDraft(null) } }} className="max-w-2xl">
      {saleAsset && saleDraft ? <form className="space-y-4" onSubmit={saveSale}>
        <div className="grid gap-3 sm:grid-cols-2"><label className="block text-xs font-medium text-slate-600">วันที่ขาย *<input className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" type="date" required max={today()} value={saleDraft.date} onChange={event => setSaleDraft({ ...saleDraft, date: event.target.value })} /></label><label className="block text-xs font-medium text-slate-600">ราคาขายรวม (บาท) *<input className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" type="number" required min="0.01" step="0.01" value={saleDraft.salePrice} onChange={event => setSaleDraft({ ...saleDraft, salePrice: event.target.value })} /></label><label className="block text-xs font-medium text-slate-600">ค่าใช้จ่ายขาย (บาท)<input className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" type="number" min="0" step="0.01" value={saleDraft.sellingCosts} onChange={event => setSaleDraft({ ...saleDraft, sellingCosts: event.target.value })} /></label><label className="block text-xs font-medium text-slate-600">ผู้ซื้อ<input className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" maxLength={200} value={saleDraft.buyer} onChange={event => setSaleDraft({ ...saleDraft, buyer: event.target.value })} /></label><label className="block text-xs font-medium text-slate-600 sm:col-span-2">เลขที่สัญญา / เอกสารอ้างอิง<input className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" maxLength={150} value={saleDraft.reference} onChange={event => setSaleDraft({ ...saleDraft, reference: event.target.value })} /></label></div>
        {(() => { const property = data.properties?.find(row => propertyAssetIds(row).includes(saleAsset.id)); const candidates = data.homes.filter(home => (!property || propertyAssetIds(property).includes(home.id)) && !home.archivedOn && !home.disposedOn && (home.kind === 'house' || categoryChain(home.categoryCode, categories).some(category => category.code === 'LAND'))); const basis = saleDraft.includedAssetIds.reduce((sum, id) => sum + assetCosts(data.homes.find(home => home.id === id)!).total, 0); return <><fieldset className="rounded-xl border border-slate-200 p-3"><legend className="px-1 text-xs font-semibold text-slate-700">ขายสินทรัพย์ใดบ้าง</legend><div className="space-y-2">{candidates.map(home => <label key={home.id} className="flex items-center gap-2 text-sm text-slate-700"><input type="checkbox" disabled={home.id === saleAsset.id} checked={saleDraft.includedAssetIds.includes(home.id)} onChange={event => setSaleDraft({ ...saleDraft, includedAssetIds: event.target.checked ? [...saleDraft.includedAssetIds, home.id] : saleDraft.includedAssetIds.filter(id => id !== home.id) })} />{home.assetCode ?? 'สินทรัพย์'} · {home.name}{categoryChain(home.categoryCode, categories).some(category => category.code === 'LAND') ? ' (ที่ดิน)' : ' (บ้าน)'}</label>)}</div><p className="mb-0 mt-2 text-[11px] text-slate-400">เลือกบ้านและที่ดินที่ขายพร้อมกันได้ รายรับจะบันทึกเพียงรายการเดียว</p></fieldset><div className="rounded-xl bg-slate-50 p-3 text-xs"><p className="mb-1">ต้นทุนอ้างอิงของสินทรัพย์ที่เลือก {money(basis)} บาท</p><p className="mb-0 font-medium text-slate-700">ส่วนต่างเบื้องต้นหลังค่าใช้จ่ายขาย {money(Number(saleDraft.salePrice || 0) - Number(saleDraft.sellingCosts || 0) - basis)} บาท</p></div></> })()}
        <label className="block text-xs font-medium text-slate-600">หมายเหตุ<textarea className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" rows={2} maxLength={1000} value={saleDraft.notes} onChange={event => setSaleDraft({ ...saleDraft, notes: event.target.value })} /></label>
        {error ? <p role="alert" className="m-0 text-sm text-rose-700">{error}</p> : null}<div className="flex justify-end gap-2"><Button type="button" disabled={busy} onClick={() => { setSaleAsset(null); setSaleDraft(null) }}>ยกเลิก</Button><Button type="submit" variant="primary" disabled={busy}>{busy ? 'กำลังบันทึก…' : 'ยืนยันขายสินทรัพย์'}</Button></div>
      </form> : null}
    </Modal>
    <Modal open={Boolean(saleReceiptAsset && saleReceiptDraft)} title={`บันทึกรับเงินจริง · ${saleReceiptAsset?.name ?? ''}`} description="ยอดรับเงินจริงแยกจากราคาขายในสัญญา บันทึกเข้ารายรับและเชื่อมกับรายการขาย" onClose={() => { if (!busy) { setSaleReceiptAsset(null); setSaleReceiptDraft(null) } }} className="max-w-2xl">
      {saleReceiptAsset && saleReceiptDraft ? <form className="space-y-4" onSubmit={saveSaleReceipt}><div className="rounded-xl bg-emerald-50 p-3 text-xs text-emerald-800">ราคาขาย {money(saleReceiptAsset.sale?.salePrice ?? 0)} · รับแล้ว {money(saleReceiptAsset.sale?.payments.reduce((sum, row) => sum + row.amount, 0) ?? 0)} · รับได้อีก {money(Math.max(0, (saleReceiptAsset.sale?.salePrice ?? 0) - (saleReceiptAsset.sale?.payments.reduce((sum, row) => sum + row.amount, 0) ?? 0)))} บาท</div>
        <div className="grid gap-3 sm:grid-cols-2"><label className="block text-xs font-medium text-slate-600">ยอดรับเงินจริง (บาท) *<input className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" type="number" required min="0.01" step="0.01" value={saleReceiptDraft.amount} onChange={event => setSaleReceiptDraft({ ...saleReceiptDraft, amount: event.target.value })} /></label><label className="block text-xs font-medium text-slate-600">วันที่รับ *<input className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" type="date" required min={saleReceiptAsset.sale?.date} max={today()} value={saleReceiptDraft.occurredOn} onChange={event => setSaleReceiptDraft({ ...saleReceiptDraft, occurredOn: event.target.value })} /></label><label className="block text-xs font-medium text-slate-600">หมวดรายรับ *<select className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" required value={saleReceiptDraft.categoryCode} onChange={event => setSaleReceiptDraft({ ...saleReceiptDraft, categoryCode: event.target.value })}><option value="">เลือกหมวด</option>{financialCategories.filter(row => row.direction === 'IN').map(row => <option key={row.code} value={row.code}>{row.nameTh}</option>)}</select></label><label className="block text-xs font-medium text-slate-600">ช่องทางรับเงิน *<select className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" required value={saleReceiptDraft.channelCode} onChange={event => setSaleReceiptDraft({ ...saleReceiptDraft, channelCode: event.target.value })}><option value="">เลือกช่องทาง</option>{channels.map(row => <option key={row.code} value={row.code}>{row.nameTh}</option>)}</select></label><label className="block text-xs font-medium text-slate-600 sm:col-span-2">เลขอ้างอิง / ใบเสร็จ<input className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" maxLength={150} value={saleReceiptDraft.reference} onChange={event => setSaleReceiptDraft({ ...saleReceiptDraft, reference: event.target.value })} /></label><label className="block text-xs font-medium text-slate-600 sm:col-span-2">สลิป / เอกสาร<input className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" type="file" accept="image/*,application/pdf" onChange={event => setSaleReceiptDraft({ ...saleReceiptDraft, slip: event.target.files?.[0] ?? null })} /></label><label className="block text-xs font-medium text-slate-600 sm:col-span-2">หมายเหตุ<textarea className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" rows={2} maxLength={1000} value={saleReceiptDraft.note} onChange={event => setSaleReceiptDraft({ ...saleReceiptDraft, note: event.target.value })} /></label></div>
        {error ? <p role="alert" className="m-0 text-sm text-rose-700">{error}</p> : null}<div className="flex justify-end gap-2"><Button type="button" disabled={busy} onClick={() => { setSaleReceiptAsset(null); setSaleReceiptDraft(null) }}>ยกเลิก</Button><Button type="submit" variant="primary" disabled={busy}>{busy ? 'กำลังบันทึก…' : 'บันทึกรายรับ'}</Button></div>
      </form> : null}
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
