'use client'

import { useState, type FormEvent, type ReactNode } from 'react'
import { House, Bike, Package, Plus, Pencil, Trash2, Download, ArrowLeft, Wallet, Landmark } from 'lucide-react'
import { Header } from '@/components/ui/header'
import { PageContainer } from '@/components/ui/page-container'
import { saveAssetWorkspace } from './actions'
import { balance, forecast, ghbPayments, money, newHome, roundMoney, today, type AssetData, type Home, type LoanRound, type Payment, type RatePeriod } from './model'

type Field = { name: string; label: string; value?: string | number; type?: string; optional?: boolean; options?: { value: string; label: string }[]; min?: number; max?: number; step?: string }
type Editor = { type: 'asset' | 'item' | 'boq' | 'payment' | 'room'; id?: string } | null
const labels = { house: 'อสังหาริมทรัพย์', vehicle: 'รถ', other: 'อื่น ๆ' }
const icon = { house: House, vehicle: Bike, other: Package }
const baht = (value: number) => `${money(value)} บาท`
function displayDate(value: string) { return value ? new Date(`${value}T00:00:00+07:00`).toLocaleDateString('th-TH', { timeZone: 'Asia/Bangkok' }) : 'ยังไม่ระบุ' }
function warrantyEnd(start: string, months: number) {
  if (!start || !months) return ''
  const d = new Date(`${start}T00:00:00Z`); const day = d.getUTCDate()
  d.setUTCDate(1); d.setUTCMonth(d.getUTCMonth() + months)
  const last = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate()
  d.setUTCDate(Math.min(day, last)); return d.toISOString().slice(0, 10)
}
function Fields({ fields }: { fields: Field[] }) {
  return <div className="asset-fields">{fields.map(f => <label key={f.name}><span>{f.label}{!f.optional ? ' *' : ''}</span>{f.options ? <select name={f.name} defaultValue={f.value} required={!f.optional}>{f.options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}</select> : <input name={f.name} type={f.type ?? 'text'} defaultValue={f.value ?? ''} required={!f.optional} min={f.min ?? (f.type === 'number' ? 0 : undefined)} max={f.max} step={f.step ?? (f.type === 'number' ? '.01' : undefined)} maxLength={f.type === 'text' || !f.type ? 3000 : undefined} />}</label>)}</div>
}
function Panel({ title, children, action }: { title: string; children: ReactNode; action?: ReactNode }) {
  return <section className="asset-panel"><div className="asset-panel-title"><h2>{title}</h2>{action}</div>{children}</section>
}
function Stat({ label, value, note }: { label: string; value: string; note?: string }) {
  return <div className="asset-stat"><span>{label}</span><strong>{value}</strong>{note ? <small>{note}</small> : null}</div>
}
function Empty({ children }: { children: ReactNode }) { return <p className="asset-empty">{children}</p> }

function Add({ children, onClick, disabled = false, enabled }: { children: ReactNode; onClick: () => void; disabled?: boolean; enabled: boolean }) {
  return <button type="button" className="asset-button" disabled={!enabled || disabled} onClick={onClick}><Plus size={15} aria-hidden="true" />{children}</button>
}

export function AssetWorkspace({ initial, canWrite }: { initial: AssetData; canWrite: boolean }) {
  const [data, setData] = useState(initial)
  const [selected, setSelected] = useState(initial.homes[0]?.id ?? '')
  const [tab, setTab] = useState('overview')
  const [editor, setEditor] = useState<Editor>(null)
  const [roundEditor, setRoundEditor] = useState<LoanRound | 'new' | null>(null)
  const [roundId, setRoundId] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [filter, setFilter] = useState('')
  const [extra, setExtra] = useState(0)
  const [importRows, setImportRows] = useState<Omit<Payment, 'id' | 'roundId'>[] | null>(null)
  const home = data.homes.find(h => h.id === selected) ?? data.homes[0]
  const latest = home.rounds.at(-1)
  const round = home.rounds.find(r => r.id === roundId) ?? latest
  const remaining = latest ? balance(home, latest) : 0
  const itemCost = home.items.reduce((s, i) => s + i.price * i.quantity, 0)
  const boqCost = home.boq.reduce((s, i) => s + i.price * i.quantity + i.labor, 0)
  const boqPaid = home.boq.reduce((s, i) => s + i.paid, 0)
  const actualInterest = home.payments.reduce((s, p) => s + p.interest, 0)
  const simulation = round ? forecast(round, round.opening, extra) : null
  const baseSimulation = round ? forecast(round) : null
  const filteredItems = home.items.filter(i => (!filter || i.room === filter))
  const editable = canWrite && !busy

  async function save(next: AssetData) {
    if (busy) return false
    setBusy(true); setError(''); setMessage('')
    try {
      const result = await saveAssetWorkspace(next)
      if (!result.data) { setError(result.error ?? 'บันทึกไม่สำเร็จ'); return false }
      setData(result.data); setMessage('บันทึกข้อมูลแล้ว'); return true
    } catch { setError('เชื่อมต่อไม่สำเร็จ กรุณาลองบันทึกอีกครั้ง'); return false }
    finally { setBusy(false) }
  }
  async function updateHome(next: Home) {
    return save({ ...data, homes: data.homes.map(h => h.id === next.id ? next : h) })
  }
  function open(type: NonNullable<Editor>['type'], id?: string) { setEditor({ type, id }); setRoundEditor(null); setImportRows(null); setError('') }
  function switchAsset(id: string) { setSelected(id); setEditor(null); setRoundEditor(null); setImportRows(null); setRoundId(''); setFilter(''); setTab('overview'); setError('') }
  function exportData() {
    const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }))
    const a = document.createElement('a'); a.href = url; a.download = `assets-${today()}.json`; a.click(); URL.revokeObjectURL(url)
  }
  function editorFields(): Field[] {
    if (!editor) return []
    if (editor.type === 'asset') {
      const h = editor.id ? home : newHome('')
      return [
        { name: 'name', label: 'ชื่อสินทรัพย์ เช่น รถ Forza / บ้านของฉัน', value: h.name },
        { name: 'kind', label: 'ประเภท', value: h.kind, options: Object.entries(labels).map(([value, label]) => ({ value, label })) },
        { name: 'financing', label: 'วิธีซื้อ', value: h.financing, options: [{ value: 'cash', label: 'ชำระเงินสด' }, { value: 'loan', label: 'กู้ / ผ่อนชำระ' }] },
        { name: 'purchasePrice', label: 'ราคาซื้อสินทรัพย์หลัก (ไม่รวมรายการย่อย)', value: h.purchasePrice, type: 'number' },
        { name: 'purchasedOn', label: 'วันที่ซื้อ', value: h.purchasedOn, type: 'date', optional: true },
        { name: 'buildingValue', label: 'มูลค่าปัจจุบันของตัวบ้าน / รถ / ทรัพย์', value: h.buildingValue, type: 'number' },
        { name: 'landValue', label: 'มูลค่าที่ดิน (เฉพาะอสังหาริมทรัพย์)', value: h.landValue, type: 'number' },
        { name: 'address', label: 'ที่อยู่ / ทะเบียน / รายละเอียด', value: h.address, optional: true },
      ]
    }
    if (editor.type === 'room') return [{ name: 'room', label: home.kind === 'house' ? 'ชื่อห้อง / พื้นที่' : 'ชื่อหมวด เช่น ตกแต่ง' }]
    if (editor.type === 'item') {
      const i = home.items.find(i => i.id === editor.id)
      return [
        { name: 'room', label: home.kind === 'house' ? 'ห้อง / พื้นที่' : 'หมวด', value: i?.room ?? home.rooms[0], options: home.rooms.map(value => ({ value, label: value })) },
        { name: 'name', label: 'ชื่อสินค้า / รายการ เช่น แครชบาร์', value: i?.name },
        { name: 'size', label: 'ขนาด / ยี่ห้อ / รุ่น', value: i?.size, optional: true },
        { name: 'quantity', label: 'จำนวน', value: i?.quantity ?? 1, type: 'number', min: .01 },
        { name: 'price', label: 'ราคาต่อหน่วย', value: i?.price ?? 0, type: 'number' },
        { name: 'shop', label: 'ร้าน / อู่ / แหล่งที่ซื้อ', value: i?.shop, optional: true },
        { name: 'purchasedOn', label: 'วันที่ซื้อ / ติดตั้ง', value: i?.purchasedOn, type: 'date', optional: true },
        { name: 'warrantyStart', label: 'วันที่เริ่มประกัน', value: i?.warrantyStart, type: 'date', optional: true },
        { name: 'warrantyMonths', label: 'ประกันกี่เดือน (0 = ไม่ระบุ)', value: i?.warrantyMonths ?? 0, type: 'number', step: '1', max: 1200 },
        { name: 'warrantyUntil', label: 'วันหมดประกัน (ถ้าระบุ จะใช้วันนี้แทนการคำนวณ)', value: i && i.warrantyUntil === warrantyEnd(i.warrantyStart, i.warrantyMonths) ? '' : i?.warrantyUntil, type: 'date', optional: true },
        { name: 'notes', label: 'หมายเหตุ / เลขใบเสร็จ', value: i?.notes, optional: true },
      ]
    }
    if (editor.type === 'boq') {
      const b = home.boq.find(b => b.id === editor.id)
      return [
        { name: 'category', label: 'หมวดงาน', value: b?.category ?? 'งานก่อสร้าง' },
        { name: 'name', label: 'รายการ', value: b?.name }, { name: 'spec', label: 'ขนาด / สเปก', value: b?.spec, optional: true },
        { name: 'quantity', label: 'ปริมาณ', value: b?.quantity ?? 1, type: 'number', min: .01 },
        { name: 'unit', label: 'หน่วย', value: b?.unit ?? 'รายการ' }, { name: 'price', label: 'ค่าวัสดุต่อหน่วย', value: b?.price ?? 0, type: 'number' },
        { name: 'labor', label: 'ค่าแรงรวมรายการ', value: b?.labor ?? 0, type: 'number' }, { name: 'paid', label: 'จ่ายแล้วรวม', value: b?.paid ?? 0, type: 'number' },
        { name: 'vendor', label: 'ร้าน / ผู้รับเหมา', value: b?.vendor, optional: true }, { name: 'reference', label: 'เลขอ้างอิงรายการรับ–จ่าย', value: b?.reference, optional: true },
      ]
    }
    const p = home.payments.find(p => p.id === editor.id)
    return [
      { name: 'roundId', label: 'รอบสัญญา', value: p?.roundId ?? round?.id, options: home.rounds.map(r => ({ value: r.id, label: r.name })) },
      { name: 'date', label: 'วันที่ชำระจริง', value: p?.date ?? today(), type: 'date' },
      { name: 'amount', label: 'ยอดชำระทั้งหมด (รวมโปะ)', value: p?.amount, type: 'number', min: .01 },
      { name: 'interest', label: 'ดอกเบี้ยตามใบแจ้งยอด', value: p?.interest, type: 'number' },
      { name: 'reference', label: 'เลขอ้างอิง / หมายเหตุ', value: p?.reference, optional: true },
    ]
  }
  async function submitEditor(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (!editor) return
    const fd = new FormData(event.currentTarget)
    const s = (key: string) => String(fd.get(key) ?? '').trim()
    const n = (key: string) => Number(s(key))
    const id = editor.id ?? crypto.randomUUID()
    const replace = <T extends { id: string }>(rows: T[], row: T): T[] => editor.id ? rows.map(x => x.id === id ? row : x) : [...rows, row]
    let ok = false
    if (editor.type === 'asset') {
      const kind = s('kind') as Home['kind']
      const next: Home = { ...(editor.id ? home : newHome(s('name'), kind)), id, name: s('name'), kind, financing: s('financing') as Home['financing'], purchasePrice: n('purchasePrice'), purchasedOn: s('purchasedOn'), landValue: kind === 'house' ? n('landValue') : 0, buildingValue: n('buildingValue'), address: s('address') }
      if (next.financing === 'cash' && next.rounds.length) { setError('สินทรัพย์นี้มีสัญญาเงินกู้แล้ว กรุณาคงวิธีซื้อเป็นกู้ / ผ่อนชำระ'); return }
      ok = await save({ ...data, homes: editor.id ? data.homes.map(h => h.id === id ? next : h) : [...data.homes, next] })
      if (ok) setSelected(id)
    } else if (editor.type === 'room') {
      ok = await updateHome({ ...home, rooms: [...home.rooms, s('room')] })
    } else if (editor.type === 'item') {
      if (n('warrantyMonths') > 0 && !s('warrantyStart') && !s('warrantyUntil')) { setError('กรุณาระบุวันที่เริ่มประกัน หรือวันหมดประกัน'); return }
      ok = await updateHome({ ...home, items: replace(home.items, { id, room: s('room'), name: s('name'), size: s('size'), quantity: n('quantity'), price: n('price'), shop: s('shop'), purchasedOn: s('purchasedOn'), warrantyStart: s('warrantyStart'), warrantyMonths: n('warrantyMonths'), warrantyUntil: s('warrantyUntil') || warrantyEnd(s('warrantyStart'), n('warrantyMonths')), notes: s('notes') }) })
    } else if (editor.type === 'boq') {
      ok = await updateHome({ ...home, boq: replace(home.boq, { id, category: s('category'), name: s('name'), spec: s('spec'), quantity: n('quantity'), unit: s('unit'), price: n('price'), labor: n('labor'), paid: n('paid'), vendor: s('vendor'), reference: s('reference') }) })
    } else {
      ok = await updateHome({ ...home, payments: replace(home.payments, { id, roundId: s('roundId'), date: s('date'), amount: n('amount'), interest: n('interest'), principal: roundMoney(n('amount') - n('interest')), reference: s('reference') }) })
    }
    if (ok) setEditor(null)
  }
  async function importFile(file: File | undefined) {
    if (!file) return
    setError(''); setEditor(null); setRoundEditor(null)
    try {
      if (file.size > 2_000_000) throw new Error('ไฟล์ใหญ่เกิน 2 MB')
      const rows = ghbPayments(await file.text())
      if (!rows.length) throw new Error('ไม่พบรายการที่มียอดชำระจริง')
      setImportRows(rows)
    } catch (error) { setError(error instanceof Error ? error.message : 'อ่านไฟล์ไม่สำเร็จ') }
  }
  const renderRowActions = (type: 'item' | 'boq' | 'payment', id: string) => <div className="asset-row-actions"><button type="button" disabled={!editable} aria-label="แก้ไขรายการ" onClick={() => open(type, id)}><Pencil size={15} /></button><button type="button" disabled={!editable} aria-label="ลบรายการ" onClick={async () => {
    if (!window.confirm('ลบรายการนี้หรือไม่?')) return
    const key = type === 'item' ? 'items' : type === 'boq' ? 'boq' : 'payments'
    await updateHome({ ...home, [key]: home[key].filter(i => i.id !== id) })
  }}><Trash2 size={15} /></button></div>

  return <PageContainer className="asset-workspace">
    <Header title="สินทรัพย์" eyebrow="Asset management" description="สินทรัพย์หลักและทุกรายละเอียดที่อยู่ข้างใต้" icon={<Wallet size={21} />} actions={<><button className="asset-button secondary" onClick={exportData}><Download size={15} />สำรองข้อมูล</button><Add enabled={editable} onClick={() => open('asset')}>เพิ่มสินทรัพย์</Add></>} />
    <div className="asset-picker" aria-label="เลือกสินทรัพย์">{data.homes.map(h => { const Icon = icon[h.kind]; return <button type="button" key={h.id} aria-pressed={home.id === h.id} onClick={() => switchAsset(h.id)}><Icon size={18} /><span>{h.name}<small>{labels[h.kind]} · {h.financing === 'cash' ? 'เงินสด' : 'ผ่อนชำระ'}</small></span></button> })}</div>
    <div className="asset-property"><div><p>{labels[home.kind]} / {home.financing === 'cash' ? 'ชำระเงินสด' : 'กู้ / ผ่อนชำระ'}</p><h2>{home.name}</h2><span>{home.address || 'เพิ่มรายละเอียดสินทรัพย์ได้ที่แก้ไขข้อมูล'}</span></div><button className="asset-button secondary" disabled={!editable} onClick={() => open('asset', home.id)}><Pencil size={14} />แก้ไขข้อมูล</button></div>
    <div aria-live="polite">{message ? <p className="asset-notice">{message}</p> : null}{busy ? <p role="status">กำลังบันทึก…</p> : null}</div>
    {error ? <p className="asset-error" role="alert">{error}</p> : null}
    {!canWrite ? <p className="asset-notice">บัญชีนี้ดูข้อมูลได้อย่างเดียว</p> : null}
    <nav className="asset-tabs" aria-label="ส่วนจัดการสินทรัพย์">{[['overview', 'ภาพรวม'], ['items', home.kind === 'house' ? 'ห้องและของในบ้าน' : 'รายการย่อย / ตกแต่ง'], ...(home.kind === 'house' ? [['boq', 'BOQ / งานบ้าน']] : []), ...(home.financing === 'loan' ? [['loan', 'เงินกู้ / การชำระ']] : [])].map(([key, name]) => <button type="button" key={key} aria-current={tab === key ? 'page' : undefined} onClick={() => { setTab(key); setEditor(null); setRoundEditor(null); setImportRows(null) }}>{name}</button>)}</nav>
    {editor ? <Panel title={editor.type === 'asset' ? editor.id ? 'แก้ไขสินทรัพย์' : 'เพิ่มสินทรัพย์หลัก' : editor.type === 'room' ? 'เพิ่มห้อง / หมวด' : editor.type === 'payment' ? 'บันทึกชำระจริง' : editor.type === 'boq' ? 'รายการ BOQ' : 'รายการย่อย'}><form key={`${editor.type}-${editor.id}`} onSubmit={submitEditor}><fieldset disabled={!editable}><Fields fields={editorFields()} />{editor.type === 'payment' ? <p className="asset-hint">เงินต้น = ยอดชำระทั้งหมด − ดอกเบี้ย ใช้ยอดจากใบแจ้งธนาคาร หากมีค่าธรรมเนียมให้แยกบันทึกต่างหาก</p> : null}<div className="asset-form-actions"><button type="button" className="asset-button secondary" onClick={() => setEditor(null)}>ยกเลิก</button><button className="asset-button" type="submit">บันทึก</button></div></fieldset></form></Panel> : null}
    {tab === 'overview' ? <>
      <div className="asset-stats"><Stat label="ราคาซื้อสินทรัพย์หลัก" value={baht(home.purchasePrice)} note={home.purchasePrice ? `ซื้อเมื่อ ${displayDate(home.purchasedOn)}` : 'ยังไม่ระบุราคาซื้อ'} /><Stat label="ค่ารายการย่อย / ตกแต่ง" value={baht(itemCost)} note={`${home.items.length} รายการ`} /><Stat label="ต้นทุนหลัก + รายการย่อย" value={baht(home.purchasePrice + itemCost)} note="BOQ แสดงแยกเพื่อไม่รวมรายการซ้ำ" /><Stat label="เงินต้นคงเหลือ" value={baht(remaining)} note={home.financing === 'cash' ? 'ซื้อเงินสด' : 'ตามประวัติชำระที่บันทึก'} /></div>
      <div className="asset-columns"><Panel title="รายละเอียดสินทรัพย์"><dl className="asset-details"><dt>วิธีซื้อ</dt><dd>{home.financing === 'cash' ? 'ชำระเงินสด' : 'กู้ / ผ่อนชำระ'}</dd><dt>มูลค่าปัจจุบันตัวทรัพย์</dt><dd>{home.buildingValue ? baht(home.buildingValue) : 'ยังไม่ระบุ'}</dd>{home.kind === 'house' ? <><dt>มูลค่าที่ดิน</dt><dd>{baht(home.landValue)}</dd></> : null}<dt>มูลค่าปัจจุบันสุทธิ</dt><dd>{home.buildingValue ? baht(home.buildingValue + home.landValue - remaining) : 'กรุณาระบุมูลค่าตัวทรัพย์ก่อน'}</dd></dl><p className="asset-hint">ราคาซื้อ ต้นทุนตกแต่ง และมูลค่าปัจจุบันเก็บแยกกัน</p></Panel><Panel title="รายการย่อยตามห้อง / หมวด">{home.rooms.length ? home.rooms.map(r => <div className="asset-summary-row" key={r}><span>{r}<small>{home.items.filter(i => i.room === r).length} รายการ</small></span><strong>{baht(home.items.filter(i => i.room === r).reduce((s, i) => s + i.price * i.quantity, 0))}</strong></div>) : <Empty>ยังไม่มีหมวด เริ่มเพิ่มหมวดและรายการย่อยได้</Empty>}</Panel></div>
      <Panel title="ประกันใกล้หมด / หมดอายุ">{home.items.filter(i => i.warrantyUntil && Math.ceil((Date.parse(i.warrantyUntil) - Date.parse(today())) / 86400000) <= 30).length ? home.items.filter(i => i.warrantyUntil && Math.ceil((Date.parse(i.warrantyUntil) - Date.parse(today())) / 86400000) <= 30).map(i => <div className="asset-summary-row" key={i.id}><span>{i.name}<small>{i.room} · {i.shop || 'ไม่ระบุร้าน'}</small></span><span className="asset-badge">{i.warrantyUntil < today() ? 'หมดประกันแล้ว' : `หมด ${displayDate(i.warrantyUntil)}`}</span></div>) : <Empty>ไม่มีรายการประกันใกล้หมดภายใน 30 วัน</Empty>}</Panel>
    </> : null}
    {tab === 'items' ? <Panel title={home.kind === 'house' ? 'ห้องและของในบ้าน' : 'รายการย่อยของสินทรัพย์'} action={<div className="asset-tools"><Add enabled={editable} onClick={() => open('room')}>เพิ่มห้อง / หมวด</Add><Add enabled={editable} disabled={!home.rooms.length} onClick={() => open('item')}>เพิ่มรายการย่อย</Add></div>}>
      <label className="asset-filter">ห้อง / หมวด <select value={filter} onChange={e => setFilter(e.target.value)}><option value="">ทั้งหมด</option>{home.rooms.map(r => <option key={r}>{r}</option>)}</select></label>
      <div className="asset-table-scroll"><table><thead><tr><th>รายการ / หมวด</th><th>ขนาด / ร้าน</th><th>จำนวน</th><th>ราคาต่อหน่วย</th><th>รวม</th><th>ประกัน</th><th><span className="sr-only">จัดการ</span></th></tr></thead><tbody>{filteredItems.map(i => { const days = i.warrantyUntil ? Math.ceil((Date.parse(i.warrantyUntil) - Date.parse(today())) / 86400000) : null; return <tr key={i.id}><td><strong>{i.name}</strong><small>{i.room} · ซื้อ {displayDate(i.purchasedOn)}</small><small>{i.notes}</small></td><td>{i.size || '—'}<small>{i.shop || '—'}</small></td><td>{i.quantity}</td><td>{money(i.price)}</td><td>{money(i.price * i.quantity)}</td><td>{days === null ? 'ไม่ระบุ' : days < 0 ? 'หมดประกันแล้ว' : `เหลือ ${days} วัน`}<small>{i.warrantyMonths ? `${i.warrantyMonths} เดือน · ` : ''}{i.warrantyUntil ? `ถึง ${displayDate(i.warrantyUntil)}` : ''}</small>{i.warrantyStart ? <small>เริ่ม {displayDate(i.warrantyStart)}</small> : null}</td><td>{renderRowActions('item', i.id)}</td></tr> })}</tbody></table></div>{!filteredItems.length ? <Empty>เพิ่มหมวดก่อน แล้วเพิ่มสินค้า อุปกรณ์ หรือรายการตกแต่งใต้สินทรัพย์นี้</Empty> : null}<div className="asset-total">รวมรายการที่แสดง <strong>{baht(filteredItems.reduce((s, i) => s + i.price * i.quantity, 0))}</strong></div>
    </Panel> : null}
    {tab === 'boq' && home.kind === 'house' ? <><div className="asset-stats"><Stat label="งบ BOQ รวม" value={baht(boqCost)} /><Stat label="จ่ายแล้ว" value={baht(boqPaid)} /><Stat label="ค้างจ่ายตาม BOQ" value={baht(boqCost - boqPaid)} /></div><Panel title="BOQ / งานก่อสร้างและต่อเติม" action={<Add enabled={editable} onClick={() => open('boq')}>เพิ่มรายการ BOQ</Add>}><p className="asset-hint">งบรายการ = ปริมาณ × ราคาวัสดุต่อหน่วย + ค่าแรงรวม · เลขอ้างอิงรับ–จ่ายเป็นข้อมูลประกอบ ยังไม่สร้างรายการบัญชีอัตโนมัติ</p><div className="asset-table-scroll"><table><thead><tr><th>หมวด / รายการ</th><th>ปริมาณ</th><th>วัสดุ/หน่วย</th><th>ค่าแรงรวม</th><th>รวม</th><th>จ่ายแล้ว / คงเหลือ</th><th><span className="sr-only">จัดการ</span></th></tr></thead><tbody>{home.boq.map(b => <tr key={b.id}><td><strong>{b.name}</strong><small>{b.category} · {b.spec}</small><small>{b.vendor} {b.reference}</small></td><td>{b.quantity} {b.unit}</td><td>{money(b.price)}</td><td>{money(b.labor)}</td><td>{money(b.quantity * b.price + b.labor)}</td><td>{money(b.paid)}<small>เหลือ {money(b.quantity * b.price + b.labor - b.paid)}</small></td><td>{renderRowActions('boq', b.id)}</td></tr>)}</tbody></table></div>{!home.boq.length ? <Empty>ยังไม่มีรายการ BOQ</Empty> : null}</Panel></> : null}
    {tab === 'loan' && home.financing === 'loan' ? <>
      <div className="asset-stats"><Stat label="วงเงินเริ่มต้น" value={baht(home.rounds[0]?.opening ?? 0)} /><Stat label="เงินต้นคงเหลือ" value={baht(remaining)} /><Stat label="ชำระจริงสะสม" value={baht(home.payments.reduce((s, p) => s + p.amount, 0))} /><Stat label="ดอกเบี้ยจ่ายจริง" value={baht(actualInterest)} /></div>
      <Panel title="สัญญาและรอบรีเทนชัน" action={<Add enabled={editable} onClick={() => { setRoundEditor('new'); setEditor(null); setImportRows(null) }}>{latest ? 'เพิ่มรอบรีเทนชัน' : 'เพิ่มสัญญาเงินกู้'}</Add>}>
        <div className="asset-rounds">{home.rounds.map(r => <button type="button" key={r.id} aria-pressed={round?.id === r.id} onClick={() => { setRoundId(r.id); setRoundEditor(null); setImportRows(null) }}><Landmark size={17} /><strong>{r.name}</strong><small>{displayDate(r.effectiveOn)} · {r.months} เดือน</small></button>)}</div>
        {round ? <><div className="asset-summary-row"><span>ยอดต้นรอบ {baht(round.opening)} · MRR อ้างอิง {round.mrr}%<small>ค่าธรรมเนียม {baht(round.fee)} · {round.notes}</small></span><button className="asset-button secondary" disabled={!editable || home.payments.some(p => p.roundId === round.id) || round.id !== latest?.id} onClick={() => { setRoundEditor(round); setEditor(null) }}>ตั้งค่าสัญญา</button></div>{!round.effectiveOn ? <p className="asset-notice">กรุณาตั้งวันที่เริ่มสัญญาก่อนบันทึกชำระหรือนำเข้า CSV</p> : null}<p className="asset-hint">ดอกเบี้ยรวมอ้างอิงจากสัญญา: {round.referenceInterest ? baht(round.referenceInterest) : 'ไม่ระบุ'} · เก็บแยกจากดอกเบี้ยจ่ายจริงและยอดจำลอง</p><p className="asset-hint">รอบที่มีประวัติชำระแล้วจะเก็บเงื่อนไขเดิมไว้ การเปลี่ยนอัตราให้เพิ่มรอบใหม่ · อัตราหลังปีที่ 7 ตั้งไว้เฉพาะค่าที่ให้มา สามารถปรับช่วงตามเอกสารสัญญาก่อนเริ่มใช้งาน</p><div className="asset-table-scroll"><table><thead><tr><th>เดือนในรอบ</th><th>อัตราต่อปี</th><th>ค่างวด</th></tr></thead><tbody>{round.periods.map(p => <tr key={p.from}><td>{p.from}–{p.to}</td><td>{p.floating ? `MRR − ${p.discount}% = ${Math.max(0, round.mrr - p.discount).toFixed(3)}%` : `${p.rate}%`}</td><td>{money(p.installment)}</td></tr>)}</tbody></table></div></> : <Empty>เพิ่มสัญญาเพื่อเริ่มติดตามการผ่อน</Empty>}
      </Panel>
      {roundEditor ? <RoundEditor key={typeof roundEditor === 'string' ? `new-${home.id}` : roundEditor.id} initial={typeof roundEditor === 'string' ? undefined : roundEditor} latest={latest} remaining={remaining} disabled={!editable} onCancel={() => setRoundEditor(null)} onSave={async r => { const ok = await updateHome({ ...home, rounds: roundEditor === 'new' ? [...home.rounds, r] : home.rounds.map(x => x.id === r.id ? r : x) }); if (ok) { setRoundId(r.id); setRoundEditor(null) } }} /> : null}
      {round ? <Panel title="ประวัติชำระจริง" action={<div className="asset-tools"><label className="asset-button secondary">นำเข้า GHB.csv<input type="file" accept=".csv,text/csv" className="sr-only" disabled={!editable || !round.effectiveOn} onChange={e => { void importFile(e.target.files?.[0]); e.target.value = '' }} /></label><Add enabled={editable} disabled={!round.effectiveOn} onClick={() => open('payment')}>บันทึกชำระ</Add></div>}>
        <p className="asset-hint">กำลังดู: {round.name} · รวมโปะไว้ในยอดชำระ ใช้ยอดดอกเบี้ยจริงจากธนาคาร · ยังไม่สร้างรายการรับ–จ่ายอัตโนมัติ</p>
        {importRows ? <form onSubmit={async e => { e.preventDefault(); const next = importRows.map(p => ({ ...p, id: crypto.randomUUID(), roundId: round.id })); const duplicates = next.some(p => home.payments.some(old => old.roundId === p.roundId && old.reference === p.reference)); if (duplicates) { setError('มีเลขงวดจากไฟล์นี้อยู่แล้ว กรุณาตรวจสอบประวัติก่อนนำเข้าซ้ำ'); return } if (await updateHome({ ...home, payments: [...home.payments, ...next] })) setImportRows(null) }}><h3>ตรวจสอบก่อนนำเข้า {importRows.length} รายการ</h3><div className="asset-table-scroll"><table><thead><tr><th>วันที่ชำระ (ต้องระบุ)</th><th>รายการ</th><th>ยอดชำระ</th><th>ดอกเบี้ย</th><th>เงินต้น</th></tr></thead><tbody>{importRows.map((p, i) => <tr key={i}><td><input aria-label={`วันที่ชำระรายการ ${i + 1}`} type="date" required value={/^\d{4}-\d{2}-\d{2}$/.test(p.date) ? p.date : ''} onChange={e => setImportRows(importRows.map((r, j) => j === i ? { ...r, date: e.target.value } : r))} /></td><td>{p.reference}</td><td>{money(p.amount)}</td><td>{money(p.interest)}</td><td>{money(p.principal)}</td></tr>)}</tbody></table></div><div className="asset-form-actions"><button type="button" className="asset-button secondary" onClick={() => setImportRows(null)}>ยกเลิก</button><button className="asset-button" disabled={!editable}>ยืนยันนำเข้า</button></div></form> : null}
        <div className="asset-table-scroll"><table><thead><tr><th>วันที่ / อ้างอิง</th><th>ยอดชำระ</th><th>ดอกเบี้ย</th><th>ตัดเงินต้น</th><th><span className="sr-only">จัดการ</span></th></tr></thead><tbody>{home.payments.filter(p => p.roundId === round.id).toSorted((a, b) => b.date.localeCompare(a.date)).map(p => <tr key={p.id}><td>{displayDate(p.date)}<small>{p.reference}</small></td><td>{money(p.amount)}</td><td>{money(p.interest)}</td><td>{money(p.principal)}</td><td>{renderRowActions('payment', p.id)}</td></tr>)}</tbody></table></div>{!home.payments.some(p => p.roundId === round.id) ? <Empty>ยังไม่มีรายการชำระจริงในรอบนี้</Empty> : null}
      </Panel> : null}
      {round && simulation && baseSimulation ? <Panel title="จำลองแผนผ่อนของรอบสัญญา"><p className="asset-hint">จำลองตั้งแต่ต้นรอบ ด้วยดอกเบี้ยรายเดือน = เงินต้น × อัตราต่อปี ÷ 12 และถือ MRR คงที่ ใช้เปรียบเทียบแผน ไม่ใช่ยอดธนาคารหรือประมาณการจากยอดชำระปัจจุบัน</p><label className="asset-filter">โปะเพิ่มต่อเดือน (บาท) <input type="number" min="0" max="1000000000" step="100" value={extra} onChange={e => { const n = Number(e.target.value); setExtra(Number.isFinite(n) ? Math.max(0, Math.min(n, 1e9)) : 0) }} /></label><div className="asset-stats"><Stat label="ดอกเบี้ยจำลอง" value={baht(simulation.totalInterest)} /><Stat label="ระยะเวลาจำลอง" value={`${simulation.rows.length} เดือน`} note={simulation.remaining > 0 ? `ยังเหลือ ${baht(simulation.remaining)} เมื่อจบแผน` : 'ชำระหมดตามแผนจำลอง'} /><Stat label="ดอกเบี้ยต่างจากไม่โปะ" value={simulation.remaining === 0 && baseSimulation.remaining === 0 ? baht(baseSimulation.totalInterest - simulation.totalInterest) : 'ยังเทียบยอดรวมไม่ได้'} /></div><details><summary>ดูตารางผ่อนจำลอง</summary><div className="asset-table-scroll asset-forecast"><table><thead><tr><th>เดือน</th><th>ต้นงวด</th><th>อัตรา %</th><th>ดอกเบี้ย</th><th>จ่ายรวม</th><th>เงินต้น</th><th>คงเหลือ</th></tr></thead><tbody>{simulation.rows.map(r => <tr key={r.month}><td>{r.month}</td><td>{money(r.opening)}</td><td>{r.rate.toFixed(3)}</td><td>{money(r.interest)}</td><td>{money(r.payment)}</td><td>{money(r.principal)}</td><td>{money(r.remaining)}</td></tr>)}</tbody></table></div></details></Panel> : null}
    </> : null}
    <p className="asset-footnote">ข้อมูลบันทึกบนเซิร์ฟเวอร์ของแอป · สำรองข้อมูลสินทรัพย์แยกด้วยปุ่มด้านบน · รายการย่อยและ BOQ ไม่ถูกบวกซ้ำเป็นมูลค่าสินทรัพย์ปัจจุบัน</p>
  </PageContainer>
}

function RoundEditor({ initial, latest, remaining, disabled, onCancel, onSave }: { initial?: LoanRound; latest?: LoanRound; remaining: number; disabled: boolean; onCancel: () => void; onSave: (round: LoanRound) => Promise<void> }) {
  const [periods, setPeriods] = useState<RatePeriod[]>(initial?.periods ?? [{ from: 1, to: 36, rate: 3, installment: 12600, floating: false, discount: 0 }])
  const update = (index: number, patch: Partial<RatePeriod>) => setPeriods(rows => rows.map((p, i) => i === index ? { ...p, ...patch } : p))
  return <Panel title={initial ? 'ตั้งค่าสัญญา' : latest ? 'เพิ่มข้อตกลงรีเทนชัน' : 'เพิ่มสัญญา'}><form onSubmit={async e => {
    e.preventDefault(); const fd = new FormData(e.currentTarget); const s = (key: string) => String(fd.get(key) ?? '').trim(); const n = (key: string) => Number(s(key))
    await onSave({ id: initial?.id ?? crypto.randomUUID(), name: s('name'), effectiveOn: s('effectiveOn'), opening: n('opening'), months: n('months'), mrr: n('mrr'), fee: n('fee'), referenceInterest: n('referenceInterest'), notes: s('notes'), periods })
  }}><fieldset disabled={disabled}><Fields fields={[
    { name: 'name', label: 'ชื่อรอบ', value: initial?.name ?? (latest ? 'รีเทนชันรอบใหม่' : 'สัญญาเริ่มต้น') },
    { name: 'effectiveOn', label: 'วันที่เริ่มมีผล', type: 'date', value: initial?.effectiveOn },
    { name: 'opening', label: latest && !initial ? 'เงินต้นยกมา (ต้องตรงกับยอดคงเหลือเดิม)' : 'วงเงิน / เงินต้นเริ่มต้น', type: 'number', min: .01, value: initial?.opening ?? (latest ? remaining : '') },
    { name: 'months', label: 'ระยะเวลาคงเหลือ (เดือน)', type: 'number', step: '1', min: 1, max: 600, value: initial?.months ?? 36 },
    { name: 'mrr', label: 'MRR อ้างอิง ณ วันเริ่มรอบ (%)', type: 'number', step: '.001', max: 100, value: initial?.mrr ?? latest?.mrr ?? 6.145 },
    { name: 'fee', label: 'ค่าธรรมเนียม (แยกจากเงินต้น)', type: 'number', value: initial?.fee ?? 0 },
    { name: 'referenceInterest', label: 'ดอกเบี้ยรวมอ้างอิงจากสัญญา (0 = ไม่ระบุ)', type: 'number', value: initial?.referenceInterest ?? 0 },
    { name: 'notes', label: 'เงื่อนไข / เอกสารอ้างอิง', optional: true, value: initial?.notes },
  ]} /><h3>ดอกเบี้ยและค่างวดแต่ละช่วง</h3><p className="asset-hint">เดือนเริ่มนับใหม่ในแต่ละรอบ ต้องต่อเนื่องจนครบระยะเวลา · ค่าเริ่มต้นของรอบใหม่เป็นตัวอย่าง กรุณาแก้ตามข้อเสนอธนาคาร · ถ้า MRR เปลี่ยน ให้เพิ่มรอบใหม่ตามวันที่มีผล</p><div className="asset-table-scroll"><table><thead><tr><th>เดือนเริ่ม</th><th>เดือนสิ้นสุด</th><th>ประเภทอัตรา</th><th>อัตรา / ส่วนลด %</th><th>ค่างวด</th><th><span className="sr-only">ลบช่วง</span></th></tr></thead><tbody>{periods.map((p, i) => <tr key={i}><td><input aria-label={`เดือนเริ่มช่วง ${i + 1}`} required type="number" min="1" max="600" value={p.from} onChange={e => update(i, { from: Number(e.target.value) })} /></td><td><input aria-label={`เดือนสิ้นสุดช่วง ${i + 1}`} required type="number" min="1" max="600" value={p.to} onChange={e => update(i, { to: Number(e.target.value) })} /></td><td><select aria-label={`ประเภทดอกเบี้ยช่วง ${i + 1}`} value={p.floating ? 'floating' : 'fixed'} onChange={e => update(i, { floating: e.target.value === 'floating' })}><option value="fixed">คงที่</option><option value="floating">MRR − ส่วนลด</option></select></td><td><input aria-label={`อัตราหรือส่วนลดช่วง ${i + 1}`} required type="number" min="0" max="100" step=".001" value={p.floating ? p.discount : p.rate} onChange={e => update(i, p.floating ? { discount: Number(e.target.value) } : { rate: Number(e.target.value) })} /></td><td><input aria-label={`ค่างวดช่วง ${i + 1}`} required type="number" min=".01" step=".01" value={p.installment} onChange={e => update(i, { installment: Number(e.target.value) })} /></td><td><button aria-label={`ลบช่วง ${i + 1}`} type="button" disabled={periods.length === 1} onClick={() => setPeriods(periods.filter((_, j) => j !== i))}><Trash2 size={15} /></button></td></tr>)}</tbody></table></div><button className="asset-button secondary" type="button" onClick={() => { const last = periods.at(-1)!; setPeriods([...periods, { ...last, from: last.to + 1, to: last.to + 12 }]) }}><Plus size={14} />เพิ่มช่วง</button><div className="asset-form-actions"><button className="asset-button secondary" type="button" onClick={onCancel}><ArrowLeft size={14} />ยกเลิก</button><button className="asset-button">บันทึกเงื่อนไข</button></div></fieldset></form></Panel>
}
