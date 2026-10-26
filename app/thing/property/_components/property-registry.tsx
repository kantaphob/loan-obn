'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { Building2, House, Layers3, MapPin, Plus, Search, Unlink, X, RefreshCw, ArrowUpRight, Wallet, TrendingUp } from 'lucide-react'
import { PageContainer } from '@/components/ui/page-container'
import { Header } from '@/components/ui/header'
import { Button } from '@/components/ui/button'
import { Modal } from '@/components/ui/modal'
import { getAssetWorkspace, saveAssetWorkspace } from '../../_shared/actions'
import { assetAcquisitionCost, assetCosts, isHomeDisposed, saleDeclarationAmounts, money, propertyAssetIds, propertyTotalCost, propertyTypes, propertyStatuses, propertyAddressFields, type AssetData, type Home, type Property } from '../../_shared/model'
import { categoryPath, isPropertyComponent, type AssetCategory } from '../categories'

import { assetFinancials, latestAssetAppraisal } from '../financials'

type Props = { initial: AssetData; categories: AssetCategory[]; canWrite: boolean }
const locationText = (property: Property) => [property.houseNumber && `เลขที่ ${property.houseNumber}`, property.moo && `หมู่ ${property.moo}`, property.village, property.subdistrict, property.district, property.province, property.postalCode].filter(Boolean).join(' · ')
function nextCode(data: AssetData) {
  const numbers = (data.properties ?? []).map(property => Number(property.code.match(/-(\d+)$/)?.[1] ?? 0))
  return `PROP-${String(Math.max(0, ...numbers) + 1).padStart(3, '0')}`
}

export function PropertyRegistry({ initial, categories, canWrite }: Props) {
  const [data, setData] = useState(initial)
  const [editing, setEditing] = useState<Property | null>(null)
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [view, setView] = useState<'held' | 'sold' | 'all'>('held')
  const [notice, setNotice] = useState('')
  const [error, setError] = useState('')
  const [removing, setRemoving] = useState<Property | null>(null)
  const [busy, setBusy] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const refreshLock = useRef(false)
  async function refresh() {
    if (refreshLock.current || open || busy || removing) return
    refreshLock.current = true; setRefreshing(true)
    try { const latest = await getAssetWorkspace(); setData(latest.data); setError('') }
    catch { setError('โหลดข้อมูล Asset ล่าสุดไม่สำเร็จ กรุณาลองใหม่') }
    finally { refreshLock.current = false; setRefreshing(false) }
  }
  useEffect(() => {
    const update = () => { if (document.visibilityState === 'visible') void refresh() }
    window.addEventListener('focus', update); document.addEventListener('visibilitychange', update)
    return () => { window.removeEventListener('focus', update); document.removeEventListener('visibilitychange', update) }
  })
  const properties = data.properties ?? []
  const soldProperty = (property: Property) => property.status === 'DISPOSED' || propertyAssetIds(property).some(id => data.homes.some(home => home.id === id && isHomeDisposed(home)))
  const heldProperties = properties.filter(property => !soldProperty(property))
  const soldProperties = properties.filter(soldProperty)
  const linked = new Set(heldProperties.flatMap(propertyAssetIds))
  const allLinked = new Set(properties.flatMap(propertyAssetIds))
  const eligible = data.homes.filter(home => !home.archivedOn && !isHomeDisposed(home) && (isPropertyComponent(home.categoryCode, 'LAND', categories) || isPropertyComponent(home.categoryCode, 'BUILDINGS', categories)))
  const visible = properties.filter(property => (view === 'all' || (view === 'sold' ? soldProperty(property) : !soldProperty(property))) && `${property.code} ${property.name} ${locationText(property)}`.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()))
  const financials = data.homes.filter(home => linked.has(home.id) && !isHomeDisposed(home)).map(assetFinancials)
  const mainCost = financials.reduce((sum, row) => sum + row.main, 0)
  const additionalCost = financials.reduce((sum, row) => sum + row.additions, 0)
  const developmentBudget = financials.reduce((sum, row) => sum + row.budget, 0)
  async function remove() {
    if (!removing || busy) return
    setBusy(true); setError('')
    try {
      const result = await saveAssetWorkspace({ ...data, properties: properties.filter(property => property.id !== removing.id) }, `ยกเลิกการรวม ${removing.code}`)
      if (!result.data) throw new Error(result.error || 'บันทึกไม่สำเร็จ')
      setData(result.data); setRemoving(null); setNotice('ยกเลิกการรวมแล้ว สินทรัพย์และต้นทุนต้นทางยังอยู่ครบ')
    } catch (error) { setError(error instanceof Error ? error.message : 'บันทึกไม่สำเร็จ') }
    finally { setBusy(false) }
  }
  return <PageContainer><div className="asset-workspace property-workspace">
    <Header title="Property · รวมอสังหาริมทรัพย์" icon={<House size={21} />} description="รวมที่ดิน อาคาร และสิ่งปลูกสร้างในสถานที่เดียวกัน โดยอ้างอิงสินทรัพย์เดิม" actions={canWrite ? <Button variant="primary" disabled={open || busy || refreshing} onClick={() => { setEditing(null); setOpen(true); setNotice(''); setError('') }}><Plus size={15} />สร้าง Property</Button> : undefined} />
    <div className="property-portfolio"><div className="property-portfolio-heading"><div><span className="property-eyebrow">PROPERTY PORTFOLIO</span><h2>ภาพรวมมูลค่าอสังหาริมทรัพย์</h2><p>{heldProperties.length} Property ที่ถืออยู่ · {linked.size} สินทรัพย์ที่เชื่อมแล้ว · ไม่รวมรถ</p></div><Link href="/thing/asset">จัดการ Asset <ArrowUpRight size={15} /></Link></div><div className="property-money-hero"><span>ต้นทุนทรัพย์สินที่ยังถืออยู่</span><strong>{money(mainCost + additionalCost)} <em>บาท</em></strong><small>อ้างอิงราคาซื้อ / BOQ และต้นทุนเพิ่มที่รับรู้ใน Asset</small></div><div className="property-portfolio-breakdown"><div><span>ต้นทุนหลัก</span><strong>{money(mainCost)} <small>บาท</small></strong></div><div><span>ต้นทุนเพิ่มในทะเบียน</span><strong>+ {money(additionalCost)} <small>บาท</small></strong></div><div><span>งบพัฒนา / โครงการ</span><strong>{money(developmentBudget)} <small>บาท</small></strong></div></div></div>
    <div className="property-sync"><span>ข้อมูลจาก Asset · รุ่น {data.revision} · พร้อมรวมเพิ่ม {eligible.filter(home => !allLinked.has(home.id)).length} รายการ</span><Button disabled={refreshing || open || busy || Boolean(removing)} onClick={() => void refresh()}><RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} />{refreshing ? 'กำลังอัปเดต…' : 'อัปเดตข้อมูล'}</Button></div>
    {notice ? <p role="status" className="asset-notice">{notice}</p> : null}
    {error && !removing ? <p role="alert" className="asset-error">{error}</p> : null}
    {open && canWrite ? <PropertyForm key={`${editing?.id ?? 'new'}-${data.revision}`} data={data} categories={categories} editing={editing} onSaved={next => { setData(next); setOpen(false); setNotice('บันทึก Property และสินทรัพย์ที่เชื่อมแล้ว') }} onCancel={() => setOpen(false)} /> : null}
    <>
      <div className="asset-panel-title"><h2 className="text-base font-semibold">รายการ Property</h2><label className="property-search"><Search size={15} aria-hidden="true" /><input aria-label="ค้นหา Property" placeholder="ค้นหาชื่อ รหัส หรือสถานที่" value={query} onChange={event => setQuery(event.target.value)} /></label></div>
      <div className="property-view-tabs" role="group" aria-label="สถานะ Property">{([['held', `ถืออยู่ ${heldProperties.length}`], ['sold', `ขายแล้ว ${soldProperties.length}`], ['all', `ทั้งหมด ${properties.length}`]] as const).map(([value, label]) => <button key={value} type="button" aria-pressed={view === value} onClick={() => setView(value)}>{label}</button>)}</div>
      {!visible.length ? <div className="asset-panel asset-empty"><Layers3 className="mx-auto mb-3" size={28} /><h3>{properties.length ? view === 'sold' ? 'ยังไม่มีรายการขายแล้ว' : 'ไม่พบ Property ในมุมมองนี้' : 'เริ่มรวมสินทรัพย์เป็น Property'}</h3><p>เลือกที่ดินหรือสิ่งปลูกสร้างที่บันทึกไว้ใน Asset อย่างน้อย 1 รายการ</p>{canWrite && !properties.length ? <Button variant="primary" onClick={() => { setEditing(null); setOpen(true) }}><Plus size={15} />สร้าง Property แรก</Button> : null}</div> : null}
      {visible.map(property => {
        const members = propertyAssetIds(property).map(id => data.homes.find(home => home.id === id)!).filter(Boolean)
        const sold = soldProperty(property)
        return <section className="asset-panel property-overview-card" key={property.id} aria-label={property.code}>
          <div className="asset-panel-title"><div><small>{property.code} · {propertyTypes[property.type ?? 'RESIDENTIAL']}</small><h2>{property.name}</h2></div><span className={`property-status${sold ? ' property-status-sold' : ''}`}>{sold ? 'ขายแล้ว' : propertyStatuses[property.status ?? 'ACTIVE']}</span></div>
          {locationText(property) ? <p className="property-location"><MapPin size={14} aria-hidden="true" />{locationText(property)}</p> : null}
          {property.description ? <p className="asset-hint">{property.description}</p> : null}
          {property.latitude !== undefined || property.longitude !== undefined ? <p className="asset-hint">พิกัด: {property.latitude ?? '—'}, {property.longitude ?? '—'}</p> : null}
          {sold ? <PropertySaleSummary members={members} /> : null}
          {!sold ? <PropertyMoney members={members} /> : null}
          <div className="property-members">{members.map(home => <SourceRow key={home.id} home={home} categories={categories} sold={sold} />)}</div>
          <div className="property-card-footer"><span>{members.length} สินทรัพย์{sold ? ' · จำหน่ายแล้ว' : <> · ต้นทุนรวม <strong>{money(propertyTotalCost(property, data.homes))} บาท</strong></>}</span>{canWrite ? <div className="asset-tools"><Button disabled={busy || refreshing || sold} onClick={() => { setEditing(property); setOpen(true); setNotice(''); setError('') }}>แก้ไข / เพิ่มสินทรัพย์</Button><Button disabled={busy} onClick={() => { setRemoving(property); setError('') }}><Unlink size={14} />ยกเลิกการรวม</Button></div> : null}</div>
        </section>
      })}
    </>
    <p className="asset-hint">ต้นทุนรวมอ่านจากราคาซื้อหรือ BOQ และรายการเพิ่มเติมที่ยังไม่รวมในราคาหลักของแต่ละ Asset ไม่สร้างต้นทุนหรือรายการรับ–จ่ายใหม่ ราคาประเมินรวมไม่ได้คำนวณอัตโนมัติ เพราะอาจมีการประเมินบ้านพร้อมที่ดินที่ครอบคลุมสินทรัพย์อื่นอยู่แล้ว</p>
    <Modal open={Boolean(removing)} title="ยกเลิกการรวม Property" onClose={() => { if (!busy) setRemoving(null) }}><p className="text-sm leading-7">ยกเลิก “{removing?.name}” และปลดการเชื่อมสินทรัพย์ทั้งหมด? ที่ดิน อาคาร BOQ และประวัติต้นทางจะยังอยู่ สามารถนำไปจัดกลุ่มใหม่ได้</p>{error ? <p role="alert" className="asset-error">{error}</p> : null}<div className="asset-form-actions"><Button disabled={busy} onClick={() => setRemoving(null)}>กลับ</Button><Button variant="danger" disabled={busy} onClick={() => void remove()}>{busy ? 'กำลังบันทึก…' : 'ยืนยันยกเลิกการรวม'}</Button></div></Modal>
  </div></PageContainer>
}

function PropertySaleSummary({ members }: { members: Home[] }) {
  const source = members.find(home => home.saleDeclaration)
  if (!source?.saleDeclaration) return <p className="asset-notice">ขายแล้ว · เก็บต้นทุนเดิมไว้ในประวัติ รายละเอียดการขายดูได้จากทะเบียน Asset</p>
  const sale = source.saleDeclaration
  const landCost = sale.landCost ?? source.landValue
  const amounts = saleDeclarationAmounts(sale, landCost)
  const landBase = `จากที่ดิน ${money(landCost)} บาท`
  const rows = [['ขายบ้าน', sale.salePrice, 'รับ'], ['รับคืนค่าแบบ', sale.designRefund, 'รับ'], ['ปิดธนาคาร', sale.bankPayoff, 'จ่าย'], [`จดจำนอง ${sale.mortgageRate}% ${landBase}`, amounts.mortgage, 'จ่าย'], [`ค่าโอน ${sale.transferRate}% ${landBase}`, amounts.transfer, 'จ่าย'], [`อากรสแตมป์ ${sale.stampRate}% ${landBase}`, amounts.stamp, 'จ่าย']] as const
  const actualSale = source.sale
  const actualReceived = actualSale?.payments.reduce((sum, payment) => sum + payment.amount, 0) ?? 0
  const acquisitionCost = members.reduce((sum, home) => sum + assetAcquisitionCost(home), 0)
  const costDetail = sale.houseCost !== undefined ? `บ้าน ${money(sale.houseCost)} + ที่ดิน ${money(sale.landCost ?? 0)}` : ''
  return <section className="property-sale-summary" aria-label="สรุปรายการขาย"><div className="property-sale-totals"><div><span>เงินรับตามข้อมูลแจ้งขาย</span><strong>{money(amounts.income)} บาท</strong></div><div><span>ปิดธนาคารและค่าธรรมเนียม</span><strong>{money(amounts.outflow)} บาท</strong></div><div><span>เงินคงเหลือตามรายการ</span><strong>{money(amounts.remaining)} บาท</strong></div></div><div className="asset-table-scroll"><table><thead><tr><th>รายการ</th><th>ประเภท</th><th>จำนวนเงิน (บาท)</th></tr></thead><tbody>{rows.map(([label, amount, direction]) => <tr key={label}><td>{label}</td><td>{direction}</td><td>{money(amount)}</td></tr>)}</tbody></table></div>{actualSale ? <p className="asset-hint">รับเงินจริง {money(actualReceived)} บาท · วันที่ขาย {actualSale.date} · เชื่อมรายการบัญชีรับแล้ว · ยอดปิดธนาคารและค่าธรรมเนียมข้างต้นเป็นยอดคำนวณ ยังไม่พบรายการจ่ายจริงที่เชื่อม</p> : <p className="asset-hint">เป็นข้อมูลแจ้งขาย ยังไม่มีรายการรับเงินจริงที่เชื่อมในบัญชี</p>}<p className="asset-hint">ค่าธรรมเนียมคำนวณจากที่ดิน {money(landCost)} บาท · ต้นทุนอ้างอิงก่อนขาย {costDetail ? `${costDetail} = ` : ''}{money(acquisitionCost)} บาท · เงินคงเหลือข้างต้นไม่ใช่กำไร</p></section>
}

function PropertyMoney({ members }: { members: Home[] }) {
  const rows = members.map(assetFinancials)
  const sum = (key: 'main' | 'additions' | 'expenses' | 'developmentActual' | 'projectActual' | 'budget') => rows.reduce((value, row) => value + row[key], 0)
  return <div className="property-finance-grid"><div><Wallet size={16} /><span>ราคาซื้อ / BOQ</span><strong>{money(sum('main'))}</strong><small>บาท · ต้นทุนหลัก</small></div><div className="property-finance-add"><TrendingUp size={16} /><span>ต้นทุนเพิ่มในทะเบียน</span><strong>+ {money(sum('additions'))}</strong><small>บาท · รวมอยู่ในต้นทุนแล้ว</small></div><div><span>พัฒนา / โครงการจริง</span><strong>{money(sum('developmentActual') + sum('projectActual'))}</strong><small>บาท · ติดตามแยก ไม่บวกซ้ำ</small><small>งบที่ระบุ {money(sum('budget'))} บาท</small></div><div><span>ซ่อมบำรุง / ค่าใช้จ่าย</span><strong>{money(sum('expenses'))}</strong><small>บาท · ไม่เพิ่มมูลค่าสินทรัพย์</small></div></div>
}

function SourceRow({ home, categories, remove, sold = false }: { home: Home; categories: AssetCategory[]; remove?: () => void; sold?: boolean }) {
  const land = isPropertyComponent(home.categoryCode, 'LAND', categories)
  const costs = assetFinancials(home)
  const appraisal = latestAssetAppraisal(home)
  return <article className="property-source property-source-expanded"><div className="property-source-top"><div className="property-source-icon" aria-hidden="true">{land ? <MapPin size={19} /> : <Building2 size={19} />}</div><div className="property-source-info"><small>{home.assetCode ?? home.id} · {land ? 'ที่ดิน' : 'อาคาร / สิ่งปลูกสร้าง'}</small><strong>{home.name}</strong><small>{land ? `โฉนด ${home.landDetails?.deedNumber || 'ยังไม่ระบุ'}` : home.address || categoryPath(home.categoryCode, categories)}</small></div>{remove ? <button type="button" className="property-remove" aria-label={`นำ ${home.name} ออกจากการรวม`} onClick={remove}><X size={16} /></button> : null}</div>
    {sold || home.disposedOn ? <p className="mb-0 mt-2 text-xs font-medium text-emerald-800">ขายแล้ว{home.disposedOn ? ` · ${home.disposedOn}` : ''}</p> : null}
    {!sold && !isHomeDisposed(home) ? <>
    <dl className="property-source-values"><div><dt>{home.costSource === 'boq' ? 'ต้นทุน BOQ' : 'ราคาซื้อ'}</dt><dd>{money(costs.main)}</dd></div><div><dt>ต้นทุนเพิ่มในทะเบียน</dt><dd className="property-positive">+ {money(costs.additions)}</dd></div><div className="property-source-total"><dt>ต้นทุนรวม</dt><dd>{money(costs.total)} <small>บาท</small></dd></div></dl>
    {appraisal ? <div className="property-appraisal"><span>ราคาประเมินล่าสุด <strong>{money(appraisal.amount)} บาท</strong></span><small>{appraisal.date} · {appraisal.source} · {appraisal.scope}</small></div> : <p className="property-no-appraisal">ยังไม่มีราคาประเมินที่ระบุวันที่และแหล่งที่มา</p>}
    {home.landValue > 0 && home.landDetails && ['asking', 'sale'].includes(home.landDetails.priceType ?? '') ? <div className="property-appraisal"><span>{home.landDetails.priceType === 'asking' ? 'ราคาประกาศขาย' : 'ราคาขายที่บันทึก'}<strong>{money(home.landValue)} บาท</strong></span><small>{home.landDetails.valuationOn || 'ยังไม่ระบุวันที่'} · {home.landDetails.valuationSource || 'ยังไม่ระบุแหล่งที่มา'}</small></div> : null}
    {costs.activity.length || costs.paid || costs.refunded || home.boq.length ? <details className="property-money-details"><summary>การปรับปรุงและเงินที่เกี่ยวข้อง · {costs.activity.length} รายการ</summary><div className="property-payment-summary"><span>ยอดจ่ายที่ระบุใน BOQ <b>{money(costs.boqPaid)}</b></span><span>จ่ายตามโครงการ <b>{money(costs.paid)}</b></span><span>รับคืน <b>{money(costs.refunded)}</b></span><span>จ่ายสุทธิ <b>{money(costs.netPaid)} บาท</b></span></div>{costs.activity.map(row => <div className="property-money-event" key={row.id}><div><strong>{row.name}</strong><small>{row.date || 'ยังไม่ระบุวันที่'} · {row.label}</small>{row.recognized > 0 ? <small>มูลค่ารับรู้ที่ระบุใน Asset: {money(row.recognized)} บาท · ไม่บวกซ้ำ</small> : null}</div><div className="property-event-amount"><b>{money(row.amount)}</b>{row.budget > 0 ? <small>งบ {money(row.budget)}</small> : null}{row.amount === 0 && row.budget > 0 ? <small>ยังไม่บันทึกต้นทุนจริง</small> : null}</div></div>)}<p className="asset-hint">ยอดโครงการจริง ยอดจ่าย และมูลค่าที่รับรู้แสดงคนละมุม ไม่ได้นำมาบวกกันเป็นต้นทุนใหม่</p></details> : null}
    </> : null}
  </article>
}

function PropertyForm({ data, categories, editing, onSaved, onCancel }: { data: AssetData; categories: AssetCategory[]; editing: Property | null; onSaved: (data: AssetData) => void; onCancel: () => void }) {
  const [draft, setDraft] = useState<Property>(() => ({ ...editing, id: editing?.id ?? '', name: editing?.name ?? '', code: editing?.code ?? nextCode(data), type: editing?.type ?? 'RESIDENTIAL', status: editing?.status ?? 'PLANNING', assetIds: editing ? propertyAssetIds(editing) : [], landId: undefined, buildingId: undefined }))
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<'ALL' | 'LAND' | 'BUILDINGS'>('ALL')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const saving = useRef(false)
  const used = new Map((data.properties ?? []).filter(property => property.id !== editing?.id).flatMap(property => propertyAssetIds(property).map(id => [id, property.code] as const)))
  const sources = data.homes.filter(home => !home.archivedOn && !isHomeDisposed(home) && (isPropertyComponent(home.categoryCode, 'LAND', categories) || isPropertyComponent(home.categoryCode, 'BUILDINGS', categories)))
  const visible = sources.filter(home => (filter === 'ALL' || isPropertyComponent(home.categoryCode, filter, categories)) && `${home.assetCode} ${home.name} ${home.landDetails?.deedNumber ?? ''} ${home.address}`.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()))
  const selected = sources.filter(home => draft.assetIds!.includes(home.id))
  const total = propertyTotalCost(draft, data.homes)
  function toggle(id: string) { setDraft(current => ({ ...current, assetIds: current.assetIds!.includes(id) ? current.assetIds!.filter(value => value !== id) : [...current.assetIds!, id] })) }
  async function save() {
    if (saving.current) return
    saving.current = true; setBusy(true); setError('')
    try {
      const { landId: _land, buildingId: _building, ...fields } = draft
      void _land; void _building
      const property: Property = { ...fields, id: editing?.id ?? crypto.randomUUID(), name: fields.name.trim(), code: fields.code.trim() }
      const properties = editing ? (data.properties ?? []).map(row => row.id === editing.id ? property : row) : [...data.properties ?? [], property]
      const result = await saveAssetWorkspace({ ...data, properties }, `${editing ? 'แก้ไข' : 'สร้าง'}การรวม ${property.code}`)
      if (!result.data) throw new Error(result.error || 'บันทึกไม่สำเร็จ')
      onSaved(result.data)
    } catch (error) { setError(error instanceof Error ? error.message : 'บันทึกไม่สำเร็จ') }
    finally { saving.current = false; setBusy(false) }
  }
  return <Modal open title={editing ? `แก้ไข ${editing.code}` : 'สร้าง Property ใหม่'} description="เลือกสินทรัพย์เดิมเพื่อรวมเป็น Property โดยไม่บันทึกต้นทุนซ้ำ" className="property-modal" onClose={() => { if (!saving.current) onCancel() }}>
    <form className="property-editor" onSubmit={event => { event.preventDefault(); void save() }}>
    <fieldset disabled={busy}>
      <section aria-label="ข้อมูล Property"><h3>1. ข้อมูลสถานที่</h3><div className="asset-fields"><label><span>รหัส Property</span><input required pattern="(PROP|PROPERTY)-[0-9]{3,}" value={draft.code} onChange={event => setDraft({ ...draft, code: event.target.value })} /></label><label><span>ชื่อ Property</span><input required maxLength={3000} placeholder="เช่น บ้านเลขที่ 99 หมู่ 7 สว่างไทรงาม" value={draft.name} onChange={event => setDraft({ ...draft, name: event.target.value })} /></label><label><span>ประเภทการใช้ประโยชน์</span><select value={draft.type} onChange={event => setDraft({ ...draft, type: event.target.value as Property['type'] })}>{Object.entries(propertyTypes).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label><label><span>สถานะ</span><select value={draft.status} onChange={event => setDraft({ ...draft, status: event.target.value as Property['status'] })}>{Object.entries(propertyStatuses).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label></div>
      <details className="mt-3"><summary>ที่อยู่ พิกัด และรายละเอียดเพิ่มเติม</summary><div className="asset-fields">{Object.entries(propertyAddressFields).map(([key, label]) => <label key={key}><span>{label}</span><input maxLength={3000} pattern={key === 'postalCode' ? '[0-9]{5}' : undefined} value={draft[key as keyof typeof propertyAddressFields] ?? ''} onChange={event => setDraft({ ...draft, [key]: event.target.value })} /></label>)}{(['latitude', 'longitude'] as const).map(key => <label key={key}><span>{key === 'latitude' ? 'ละติจูด' : 'ลองจิจูด'}</span><input type="number" min={key === 'latitude' ? -90 : -180} max={key === 'latitude' ? 90 : 180} step="0.0000001" value={draft[key] ?? ''} onChange={event => setDraft({ ...draft, [key]: event.target.value === '' ? undefined : Number(event.target.value) })} /></label>)}</div></details></section>
      <h3 className="mt-6">2. เลือกสินทรัพย์ที่อยู่ใน Property</h3><p className="asset-hint">เลือกได้หลายโฉนด หลายอาคาร และสิ่งปลูกสร้าง เช่น รั้ว โรงรถ หรือสวน เริ่มจากที่ดินอย่างเดียวได้ แล้วเพิ่มรายการภายหลัง</p>
      <div className="property-composer"><section className="property-source-picker" aria-label="เลือกสินทรัพย์"><div className="property-picker-tools"><label className="property-search"><Search size={15} aria-hidden="true" /><input aria-label="ค้นหาสินทรัพย์" placeholder="ชื่อ รหัส หรือเลขโฉนด" value={query} onChange={event => setQuery(event.target.value)} /></label><select aria-label="กรองประเภทสินทรัพย์" value={filter} onChange={event => setFilter(event.target.value as typeof filter)}><option value="ALL">ทุกประเภท</option><option value="LAND">ที่ดิน</option><option value="BUILDINGS">อาคาร / สิ่งปลูกสร้าง</option></select></div>
        <div className="property-choices">{visible.map(home => <label className="property-choice" key={home.id} data-selected={draft.assetIds!.includes(home.id)}><input type="checkbox" checked={draft.assetIds!.includes(home.id)} disabled={used.has(home.id) || draft.type === 'LAND_ONLY' && !isPropertyComponent(home.categoryCode, 'LAND', categories)} onChange={() => toggle(home.id)} /><span><small>{home.assetCode ?? home.id}</small><strong>{home.name}</strong><small>{categoryPath(home.categoryCode, categories)}</small>{used.has(home.id) ? <small className="text-amber-700">อยู่ใน {used.get(home.id)} แล้ว</small> : null}</span><strong>{money(assetCosts(home).total)} บาท</strong></label>)}{!visible.length ? <p className="asset-empty">ไม่พบสินทรัพย์ที่ตรงกับการค้นหา</p> : null}</div>
        <p className="asset-hint">ยังไม่มีสินทรัพย์ที่ต้องการ? <Link href="/thing/asset" target="_blank" rel="noopener noreferrer">เพิ่มที่ทะเบียน Asset ในแท็บใหม่ ↗</Link> แล้วบันทึกแบบร่างนี้หรือยกเลิกก่อนโหลดข้อมูลใหม่</p></section>
        <aside className="property-selection" aria-label="สรุปการรวม"><h3>สินทรัพย์ที่เลือก · {selected.length} รายการ</h3>{selected.map(home => <SourceRow key={home.id} home={home} categories={categories} remove={() => toggle(home.id)} />)}{!selected.length ? <p className="asset-empty">เลือกจากรายการด้านซ้ายเพื่อดูต้นทุนรวม</p> : null}<div className="property-selection-total"><span>ต้นทุนรวมจากสินทรัพย์</span><strong aria-live="polite">{money(total)} บาท</strong><small>ไม่มีการคัดลอกราคาหรือสร้างรายการจ่ายเพิ่ม</small></div></aside>
      </div>
      {draft.type === 'LAND_ONLY' && selected.some(home => !isPropertyComponent(home.categoryCode, 'LAND', categories)) ? <p role="alert" className="asset-error">ประเภทที่ดินเปล่าเชื่อมได้เฉพาะที่ดิน กรุณานำสิ่งปลูกสร้างออกหรือเปลี่ยนประเภท</p> : null}
      {error ? <p role="alert" className="asset-error">{error}</p> : null}
      <div className="asset-form-actions"><Button onClick={onCancel}>ยกเลิก</Button><Button type="submit" variant="primary" disabled={!selected.length}>{busy ? 'กำลังบันทึก…' : `บันทึกการรวม ${selected.length} สินทรัพย์`}</Button></div>
    </fieldset>
    </form>
  </Modal>
}
