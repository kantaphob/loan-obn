'use client'

import { useState } from 'react'
import Link from 'next/link'
import { House, Plus } from 'lucide-react'
import { PageContainer } from '@/components/ui/page-container'
import { Header } from '@/components/ui/header'
import { Button } from '@/components/ui/button'
import { saveAssetWorkspace } from '../../_shared/actions'
import { assetCosts, money, newHome, propertyCosts, type AssetData, type Home, type Property } from '../../_shared/model'
import { isPropertyComponent, type AssetCategory } from '../categories'

function nextCode(prefix: string, used: string[]) {
  let sequence = 1
  while (used.includes(`${prefix}-${String(sequence).padStart(3, '0')}`)) sequence++
  return `${prefix}-${String(sequence).padStart(3, '0')}`
}

export function PropertyRegistry({ initial, categories, canWrite }: { initial: AssetData; categories: AssetCategory[]; canWrite: boolean }) {
  const [data, setData] = useState(initial)
  const [editing, setEditing] = useState<Property | null>(null)
  const [open, setOpen] = useState(!initial.properties?.length)
  const [notice, setNotice] = useState('')
  return <PageContainer><div className="asset-workspace">
    <Header title="PROPERTY · บ้านพร้อมที่ดิน" icon={<House size={21} />} description="เชื่อมที่ดินและบ้านเป็นทรัพย์สินเดียว พร้อมต้นทุนจากสินทรัพย์ต้นทาง" actions={canWrite ? <Button variant="primary" onClick={() => { setEditing(null); setOpen(true); setNotice('') }}><Plus size={15} />สร้าง PROPERTY</Button> : undefined} />
    <nav className="asset-tools mb-5" aria-label="จัดการสินทรัพย์"><Link href="/thing/asset">ทะเบียนสินทรัพย์</Link></nav>
    <p role="status">{notice}</p>
    {data.properties?.map(property => {
      const costs = propertyCosts(property, data.homes)
      const land = data.homes.find(home => home.id === property.landId)!
      const building = data.homes.find(home => home.id === property.buildingId)!
      return <section className="asset-panel" key={property.id} aria-label={property.code}>
        <div className="asset-panel-title"><div><small>{property.code}</small><h2>{property.name}</h2></div>{canWrite ? <Button onClick={() => { setEditing(property); setOpen(true); setNotice('') }}>แก้ไขความสัมพันธ์</Button> : null}</div>
        <div className="asset-columns"><SourceSummary title="ที่ดิน" asset={land} amount={costs.land} /><SourceSummary title="บ้าน" asset={building} amount={costs.building} /></div>
        <div className="asset-total">ต้นทุนรวม <strong>{money(costs.total)} บาท</strong></div>
      </section>
    })}
    {!data.properties?.length && !canWrite ? <p className="asset-empty">ยังไม่มี PROPERTY</p> : null}
    {open && canWrite ? <PropertyForm key={`${editing?.id ?? 'new'}-${data.revision}`} data={data} categories={categories} editing={editing} onSaved={next => { setData(next); setOpen(false); setNotice('บันทึก PROPERTY และความสัมพันธ์แล้ว') }} onCancel={() => setOpen(false)} /> : null}
    <p className="asset-notice">PROPERTY เก็บเฉพาะลิงก์ที่ดินและบ้าน ต้นทุนรวมคำนวณจากสินทรัพย์ต้นทางทุกครั้ง จึงไม่นำยอด PROPERTY ไปบวกซ้ำในทะเบียนสินทรัพย์ เมื่อแก้ BOQ ยอดรวมจะเปลี่ยนตามหลังโหลดข้อมูลใหม่</p>
  </div></PageContainer>
}

function SourceSummary({ title, asset, amount }: { title: string; asset: Home; amount: number }) {
  return <div className="asset-stat"><span>{title} · {asset.id}</span><h3>{asset.name}</h3><small>{asset.landDetails ? `โฉนดเลขที่ ${asset.landDetails.deedNumber || 'ยังไม่ระบุ'}` : asset.address}</small><strong>{money(amount)} บาท</strong><small>{asset.costSource === 'boq' ? 'ต้นทุนจาก BOQ ที่ใช้งาน' : 'ราคาซื้อ'} รวมต้นทุนเพิ่มเติมที่ยังไม่รวมในราคาหลัก</small></div>
}

function PropertyForm({ data, categories, editing, onSaved, onCancel }: { data: AssetData; categories: AssetCategory[]; editing: Property | null; onSaved: (next: AssetData) => void; onCancel: () => void }) {
  const [name, setName] = useState(editing?.name ?? 'บ้านพร้อมที่ดิน · บ้านเลขที่ 99')
  const [code, setCode] = useState(editing?.code ?? nextCode('PROPERTY', (data.properties ?? []).map(row => row.code)))
  const [landId, setLandId] = useState(editing?.landId ?? '')
  const [buildingId, setBuildingId] = useState(editing?.buildingId ?? '')
  const [deed, setDeed] = useState('XXX')
  const [address, setAddress] = useState('บ้านเลขที่ 99 หมู่ 7 สว่างไทรงาม')
  const [landPrice, setLandPrice] = useState('1000000')
  const [buildingPrice, setBuildingPrice] = useState('1970000')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const used = new Set((data.properties ?? []).filter(row => row.id !== editing?.id).flatMap(row => [row.landId, row.buildingId]))
  const available = (root: 'LAND' | 'BUILDINGS') => data.homes.filter(home => !home.archivedOn && !used.has(home.id) && isPropertyComponent(home.categoryCode, root, categories))
  const land = data.homes.find(home => home.id === landId)
  const building = data.homes.find(home => home.id === buildingId)
  const landCost = land ? assetCosts(land).total : Number(landPrice)
  const buildingCost = building ? assetCosts(building).total : Number(buildingPrice)
  const validAmounts = [landCost, buildingCost].every(value => Number.isFinite(value) && value >= 0)
  async function save() {
    if (busy) return
    setBusy(true); setError('')
    try {
      const homes = [...data.homes]
      let selectedLand = land
      let selectedBuilding = building
      if (!selectedLand) {
        selectedLand = { ...newHome(`โฉนดเลขที่ ${deed.trim()}`), id: nextCode('LAND', homes.map(home => home.id)), categoryCode: 'LAND', financing: 'cash', purchasePrice: Number(landPrice), landDetails: { deedNumber: deed.trim(), areaSquareWa: 0, valuationOn: '', valuationSource: '', projectionYears: 5 } }
        if (!deed.trim()) throw new Error('กรุณาระบุเลขโฉนด')
        homes.push(selectedLand)
      }
      if (!selectedBuilding) {
        if (!address.trim()) throw new Error('กรุณาระบุบ้านเลขที่และที่อยู่')
        selectedBuilding = { ...newHome(address.trim()), id: nextCode('BLD', homes.map(home => home.id)), address: address.trim(), financing: 'cash', costSource: 'boq', boq: [{ id: crypto.randomUUID(), category: 'งานก่อสร้าง', name: 'ต้นทุนก่อสร้างรวมตาม BOQ', spec: 'ยอดสรุปเริ่มต้นตาม BOQ ที่ผู้ใช้ระบุ', quantity: 1, unit: 'งาน', price: Number(buildingPrice), labor: 0, paid: 0, vendor: '', reference: '', scope: 'construction' }] }
        homes.push(selectedBuilding)
      }
      const property: Property = { id: editing?.id ?? crypto.randomUUID(), code: code.trim(), name: name.trim(), landId: selectedLand.id, buildingId: selectedBuilding.id }
      const properties = editing ? (data.properties ?? []).map(row => row.id === editing.id ? property : row) : [...data.properties ?? [], property]
      const result = await saveAssetWorkspace({ ...data, homes, properties }, `${editing ? 'แก้ไข' : 'สร้าง'}ความสัมพันธ์ ${property.code}`)
      if (!result.data) throw new Error(result.error || 'บันทึกไม่สำเร็จ')
      onSaved(result.data)
    } catch (error) { setError(error instanceof Error ? error.message : 'บันทึกไม่สำเร็จ') }
    finally { setBusy(false) }
  }
  return <form className="asset-panel" onSubmit={event => { event.preventDefault(); void save() }}>
    <h2>{editing ? 'แก้ไข PROPERTY' : 'สร้าง PROPERTY'}</h2><p className="asset-hint">ค่าที่เตรียมไว้เป็นข้อมูลตัวอย่างตามโจทย์ ตรวจสอบก่อนบันทึก เลือกสินทรัพย์เดิมได้เพื่อหลีกเลี่ยงการสร้างซ้ำ</p>
    <fieldset disabled={busy}>
      <div className="asset-fields mb-5"><label><span>รหัส PROPERTY</span><input required pattern="PROPERTY-[0-9]{3,}" value={code} onChange={event => setCode(event.target.value)} /></label><label><span>ชื่อ PROPERTY</span><input required maxLength={3000} value={name} onChange={event => setName(event.target.value)} /></label></div>
      <div className="asset-columns">
        <section className="asset-stat"><h3>1. ที่ดิน</h3><div className="asset-fields !grid-cols-1">
          <label><span>สินทรัพย์ที่ดิน</span><select value={landId} onChange={event => setLandId(event.target.value)}><option value="">สร้างที่ดินใหม่ · {nextCode('LAND', data.homes.map(home => home.id))}</option>{available('LAND').map(home => <option key={home.id} value={home.id}>{home.name} · {home.id}</option>)}</select></label>
          {!landId ? <><label><span>โฉนดเลขที่</span><input required value={deed} onChange={event => setDeed(event.target.value)} /></label><label><span>ราคาซื้อที่ดิน (บาท)</span><input required type="number" min="0" max="1000000000000" step="0.01" value={landPrice} onChange={event => setLandPrice(event.target.value)} /></label></> : <small>ใช้ราคาจากสินทรัพย์เดิม: {money(landCost)} บาท</small>}
        </div></section>
        <section className="asset-stat"><h3>2. บ้าน</h3><div className="asset-fields !grid-cols-1">
          <label><span>สินทรัพย์บ้าน</span><select value={buildingId} onChange={event => setBuildingId(event.target.value)}><option value="">สร้างบ้านใหม่ · {nextCode('BLD', data.homes.map(home => home.id))}</option>{available('BUILDINGS').map(home => <option key={home.id} value={home.id}>{home.name} · {home.id}</option>)}</select></label>
          {!buildingId ? <><label><span>บ้านเลขที่และที่อยู่</span><input required value={address} onChange={event => setAddress(event.target.value)} /></label><label><span>ต้นทุนก่อสร้างตาม BOQ (บาท)</span><input required type="number" min="0" max="1000000000000" step="0.01" value={buildingPrice} onChange={event => setBuildingPrice(event.target.value)} /></label><small>บันทึกเป็น BOQ สรุป 1 รายการ ยังไม่ระบุยอดจ่ายจริง</small></> : <small>ใช้ต้นทุนจากสินทรัพย์เดิม: {money(buildingCost)} บาท</small>}
        </div></section>
      </div>
      <div className="asset-property mt-5" aria-live="polite"><div><p>{code}</p><h2>{name}</h2><span>ที่ดิน + บ้าน = PROPERTY</span></div><div><p>ต้นทุนรวม</p><strong className="text-2xl">{validAmounts ? money(landCost + buildingCost) : '—'} บาท</strong></div></div>
      {error ? <p role="alert" className="asset-error">{error}</p> : null}
      <div className="asset-form-actions"><Button onClick={onCancel}>ยกเลิก</Button><Button type="submit" variant="primary" disabled={!validAmounts}>{busy ? 'กำลังบันทึก…' : 'บันทึก PROPERTY'}</Button></div>
    </fieldset>
  </form>
}
