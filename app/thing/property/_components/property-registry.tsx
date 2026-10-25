'use client'

import { useRef, useState } from 'react'
import Link from 'next/link'
import { Building2, House, Layers3, MapPin, Plus, Search, Unlink, X } from 'lucide-react'
import { PageContainer } from '@/components/ui/page-container'
import { Header } from '@/components/ui/header'
import { Button } from '@/components/ui/button'
import { Modal } from '@/components/ui/modal'
import { saveAssetWorkspace } from '../../_shared/actions'
import { assetCosts, money, propertyAssetIds, propertyTotalCost, propertyTypes, propertyStatuses, propertyAddressFields, type AssetData, type Home, type Property } from '../../_shared/model'
import { categoryPath, isPropertyComponent, type AssetCategory } from '../categories'

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
  const [notice, setNotice] = useState('')
  const [error, setError] = useState('')
  const [removing, setRemoving] = useState<Property | null>(null)
  const [busy, setBusy] = useState(false)
  const properties = data.properties ?? []
  const linked = new Set(properties.flatMap(propertyAssetIds))
  const eligible = data.homes.filter(home => !home.archivedOn && (isPropertyComponent(home.categoryCode, 'LAND', categories) || isPropertyComponent(home.categoryCode, 'BUILDINGS', categories)))
  const visible = properties.filter(property => `${property.code} ${property.name} ${locationText(property)}`.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()))
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
    <Header title="Property · รวมอสังหาริมทรัพย์" icon={<House size={21} />} description="รวมที่ดิน อาคาร และสิ่งปลูกสร้างในสถานที่เดียวกัน โดยอ้างอิงสินทรัพย์เดิม" actions={canWrite ? <Button variant="primary" disabled={open || busy} onClick={() => { setEditing(null); setOpen(true); setNotice(''); setError('') }}><Plus size={15} />สร้าง Property</Button> : undefined} />
    <div className="property-hero"><div><span className="property-eyebrow">PROPERTY → ASSETS</span><h2>หนึ่งสถานที่ หลายสินทรัพย์</h2><p>เริ่มจากที่ดิน แล้วเพิ่มบ้าน รั้ว โรงรถ หรือสวนได้ภายหลัง ต้นทุนอยู่กับสินทรัพย์แต่ละรายการเสมอ</p><Link href="/thing/asset">ไปทะเบียนสินทรัพย์ →</Link></div><div className="property-hero-count"><strong>{properties.length}</strong><span>Property ในทะเบียน</span></div></div>
    <div className="asset-stats mt-4"><div className="asset-stat"><span>สินทรัพย์ที่รวมแล้ว</span><strong>{linked.size} รายการ</strong></div><div className="asset-stat"><span>พร้อมนำมารวม</span><strong>{eligible.filter(home => !linked.has(home.id)).length} รายการ</strong></div><div className="asset-stat"><span>ต้นทุนสินทรัพย์ที่รวมแล้ว · ทุกสถานะ</span><strong>{money(properties.reduce((sum, property) => sum + propertyTotalCost(property, data.homes), 0))} บาท</strong></div></div>
    {notice ? <p role="status" className="asset-notice">{notice}</p> : null}
    {error && !removing ? <p role="alert" className="asset-error">{error}</p> : null}
    {open && canWrite ? <PropertyForm key={`${editing?.id ?? 'new'}-${data.revision}`} data={data} categories={categories} editing={editing} onSaved={next => { setData(next); setOpen(false); setNotice('บันทึก Property และสินทรัพย์ที่เชื่อมแล้ว') }} onCancel={() => setOpen(false)} /> : null}
    <>
      <div className="asset-panel-title"><h2 className="text-base font-semibold">รายการ Property</h2><label className="property-search"><Search size={15} aria-hidden="true" /><input aria-label="ค้นหา Property" placeholder="ค้นหาชื่อ รหัส หรือสถานที่" value={query} onChange={event => setQuery(event.target.value)} /></label></div>
      {!visible.length ? <div className="asset-panel asset-empty"><Layers3 className="mx-auto mb-3" size={28} /><h3>{properties.length ? 'ไม่พบ Property ที่ค้นหา' : 'เริ่มรวมสินทรัพย์เป็น Property'}</h3><p>เลือกที่ดินหรือสิ่งปลูกสร้างที่บันทึกไว้ใน Asset อย่างน้อย 1 รายการ</p>{canWrite && !properties.length ? <Button variant="primary" onClick={() => { setEditing(null); setOpen(true) }}><Plus size={15} />สร้าง Property แรก</Button> : null}</div> : null}
      {visible.map(property => {
        const members = propertyAssetIds(property).map(id => data.homes.find(home => home.id === id)!).filter(Boolean)
        return <section className="asset-panel" key={property.id} aria-label={property.code}>
          <div className="asset-panel-title"><div><small>{property.code} · {propertyTypes[property.type ?? 'RESIDENTIAL']}</small><h2>{property.name}</h2></div><span className="property-status">{propertyStatuses[property.status ?? 'ACTIVE']}</span></div>
          {locationText(property) ? <p className="property-location"><MapPin size={14} aria-hidden="true" />{locationText(property)}</p> : null}
          {property.description ? <p className="asset-hint">{property.description}</p> : null}
          {property.latitude !== undefined || property.longitude !== undefined ? <p className="asset-hint">พิกัด: {property.latitude ?? '—'}, {property.longitude ?? '—'}</p> : null}
          <div className="property-members">{members.map(home => <SourceRow key={home.id} home={home} categories={categories} />)}</div>
          <div className="property-card-footer"><span>{members.length} สินทรัพย์ · ต้นทุนรวม <strong>{money(propertyTotalCost(property, data.homes))} บาท</strong></span>{canWrite ? <div className="asset-tools"><Button disabled={busy} onClick={() => { setEditing(property); setOpen(true); setNotice(''); setError('') }}>แก้ไข / เพิ่มสินทรัพย์</Button><Button disabled={busy} onClick={() => { setRemoving(property); setError('') }}><Unlink size={14} />ยกเลิกการรวม</Button></div> : null}</div>
        </section>
      })}
    </>
    <p className="asset-hint">ต้นทุนรวมอ่านจากราคาซื้อหรือ BOQ และรายการเพิ่มเติมที่ยังไม่รวมในราคาหลักของแต่ละ Asset ไม่สร้างต้นทุนหรือรายการรับ–จ่ายใหม่ ราคาประเมินรวมไม่ได้คำนวณอัตโนมัติ เพราะอาจมีการประเมินบ้านพร้อมที่ดินที่ครอบคลุมสินทรัพย์อื่นอยู่แล้ว</p>
    <Modal open={Boolean(removing)} title="ยกเลิกการรวม Property" onClose={() => { if (!busy) setRemoving(null) }}><p className="text-sm leading-7">ยกเลิก “{removing?.name}” และปลดการเชื่อมสินทรัพย์ทั้งหมด? ที่ดิน อาคาร BOQ และประวัติต้นทางจะยังอยู่ สามารถนำไปจัดกลุ่มใหม่ได้</p>{error ? <p role="alert" className="asset-error">{error}</p> : null}<div className="asset-form-actions"><Button disabled={busy} onClick={() => setRemoving(null)}>กลับ</Button><Button variant="danger" disabled={busy} onClick={() => void remove()}>{busy ? 'กำลังบันทึก…' : 'ยืนยันยกเลิกการรวม'}</Button></div></Modal>
  </div></PageContainer>
}

function SourceRow({ home, categories, remove }: { home: Home; categories: AssetCategory[]; remove?: () => void }) {
  const land = isPropertyComponent(home.categoryCode, 'LAND', categories)
  const costs = assetCosts(home)
  return <div className="property-source"><div className="property-source-icon" aria-hidden="true">{land ? <MapPin size={19} /> : <Building2 size={19} />}</div><div className="property-source-info"><small>{home.assetCode ?? home.id} · {land ? 'ที่ดิน' : 'อาคาร / สิ่งปลูกสร้าง'}</small><strong>{home.name}</strong><small>{land ? `โฉนด ${home.landDetails?.deedNumber || 'ยังไม่ระบุ'}` : home.address || categoryPath(home.categoryCode, categories)}</small><small>{home.costSource === 'boq' ? 'BOQ' : 'ราคาซื้อ'} {money(costs.main)}{costs.additions ? ` + เพิ่มเติม ${money(costs.additions)}` : ''} บาท</small></div><strong className="property-source-cost">{money(costs.total)} บาท</strong>{remove ? <button type="button" className="property-remove" aria-label={`นำ ${home.name} ออกจากการรวม`} onClick={remove}><X size={16} /></button> : null}</div>
}

function PropertyForm({ data, categories, editing, onSaved, onCancel }: { data: AssetData; categories: AssetCategory[]; editing: Property | null; onSaved: (data: AssetData) => void; onCancel: () => void }) {
  const [draft, setDraft] = useState<Property>(() => ({ ...editing, id: editing?.id ?? '', name: editing?.name ?? '', code: editing?.code ?? nextCode(data), type: editing?.type ?? 'RESIDENTIAL', status: editing?.status ?? 'PLANNING', assetIds: editing ? propertyAssetIds(editing) : [], landId: undefined, buildingId: undefined }))
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<'ALL' | 'LAND' | 'BUILDINGS'>('ALL')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const saving = useRef(false)
  const used = new Map((data.properties ?? []).filter(property => property.id !== editing?.id).flatMap(property => propertyAssetIds(property).map(id => [id, property.code] as const)))
  const sources = data.homes.filter(home => !home.archivedOn && (isPropertyComponent(home.categoryCode, 'LAND', categories) || isPropertyComponent(home.categoryCode, 'BUILDINGS', categories)))
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
