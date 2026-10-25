'use client'

import { useState, type FormEvent } from 'react'
import { BadgePlus, Building2, ClipboardList, Download, FileUp, Pencil, Plus, Trash2, Wrench } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Modal } from '@/components/ui/modal'
import { assetCosts, money, today, type BoqItem, type BuildingDetails, type BuildingWork, type BuildingWorkType, type Home } from '@/app/thing/_shared/model'
import { extractBoqPdfText } from '@/app/thing/_shared/actions'

const workTypes: Record<BuildingWorkType, string> = { construction: 'ก่อสร้าง', repair: 'ซ่อมบำรุง', improvement: 'ต่อเติม / ปรับปรุง', decoration: 'ตกแต่ง', built_in: 'บิวท์อิน', equipment: 'อุปกรณ์' }
const typeList = Object.entries(workTypes) as [BuildingWorkType, string][]
const field = 'mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100'
const label = 'block text-xs font-medium text-slate-600'
const emptyDetails = (): BuildingDetails => ({ usableAreaSqm: 0, floorCount: 1, buildingType: '', completedOn: '', notes: '', roomCounts: [] })
const emptyWork = (): BuildingWork => ({ id: crypto.randomUUID(), type: 'repair', name: '', roomNames: [], date: today(), amount: 0, treatment: 'expense', vendor: '', warrantyUntil: '', reference: '', notes: '' })
const emptyBoq = (): BoqItem => ({ id: crypto.randomUUID(), scope: 'construction', category: 'หมวดงานทั่วไป', subcategory: '', name: '', spec: '', quantity: 1, unit: 'งาน', price: 0, labor: 0, paid: 0, vendor: '', reference: '' })

function cellText(value: unknown) {
  if (value && typeof value === 'object') {
    const cell = value as { text?: unknown; result?: unknown; richText?: { text: string }[] }
    if (typeof cell.result === 'number' || typeof cell.result === 'string') return String(cell.result).trim()
    if (typeof cell.text === 'string') return cell.text.trim()
    if (cell.richText) return cell.richText.map(part => part.text).join('').trim()
  }
  return typeof value === 'string' || typeof value === 'number' ? String(value).trim() : ''
}
function cellNumber(value: unknown) {
  const parsed = Number(cellText(value).replaceAll(',', ''))
  return Number.isFinite(parsed) ? parsed : 0
}
async function readBoqWorkbook(file: File) {
  if (file.size > 15 * 1024 * 1024) throw new Error('ไฟล์ BOQ ต้องมีขนาดไม่เกิน 15 MB')
  const ExcelJS = await import('exceljs')
  const workbook = new ExcelJS.Workbook()
  await workbook.xlsx.load(await file.arrayBuffer())
  const candidates = workbook.worksheets.filter(sheet => {
    let hasBoqColumns = false
    sheet.eachRow((row, rowNumber) => {
      if (rowNumber > 5) return
      const header = Array.from({ length: Math.min(row.cellCount, 12) }, (_, index) => cellText(row.getCell(index + 1).value)).join(' ')
      if (header.includes('รายการ') && header.includes('หน่วย') && (header.includes('วัสดุ') || header.includes('ค่าแรง'))) hasBoqColumns = true
    })
    return hasBoqColumns
  })
  if (!candidates.length) throw new Error('ไม่พบชีต BOQ ที่มีคอลัมน์รายการ จำนวน หน่วย และราคา')
  return candidates.map(sheet => {
    let category = 'หมวดงานทั่วไป'
    let subcategory = ''
    let summaryStarted = false
    const items: BoqItem[] = []
    sheet.eachRow((row, rowNumber) => {
      if (summaryStarted) return
      if (rowNumber <= 2) return
      const sequence = cellText(row.getCell(1).value)
      const name = cellText(row.getCell(2).value)
      if (/^ITEM$/i.test(sequence) || /^DESCRIPTION$/i.test(name)) { summaryStarted = true; return }
      const quantity = cellNumber(row.getCell(3).value)
      const unit = cellText(row.getCell(4).value)
      const materialRate = cellNumber(row.getCell(5).value)
      const materialTotal = cellNumber(row.getCell(6).value)
      const laborRate = cellNumber(row.getCell(7).value)
      const laborTotal = cellNumber(row.getCell(8).value)
      const hasPricing = quantity > 0 || materialRate > 0 || materialTotal > 0 || laborRate > 0 || laborTotal > 0
      if (!name || /^(ITEM|DESCRIPTION|ลำดับที่|รายการ)$/i.test(name)) return
      if (!hasPricing && (/^หมวด/.test(name) || sequence && Number.isInteger(Number(sequence)))) { category = name.replace(/^หมวด\s*/, ''); subcategory = ''; return }
      if (!hasPricing) { subcategory = name; return }
      const safeQuantity = quantity > 0 ? quantity : 1
      const price = materialRate || (materialTotal > 0 ? materialTotal / safeQuantity : 0)
      const labor = laborTotal || laborRate * safeQuantity
      items.push({ id: crypto.randomUUID(), scope: 'construction', category, subcategory, name, spec: cellText(row.getCell(10).value), quantity: safeQuantity, unit: unit || 'งาน', price, labor, paid: 0, vendor: '', reference: '' })
    })
    return { sheetName: sheet.name, items }
  }).filter(sheet => sheet.items.length > 0)
}
function parsePdfBoqLines(pages: string[][]): BoqItem[] {
  const unitNames = new Set(['ตร.ม.', 'ตรม.', 'ตารางเมตร', 'ลบ.ม.', 'ลบม.', 'เมตร', 'ม.', 'กก.', 'กิโลกรัม', 'เส้น', 'ชุด', 'ท่อน', 'กล่อง', 'ตัว', 'ใบ', 'อัน', 'งาน', 'LS.', 'LS', 'L.S.'])
  const numberValue = (value: string) => {
    const number = Number(value.replaceAll(',', '').replace(/[^\d.-]/g, ''))
    return Number.isFinite(number) ? number : NaN
  }
  const items: BoqItem[] = []
  let category = 'หมวดงานทั่วไป'
  let subcategory = ''
  for (const line of pages.flat()) {
    const normalized = line.replace(/\s+/g, ' ').trim()
    if (!normalized || /^(รายการ|ลำดับที่|จำนวน|หน่วย|ค่าวัสดุ|ค่าแรง|รวมค่าวัสดุ)/i.test(normalized) || /^(รวมหมวด|รวมค่าก่อสร้าง|ยอดรวม|หน้า\s*\d+)/i.test(normalized)) continue
    if (/หมวด(?:งาน|\s)/.test(normalized) && !unitNames.has(normalized.split(' ').at(-1) ?? '')) {
      category = normalized.replace(/^\d+(?:\.\d+)*\s*/, '').trim(); subcategory = ''; continue
    }
    const tokens = normalized.split(' ')
    const unitIndex = tokens.findIndex(token => unitNames.has(token.replace(/[,:;]$/, '')))
    if (unitIndex >= 1) {
      const quantity = numberValue(tokens[unitIndex - 1])
      if (!Number.isFinite(quantity) || quantity <= 0) continue
      const nameTokens = tokens.slice(0, unitIndex - 1)
      if (/^\d+(?:\.\d+)*$/.test(nameTokens[0] ?? '')) nameTokens.shift()
      const name = nameTokens.join(' ').trim()
      if (!name) continue
      const amounts = tokens.slice(unitIndex + 1).map(numberValue).filter(Number.isFinite)
      const price = amounts[0] ?? 0
      const labor = amounts.length >= 4 ? amounts[3] : amounts.length === 3 ? Math.max(0, amounts[2] - price * quantity) : amounts.length === 2 ? amounts[1] * quantity : 0
      items.push({ id: crypto.randomUUID(), scope: 'construction', category, subcategory, name, spec: '', quantity, unit: tokens[unitIndex].replace(/[,:;]$/, ''), price, labor, paid: 0, vendor: '', reference: '' })
      continue
    }
    if (!/\d/.test(normalized) && !/^(รวม|หมายเหตุ|เลขที่|รายการที่)/.test(normalized)) subcategory = normalized
  }
  return items
}

export function BuildingManager({ asset, canWrite, busy, onSave }: { asset: Home; canWrite: boolean; busy: boolean; onSave: (patch: Partial<Home>, reason: string) => Promise<void> }) {
  const [section, setSection] = useState<'information' | 'management'>('information')
  const [infoOpen, setInfoOpen] = useState(false)
  const [infoError, setInfoError] = useState('')
  const [infoDraft, setInfoDraft] = useState<{ address: string; details: BuildingDetails; rooms: string[]; newRoom: string; newRoomCount: number; costSource: Home['costSource']; purchasePrice: number }>({ address: asset.address, details: asset.buildingDetails ?? emptyDetails(), rooms: [...asset.rooms], newRoom: '', newRoomCount: 1, costSource: asset.costSource, purchasePrice: asset.purchasePrice })
  const [workOpen, setWorkOpen] = useState(false)
  const [workError, setWorkError] = useState('')
  const [workDraft, setWorkDraft] = useState<BuildingWork | null>(null)
  const [boqOpen, setBoqOpen] = useState(false)
  const [boqError, setBoqError] = useState('')
  const [boqDraft, setBoqDraft] = useState<BoqItem[]>([])
  const [boqImportChoices, setBoqImportChoices] = useState<{ sheetName: string; items: BoqItem[] }[]>([])
  const [boqImportSheet, setBoqImportSheet] = useState('')
  const [boqImportNotice, setBoqImportNotice] = useState('')
  const costs = assetCosts(asset)
  const works = asset.buildingWorks ?? []
  const capitalWorks = works.filter(work => work.treatment === 'capital').reduce((sum, work) => sum + work.amount, 0)
  const expenseWorks = works.filter(work => work.treatment === 'expense').reduce((sum, work) => sum + work.amount, 0)
  const constructionRows = asset.boq.filter(row => !row.cancelled && row.scope !== 'builtin')
  const constructionBoqTotal = constructionRows.reduce((sum, row) => sum + row.quantity * row.price + row.labor, 0)

  function openInfo() {
    const details = structuredClone(asset.buildingDetails ?? emptyDetails())
    details.roomCounts ??= asset.rooms.map(name => ({ name, count: 1 }))
    setInfoDraft({ address: asset.address, details, rooms: [...asset.rooms], newRoom: '', newRoomCount: 1, costSource: asset.costSource, purchasePrice: asset.purchasePrice })
    setInfoError(''); setInfoOpen(true)
  }
  function addRoom() {
    const room = infoDraft.newRoom.trim()
    if (!room || infoDraft.rooms.includes(room)) return
    setInfoDraft({ ...infoDraft, rooms: [...infoDraft.rooms, room], details: { ...infoDraft.details, roomCounts: [...(infoDraft.details.roomCounts ?? []), { name: room, count: infoDraft.newRoomCount }] }, newRoom: '', newRoomCount: 1 })
  }
  function roomCount(room: string, draft = infoDraft) {
    return draft.details.roomCounts?.find(row => row.name === room)?.count ?? 1
  }
  function updateRoomCount(room: string, count: number) {
    setInfoDraft({ ...infoDraft, details: { ...infoDraft.details, roomCounts: infoDraft.rooms.map(name => ({ name, count: name === room ? count : roomCount(name) })) } })
  }
  function totalRoomCount(rooms: string[], details?: BuildingDetails) {
    return rooms.reduce((sum, room) => sum + (details?.roomCounts?.find(row => row.name === room)?.count ?? 1), 0)
  }
  function roomInUse(room: string) {
    return asset.items.some(item => item.room === room) || asset.boq.some(item => item.room === room) || works.some(work => work.roomNames.includes(room))
  }
  async function saveInfo(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setInfoError('')
    try {
      await onSave({ address: infoDraft.address.trim(), buildingDetails: infoDraft.details, rooms: infoDraft.rooms, costSource: infoDraft.costSource, purchasePrice: infoDraft.purchasePrice }, 'แก้ไขข้อมูลบ้านและห้อง')
      setInfoOpen(false)
    } catch (caught) { setInfoError(caught instanceof Error ? caught.message : 'บันทึกข้อมูลบ้านไม่สำเร็จ') }
  }
  function editWork(work?: BuildingWork) {
    setWorkDraft(work ? structuredClone(work) : emptyWork()); setWorkError(''); setWorkOpen(true)
  }
  async function saveWork(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (!workDraft) return
    if (!workDraft.name.trim()) { setWorkError('กรอกชื่องานก่อนบันทึก'); return }
    setWorkError('')
    const rows = [...works.filter(row => row.id !== workDraft.id), { ...workDraft, name: workDraft.name.trim(), vendor: workDraft.vendor.trim(), reference: workDraft.reference.trim(), notes: workDraft.notes.trim() }].sort((a, b) => a.date.localeCompare(b.date))
    try { await onSave({ buildingWorks: rows }, `${works.some(row => row.id === workDraft.id) ? 'แก้ไข' : 'เพิ่ม'}รายการบ้าน: ${workDraft.name}`); setWorkOpen(false); setWorkDraft(null) }
    catch (caught) { setWorkError(caught instanceof Error ? caught.message : 'บันทึกรายการบ้านไม่สำเร็จ') }
  }
  function openBoq() { setBoqDraft(constructionRows.map(row => structuredClone(row))); setBoqImportChoices([]); setBoqImportSheet(''); setBoqImportNotice(''); setBoqError(''); setBoqOpen(true) }
  async function importBoqFile(file?: File) {
    if (!file) return
    setBoqError(''); setBoqImportNotice('')
    try {
      if (file.name.toLowerCase().endsWith('.pdf') || file.type === 'application/pdf') {
        const upload = new FormData(); upload.set('file', file)
        const extracted = await extractBoqPdfText(upload)
        const items = parsePdfBoqLines(extracted.pages)
        if (!items.length) throw new Error('ไม่พบแถว BOQ ที่อ่านได้ใน PDF หากเป็นไฟล์สแกนต้องใช้ OCR หรือหากตารางมีรูปแบบต่างออกไปให้ตรวจเอกสารก่อน')
        await persistBoqRows(items, file.name)
        return
      }
      const choices = await readBoqWorkbook(file)
      if (!choices.length) throw new Error('ไม่พบรายการ BOQ ในไฟล์นี้')
      setBoqImportChoices(choices); setBoqImportSheet(choices[0].sheetName)
      if (choices.length === 1) await persistBoqRows(choices[0].items, choices[0].sheetName)
    } catch (caught) { setBoqError(caught instanceof Error ? caught.message : 'อ่านไฟล์ BOQ ไม่สำเร็จ') }
  }
  async function applyImportedBoq() {
    const choice = boqImportChoices.find(sheet => sheet.sheetName === boqImportSheet)
    if (!choice) return
    await persistBoqRows(choice.items, choice.sheetName)
  }
  async function persistBoqRows(rows: BoqItem[], source: string) {
    if (rows.some(row => !row.name.trim() || row.quantity <= 0)) { setBoqError('ข้อมูลในไฟล์มีรายการหรือจำนวนไม่ถูกต้อง'); return }
    const otherRows = asset.boq.filter(row => row.scope === 'builtin' || row.cancelled)
    try {
      await onSave({ boq: [...otherRows, ...rows.map(row => ({ ...row, scope: 'construction' as const }))], costSource: 'boq' }, `นำเข้า BOQ ก่อสร้างจากชีต ${source}`)
      setBoqDraft(rows); setBoqError(''); setBoqOpen(false)
    } catch (caught) { setBoqError(caught instanceof Error ? caught.message : 'นำเข้าและบันทึก BOQ ไม่สำเร็จ') }
  }
  async function exportBoq(rows: BoqItem[] = boqDraft) {
    try {
      const ExcelJS = await import('exceljs')
      const workbook = new ExcelJS.Workbook()
      const sheet = workbook.addWorksheet('BOQ ก่อสร้าง')
      sheet.columns = [
        { header: 'หมวด', key: 'category', width: 26 }, { header: 'หมวดย่อย', key: 'subcategory', width: 24 },
        { header: 'รายการ', key: 'name', width: 42 }, { header: 'จำนวน', key: 'quantity', width: 12 },
        { header: 'หน่วย', key: 'unit', width: 14 }, { header: 'ค่าวัสดุต่อหน่วย', key: 'price', width: 18 },
        { header: 'ค่าแรงรวม', key: 'labor', width: 16 }, { header: 'รวมวัสดุ', key: 'materialTotal', width: 16 },
        { header: 'รวมค่าก่อสร้าง', key: 'total', width: 18 }, { header: 'รายละเอียด / สเปก', key: 'spec', width: 40 },
      ]
      sheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } }
      sheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF315E59' } }
      for (const row of rows) sheet.addRow({ ...row, materialTotal: row.quantity * row.price, total: row.quantity * row.price + row.labor })
      sheet.autoFilter = 'A1:J1'; sheet.views = [{ state: 'frozen', ySplit: 1 }]
      const bytes = await workbook.xlsx.writeBuffer()
      const url = URL.createObjectURL(new Blob([bytes], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }))
      const link = document.createElement('a'); link.href = url; link.download = `BOQ-${asset.assetCode ?? 'building'}.xlsx`; link.click(); URL.revokeObjectURL(url)
    } catch (caught) { setBoqError(caught instanceof Error ? `ส่งออก Excel ไม่สำเร็จ: ${caught.message}` : 'ส่งออก Excel ไม่สำเร็จ') }
  }
  async function saveBoq(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (boqDraft.some(row => !row.name.trim() || row.quantity <= 0)) { setBoqError('กรอกรายการและจำนวน BOQ ให้ครบ'); return }
    const otherRows = asset.boq.filter(row => row.scope === 'builtin' || row.cancelled)
    try { await onSave({ boq: [...otherRows, ...boqDraft.map(row => ({ ...row, scope: 'construction' as const }))], costSource: 'boq' }, 'บันทึกรายการ BOQ ก่อสร้างบ้าน'); setBoqOpen(false) }
    catch (caught) { setBoqError(caught instanceof Error ? caught.message : 'บันทึก BOQ ไม่สำเร็จ') }
  }
  const boqTotal = boqDraft.reduce((sum, row) => sum + row.quantity * row.price + row.labor, 0)

  return <section className="mt-4 overflow-hidden rounded-2xl border border-slate-200 bg-white" aria-label={`ข้อมูลบ้าน ${asset.name}`}>
    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-4 py-3">
      <div className="flex gap-1 rounded-xl bg-slate-100 p-1" role="tablist" aria-label="ส่วนจัดการบ้าน">
        <button type="button" role="tab" aria-selected={section === 'information'} onClick={() => setSection('information')} className={`rounded-lg px-3 py-2 text-xs font-medium ${section === 'information' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500'}`}><Building2 size={14} className="mr-1 inline" />ข้อมูลบ้าน</button>
        <button type="button" role="tab" aria-selected={section === 'management'} onClick={() => setSection('management')} className={`rounded-lg px-3 py-2 text-xs font-medium ${section === 'management' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500'}`}><Wrench size={14} className="mr-1 inline" />จัดการบ้าน · {works.length}</button>
      </div>
      {section === 'information' && canWrite ? <Button disabled={busy} onClick={openInfo}><Pencil size={13} />แก้ไขข้อมูลบ้าน</Button> : null}
      {section === 'management' && canWrite ? <Button variant="primary" disabled={busy} onClick={() => editWork()}><Plus size={14} />เพิ่มรายการ</Button> : null}
    </div>

    {section === 'information' ? <div className="grid gap-4 p-4 lg:grid-cols-[minmax(0,1.1fr)_minmax(260px,0.9fr)]">
      <div><h3 className="mb-2 mt-0 flex items-center gap-2 text-sm font-semibold text-slate-800"><Building2 size={15} />ข้อมูลประจำบ้าน</h3><dl className="grid grid-cols-2 gap-2 text-xs"><div className="rounded-xl bg-slate-50 p-3"><dt className="text-slate-500">ที่อยู่</dt><dd className="mb-0 mt-1 font-medium text-slate-800">{asset.address || 'ยังไม่ระบุ'}</dd></div><div className="rounded-xl bg-slate-50 p-3"><dt className="text-slate-500">พื้นที่ใช้สอย</dt><dd className="mb-0 mt-1 font-medium text-slate-800">{asset.buildingDetails?.usableAreaSqm ? `${money(asset.buildingDetails.usableAreaSqm)} ตร.ม.` : 'ยังไม่ระบุ'}</dd></div><div className="rounded-xl bg-slate-50 p-3"><dt className="text-slate-500">จำนวนชั้น</dt><dd className="mb-0 mt-1 font-medium text-slate-800">{asset.buildingDetails?.floorCount ?? 1} ชั้น</dd></div><div className="rounded-xl bg-slate-50 p-3"><dt className="text-slate-500">ประเภทอาคาร</dt><dd className="mb-0 mt-1 font-medium text-slate-800">{asset.buildingDetails?.buildingType || 'ยังไม่ระบุ'}</dd></div></dl>
        <div className="mt-3"><h4 className="mb-2 mt-0 text-xs font-semibold text-slate-700">ห้อง / พื้นที่ · รวม {totalRoomCount(asset.rooms, asset.buildingDetails)} ห้อง</h4>{asset.rooms.length ? <div className="flex flex-wrap gap-1.5">{asset.rooms.map(room => <span key={room} className="rounded-full bg-slate-100 px-2.5 py-1 text-xs text-slate-600">{room} {roomCount(room, { ...infoDraft, details: asset.buildingDetails ?? emptyDetails() })} ห้อง</span>)}</div> : <p className="mb-0 text-xs text-slate-400">ยังไม่มีรายการห้อง</p>}</div>
      </div>
      <aside className="rounded-xl border border-slate-200 bg-slate-50/70 p-3"><div className="flex items-center justify-between gap-2"><h3 className="m-0 flex items-center gap-2 text-sm font-semibold text-slate-800"><ClipboardList size={15} />ต้นทุนก่อสร้างอ้างอิง</h3><div className="flex flex-wrap gap-2">{canWrite ? <Button disabled={busy} onClick={openBoq}><Pencil size={13} />จัดการ BOQ</Button> : null}<Button disabled={!constructionRows.length} onClick={() => void exportBoq(constructionRows)}><Download size={14} />ส่งออก Excel</Button></div></div>
        <p className="mb-0 mt-2 text-xs text-slate-500">วิธีอ้างอิง: {asset.costSource === 'boq' ? 'BOQ' : 'ราคาเหมา / ราคาซื้อ'}</p><strong className="mt-1 block text-lg text-slate-900">{money(costs.main)} บาท</strong><p className="mb-0 mt-1 text-xs text-slate-500">{asset.costSource === 'boq' ? `รายการก่อสร้าง BOQ ${constructionRows.length} · ${money(constructionBoqTotal)} บาท` : `ราคาตั้งต้น ${money(asset.purchasePrice)} บาท`}</p>
        {capitalWorks ? <p className="mb-0 mt-2 text-xs text-emerald-700">ต้นทุนต่อเติม/ปรับปรุงจริง {money(capitalWorks)} บาท · คิดแยกจากราคาอ้างอิง</p> : null}<p className="mb-0 mt-1 text-xs text-slate-500">ต้นทุนสินทรัพย์รวม {money(costs.total)} บาท</p><p className="mb-0 mt-2 text-[11px] leading-5 text-slate-400">ใช้ราคาเหมา หรือ BOQ เป็นราคาก่อสร้างหลักเพียงแบบเดียว งานที่เพิ่มภายหลังบันทึกแยกในส่วนจัดการบ้าน</p>
      </aside>
    </div> : <div className="p-4"><div className="mb-3 grid gap-2 sm:grid-cols-3"><div className="rounded-xl bg-slate-50 p-3"><span className="block text-[11px] text-slate-500">รายการ</span><strong className="mt-1 block text-sm">{works.length} งาน</strong></div><div className="rounded-xl bg-emerald-50/70 p-3"><span className="block text-[11px] text-slate-500">ปรับปรุงที่เพิ่มต้นทุน</span><strong className="mt-1 block text-sm text-emerald-800">{money(capitalWorks)} บาท</strong></div><div className="rounded-xl bg-amber-50/70 p-3"><span className="block text-[11px] text-slate-500">ซ่อม / บริการ</span><strong className="mt-1 block text-sm text-amber-800">{money(expenseWorks)} บาท</strong></div></div>
      {!works.length ? <div className="rounded-xl border border-dashed border-slate-200 px-4 py-8 text-center"><BadgePlus className="mx-auto mb-2 text-slate-400" size={22} /><p className="m-0 text-sm font-medium text-slate-700">ยังไม่มีงานบ้าน</p><p className="mb-3 mt-1 text-xs text-slate-500">บันทึกงานก่อสร้าง ซ่อม ต่อเติม ตกแต่ง บิวท์อิน หรืออุปกรณ์ได้ โดยเลือกห้องที่เกี่ยวข้อง</p>{canWrite ? <Button variant="primary" disabled={busy} onClick={() => editWork()}><Plus size={14} />เพิ่มรายการแรก</Button> : null}</div> : <div className="space-y-2">{works.toReversed().map(work => <article key={work.id} className="rounded-xl border border-slate-200 bg-white px-3 py-3"><div className="flex flex-wrap items-start justify-between gap-3"><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-1.5"><strong className="text-sm text-slate-800">{work.name}</strong><span className="text-xs text-slate-500">{workTypes[work.type]}</span><span className={`rounded-full px-2 py-0.5 text-[10px] ${work.treatment === 'capital' ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>{work.treatment === 'capital' ? 'เพิ่มต้นทุนสินทรัพย์' : 'ซ่อม / บริการ'}</span></div><p className="mb-0 mt-1 text-xs text-slate-500">{work.roomNames.length ? work.roomNames.join(' · ') : 'ทั้งอาคาร'} · {work.date}{work.vendor ? ` · ${work.vendor}` : ''}</p><p className="mb-0 mt-1 text-xs text-slate-600">{money(work.amount)} บาท{work.warrantyUntil ? ` · รับประกันถึง ${work.warrantyUntil}` : ''}{work.reference ? ` · ${work.reference}` : ''}</p>{work.notes ? <p className="mb-0 mt-1 text-xs text-slate-400">{work.notes}</p> : null}</div>{canWrite ? <Button disabled={busy} onClick={() => editWork(work)} aria-label={`แก้ไข ${work.name}`}><Pencil size={13} />แก้ไข</Button> : null}</div></article>)}</div>}
    </div>}

    <Modal open={infoOpen} title={`ข้อมูลบ้าน · ${asset.name}`} onClose={() => { if (!busy) setInfoOpen(false) }} className="max-w-2xl"><form className="space-y-4" onSubmit={saveInfo}><div className="grid gap-3 sm:grid-cols-2"><label className={`${label} sm:col-span-2`}>ที่อยู่<input className={field} maxLength={1000} value={infoDraft.address} onChange={event => setInfoDraft({ ...infoDraft, address: event.target.value })} /></label><label className={label}>พื้นที่ใช้สอย (ตร.ม.)<input className={field} type="number" min="0" step="0.01" value={infoDraft.details.usableAreaSqm} onChange={event => setInfoDraft({ ...infoDraft, details: { ...infoDraft.details, usableAreaSqm: Number(event.target.value) } })} /></label><label className={label}>จำนวนชั้น<input className={field} type="number" min="0" step="1" value={infoDraft.details.floorCount} onChange={event => setInfoDraft({ ...infoDraft, details: { ...infoDraft.details, floorCount: Number(event.target.value) } })} /></label><label className={label}>ประเภทอาคาร<input className={field} maxLength={120} value={infoDraft.details.buildingType} onChange={event => setInfoDraft({ ...infoDraft, details: { ...infoDraft.details, buildingType: event.target.value } })} placeholder="เช่น บ้านเดี่ยว" /></label><label className={label}>วันที่สร้างเสร็จ<input className={field} type="date" max={today()} value={infoDraft.details.completedOn} onChange={event => setInfoDraft({ ...infoDraft, details: { ...infoDraft.details, completedOn: event.target.value } })} /></label>
        <label className={`${label} sm:col-span-2`}>วิธีอ้างอิงราคาก่อสร้าง<select className={field} value={infoDraft.costSource} onChange={event => setInfoDraft({ ...infoDraft, costSource: event.target.value as Home['costSource'] })}><option value="manual">ราคาเหมา / ราคาซื้อ</option><option value="boq">BOQ</option></select></label>{infoDraft.costSource === 'manual' ? <label className={`${label} sm:col-span-2`}>ราคาก่อสร้างอ้างอิง / ราคาซื้อ (บาท)<input className={field} type="number" min="0" step="0.01" value={infoDraft.purchasePrice} onChange={event => setInfoDraft({ ...infoDraft, purchasePrice: Number(event.target.value) })} /></label> : <div className="rounded-xl bg-blue-50 p-3 text-xs text-blue-800 sm:col-span-2">อ้างอิง BOQ ก่อสร้าง {constructionRows.length} รายการ · {money(constructionBoqTotal)} บาท · ใช้ปุ่ม “จัดการ BOQ” เพื่อแก้ไขรายการ</div>}
        <label className={`${label} sm:col-span-2`}>หมายเหตุ<textarea className={field} rows={2} maxLength={1000} value={infoDraft.details.notes} onChange={event => setInfoDraft({ ...infoDraft, details: { ...infoDraft.details, notes: event.target.value } })} /></label></div>
        <div className="rounded-xl border border-slate-200 p-3"><div className="flex items-center justify-between gap-2"><h3 className="m-0 text-sm font-semibold">ห้อง / พื้นที่</h3><span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs text-slate-600">รวม {totalRoomCount(infoDraft.rooms, infoDraft.details)} ห้อง</span></div><p className="mb-0 mt-1 text-[11px] text-slate-400">เพิ่มประเภทห้องและจำนวน เช่น ห้องน้ำ 4 ห้อง</p><div className="mt-2 space-y-1.5">{infoDraft.rooms.map(room => <div key={room} className="flex items-center gap-2 rounded-lg bg-slate-50 px-3 py-2 text-xs"><span className="min-w-0 flex-1">{room}</span><label className="flex items-center gap-1 text-slate-500">จำนวน<input className="w-16 rounded-lg border border-slate-200 bg-white px-2 py-1 text-right text-xs text-slate-800" type="number" min="1" step="1" value={roomCount(room)} onChange={event => updateRoomCount(room, Math.max(1, Number(event.target.value)))} aria-label={`จำนวน ${room}`} /></label><button type="button" disabled={roomInUse(room)} title={roomInUse(room) ? 'ห้องนี้มีรายการที่เชื่อมอยู่' : 'ลบห้อง'} className="rounded p-1 text-slate-400 hover:bg-rose-50 hover:text-rose-600 disabled:cursor-not-allowed disabled:opacity-40" aria-label={`ลบห้อง ${room}`} onClick={() => setInfoDraft({ ...infoDraft, rooms: infoDraft.rooms.filter(value => value !== room), details: { ...infoDraft.details, roomCounts: infoDraft.details.roomCounts?.filter(row => row.name !== room) } })}><Trash2 size={14} /></button></div>)}</div><div className="mt-2 grid grid-cols-[minmax(0,1fr)_5rem_auto] items-end gap-2"><label className={label}>ชื่อประเภทห้อง<input className={field} value={infoDraft.newRoom} onChange={event => setInfoDraft({ ...infoDraft, newRoom: event.target.value })} placeholder="เช่น ห้องทำงาน" /></label><label className={label}>จำนวน<input className={field} type="number" min="1" step="1" value={infoDraft.newRoomCount} onChange={event => setInfoDraft({ ...infoDraft, newRoomCount: Math.max(1, Number(event.target.value)) })} /></label><Button type="button" disabled={!infoDraft.newRoom.trim() || infoDraft.rooms.includes(infoDraft.newRoom.trim())} onClick={addRoom}><Plus size={13} />เพิ่ม</Button></div></div>
        {infoError ? <p role="alert" className="m-0 text-sm text-rose-700">{infoError}</p> : null}<div className="flex justify-end gap-2"><Button disabled={busy} onClick={() => setInfoOpen(false)}>ยกเลิก</Button><Button type="submit" variant="primary" disabled={busy}>{busy ? 'กำลังบันทึก…' : 'บันทึกข้อมูลบ้าน'}</Button></div></form></Modal>

    <Modal open={boqOpen} title={`BOQ ก่อสร้าง · ${asset.name}`} description="อัปโหลดไฟล์ Excel หรือกรอกตารางเอง โดยจัดรายการตามหมวดและหมวดย่อย" onClose={() => { if (!busy) setBoqOpen(false) }} className="max-w-5xl"><form className="space-y-3" onSubmit={saveBoq}>
      <div className="rounded-xl bg-slate-50 p-3"><p className="m-0 text-xs font-medium text-slate-700">นำเข้า BOQ จาก Excel หรือ PDF <span className="font-normal text-slate-500">(.xlsx, .xlsm, .pdf ไม่เกิน 15 MB)</span></p><input className="mt-2 block max-w-full text-xs" type="file" accept=".xlsx,.xlsm,.pdf,application/pdf,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel.sheet.macroEnabled.12" onChange={event => { void importBoqFile(event.currentTarget.files?.[0]); event.currentTarget.value = '' }} /><p className="mb-0 mt-1 text-[11px] text-slate-400">PDF ต้องมีข้อความที่เลือกได้ ไฟล์สแกนภาพต้องผ่าน OCR</p></div>
      {boqImportNotice ? <p role="status" className="m-0 rounded-xl border border-emerald-100 bg-emerald-50 p-3 text-xs text-emerald-800">{boqImportNotice}</p> : null}
      {boqImportChoices.length ? <div className="flex flex-wrap items-end gap-2 rounded-xl border border-blue-100 bg-blue-50/60 p-3"><label className={`${label} min-w-48 flex-1`}>เลือกชุด BOQ เพื่อบันทึก<select className={field} value={boqImportSheet} onChange={event => setBoqImportSheet(event.target.value)}>{boqImportChoices.map(choice => { const total = choice.items.reduce((sum, row) => sum + row.quantity * row.price + row.labor, 0); return <option key={choice.sheetName} value={choice.sheetName}>{choice.sheetName} · {choice.items.length} รายการ · {money(total)} บาท</option> })}</select></label><Button type="button" variant="primary" disabled={busy} onClick={() => void applyImportedBoq()}><FileUp size={14} />นำเข้าและบันทึก</Button></div> : null}
      <div className="flex flex-wrap items-center justify-between gap-2"><p className="m-0 text-xs text-slate-500">รวม BOQ ก่อสร้าง <strong className="text-slate-800">{money(boqTotal)} บาท</strong> · แยกตามหมวดและหมวดย่อย</p><Button type="button" onClick={() => setBoqDraft([...boqDraft, emptyBoq()])}><Plus size={13} />เพิ่มรายการ</Button></div>
      {boqDraft.length ? <div className="max-h-[55vh] space-y-2 overflow-y-auto">{boqDraft.map((row, index) => <div key={row.id} className="grid gap-2 rounded-xl border border-slate-200 p-3 sm:grid-cols-6"><label className={`${label} sm:col-span-2`}>1 · หมวด<input className={field} value={row.category} onChange={event => setBoqDraft(boqDraft.map((value, i) => i === index ? { ...value, category: event.target.value } : value))} placeholder="เช่น งานโครงสร้าง" /></label><label className={`${label} sm:col-span-2`}>1.1 · หมวดย่อย<input className={field} value={row.subcategory ?? ''} onChange={event => setBoqDraft(boqDraft.map((value, i) => i === index ? { ...value, subcategory: event.target.value } : value))} placeholder="เช่น งานฐานราก" /></label><button type="button" aria-label={`ลบ ${row.name || 'รายการ BOQ'}`} className="justify-self-end self-end rounded-lg p-2 text-slate-400 hover:bg-rose-50 hover:text-rose-600 sm:col-span-2" onClick={() => setBoqDraft(boqDraft.filter((_, i) => i !== index))}><Trash2 size={15} /></button><label className={`${label} sm:col-span-3`}>รายการ<input className={field} required value={row.name} onChange={event => setBoqDraft(boqDraft.map((value, i) => i === index ? { ...value, name: event.target.value } : value))} placeholder="เช่น คอนกรีตโครงสร้าง" /></label><label className={label}>จำนวน<input className={field} type="number" min="0.01" step="0.01" value={row.quantity} onChange={event => setBoqDraft(boqDraft.map((value, i) => i === index ? { ...value, quantity: Number(event.target.value) } : value))} /></label><label className={label}>หน่วย<input className={field} value={row.unit} onChange={event => setBoqDraft(boqDraft.map((value, i) => i === index ? { ...value, unit: event.target.value } : value))} /></label><label className={label}>วัสดุ / หน่วย<input className={field} type="number" min="0" step="0.01" value={row.price} onChange={event => setBoqDraft(boqDraft.map((value, i) => i === index ? { ...value, price: Number(event.target.value) } : value))} /></label><label className={label}>ค่าแรงรวม<input className={field} type="number" min="0" step="0.01" value={row.labor} onChange={event => setBoqDraft(boqDraft.map((value, i) => i === index ? { ...value, labor: Number(event.target.value) } : value))} /></label><label className={`${label} sm:col-span-4`}>รายละเอียด / สเปก<input className={field} value={row.spec} onChange={event => setBoqDraft(boqDraft.map((value, i) => i === index ? { ...value, spec: event.target.value } : value))} /></label><p className="m-0 self-end text-xs font-medium text-slate-600 sm:col-span-2">รวม {money(row.quantity * row.price + row.labor)} บาท</p></div>)}</div> : <p className="rounded-xl bg-slate-50 p-5 text-center text-sm text-slate-500">ยังไม่มีรายการ BOQ ก่อสร้าง</p>}
      {boqError ? <p role="alert" className="m-0 text-sm text-rose-700">{boqError}</p> : null}<div className="flex justify-end gap-2"><Button disabled={busy} onClick={() => setBoqOpen(false)}>ยกเลิก</Button><Button variant="primary" type="submit" disabled={busy}>{busy ? 'กำลังบันทึก…' : 'บันทึก BOQ'}</Button></div></form></Modal>

    <Modal open={workOpen} title={`${workDraft && works.some(work => work.id === workDraft.id) ? 'แก้ไข' : 'เพิ่ม'}รายการบ้าน · ${asset.name}`} description="เลือกห้องได้หลายห้อง หรือเว้นว่างเพื่อระบุว่าทำทั้งอาคาร" onClose={() => { if (!busy) { setWorkOpen(false); setWorkDraft(null) } }} className="max-w-2xl">{workDraft ? <form className="space-y-4" onSubmit={saveWork}><div className="grid gap-3 sm:grid-cols-2"><label className={label}>ประเภทงาน<select className={field} value={workDraft.type} onChange={event => { const type = event.target.value as BuildingWorkType; setWorkDraft({ ...workDraft, type, treatment: type === 'repair' ? 'expense' : workDraft.treatment }) }}>{typeList.map(([value, name]) => <option key={value} value={value}>{name}</option>)}</select></label><label className={label}>ชื่องาน *<input className={field} required maxLength={300} value={workDraft.name} onChange={event => setWorkDraft({ ...workDraft, name: event.target.value })} placeholder="เช่น ทาสีห้องครัว" /></label><label className={label}>วันที่ *<input className={field} type="date" required max={today()} value={workDraft.date} onChange={event => setWorkDraft({ ...workDraft, date: event.target.value })} /></label><label className={label}>มูลค่า / ค่าใช้จ่าย (บาท)<input className={field} type="number" min="0" step="0.01" value={workDraft.amount} onChange={event => setWorkDraft({ ...workDraft, amount: Number(event.target.value) })} /></label>
        <fieldset className="rounded-xl border border-slate-200 p-3 sm:col-span-2"><legend className="px-1 text-xs font-medium text-slate-600">ห้องที่เกี่ยวข้อง · เลือกได้หลายห้อง</legend>{asset.rooms.length ? <div className="grid gap-2 sm:grid-cols-3">{asset.rooms.map(room => <label key={room} className="flex items-center gap-2 text-xs text-slate-700"><input type="checkbox" checked={workDraft.roomNames.includes(room)} onChange={event => setWorkDraft({ ...workDraft, roomNames: event.target.checked ? [...workDraft.roomNames, room] : workDraft.roomNames.filter(value => value !== room) })} />{room}</label>)}</div> : <p className="m-0 text-xs text-slate-400">ยังไม่มีห้อง ใช้ขอบเขตทั้งอาคารได้ หรือเพิ่มห้องจากข้อมูลบ้าน</p>}<p className="mb-0 mt-2 text-[11px] text-slate-400">ไม่เลือกห้อง = งานระดับทั้งอาคาร</p></fieldset>
        <label className={label}>บันทึกเป็น<select className={field} value={workDraft.treatment} onChange={event => setWorkDraft({ ...workDraft, treatment: event.target.value as BuildingWork['treatment'] })}><option value="capital">ต้นทุนปรับปรุงสินทรัพย์</option><option value="expense">ซ่อม / บริการ</option></select></label><label className={label}>ผู้รับเหมา / ร้านค้า<input className={field} maxLength={300} value={workDraft.vendor} onChange={event => setWorkDraft({ ...workDraft, vendor: event.target.value })} /></label><label className={label}>ประกันถึงวันที่<input className={field} type="date" value={workDraft.warrantyUntil} onChange={event => setWorkDraft({ ...workDraft, warrantyUntil: event.target.value })} /></label><label className={label}>เลขอ้างอิง / ใบเสร็จ<input className={field} maxLength={150} value={workDraft.reference} onChange={event => setWorkDraft({ ...workDraft, reference: event.target.value })} /></label><label className={`${label} sm:col-span-2`}>หมายเหตุ<textarea className={field} rows={2} maxLength={1000} value={workDraft.notes} onChange={event => setWorkDraft({ ...workDraft, notes: event.target.value })} /></label></div>{workError ? <p role="alert" className="m-0 text-sm text-rose-700">{workError}</p> : null}<div className="flex justify-end gap-2"><Button disabled={busy} onClick={() => { setWorkOpen(false); setWorkDraft(null) }}>ยกเลิก</Button><Button variant="primary" type="submit" disabled={busy}>{busy ? 'กำลังบันทึก…' : 'บันทึกรายการ'}</Button></div></form> : null}</Modal>
  </section>
}
