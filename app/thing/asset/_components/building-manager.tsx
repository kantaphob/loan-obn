'use client'

import { useState, type FormEvent } from 'react'
import { BadgePlus, Building2, ClipboardList, Download, FileUp, Pencil, Plus, Trash2, Wrench, Package, Hammer, BrushCleaning, Wallet } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Modal } from '@/components/ui/modal'
import { assetCosts, money, today, type BoqItem, type BuildingChangeOrder, type BuildingChangeOrderLine, type BuildingDetails, type BuildingProject, type BuildingWork, type BuildingWorkType, type Home, type HomeItem, type LedgerOption } from '@/app/thing/_shared/model'
import { parseBoqTsv } from '@/app/thing/_shared/boq-import'
import { extractBoqPdfText } from '@/app/thing/_shared/actions'

const workTypes: Record<BuildingWorkType, string> = { construction: 'ก่อสร้าง', repair: 'ซ่อมบำรุง', improvement: 'ต่อเติม / ปรับปรุง', decoration: 'ตกแต่ง', built_in: 'บิวท์อิน', equipment: 'อุปกรณ์' }
const typeList = Object.entries(workTypes) as [BuildingWorkType, string][]
const field = 'mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100'
const label = 'block text-xs font-medium text-slate-600'
const emptyDetails = (): BuildingDetails => ({ usableAreaSqm: 0, floorCount: 1, buildingType: '', completedOn: '', notes: '', roomCounts: [] })
const emptyWork = (): BuildingWork => ({ id: crypto.randomUUID(), type: 'repair', name: '', roomNames: [], date: today(), amount: 0, treatment: 'expense', vendor: '', warrantyUntil: '', reference: '', notes: '' })
const emptyBoq = (): BoqItem => ({ id: crypto.randomUUID(), scope: 'construction', category: 'หมวดงานทั่วไป', subcategory: '', name: '', spec: '', quantity: 1, unit: 'งาน', price: 0, labor: 0, paid: 0, vendor: '', reference: '' })
const emptyHomeItem = (): HomeItem => ({ id: crypto.randomUUID(), room: '', name: '', size: '', quantity: 1, price: 0, shop: '', purchasedOn: today(), warrantyStart: today(), warrantyMonths: 0, warrantyUntil: '', notes: '', status: 'active' })
const emptyProject = (): BuildingProject => ({ id: crypto.randomUUID(), name: '', type: 'extension', roomNames: [], pricingMode: 'lump_sum', lumpSum: 0, boqLines: [], status: 'planned', startedOn: today(), completedOn: '', vendor: '', reference: '', notes: '', warrantyUntil: '', actualCost: 0, payments: [], outcome: { type: 'none', roomName: '', newRoomName: '', areaAddedSqm: 0, componentName: '', replacesItemId: '' } })
const emptyChangeOrderLine = (): BuildingChangeOrderLine => ({ id: crypto.randomUUID(), kind: 'add', description: '', amount: 0 })
export type BuildingProjectPaymentDraft = { direction: 'IN' | 'OUT'; amount: string; occurredOn: string; categoryCode: string; channelCode: string; reference: string; note: string; paymentType: 'deposit' | 'progress' | 'final' | 'refund'; slip: File | null }

function warrantyEndDate(purchasedOn: string, months: number) {
  if (!purchasedOn || !Number.isInteger(months) || months <= 0) return ''
  const [year, month, day] = purchasedOn.split('-').map(Number)
  const targetMonth = month - 1 + months
  const lastDay = new Date(Date.UTC(year, targetMonth + 1, 0)).getUTCDate()
  return new Date(Date.UTC(year, targetMonth, Math.min(day, lastDay))).toISOString().slice(0, 10)
}

async function readReceipt(file: File) {
  if (!file.size || file.size > 5 * 1024 * 1024) throw new Error('ไฟล์บิลหรือเอกสารต้องมีขนาดไม่เกิน 5 MB')
  const bytes = new Uint8Array(await file.slice(0, 8).arrayBuffer())
  const mimeType = bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46 && bytes[4] === 0x2d ? 'application/pdf'
    : bytes.length >= 8 && [137, 80, 78, 71, 13, 10, 26, 10].every((value, index) => bytes[index] === value) ? 'image/png'
    : bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff ? 'image/jpeg' : null
  if (!mimeType) throw new Error('รองรับเฉพาะไฟล์ PDF, JPG หรือ PNG')
  return await new Promise<NonNullable<HomeItem['receipt']>>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => typeof reader.result === 'string' ? resolve({ name: file.name.slice(0, 240), mimeType, dataUrl: reader.result }) : reject(new Error('อ่านไฟล์ไม่สำเร็จ'))
    reader.onerror = () => reject(new Error('อ่านไฟล์ไม่สำเร็จ'))
    reader.readAsDataURL(file)
  })
}

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
      if (rowNumber <= 3) return
      const sequence = cellText(row.getCell(1).value)
      const name = cellText(row.getCell(2).value)
      if (/^ITEM$/i.test(sequence) || /^DESCRIPTION$/i.test(name)) { summaryStarted = true; return }
      if (/^(?:รวมหมวด|รวมงาน|รวมค่าก่อสร้าง|ยอดรวม)/.test(name)) return
      const quantity = cellNumber(row.getCell(3).value)
      const unit = cellText(row.getCell(4).value)
      const materialRate = cellNumber(row.getCell(5).value)
      const materialTotal = cellNumber(row.getCell(6).value)
      const laborRate = cellNumber(row.getCell(7).value)
      const laborTotal = cellNumber(row.getCell(8).value)
      const hasPricing = quantity > 0 || materialRate > 0 || materialTotal > 0 || laborRate > 0 || laborTotal > 0
      if (!name || /^(ITEM|DESCRIPTION|ลำดับที่|รายการ)$/i.test(name)) return
      if (!hasPricing && (/^หมวด/.test(name) || sequence && Number.isInteger(Number(sequence)))) { category = name.replace(/^\d+(?:\.\d+)*\s*/, '').replace(/^หมวด\s*/, '').replace(/\s+[\d,]+(?:\.\d+)?\s*$/, '').trim() || 'หมวดงานทั่วไป'; subcategory = ''; return }
      if (!hasPricing) { subcategory = name; return }
      const safeQuantity = quantity > 0 ? quantity : 1
      const price = cellText(row.getCell(5).value) ? materialRate : (materialTotal > 0 ? materialTotal / safeQuantity : 0)
      const labor = cellText(row.getCell(8).value) ? laborTotal : laborRate * safeQuantity
      items.push({ id: crypto.randomUUID(), scope: 'construction', category, subcategory, name, spec: '', quantity: safeQuantity, unit: unit || 'งาน', price, labor, paid: 0, vendor: '', reference: '', materialTotal, laborRate, boqTotal: cellNumber(row.getCell(9).value), note: cellText(row.getCell(10).value) })
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
      items.push({ id: crypto.randomUUID(), scope: 'construction', category, subcategory, name, spec: '', quantity, unit: tokens[unitIndex].replace(/[,:;]$/, ''), price, labor, paid: 0, vendor: '', reference: '', materialTotal: amounts.length >= 2 ? amounts[1] : price * quantity, laborRate: amounts.length >= 3 ? amounts[2] : undefined, boqTotal: amounts.length >= 5 ? amounts[4] : undefined })
      continue
    }
    if (!/\d/.test(normalized) && !/^(รวม|หมายเหตุ|เลขที่|รายการที่)/.test(normalized)) subcategory = normalized
  }
  return items
}

export function BuildingManager({ asset, canWrite, busy, ledger, usedLedgerIds, financialCategories, channels, onCreateProjectPayment, onSave }: { asset: Home; canWrite: boolean; busy: boolean; ledger: LedgerOption[]; usedLedgerIds: number[]; financialCategories: { code: string; nameTh: string; direction: string }[]; channels: { code: string; nameTh: string }[]; onCreateProjectPayment: (project: BuildingProject | BuildingChangeOrder, payment: BuildingProjectPaymentDraft) => Promise<void>; onSave: (patch: Partial<Home>, reason: string) => Promise<void> }) {
  const [section, setSection] = useState<'information' | 'management' | 'cashbook'>('information')
  const [infoOpen, setInfoOpen] = useState(false)
  const [infoError, setInfoError] = useState('')
  const [infoDraft, setInfoDraft] = useState<{ address: string; details: BuildingDetails; rooms: string[]; newRoom: string; newRoomCount: number; costSource: Home['costSource']; purchasePrice: number }>({ address: asset.address, details: asset.buildingDetails ?? emptyDetails(), rooms: [...asset.rooms], newRoom: '', newRoomCount: 1, costSource: asset.costSource, purchasePrice: asset.purchasePrice })
  const [workOpen, setWorkOpen] = useState(false)
  const [workError, setWorkError] = useState('')
  const [workDraft, setWorkDraft] = useState<BuildingWork | null>(null)
  const [workFlowKind, setWorkFlowKind] = useState<'project' | 'maintenance' | 'edit'>('edit')
  const [addChoiceOpen, setAddChoiceOpen] = useState(false)
  const [itemOpen, setItemOpen] = useState(false)
  const [itemError, setItemError] = useState('')
  const [itemDraft, setItemDraft] = useState<HomeItem | null>(null)
  const [projectOpen, setProjectOpen] = useState(false)
  const [projectError, setProjectError] = useState('')
  const [projectDraft, setProjectDraft] = useState<BuildingProject | null>(null)
  const [projectLineName, setProjectLineName] = useState('')
  const [projectLinePrice, setProjectLinePrice] = useState('')
  const [payingProject, setPayingProject] = useState<BuildingProject | BuildingChangeOrder | null>(null)
  const [projectPaymentDraft, setProjectPaymentDraft] = useState<BuildingProjectPaymentDraft | null>(null)
  const [boqOpen, setBoqOpen] = useState(false)
  const [boqError, setBoqError] = useState('')
  const [boqDraft, setBoqDraft] = useState<BoqItem[]>([])
  const [boqFeeDraft, setBoqFeeDraft] = useState(0)
  const [boqAgreedTotalDraft, setBoqAgreedTotalDraft] = useState<number | ''>('')
  const [boqBaseVersion, setBoqBaseVersion] = useState('current')
  const [boqViewingVersionId, setBoqViewingVersionId] = useState('current')
  const [changeOrderOpen, setChangeOrderOpen] = useState(false)
  const [changeOrderError, setChangeOrderError] = useState('')
  const [changeOrderDraft, setChangeOrderDraft] = useState<{ title: string; date: string; reference: string; notes: string; lines: BuildingChangeOrderLine[] }>({ title: '', date: today(), reference: '', notes: '', lines: [emptyChangeOrderLine()] })
  const [boqItemDraft, setBoqItemDraft] = useState<{ originalId: string | null; row: BoqItem } | null>(null)
  const [boqImportChoices, setBoqImportChoices] = useState<{ sheetName: string; items: BoqItem[] }[]>([])
  const [boqImportSheet, setBoqImportSheet] = useState('')
  const [boqImportMode, setBoqImportMode] = useState<'append' | 'replace'>('append')
  const [boqImportNotice, setBoqImportNotice] = useState('')
  const costs = assetCosts(asset)
  const works = asset.buildingWorks ?? []
  const projects = asset.buildingProjects ?? []
  const capitalWorks = works.filter(work => work.treatment === 'capital').reduce((sum, work) => sum + work.amount, 0) + projects.reduce((sum, project) => sum + project.actualCost, 0)
  const expenseWorks = works.filter(work => work.treatment === 'expense').reduce((sum, work) => sum + work.amount, 0)
  const constructionRows = asset.boq.filter(row => !row.cancelled && row.scope !== 'builtin')
  const constructionBoqTotal = constructionRows.reduce((sum, row) => sum + row.quantity * row.price + row.labor, 0)
  const summaryCategoryName = (category: string) => {
    const cleaned = category.replace(/\s*,\s*ระบบสุขาภิบาล/g, '').trim()
    return cleaned === 'ยังไม่ระบุหมวด' ? cleaned : cleaned.startsWith('หมวด') ? cleaned : `หมวด${cleaned}`
  }
  const boqVersions = asset.boqVersions ?? []
  const boqViewVersions = [
    ...boqVersions.map(version => ({ ...version, isCurrent: false })),
    { id: 'current', version: asset.boqVersion ?? 1, createdOn: 'ปัจจุบัน', managementFee: asset.boqManagementFee ?? 0, agreedTotal: asset.boqAgreedTotal, items: constructionRows, isCurrent: true },
  ].sort((a, b) => a.version - b.version)
  const selectedBoqVersion = boqViewVersions.find(version => version.id === boqViewingVersionId) ?? boqViewVersions.at(-1)!
  const selectedBoqRows = selectedBoqVersion.items.filter(row => !row.cancelled && row.scope !== 'builtin')
  const selectedBoqTotal = selectedBoqRows.reduce((sum, row) => sum + row.quantity * row.price + row.labor, 0)
  const selectedBoqCategories = Array.from(selectedBoqRows.reduce((groups, row) => groups.set(row.category || 'ยังไม่ระบุหมวด', (groups.get(row.category || 'ยังไม่ระบุหมวด') ?? 0) + row.quantity * row.price + row.labor), new Map<string, number>()).entries())
  const selectedBoqAssetCost = selectedBoqVersion.agreedTotal ?? selectedBoqTotal + selectedBoqVersion.managementFee
  const isViewingCurrentBoq = selectedBoqVersion.isCurrent
  const changeOrders = asset.buildingChangeOrders ?? []
  const selectedChangeOrders = changeOrders.filter(order => order.baseVersion === selectedBoqVersion.version).toReversed()
  const selectedChangeOrderAdds = selectedChangeOrders.filter(order => order.status === 'approved').flatMap(order => order.lines).filter(line => line.kind === 'add').reduce((sum, line) => sum + line.amount, 0)
  const selectedChangeOrderDeductions = selectedChangeOrders.filter(order => order.status === 'approved').flatMap(order => order.lines).filter(line => line.kind === 'deduct').reduce((sum, line) => sum + line.amount, 0)
  const nextChangeOrderNumber = Math.max(0, ...changeOrders.map(order => order.number)) + 1
  function projectBudget(project: BuildingProject) { return project.pricingMode === 'lump_sum' ? project.lumpSum : project.boqLines.reduce((sum, line) => sum + line.quantity * line.unitPrice + line.labor, 0) }

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
    setWorkFlowKind('edit'); setWorkDraft(work ? structuredClone(work) : emptyWork()); setWorkError(''); setWorkOpen(true)
  }
  function chooseAddType(type: 'equipment' | 'project' | 'repair') {
    setAddChoiceOpen(false)
    if (type === 'equipment') { setItemDraft(emptyHomeItem()); setItemError(''); setItemOpen(true); return }
    if (type === 'project') { editProject(); return }
    const work = emptyWork()
    work.type = 'repair'
    work.treatment = 'expense'
    setWorkFlowKind('maintenance')
    setWorkDraft(work); setWorkError(''); setWorkOpen(true)
  }
  async function saveHomeItem(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!itemDraft) return
    if (!itemDraft.name.trim()) { setItemError('กรอกชื่อสิ่งของหรืออุปกรณ์ก่อนบันทึก'); return }
    const warrantyUntil = warrantyEndDate(itemDraft.purchasedOn, itemDraft.warrantyMonths)
    const rows = [...asset.items.filter(row => row.id !== itemDraft.id), { ...itemDraft, warrantyStart: itemDraft.purchasedOn, warrantyUntil, name: itemDraft.name.trim(), shop: itemDraft.shop.trim(), notes: itemDraft.notes.trim() }]
    try { await onSave({ items: rows }, `เพิ่มอุปกรณ์บ้าน: ${itemDraft.name}`); setItemOpen(false); setItemDraft(null) }
    catch (caught) { setItemError(caught instanceof Error ? caught.message : 'บันทึกอุปกรณ์ไม่สำเร็จ') }
  }
  function editProject(project?: BuildingProject) { setProjectDraft(project ? structuredClone(project) : emptyProject()); setProjectLineName(''); setProjectLinePrice(''); setProjectError(''); setProjectOpen(true) }
  function addProjectLine() {
    if (!projectDraft || !projectLineName.trim()) { setProjectError('ระบุชื่อรายการ BOQ ก่อนเพิ่ม'); return }
    const price = Number(projectLinePrice || 0)
    if (!Number.isFinite(price) || price < 0) { setProjectError('ราคาต้องเป็นตัวเลขตั้งแต่ 0 ขึ้นไป'); return }
    setProjectDraft({ ...projectDraft, boqLines: [...projectDraft.boqLines, { id: crypto.randomUUID(), name: projectLineName.trim(), quantity: 1, unit: 'รายการ', unitPrice: price, labor: 0 }] })
    setProjectLineName(''); setProjectLinePrice(''); setProjectError('')
  }
  function openProjectPayment(project: BuildingProject | BuildingChangeOrder, direction: 'IN' | 'OUT') {
    setPayingProject(project)
    setProjectPaymentDraft({ direction, amount: '', occurredOn: today(), categoryCode: direction === 'OUT' ? financialCategories.find(row => row.direction === 'OUT' && row.code === 'OPERATING_EXPENSE')?.code ?? financialCategories.find(row => row.direction === 'OUT')?.code ?? '' : financialCategories.find(row => row.direction === 'IN' && row.code === 'OTHER_INCOME')?.code ?? financialCategories.find(row => row.direction === 'IN')?.code ?? '', channelCode: '', reference: '', note: '', paymentType: direction === 'IN' ? 'refund' : 'progress', slip: null })
    setProjectError('')
  }
  async function saveProject(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (!projectDraft) return
    if (!projectDraft.name.trim()) { setProjectError('กรอกชื่อโครงการก่อนบันทึก'); return }
    if (projectDraft.pricingMode === 'boq' && !projectDraft.boqLines.length) { setProjectError('เพิ่มรายการ BOQ ของโครงการอย่างน้อย 1 รายการ'); return }
    const prior = projects.find(project => project.id === projectDraft.id)
    const completingNow = projectDraft.status === 'completed' && prior?.status !== 'completed'
    const rows = [...projects.filter(project => project.id !== projectDraft.id), { ...projectDraft, name: projectDraft.name.trim(), vendor: projectDraft.vendor.trim(), reference: projectDraft.reference.trim(), notes: projectDraft.notes.trim(), actualCost: completingNow ? Math.max(projectDraft.actualCost, projectDraft.payments.reduce((sum, payment) => sum + (payment.direction === 'OUT' ? payment.amount : -payment.amount), 0)) : projectDraft.actualCost }].sort((a, b) => a.startedOn.localeCompare(b.startedOn))
    let nextRooms = asset.rooms
    let nextItems = asset.items
    let nextDetails = asset.buildingDetails ?? emptyDetails()
    const outcome = projectDraft.outcome
    if (completingNow && outcome?.type === 'add_room') {
      const name = outcome.newRoomName.trim()
      nextRooms = [...asset.rooms, name]
      nextDetails = { ...nextDetails, usableAreaSqm: nextDetails.usableAreaSqm + outcome.areaAddedSqm, roomCounts: [...(nextDetails.roomCounts ?? asset.rooms.map(room => ({ name: room, count: 1 }))), { name, count: 1 }] }
    } else if (completingNow && outcome?.type === 'component' || completingNow && outcome?.type === 'update_existing') {
      if (outcome.type === 'update_existing') nextItems = asset.items.map(item => item.id === outcome.replacesItemId ? { ...item, status: 'retired', events: [...(item.events ?? []), { date: projectDraft.completedOn, from: item.room, to: 'เลิกใช้งาน', status: 'retired' }] } : item)
      const targetRoom = outcome.roomName || projectDraft.roomNames[0] || ''
      const component: HomeItem = { id: crypto.randomUUID(), room: targetRoom, name: outcome.componentName.trim(), size: '', quantity: 1, price: 0, shop: projectDraft.vendor, purchasedOn: projectDraft.completedOn, warrantyStart: projectDraft.completedOn, warrantyMonths: 0, warrantyUntil: projectDraft.warrantyUntil, notes: `ได้จากโครงการ ${projectDraft.name}${projectDraft.reference ? ` · ${projectDraft.reference}` : ''}`, status: 'active', includedInMainCost: true }
      nextItems = [...nextItems, component]
      if (outcome.areaAddedSqm > 0) nextDetails = { ...nextDetails, usableAreaSqm: nextDetails.usableAreaSqm + outcome.areaAddedSqm }
    } else if (completingNow && outcome?.type === 'none' && outcome.areaAddedSqm > 0) nextDetails = { ...nextDetails, usableAreaSqm: nextDetails.usableAreaSqm + outcome.areaAddedSqm }
    try { await onSave({ buildingProjects: rows, rooms: nextRooms, items: nextItems, buildingDetails: nextDetails }, `${completingNow ? 'ปิดโครงการ' : prior ? 'แก้ไขโครงการ' : 'สร้างโครงการ'}บ้าน: ${projectDraft.name}`); setProjectOpen(false); setProjectDraft(null) }
    catch (caught) { setProjectError(caught instanceof Error ? caught.message : 'บันทึกโครงการไม่สำเร็จ') }
  }
  async function saveWork(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (!workDraft) return
    if (!workDraft.name.trim()) { setWorkError('กรอกชื่องานก่อนบันทึก'); return }
    setWorkError('')
    const rows = [...works.filter(row => row.id !== workDraft.id), { ...workDraft, name: workDraft.name.trim(), vendor: workDraft.vendor.trim(), reference: workDraft.reference.trim(), notes: workDraft.notes.trim() }].sort((a, b) => a.date.localeCompare(b.date))
    try { await onSave({ buildingWorks: rows }, `${works.some(row => row.id === workDraft.id) ? 'แก้ไข' : 'เพิ่ม'}รายการบ้าน: ${workDraft.name}`); setWorkOpen(false); setWorkDraft(null) }
    catch (caught) { setWorkError(caught instanceof Error ? caught.message : 'บันทึกรายการบ้านไม่สำเร็จ') }
  }
  function openBoq() { setBoqDraft(constructionRows.map(row => structuredClone(row))); setBoqFeeDraft(asset.boqManagementFee ?? 0); setBoqAgreedTotalDraft(asset.boqAgreedTotal ?? ''); setBoqBaseVersion('current'); setBoqImportMode('append'); setBoqImportChoices([]); setBoqImportSheet(''); setBoqImportNotice(''); setBoqError(''); setBoqOpen(true) }
  function openChangeOrder() { setChangeOrderDraft({ title: '', date: today(), reference: '', notes: '', lines: [emptyChangeOrderLine()] }); setChangeOrderError(''); setChangeOrderOpen(true) }
  async function saveChangeOrder(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!changeOrderDraft.title.trim() || !changeOrderDraft.lines.length || changeOrderDraft.lines.some(line => !line.description.trim() || line.amount <= 0)) { setChangeOrderError('กรอกชื่อใบงานและรายละเอียด/ยอดเงินของทุกรายการให้ครบ'); return }
    const order: BuildingChangeOrder = { id: crypto.randomUUID(), number: nextChangeOrderNumber, baseVersion: selectedBoqVersion.version, title: changeOrderDraft.title.trim(), date: changeOrderDraft.date, status: 'draft', reference: changeOrderDraft.reference.trim(), notes: changeOrderDraft.notes.trim(), lines: changeOrderDraft.lines.map(line => ({ ...line, description: line.description.trim() })) }
    try { await onSave({ buildingChangeOrders: [...changeOrders, order] }, `สร้างใบงานเพิ่ม-ลดงาน ${order.number}: ${order.title}`); setChangeOrderOpen(false) }
    catch (caught) { setChangeOrderError(caught instanceof Error ? caught.message : 'บันทึกใบงานไม่สำเร็จ') }
  }
  async function updateChangeOrder(order: BuildingChangeOrder, patch: Partial<BuildingChangeOrder>) {
    try { await onSave({ buildingChangeOrders: changeOrders.map(row => row.id === order.id ? { ...row, ...patch } : row) }, `${patch.status ? patch.status === 'approved' ? 'อนุมัติ' : 'ยกเลิกอนุมัติ' : 'แก้ไข'}ใบงานเพิ่ม-ลดงาน ${order.number}`) }
    catch (caught) { setChangeOrderError(caught instanceof Error ? caught.message : 'อัปเดตใบงานไม่สำเร็จ') }
  }
  async function deleteChangeOrder(order: BuildingChangeOrder) {
    try { await onSave({ buildingChangeOrders: changeOrders.filter(row => row.id !== order.id) }, `ลบใบงานเพิ่ม-ลดงาน ${order.number}: ${order.title}`) }
    catch (caught) { setChangeOrderError(caught instanceof Error ? caught.message : 'ลบใบงานไม่สำเร็จ') }
  }
  function selectBoqBase(value: string) {
    setBoqBaseVersion(value)
    if (value === 'current') { setBoqDraft(constructionRows.map(row => structuredClone(row))); setBoqFeeDraft(asset.boqManagementFee ?? 0); setBoqAgreedTotalDraft(asset.boqAgreedTotal ?? ''); return }
    const version = boqVersions.find(row => row.id === value)
    if (version) { setBoqDraft(version.items.map(row => structuredClone(row))); setBoqFeeDraft(version.managementFee); setBoqAgreedTotalDraft(version.agreedTotal ?? ''); setBoqImportNotice(`กำลังใช้เวอร์ชัน ${version.version} เป็นต้นแบบ · บันทึกแล้วจะสร้างเวอร์ชันใหม่`); setBoqError('') }
  }
  async function importBoqFile(file?: File) {
    if (!file) return
    setBoqError(''); setBoqImportNotice('')
    try {
      if (file.name.toLowerCase().endsWith('.pdf') || file.type === 'application/pdf') {
        const upload = new FormData(); upload.set('file', file)
        const extracted = await extractBoqPdfText(upload)
        const items = parsePdfBoqLines(extracted.pages)
        if (!items.length) throw new Error('ไม่พบแถว BOQ ที่อ่านได้ใน PDF หากเป็นไฟล์สแกนต้องใช้ OCR หรือหากตารางมีรูปแบบต่างออกไปให้ตรวจเอกสารก่อน')
        stageBoqRows(items, file.name)
        return
      }
      if (/\.(txt|tsv)$/i.test(file.name)) {
        const items = parseBoqTsv(await file.text())
        if (!items.length) throw new Error('ไม่พบรายการ BOQ ในไฟล์นี้')
        stageBoqRows(items, file.name)
        return
      }
      const choices = await readBoqWorkbook(file)
      if (!choices.length) throw new Error('ไม่พบรายการ BOQ ในไฟล์นี้')
      if (choices.length === 1) stageBoqRows(choices[0].items, `${file.name} · ${choices[0].sheetName}`)
      else { setBoqImportChoices(choices); setBoqImportSheet(choices[0].sheetName) }
    } catch (caught) { setBoqError(caught instanceof Error ? caught.message : 'อ่านไฟล์ BOQ ไม่สำเร็จ') }
  }
  function applyImportedBoq() {
    const choice = boqImportChoices.find(sheet => sheet.sheetName === boqImportSheet)
    if (!choice) return
    stageBoqRows(choice.items, choice.sheetName)
  }
  function stageBoqRows(rows: BoqItem[], source: string) {
    if (rows.some(row => !row.name.trim() || row.quantity <= 0)) { setBoqError('ข้อมูลในไฟล์มีรายการหรือจำนวนไม่ถูกต้อง'); return }
    const stagedRows = boqImportMode === 'append' ? [...boqDraft, ...rows] : rows
    setBoqDraft(stagedRows); setBoqImportChoices([]); setBoqError('')
    setBoqImportNotice(`อ่าน ${source} แล้ว ${rows.length} รายการ · ${boqImportMode === 'append' ? 'เพิ่มต่อจากรายการเดิม' : 'แทนที่รายการเดิม'} · รวมในแบบร่าง ${stagedRows.length} รายการ · ตรวจและแก้ไขได้ก่อนบันทึก`)
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
        { header: 'รวมค่าวัสดุ', key: 'materialTotal', width: 16 }, { header: 'ค่าแรงต่อหน่วย', key: 'laborRate', width: 16 },
        { header: 'รวมค่าแรง', key: 'labor', width: 16 }, { header: 'รวมค่าวัสดุและค่าแรง', key: 'total', width: 22 },
        { header: 'รายละเอียด / สเปก', key: 'spec', width: 40 }, { header: 'หมายเหตุ', key: 'note', width: 32 },
      ]
      sheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } }
      sheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF315E59' } }
      for (const row of rows) sheet.addRow({ ...row, materialTotal: row.materialTotal ?? row.quantity * row.price, laborRate: row.laborRate ?? (row.quantity ? row.labor / row.quantity : 0), total: row.boqTotal ?? row.quantity * row.price + row.labor })
      sheet.autoFilter = 'A1:L1'; sheet.views = [{ state: 'frozen', ySplit: 1 }]
      const bytes = await workbook.xlsx.writeBuffer()
      const url = URL.createObjectURL(new Blob([bytes], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }))
      const link = document.createElement('a'); link.href = url; link.download = `BOQ-${asset.assetCode ?? 'building'}.xlsx`; link.click(); URL.revokeObjectURL(url)
    } catch (caught) { setBoqError(caught instanceof Error ? `ส่งออก Excel ไม่สำเร็จ: ${caught.message}` : 'ส่งออก Excel ไม่สำเร็จ') }
  }
  async function saveBoq(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (boqDraft.some(row => !row.name.trim() || row.quantity <= 0)) { setBoqError('กรอกรายการและจำนวน BOQ ให้ครบ'); return }
    if (!Number.isFinite(boqFeeDraft) || boqFeeDraft < 0) { setBoqError('ค่าดำเนินงานก่อสร้างต้องเป็นศูนย์หรือมากกว่า'); return }
    if (boqAgreedTotalDraft !== '' && (!Number.isFinite(boqAgreedTotalDraft) || boqAgreedTotalDraft < 0)) { setBoqError('ยอดก่อสร้างตามข้อตกลงต้องเป็นศูนย์หรือมากกว่า'); return }
    const otherRows = asset.boq.filter(row => row.scope === 'builtin' || row.cancelled)
    const submitter = (event.nativeEvent as SubmitEvent).submitter as HTMLButtonElement | null
    const createNewVersion = submitter?.value === 'new-version' || boqBaseVersion !== 'current'
    const currentVersion = asset.boqVersion ?? 1
    const nextVersion = createNewVersion ? Math.max(currentVersion, ...boqVersions.map(version => version.version), 0) + 1 : currentVersion
    const history = createNewVersion
      ? [...boqVersions.filter(version => version.version !== currentVersion), { id: `boq-v${currentVersion}-${crypto.randomUUID()}`, version: currentVersion, createdOn: today(), managementFee: asset.boqManagementFee ?? 0, ...(asset.boqAgreedTotal !== undefined ? { agreedTotal: asset.boqAgreedTotal } : {}), items: constructionRows.map(row => structuredClone(row)) }]
      : boqVersions
    const reason = createNewVersion ? `บันทึก BOQ ก่อสร้าง เวอร์ชัน ${nextVersion}` : `แก้ไข BOQ ก่อสร้าง เวอร์ชัน ${currentVersion}`
    try { await onSave({ boq: [...otherRows, ...boqDraft.map(row => ({ ...row, scope: 'construction' as const }))], boqVersion: nextVersion, boqManagementFee: boqFeeDraft, boqAgreedTotal: boqAgreedTotalDraft === '' ? undefined : boqAgreedTotalDraft, boqVersions: history, costSource: 'boq' }, reason); setBoqOpen(false) }
    catch (caught) { setBoqError(caught instanceof Error ? caught.message : 'บันทึก BOQ ไม่สำเร็จ') }
  }
  function editBoqItem(row?: BoqItem, category = 'หมวดงานทั่วไป') {
    setBoqItemDraft({ originalId: row?.id ?? null, row: row ? structuredClone(row) : { ...emptyBoq(), category } })
  }
  function saveBoqItem(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!boqItemDraft?.row.name.trim() || !boqItemDraft.row.unit.trim() || boqItemDraft.row.quantity <= 0) return
    setBoqDraft(rows => boqItemDraft.originalId
      ? rows.map(row => row.id === boqItemDraft.originalId ? boqItemDraft.row : row)
      : [...rows, boqItemDraft.row])
    setBoqItemDraft(null)
  }
  const boqTotal = boqDraft.reduce((sum, row) => sum + row.quantity * row.price + row.labor, 0)
  const boqGroups = [...boqDraft.reduce((groups, row, index) => {
    const key = row.category || 'ยังไม่ระบุหมวด'
    groups.set(key, [...(groups.get(key) ?? []), { row, index }])
    return groups
  }, new Map<string, { row: BoqItem; index: number }[]>()).entries()]

  const cashTargets = [...projects, ...(asset.buildingChangeOrders ?? [])]
  const cashRows = cashTargets.flatMap(target => (target.payments ?? []).map(payment => ({ ...payment, title: 'name' in target ? target.name : target.title }))).sort((a, b) => b.date.localeCompare(a.date) || b.ledgerEntryId - a.ledgerEntryId)
  const cashIn = cashRows.filter(row => row.direction === 'IN').reduce((sum, row) => sum + row.amount, 0)
  const cashOut = cashRows.filter(row => row.direction === 'OUT').reduce((sum, row) => sum + row.amount, 0)
  return <section className="mt-4 overflow-hidden rounded-2xl border border-slate-200 bg-white" aria-label={`ข้อมูลบ้าน ${asset.name}`}>
    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-4 py-3">
      <div className="flex gap-1 rounded-xl bg-slate-100 p-1" role="tablist" aria-label="ส่วนจัดการบ้าน">
        <button type="button" role="tab" aria-selected={section === 'information'} onClick={() => setSection('information')} className={`rounded-lg px-3 py-2 text-xs font-medium ${section === 'information' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500'}`}><Building2 size={14} className="mr-1 inline" />ข้อมูลบ้าน</button>
        <button type="button" role="tab" aria-selected={section === 'management'} onClick={() => setSection('management')} className={`rounded-lg px-3 py-2 text-xs font-medium ${section === 'management' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500'}`}><Wrench size={14} className="mr-1 inline" />จัดการบ้าน · {works.length + projects.length}</button>
        <button type="button" role="tab" aria-selected={section === 'cashbook'} onClick={() => setSection('cashbook')} className={`rounded-lg px-3 py-2 text-xs font-medium ${section === 'cashbook' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500'}`}><Wallet size={14} className="mr-1 inline" />รับจ่าย · {cashRows.length}</button>
      </div>
      {section === 'information' && canWrite ? <Button disabled={busy} onClick={openInfo}><Pencil size={13} />แก้ไขข้อมูลบ้าน</Button> : null}
      {section === 'management' && canWrite ? <Button variant="primary" disabled={busy} onClick={() => setAddChoiceOpen(true)}><Plus size={14} />เพิ่มรายการ</Button> : null}
    </div>

    {section === 'cashbook' ? <div className="space-y-4 p-4">
      <h3 className="m-0 text-base font-semibold">รายการรับ–จ่าย · {asset.name}</h3>
      <p className="text-xs text-slate-500">รายการเงินจริงของบ้านจากโครงการและใบงานเพิ่ม–ลด พร้อมอ้างอิง Ledger</p>
      <div className="grid gap-3 sm:grid-cols-3">{[['รับคืน', cashIn], ['จ่ายจริง', cashOut], ['จ่ายสุทธิ', cashOut - cashIn]].map(([text, value]) => <div key={text} className="rounded-xl bg-slate-50 p-3"><p className="text-xs text-slate-500">{text}</p><strong>{money(Number(value))} บาท</strong></div>)}</div>
      {canWrite ? <div className="flex flex-wrap gap-2"><Button disabled={busy} onClick={() => editProject()}>เพิ่มรายการงาน / ค่าใช้จ่ายบ้าน</Button>{cashTargets.filter(target => !('status' in target) || target.status !== 'draft').map(target => <Button key={target.id} disabled={busy} onClick={() => openProjectPayment(target, 'OUT')}>บันทึกจ่าย · {'name' in target ? target.name : target.title}</Button>)}</div> : null}
      {!cashTargets.length ? <p className="text-sm text-slate-500">เพิ่มรายการงาน / ค่าใช้จ่ายบ้านก่อน จากนั้นกดบันทึกจ่าย โดยระบุวันที่จ่ายจริงย้อนหลังได้</p> : null}
      <div className="overflow-x-auto"><table className="w-full whitespace-nowrap text-left text-xs"><thead><tr>{['วันที่', 'รายการ', 'รายรับ', 'รายจ่าย', 'อ้างอิง', 'Ledger'].map(text => <th key={text} className="p-3">{text}</th>)}</tr></thead><tbody>{cashRows.map(row => <tr key={row.id} className="border-t border-slate-100"><td className="p-3">{row.date}</td><td className="p-3">{row.title}{row.note ? ` · ${row.note}` : ''}</td><td className="p-3">{row.direction === 'IN' ? money(row.amount) : '—'}</td><td className="p-3">{row.direction === 'OUT' ? money(row.amount) : '—'}</td><td className="p-3">{row.reference || '—'}</td><td className="p-3">#{row.ledgerEntryId}</td></tr>)}</tbody></table></div>
      {!cashRows.length ? <p className="py-6 text-center text-sm text-slate-500">ยังไม่มีรายการรับ–จ่ายที่บันทึกของบ้านนี้</p> : null}
    </div> : null}
    {section === 'cashbook' ? null : section === 'information' ? <div className="grid gap-4 p-4 lg:grid-cols-[minmax(0,1.1fr)_minmax(260px,0.9fr)]">
      <div><h3 className="mb-2 mt-0 flex items-center gap-2 text-sm font-semibold text-slate-800"><Building2 size={15} />ข้อมูลประจำบ้าน</h3><dl className="grid grid-cols-2 gap-2 text-xs"><div className="rounded-xl bg-slate-50 p-3"><dt className="text-slate-500">ที่อยู่</dt><dd className="mb-0 mt-1 font-medium text-slate-800">{asset.address || 'ยังไม่ระบุ'}</dd></div><div className="rounded-xl bg-slate-50 p-3"><dt className="text-slate-500">พื้นที่ใช้สอย</dt><dd className="mb-0 mt-1 font-medium text-slate-800">{asset.buildingDetails?.usableAreaSqm ? `${money(asset.buildingDetails.usableAreaSqm)} ตร.ม.` : 'ยังไม่ระบุ'}</dd></div><div className="rounded-xl bg-slate-50 p-3"><dt className="text-slate-500">จำนวนชั้น</dt><dd className="mb-0 mt-1 font-medium text-slate-800">{asset.buildingDetails?.floorCount ?? 1} ชั้น</dd></div><div className="rounded-xl bg-slate-50 p-3"><dt className="text-slate-500">ประเภทอาคาร</dt><dd className="mb-0 mt-1 font-medium text-slate-800">{asset.buildingDetails?.buildingType || 'ยังไม่ระบุ'}</dd></div></dl>
        <div className="mt-3"><h4 className="mb-2 mt-0 text-xs font-semibold text-slate-700">ห้อง / พื้นที่ · รวม {totalRoomCount(asset.rooms, asset.buildingDetails)} ห้อง</h4>{asset.rooms.length ? <div className="flex flex-wrap gap-1.5">{asset.rooms.map(room => <span key={room} className="rounded-full bg-slate-100 px-2.5 py-1 text-xs text-slate-600">{room} {roomCount(room, { ...infoDraft, details: asset.buildingDetails ?? emptyDetails() })} ห้อง</span>)}</div> : <p className="mb-0 text-xs text-slate-400">ยังไม่มีรายการห้อง</p>}</div>
      </div>
      <aside className="rounded-xl border border-slate-200 bg-slate-50/70 p-3">
        <div className="flex flex-wrap items-center justify-between gap-2"><h3 className="m-0 flex items-center gap-2 text-sm font-semibold text-slate-800"><ClipboardList size={15} />ต้นทุนก่อสร้างอ้างอิง</h3><div className="flex flex-wrap gap-2">{canWrite ? <Button disabled={busy} onClick={openBoq}><Pencil size={13} />จัดการ BOQ</Button> : null}<Button disabled={!selectedBoqRows.length} onClick={() => void exportBoq(selectedBoqRows)}><Download size={14} />ส่งออก Excel</Button></div></div>
        {boqViewVersions.length > 1 ? <div className="mt-3" role="group" aria-label="เลือกเวอร์ชัน BOQ เพื่อดู">
          <div className="mb-1.5 flex items-center justify-between gap-2"><span className="text-xs font-medium text-slate-700">เวอร์ชัน BOQ</span><span className="text-[11px] text-slate-400">เลื่อนด้านข้างเพื่อดูเวอร์ชันอื่น</span></div>
          <div className="-mx-1 flex snap-x gap-2 overflow-x-auto px-1 pb-2">
            {boqViewVersions.map(version => {
              const rows = version.items.filter(row => !row.cancelled && row.scope !== 'builtin')
              const total = rows.reduce((sum, row) => sum + row.quantity * row.price + row.labor, 0)
              const amount = version.agreedTotal ?? total + version.managementFee
              const selected = version.id === selectedBoqVersion.id
              return <button key={version.id} type="button" aria-pressed={selected} onClick={() => setBoqViewingVersionId(version.id)} className={`min-w-36 snap-start rounded-xl border px-3 py-2 text-left transition ${selected ? 'border-sky-500 bg-sky-50 ring-1 ring-sky-200' : 'border-slate-200 bg-white hover:border-sky-300'}`}>
                <span className="block text-[11px] font-semibold text-slate-700">เวอร์ชัน {version.version}{version.isCurrent ? ' · ปัจจุบัน' : ''}</span>
                <span className="mt-0.5 block text-[10px] text-slate-400">{version.createdOn}</span>
                <strong className="mt-1 block whitespace-nowrap text-xs tabular-nums text-slate-800">{money(amount)} บาท</strong>
              </button>
            })}
          </div>
        </div> : null}
        <p className="mb-0 mt-2 text-xs text-slate-500">วิธีอ้างอิง: {asset.costSource === 'boq' ? `BOQ · เวอร์ชัน ${selectedBoqVersion.version}${isViewingCurrentBoq ? '' : ' · ประวัติ'}` : 'ราคาเหมา / ราคาซื้อ'}</p>
        {!isViewingCurrentBoq ? <p className="mb-0 mt-1 text-[11px] text-sky-700">กำลังดูข้อมูลย้อนหลัง · เวอร์ชันเดิมเป็นข้อมูลอ่านอย่างเดียว</p> : null}
        <strong className="mt-1 block text-lg text-slate-900">{money(isViewingCurrentBoq && asset.costSource !== 'boq' ? costs.main : selectedBoqAssetCost)} บาท</strong>
        <p className="mb-0 mt-1 text-xs text-slate-500">{asset.costSource === 'boq' || !isViewingCurrentBoq ? `รายการก่อสร้าง BOQ ${selectedBoqRows.length} · ${money(selectedBoqTotal)} บาท` : `ราคาตั้งต้น ${money(asset.purchasePrice)} บาท`}</p>
        {selectedBoqRows.length ? <div className="mt-3 overflow-hidden rounded-lg border border-slate-200 bg-white"><table className="w-full text-xs"><thead className="bg-slate-100 text-slate-600"><tr><th className="w-12 px-2 py-2 text-left font-medium">ITEM</th><th className="px-2 py-2 text-left font-medium">DESCRIPTION</th><th className="w-32 px-2 py-2 text-right font-medium">Total</th></tr></thead><tbody className="divide-y divide-slate-100">{selectedBoqCategories.map(([category, total], index) => <tr key={category}><td className="px-2 py-1.5 text-slate-500">{index + 1}</td><td className="px-2 py-1.5 text-slate-700">{summaryCategoryName(category)}</td><td className="px-2 py-1.5 text-right tabular-nums text-slate-700">{money(total)}</td></tr>)}<tr className="bg-slate-50 font-semibold"><td /><td className="px-2 py-1.5 text-slate-700">รวมหมวดงาน {selectedBoqCategories.length ? `1 - ${selectedBoqCategories.length}` : ''}</td><td className="px-2 py-1.5 text-right tabular-nums text-slate-800">{money(selectedBoqTotal)}</td></tr><tr><td /><td className="px-2 py-1.5 text-slate-600">ค่าดำเนินงานก่อสร้าง</td><td className="px-2 py-1.5 text-right tabular-nums text-slate-700">{money(selectedBoqVersion.managementFee)}</td></tr><tr className="bg-slate-50 font-semibold"><td /><td className="px-2 py-1.5 text-slate-800">รวมค่าก่อสร้างเป็นเงิน</td><td className="px-2 py-1.5 text-right tabular-nums text-slate-900">{money(selectedBoqTotal + selectedBoqVersion.managementFee)}</td></tr>{selectedBoqVersion.agreedTotal !== undefined ? <tr className="bg-emerald-50 font-semibold"><td /><td className="px-2 py-1.5 text-emerald-800">คิดค่าก่อสร้างตามยอดตกลง</td><td className="px-2 py-1.5 text-right tabular-nums text-emerald-900">{money(selectedBoqVersion.agreedTotal)}</td></tr> : null}</tbody></table></div> : null}
        <section className="mt-3 rounded-lg border border-slate-200 bg-white p-3">
          <div className="flex flex-wrap items-start justify-between gap-2"><div><h4 className="m-0 text-xs font-semibold text-slate-800">ใบงานเพิ่ม-ลดงาน · เวอร์ชัน {selectedBoqVersion.version}</h4><p className="mb-0 mt-1 text-[11px] text-slate-500">แยกจาก BOQ หลัก และไม่เปลี่ยนยอดต้นทุนจนกว่าอนุมัติ</p></div>{canWrite && isViewingCurrentBoq ? <Button disabled={busy} onClick={openChangeOrder}><Plus size={13} />สร้างใบงาน</Button> : null}</div>
          {selectedChangeOrders.length ? <><div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[11px]"><span className="text-emerald-700">เพิ่มที่อนุมัติ +{money(selectedChangeOrderAdds)}</span><span className="text-rose-700">ลดที่อนุมัติ −{money(selectedChangeOrderDeductions)}</span><strong className="text-slate-800">สุทธิ {money(selectedChangeOrderAdds - selectedChangeOrderDeductions)} บาท</strong></div>{selectedChangeOrders.some(order => order.status === 'approved') ? <p className="mb-0 mt-1 rounded-md bg-sky-50 px-2.5 py-2 text-[11px] text-sky-800">มูลค่าก่อสร้างหลังใบงานที่อนุมัติ {money(selectedBoqAssetCost + selectedChangeOrderAdds - selectedChangeOrderDeductions)} บาท</p> : null}<div className="mt-2 space-y-2">{selectedChangeOrders.map(order => { const adds = order.lines.filter(line => line.kind === 'add').reduce((sum, line) => sum + line.amount, 0); const deductions = order.lines.filter(line => line.kind === 'deduct').reduce((sum, line) => sum + line.amount, 0); const paid = (order.payments ?? []).filter(payment => payment.direction === 'OUT').reduce((sum, payment) => sum + payment.amount, 0); const returned = (order.payments ?? []).filter(payment => payment.direction === 'IN').reduce((sum, payment) => sum + payment.amount, 0); return <article key={order.id} className="rounded-lg bg-slate-50 p-2.5"><div className="flex flex-wrap items-start justify-between gap-2"><div><strong className="text-xs text-slate-800">ใบงาน {order.number} · {order.title}</strong><span className={`ml-2 rounded-full px-2 py-0.5 text-[10px] ${order.status === 'approved' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>{order.status === 'approved' ? 'อนุมัติแล้ว' : 'รออนุมัติ'}</span><p className="mb-0 mt-1 text-[11px] text-slate-500">{order.date}{order.reference ? ` · ${order.reference}` : ''} · เสนอเพิ่ม {money(adds)} · เสนอลด {money(deductions)} · สุทธิ {money(adds - deductions)} บาท</p><p className="mb-0 mt-1 text-[11px] font-medium text-slate-700">จ่ายจริง {money(paid)} · รับคืน {money(returned)} · จ่ายสุทธิ {money(paid - returned)} บาท</p></div>{canWrite && isViewingCurrentBoq ? <div className="flex flex-wrap gap-1">{order.status === 'draft' ? <Button disabled={busy} onClick={() => void updateChangeOrder(order, { status: 'approved' })}>อนุมัติ</Button> : <><Button disabled={busy} onClick={() => openProjectPayment(order, 'OUT')}><Wallet size={13} />บันทึกจ่ายจริง</Button><Button disabled={busy || paid - returned <= 0} onClick={() => openProjectPayment(order, 'IN')}><Wallet size={13} />รับคืน</Button><Button disabled={busy} onClick={() => void updateChangeOrder(order, { status: 'draft' })}>ยกเลิกอนุมัติ</Button></>}<button type="button" className="rounded-lg p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600" aria-label={`ลบใบงาน ${order.number}`} onClick={() => void deleteChangeOrder(order)}><Trash2 size={14} /></button></div> : null}</div><ul className="mb-0 mt-1.5 space-y-0.5 pl-4 text-[11px] text-slate-600">{order.lines.map(line => <li key={line.id}><span className={line.kind === 'add' ? 'text-emerald-700' : 'text-rose-700'}>{line.kind === 'add' ? 'เพิ่ม' : 'ลด'}</span> · {line.description} · {money(line.amount)} บาท</li>)}</ul>{order.payments?.length ? <details className="mt-2 text-[11px] text-slate-500"><summary className="cursor-pointer">ประวัติรับ–จ่ายจริง ({order.payments.length})</summary><ul className="my-1 space-y-1 pl-4">{order.payments.toReversed().map(payment => { const entry = ledger.find(row => row.id === payment.ledgerEntryId); return <li key={payment.id}>{payment.date} · {payment.direction === 'IN' ? 'รับคืน' : 'จ่ายจริง'} · {money(payment.amount)} บาท{payment.reference ? ` · ${payment.reference}` : ''}{entry ? ` · ${entry.categoryName}` : ''}{usedLedgerIds.includes(payment.ledgerEntryId) ? '' : ' · ตรวจสอบการเชื่อมโยง'}</li> })}</ul></details> : null}{order.payments?.length ? <details className="mt-2 text-[11px] text-slate-500"><summary className="cursor-pointer">ประวัติรับ–จ่ายจริง ({order.payments.length})</summary><ul className="my-1 space-y-1 pl-4">{order.payments.toReversed().map(payment => { const entry = ledger.find(row => row.id === payment.ledgerEntryId); return <li key={payment.id}>{payment.date} · {payment.direction === 'IN' ? 'รับคืน' : 'จ่ายจริง'} · {money(payment.amount)} บาท{payment.reference ? ` · ${payment.reference}` : ''}{entry ? ` · ${entry.categoryName}` : ''}{usedLedgerIds.includes(payment.ledgerEntryId) ? '' : ' · ตรวจสอบการเชื่อมโยง'}</li> })}</ul></details> : null}{order.notes ? <p className="mb-0 mt-1 text-[11px] text-slate-400">{order.notes}</p> : null}</article> })}</div></> : <p className="mb-0 mt-2 text-[11px] text-slate-400">ยังไม่มีใบงานของเวอร์ชันนี้</p>}
        </section>
        {capitalWorks ? <p className="mb-0 mt-2 text-xs text-emerald-700">ต้นทุนต่อเติม/ปรับปรุงจริง {money(capitalWorks)} บาท · คิดแยกจากราคาอ้างอิง</p> : null}<p className="mb-0 mt-1 text-xs text-slate-500">{isViewingCurrentBoq ? 'ต้นทุนสินทรัพย์รวม' : 'ต้นทุนสินทรัพย์รวมปัจจุบัน'} {money(costs.total)} บาท</p><p className="mb-0 mt-2 text-[11px] leading-5 text-slate-400">ใช้ราคาเหมา หรือ BOQ เป็นราคาก่อสร้างหลักเพียงแบบเดียว งานที่เพิ่มภายหลังบันทึกแยกในส่วนจัดการบ้าน</p>
      </aside>
    </div> : <div className="p-4"><div className="mb-3 grid gap-2 sm:grid-cols-4"><div className="rounded-xl bg-slate-50 p-3"><span className="block text-[11px] text-slate-500">งานบ้าน</span><strong className="mt-1 block text-sm">{works.length} รายการ</strong></div><div className="rounded-xl bg-sky-50/70 p-3"><span className="block text-[11px] text-slate-500">สิ่งของ / อุปกรณ์</span><strong className="mt-1 block text-sm text-sky-800">{asset.items.filter(item => !['removed', 'sold', 'retired'].includes(item.status ?? '')).length} รายการ</strong></div><div className="rounded-xl bg-emerald-50/70 p-3"><span className="block text-[11px] text-slate-500">ปรับปรุงที่เพิ่มต้นทุน</span><strong className="mt-1 block text-sm text-emerald-800">{money(capitalWorks)} บาท</strong></div><div className="rounded-xl bg-amber-50/70 p-3"><span className="block text-[11px] text-slate-500">ซ่อม / บริการ</span><strong className="mt-1 block text-sm text-amber-800">{money(expenseWorks)} บาท</strong></div></div>
      {!works.length && !projects.length && !asset.items.length ? <div className="rounded-xl border border-dashed border-slate-200 px-4 py-8 text-center"><BadgePlus className="mx-auto mb-2 text-slate-400" size={22} /><p className="m-0 text-sm font-medium text-slate-700">ยังไม่มีรายการบ้าน</p><p className="mb-3 mt-1 text-xs text-slate-500">เลือกเพิ่มสิ่งของหรืออุปกรณ์ งานต่อเติม / ปรับปรุง หรืองานซ่อมบำรุง</p>{canWrite ? <Button variant="primary" disabled={busy} onClick={() => setAddChoiceOpen(true)}><Plus size={14} />เพิ่มรายการแรก</Button> : null}</div> : null}
      {projects.length ? <section className="mb-4"><h3 className="mb-2 mt-0 flex items-center gap-2 text-sm font-semibold text-slate-700"><Hammer size={15} />โครงการต่อเติม / ปรับปรุง · {projects.length}</h3><div className="space-y-2">{projects.toReversed().map(project => { const budget = projectBudget(project); const paid = project.payments.filter(payment => payment.direction === 'OUT').reduce((sum, payment) => sum + payment.amount, 0); const returned = project.payments.filter(payment => payment.direction === 'IN').reduce((sum, payment) => sum + payment.amount, 0); const status = { planned: 'วางแผน', in_progress: 'กำลังทำ', completed: 'เสร็จแล้ว' }[project.status]; return <article key={project.id} className="rounded-xl border border-slate-200 bg-white p-3"><div className="flex flex-wrap items-start justify-between gap-3"><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><strong className="text-sm text-slate-800">{project.name}</strong><span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] text-slate-600">{status}</span><span className="text-xs text-slate-500">{project.type === 'extension' ? 'ต่อเติม / ขยายพื้นที่' : 'ปรับปรุง / ตกแต่ง'}</span><span className="text-xs text-slate-500">{project.pricingMode === 'boq' ? `BOQ ${project.boqLines.length} รายการ` : 'ราคาเหมา'}</span></div><p className="mb-0 mt-1 text-xs text-slate-500">{project.roomNames.length ? project.roomNames.join(' · ') : 'ทั้งอาคาร'} · เริ่ม {project.startedOn}{project.completedOn ? ` · เสร็จ ${project.completedOn}` : ''}</p><p className="mb-0 mt-1 text-xs text-slate-600">งบ {money(budget)} · ปรับปรุงจริง {money(project.actualCost)} · จ่าย {money(paid)} · รับคืน {money(returned)} บาท</p>{project.boqLines.length ? <details className="mt-2 text-xs text-slate-500"><summary className="cursor-pointer">ดู BOQ โครงการ ({project.boqLines.length})</summary><ul className="my-1 space-y-1 pl-5">{project.boqLines.map(line => <li key={line.id}>{line.name} · {line.quantity} {line.unit} · {money(line.quantity * line.unitPrice + line.labor)} บาท</li>)}</ul></details> : null}{project.payments.length ? <details className="mt-1 text-xs text-slate-500"><summary className="cursor-pointer">ประวัติรับ–จ่าย ({project.payments.length})</summary><ul className="my-1 space-y-1 pl-5">{project.payments.toReversed().map(payment => { const entry = ledger.find(row => row.id === payment.ledgerEntryId); const alreadyLinked = usedLedgerIds.includes(payment.ledgerEntryId); return <li key={payment.id}>{payment.date} · {payment.direction === 'IN' ? 'รับคืน' : 'จ่าย'} · {money(payment.amount)} บาท{payment.reference ? ` · ${payment.reference}` : ''}{entry ? ` · ${entry.categoryName}` : ''}{alreadyLinked ? '' : ' · ตรวจสอบการเชื่อมโยง'}</li> })}</ul></details> : null}</div>{canWrite ? <div className="flex flex-wrap gap-1.5"><Button disabled={busy || project.status === 'completed'} onClick={() => openProjectPayment(project, 'OUT')}><Wallet size={13} />บันทึกจ่าย</Button><Button disabled={busy || paid - returned <= 0 || project.status === 'completed'} onClick={() => openProjectPayment(project, 'IN')}><Wallet size={13} />รับคืน</Button><Button disabled={busy} onClick={() => editProject(project)}><Pencil size={13} />แก้ไข / ปิดงาน</Button></div> : null}</div></article> })}</div></section> : null}
      {works.length ? <div className="space-y-2">{works.toReversed().map(work => <article key={work.id} className="rounded-xl border border-slate-200 bg-white px-3 py-3"><div className="flex flex-wrap items-start justify-between gap-3"><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-1.5"><strong className="text-sm text-slate-800">{work.name}</strong><span className="text-xs text-slate-500">{workTypes[work.type]}</span><span className={`rounded-full px-2 py-0.5 text-[10px] ${work.treatment === 'capital' ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>{work.treatment === 'capital' ? 'เพิ่มต้นทุนสินทรัพย์' : 'ซ่อม / บริการ'}</span></div><p className="mb-0 mt-1 text-xs text-slate-500">{work.roomNames.length ? work.roomNames.join(' · ') : 'ทั้งอาคาร'} · {work.date}{work.vendor ? ` · ${work.vendor}` : ''}</p><p className="mb-0 mt-1 text-xs text-slate-600">{money(work.amount)} บาท{work.warrantyUntil ? ` · รับประกันถึง ${work.warrantyUntil}` : ''}{work.reference ? ` · ${work.reference}` : ''}</p>{work.notes ? <p className="mb-0 mt-1 text-xs text-slate-400">{work.notes}</p> : null}</div>{canWrite ? <Button disabled={busy} onClick={() => editWork(work)} aria-label={`แก้ไข ${work.name}`}><Pencil size={13} />แก้ไข</Button> : null}</div></article>)}</div> : null}
      {asset.items.some(item => !['removed', 'sold', 'retired'].includes(item.status ?? '')) ? <section className="mt-4"><h3 className="mb-2 mt-0 flex items-center gap-2 text-sm font-semibold text-slate-700"><Package size={15} />สิ่งของ / อุปกรณ์ในบ้าน</h3><div className="grid gap-2 sm:grid-cols-2">{asset.items.filter(item => !['removed', 'sold', 'retired'].includes(item.status ?? '')).map(item => <article key={item.id} className="rounded-xl border border-slate-200 bg-white p-3"><div className="flex items-start justify-between gap-2"><div><strong className="text-sm text-slate-800">{item.name}</strong><p className="mb-0 mt-1 text-xs text-slate-500">{item.room || 'ทั้งอาคาร'}{item.size ? ` · ${item.size}` : ''} · {item.quantity} ชิ้น</p><p className="mb-0 mt-1 text-xs text-slate-600">ซื้อ {money(item.price)} บาท{item.purchasedOn ? ` · ${item.purchasedOn}` : ''}{item.shop ? ` · ${item.shop}` : ''}</p>{item.warrantyUntil ? <p className="mb-0 mt-1 text-[11px] text-slate-500">ประกันถึง {item.warrantyUntil}</p> : null}{item.receipt ? <a className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-blue-700 hover:underline" href={item.receipt.dataUrl} download={item.receipt.name} target="_blank" rel="noreferrer"><FileUp size={13} />ดูบิล / เอกสาร</a> : null}{item.notes ? <p className="mb-0 mt-1 text-[11px] text-slate-400">{item.notes}</p> : null}</div>{canWrite ? <Button disabled={busy} onClick={() => { setItemDraft(structuredClone(item)); setItemError(''); setItemOpen(true) }} aria-label={`แก้ไข ${item.name}`}><Pencil size={13} />แก้ไข</Button> : null}</div></article>)}</div></section> : null}
    </div>}

    <Modal open={changeOrderOpen} title={`สร้างใบงานเพิ่ม-ลดงาน · เวอร์ชัน ${selectedBoqVersion.version}`} description="บันทึกรายการเปลี่ยนแปลงแยกจาก BOQ หลัก แล้วอนุมัติเพื่อรวมยอดสุทธิ" onClose={() => { if (!busy) setChangeOrderOpen(false) }} className="max-w-2xl"><form className="space-y-4" onSubmit={saveChangeOrder}>
      <label className={label}>ชื่อใบงาน *<input className={field} required maxLength={200} value={changeOrderDraft.title} onChange={event => setChangeOrderDraft({ ...changeOrderDraft, title: event.target.value })} placeholder="เช่น ใบงานเพิ่ม-ลดงาน ครั้งที่ 1" /></label>
      <div className="grid gap-3 sm:grid-cols-2"><label className={label}>วันที่ *<input className={field} type="date" max={today()} required value={changeOrderDraft.date} onChange={event => setChangeOrderDraft({ ...changeOrderDraft, date: event.target.value })} /></label><label className={label}>เลขที่เอกสาร / อ้างอิง<input className={field} maxLength={150} value={changeOrderDraft.reference} onChange={event => setChangeOrderDraft({ ...changeOrderDraft, reference: event.target.value })} /></label></div>
      <section className="space-y-2"><div className="flex items-center justify-between"><h3 className="m-0 text-sm font-semibold text-slate-700">รายการเพิ่ม / ลด</h3><Button type="button" onClick={() => setChangeOrderDraft({ ...changeOrderDraft, lines: [...changeOrderDraft.lines, emptyChangeOrderLine()] })}><Plus size={13} />เพิ่มบรรทัด</Button></div>{changeOrderDraft.lines.map((line, index) => <div key={line.id} className="grid gap-2 rounded-xl border border-slate-200 p-3 sm:grid-cols-[120px_minmax(0,1fr)_140px_32px]"><label className={label}>ประเภท<select className={field} value={line.kind} onChange={event => setChangeOrderDraft({ ...changeOrderDraft, lines: changeOrderDraft.lines.map(row => row.id === line.id ? { ...row, kind: event.target.value as BuildingChangeOrderLine['kind'] } : row) })}><option value="add">งานเพิ่ม (+)</option><option value="deduct">งานลด (−)</option></select></label><label className={label}>รายละเอียด *<input className={field} required maxLength={300} value={line.description} onChange={event => setChangeOrderDraft({ ...changeOrderDraft, lines: changeOrderDraft.lines.map(row => row.id === line.id ? { ...row, description: event.target.value } : row) })} placeholder="งานหรือรายการที่เปลี่ยน" /></label><label className={label}>มูลค่า (บาท) *<input className={field} required type="number" min="0.01" step="0.01" value={line.amount || ''} onChange={event => setChangeOrderDraft({ ...changeOrderDraft, lines: changeOrderDraft.lines.map(row => row.id === line.id ? { ...row, amount: Number(event.target.value) } : row) })} /></label><button type="button" aria-label={`ลบบรรทัด ${index + 1}`} disabled={changeOrderDraft.lines.length <= 1} className="mt-5 rounded-lg p-1 text-slate-400 hover:bg-rose-50 hover:text-rose-600 disabled:opacity-30" onClick={() => setChangeOrderDraft({ ...changeOrderDraft, lines: changeOrderDraft.lines.filter(row => row.id !== line.id) })}><Trash2 size={15} /></button></div>)}</section>
      <label className={label}>หมายเหตุ<textarea className={field} rows={2} maxLength={1000} value={changeOrderDraft.notes} onChange={event => setChangeOrderDraft({ ...changeOrderDraft, notes: event.target.value })} /></label>
      <div className="rounded-xl bg-slate-50 p-3 text-sm"><div className="flex justify-between"><span className="text-emerald-700">งานเพิ่ม</span><strong>+{money(changeOrderDraft.lines.filter(line => line.kind === 'add').reduce((sum, line) => sum + line.amount, 0))}</strong></div><div className="mt-1 flex justify-between"><span className="text-rose-700">งานลด</span><strong>−{money(changeOrderDraft.lines.filter(line => line.kind === 'deduct').reduce((sum, line) => sum + line.amount, 0))}</strong></div><div className="mt-1 flex justify-between border-t border-slate-200 pt-1 font-semibold"><span>ยอดสุทธิ</span><strong>{money(changeOrderDraft.lines.reduce((sum, line) => sum + (line.kind === 'add' ? line.amount : -line.amount), 0))} บาท</strong></div><p className="mb-0 mt-2 text-[11px] text-slate-500">บันทึกเป็น “รออนุมัติ” ก่อน ยอด BOQ จะเปลี่ยนเมื่อกดอนุมัติ</p></div>
      {changeOrderError ? <p role="alert" className="m-0 text-sm text-rose-700">{changeOrderError}</p> : null}<div className="flex justify-end gap-2"><Button type="button" disabled={busy} onClick={() => setChangeOrderOpen(false)}>ยกเลิก</Button><Button type="submit" variant="primary" disabled={busy}>{busy ? 'กำลังบันทึก…' : 'บันทึกใบงาน'}</Button></div>
    </form></Modal>

    <Modal open={addChoiceOpen} title={`เพิ่มรายการบ้าน · ${asset.name}`} description="เลือกประเภทก่อน แล้วระบุห้องหรือพื้นที่ที่เกี่ยวข้อง" onClose={() => { if (!busy) setAddChoiceOpen(false) }} className="max-w-3xl"><div className="grid gap-3 sm:grid-cols-3">
      <button type="button" onClick={() => chooseAddType('equipment')} className="rounded-2xl border border-slate-200 bg-white p-4 text-left transition hover:border-sky-300 hover:bg-sky-50/50"><Package className="mb-3 text-sky-700" size={22} /><strong className="block text-sm text-slate-800">สิ่งของ / อุปกรณ์</strong><span className="mt-1 block text-xs leading-5 text-slate-500">แอร์ เครื่องกรองอากาศ เฟอร์นิเจอร์ พร้อมห้อง ราคา ร้านค้า และประกัน</span></button>
      <button type="button" onClick={() => chooseAddType('project')} className="rounded-2xl border border-slate-200 bg-white p-4 text-left transition hover:border-emerald-300 hover:bg-emerald-50/50"><Hammer className="mb-3 text-emerald-700" size={22} /><strong className="block text-sm text-slate-800">งานต่อเติม / ปรับปรุง</strong><span className="mt-1 block text-xs leading-5 text-slate-500">บันทึกเป็นต้นทุนปรับปรุง และเลือกห้องที่เกี่ยวข้องได้หลายห้อง</span></button>
      <button type="button" onClick={() => chooseAddType('repair')} className="rounded-2xl border border-slate-200 bg-white p-4 text-left transition hover:border-amber-300 hover:bg-amber-50/50"><BrushCleaning className="mb-3 text-amber-700" size={22} /><strong className="block text-sm text-slate-800">งานซ่อมบำรุง</strong><span className="mt-1 block text-xs leading-5 text-slate-500">บันทึกค่าใช้จ่าย ผู้ให้บริการ วันที่ และประกันงานซ่อม</span></button>
    </div><div className="mt-4 flex justify-end"><Button disabled={busy} onClick={() => setAddChoiceOpen(false)}>ยกเลิก</Button></div></Modal>

    <Modal open={projectOpen} title={`${projects.some(project => project.id === projectDraft?.id) ? 'แก้ไข' : 'สร้าง'}โครงการบ้าน · ${asset.name}`} description="กรอกข้อมูลโครงการและงบประมาณ โดยเพิ่มรายละเอียดเท่าที่มี" onClose={() => { if (!busy) { setProjectOpen(false); setProjectDraft(null) } }} className="max-w-3xl p-6">
      {projectDraft ? <form className="space-y-5" onSubmit={saveProject}>
        <label className="block text-sm font-medium text-slate-600">ชื่อโครงการ<input className="mt-1.5 w-full rounded-full border border-slate-200 bg-white px-5 py-3 text-sm text-slate-800 outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-100" required maxLength={300} value={projectDraft.name} onChange={event => setProjectDraft({ ...projectDraft, name: event.target.value })} placeholder="เช่น ต่อเติมห้องครัว" /></label>
        <label className="block text-sm font-medium text-slate-600">ประเภทงาน<select className="mt-1.5 w-full rounded-full border border-slate-200 bg-white px-5 py-3 text-sm text-slate-800 outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-100" value={projectDraft.type} onChange={event => setProjectDraft({ ...projectDraft, type: event.target.value as BuildingProject['type'] })}><option value="extension">ต่อเติม / ขยายพื้นที่</option><option value="renovation">ปรับปรุง / ตกแต่ง</option></select></label>
        <fieldset className="rounded-2xl border border-slate-200 p-4"><legend className="px-1 text-sm font-medium text-slate-600">พื้นที่หรือห้องที่เกี่ยวข้อง</legend><div className="flex flex-wrap gap-2">{asset.rooms.map(room => <label key={room} className={`cursor-pointer rounded-full border px-4 py-2 text-sm ${projectDraft.roomNames.includes(room) ? 'border-slate-700 bg-slate-800 text-white' : 'border-slate-200 bg-white text-slate-700'}`}><input className="sr-only" type="checkbox" checked={projectDraft.roomNames.includes(room)} onChange={event => setProjectDraft({ ...projectDraft, roomNames: event.target.checked ? [...projectDraft.roomNames, room] : projectDraft.roomNames.filter(value => value !== room) })} />{room}</label>)}</div><p className="mb-0 mt-2 text-xs text-slate-400">ไม่เลือกห้อง = งานระดับทั้งอาคาร · เลือกได้หลายห้อง</p></fieldset>
        <fieldset className="space-y-3"><legend className="mb-2 text-sm font-medium text-slate-600">วิธีคิดราคา</legend><label className="flex cursor-pointer items-center gap-3 text-sm text-slate-700"><input type="radio" name="projectPricing" checked={projectDraft.pricingMode === 'lump_sum'} onChange={() => setProjectDraft({ ...projectDraft, pricingMode: 'lump_sum' })} />ราคาเหมา</label><label className="flex cursor-pointer items-center gap-3 text-sm text-slate-700"><input type="radio" name="projectPricing" checked={projectDraft.pricingMode === 'boq'} onChange={() => setProjectDraft({ ...projectDraft, pricingMode: 'boq' })} />BOQ แยกรายการ</label></fieldset>
        {projectDraft.pricingMode === 'lump_sum' ? <label className="block text-sm font-medium text-slate-600">ราคาเหมา (บาท)<input className="mt-1.5 w-full rounded-full border border-slate-200 bg-white px-5 py-3 text-sm text-slate-800 outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-100" type="number" min="0" step="0.01" value={projectDraft.lumpSum} onChange={event => setProjectDraft({ ...projectDraft, lumpSum: Number(event.target.value) })} /></label> : <div className="space-y-2"><div className="space-y-1">{projectDraft.boqLines.map(line => <div key={line.id} className="flex items-center gap-3 rounded-xl px-2 py-2"><span className="min-w-0 flex-1 text-sm text-slate-700">{line.name}</span><span className="w-36 text-right text-sm font-medium text-slate-800">฿{money(line.quantity * line.unitPrice + line.labor)}</span><button type="button" className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700" aria-label={`ลบ ${line.name}`} onClick={() => setProjectDraft({ ...projectDraft, boqLines: projectDraft.boqLines.filter(row => row.id !== line.id) })}><Trash2 size={15} /></button></div>)}</div><div className="grid gap-2 sm:grid-cols-2"><label className="block text-sm font-medium text-slate-600">ชื่อรายการใหม่<input className="mt-1.5 w-full rounded-full border border-slate-200 bg-white px-5 py-3 text-sm text-slate-800 outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-100" value={projectLineName} onChange={event => setProjectLineName(event.target.value)} placeholder="เช่น งานโครงสร้าง" /></label><label className="block text-sm font-medium text-slate-600">ราคา (บาท)<input className="mt-1.5 w-full rounded-full border border-slate-200 bg-white px-5 py-3 text-sm text-slate-800 outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-100" type="number" min="0" step="0.01" value={projectLinePrice} onChange={event => setProjectLinePrice(event.target.value)} placeholder="0" /></label></div><Button type="button" className="w-full justify-center rounded-full" onClick={addProjectLine}><Plus size={14} />เพิ่มรายการ BOQ</Button><p className="mb-0 text-xs text-slate-400">ยอด BOQ คำนวณจากรายการที่เพิ่มไว้</p></div>}
        <div className="grid gap-3 sm:grid-cols-2"><label className="block text-sm font-medium text-slate-600">วันเริ่มงาน<input className="mt-1.5 w-full rounded-full border border-slate-200 bg-white px-5 py-3 text-sm text-slate-800 outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-100" type="date" max={today()} value={projectDraft.startedOn} onChange={event => setProjectDraft({ ...projectDraft, startedOn: event.target.value })} /></label><label className="block text-sm font-medium text-slate-600">วันเสร็จงาน<input className="mt-1.5 w-full rounded-full border border-slate-200 bg-white px-5 py-3 text-sm text-slate-800 outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-100" type="date" max={today()} value={projectDraft.completedOn} onChange={event => setProjectDraft({ ...projectDraft, completedOn: event.target.value, status: event.target.value ? 'completed' : projectDraft.status === 'completed' ? 'in_progress' : projectDraft.status })} /></label><label className="block text-sm font-medium text-slate-600">สถานะ<select disabled={projects.some(row => row.id === projectDraft.id && row.status === 'completed')} className="mt-1.5 w-full rounded-full border border-slate-200 bg-white px-5 py-3 text-sm text-slate-800 outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-100" value={projectDraft.status} onChange={event => setProjectDraft({ ...projectDraft, status: event.target.value as BuildingProject['status'], completedOn: event.target.value === 'completed' ? projectDraft.completedOn || today() : '' })}><option value="planned">วางแผน</option><option value="in_progress">กำลังทำ</option><option value="completed">เสร็จแล้ว / ปิดงาน</option></select></label><label className="block text-sm font-medium text-slate-600">ผู้รับเหมา<input className="mt-1.5 w-full rounded-full border border-slate-200 bg-white px-5 py-3 text-sm text-slate-800 outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-100" value={projectDraft.vendor} onChange={event => setProjectDraft({ ...projectDraft, vendor: event.target.value })} /></label><label className="block text-sm font-medium text-slate-600">ประกันถึงวันที่<input className="mt-1.5 w-full rounded-full border border-slate-200 bg-white px-5 py-3 text-sm text-slate-800 outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-100" type="date" value={projectDraft.warrantyUntil} onChange={event => setProjectDraft({ ...projectDraft, warrantyUntil: event.target.value })} /></label><label className="block text-sm font-medium text-slate-600">เลขอ้างอิง / สัญญา<input className="mt-1.5 w-full rounded-full border border-slate-200 bg-white px-5 py-3 text-sm text-slate-800 outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-100" maxLength={150} value={projectDraft.reference} onChange={event => setProjectDraft({ ...projectDraft, reference: event.target.value })} /></label></div>
        {projectDraft.status === 'completed' ? <section className="rounded-2xl border border-slate-200 p-4"><h3 className="mb-3 mt-0 text-sm font-semibold text-slate-700">ผลลัพธ์เมื่อปิดงาน · ไม่บังคับ</h3><label className="block text-sm font-medium text-slate-600">ผลลัพธ์<select className="mt-1.5 w-full rounded-full border border-slate-200 bg-white px-5 py-3 text-sm text-slate-800 outline-none focus:border-slate-400" value={projectDraft.outcome?.type ?? 'none'} onChange={event => setProjectDraft({ ...projectDraft, outcome: { ...(projectDraft.outcome ?? emptyProject().outcome!), type: event.target.value as NonNullable<BuildingProject['outcome']>['type'] } })}><option value="none">บันทึกงานไว้กับอาคาร</option><option value="add_room">เพิ่มห้อง / พื้นที่</option><option value="component">สร้างอุปกรณ์ / สิ่งติดตั้ง</option><option value="update_existing">ปรับปรุง / เปลี่ยนรายการเดิม</option></select></label>{projectDraft.outcome?.type === 'add_room' ? <div className="mt-3 grid gap-3 sm:grid-cols-2"><label className="block text-sm text-slate-600">ชื่อห้องใหม่ *<input className="mt-1 w-full rounded-full border border-slate-200 px-5 py-3" value={projectDraft.outcome.newRoomName} onChange={event => setProjectDraft({ ...projectDraft, outcome: { ...projectDraft.outcome!, newRoomName: event.target.value } })} /></label><label className="block text-sm text-slate-600">พื้นที่ที่เพิ่ม (ตร.ม.)<input className="mt-1 w-full rounded-full border border-slate-200 px-5 py-3" type="number" min="0" step="0.01" value={projectDraft.outcome.areaAddedSqm} onChange={event => setProjectDraft({ ...projectDraft, outcome: { ...projectDraft.outcome!, areaAddedSqm: Number(event.target.value) } })} /></label></div> : null}{projectDraft.outcome?.type === 'component' || projectDraft.outcome?.type === 'update_existing' ? <div className="mt-3 grid gap-3 sm:grid-cols-2">{projectDraft.outcome.type === 'update_existing' ? <label className="block text-sm text-slate-600">รายการเดิมที่เปลี่ยน<select className="mt-1 w-full rounded-full border border-slate-200 px-5 py-3" value={projectDraft.outcome.replacesItemId} onChange={event => setProjectDraft({ ...projectDraft, outcome: { ...projectDraft.outcome!, replacesItemId: event.target.value } })}><option value="">เลือกรายการเดิม</option>{asset.items.filter(item => !['removed', 'sold', 'retired'].includes(item.status ?? '')).map(item => <option key={item.id} value={item.id}>{item.name} · {item.room}</option>)}</select></label> : null}<label className="block text-sm text-slate-600">ชื่ออุปกรณ์ / สิ่งติดตั้งใหม่ *<input className="mt-1 w-full rounded-full border border-slate-200 px-5 py-3" value={projectDraft.outcome.componentName} onChange={event => setProjectDraft({ ...projectDraft, outcome: { ...projectDraft.outcome!, componentName: event.target.value } })} /></label><label className="block text-sm text-slate-600">ห้อง<select className="mt-1 w-full rounded-full border border-slate-200 px-5 py-3" value={projectDraft.outcome.roomName} onChange={event => setProjectDraft({ ...projectDraft, outcome: { ...projectDraft.outcome!, roomName: event.target.value } })}><option value="">เลือกห้องในโครงการ</option>{asset.rooms.map(room => <option key={room} value={room}>{room}</option>)}</select></label></div> : null}{projectDraft.outcome?.type !== 'add_room' ? <label className="mt-3 block text-sm text-slate-600">พื้นที่เพิ่ม (ตร.ม.)<input className="mt-1 w-full max-w-sm rounded-full border border-slate-200 px-5 py-3" type="number" min="0" step="0.01" value={projectDraft.outcome?.areaAddedSqm ?? 0} onChange={event => setProjectDraft({ ...projectDraft, outcome: { ...projectDraft.outcome!, areaAddedSqm: Number(event.target.value) } })} /></label> : null}<p className="mb-0 mt-3 text-xs text-slate-400">รายการเดิมจะเก็บประวัติไว้และเปลี่ยนสถานะเป็นเลิกใช้งาน ไม่ลบทิ้ง</p></section> : null}
        <label className="block text-sm font-medium text-slate-600">หมายเหตุ / เอกสารอ้างอิง<textarea className="mt-1.5 w-full rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm outline-none focus:border-slate-400" rows={2} maxLength={1000} value={projectDraft.notes} onChange={event => setProjectDraft({ ...projectDraft, notes: event.target.value })} placeholder="เพิ่มรายละเอียดหรือลิงก์เอกสารได้ (ไม่บังคับ)" /></label>
        <div className="rounded-2xl bg-slate-50 p-5"><span className="block text-sm text-slate-500">งบประมาณโครงการ</span><strong className="mt-1 block text-4xl font-semibold tracking-tight text-slate-800">฿{money(projectBudget(projectDraft))}</strong></div>
        {projectError ? <p role="alert" className="m-0 text-sm text-rose-700">{projectError}</p> : null}<div className="sticky bottom-[-24px] -mx-6 flex justify-end gap-2 border-t border-slate-100 bg-white px-6 py-4"><Button disabled={busy} onClick={() => { setProjectOpen(false); setProjectDraft(null) }}>ยกเลิก</Button><button type="submit" disabled={busy} className="w-full rounded-full bg-[#34363a] px-5 py-3 text-sm font-medium text-white transition hover:bg-[#25272a] disabled:opacity-50">{busy ? 'กำลังบันทึก…' : projectDraft.status === 'completed' ? 'บันทึกโครงการและปิดงาน' : 'บันทึกโครงการ'}</button></div>
      </form> : null}
    </Modal>

    <Modal open={Boolean(payingProject && projectPaymentDraft)} title={`${projectPaymentDraft?.direction === 'IN' ? 'บันทึกรับคืนจริง' : 'บันทึกจ่ายจริง'} · ${payingProject ? 'title' in payingProject ? payingProject.title : payingProject.name : ''}`} description="ยอดรับ–จ่ายจริงบันทึกเข้าบัญชีแยกจากยอดเสนอของใบงาน" onClose={() => { if (!busy) { setPayingProject(null); setProjectPaymentDraft(null); setProjectError('') } }} className="max-w-2xl">{payingProject && projectPaymentDraft ? <form className="space-y-4" onSubmit={event => { event.preventDefault(); if (!payingProject || !projectPaymentDraft) return; setProjectError(''); onCreateProjectPayment(payingProject, projectPaymentDraft).then(() => { setPayingProject(null); setProjectPaymentDraft(null) }).catch(caught => setProjectError(caught instanceof Error ? caught.message : 'บันทึกรับ–จ่ายไม่สำเร็จ')) }}><div className="grid gap-3 sm:grid-cols-2"><label className={label}>ยอดเงินจริง (บาท) *<input className={field} required type="number" min="0.01" step="0.01" value={projectPaymentDraft.amount} onChange={event => setProjectPaymentDraft({ ...projectPaymentDraft, amount: event.target.value })} /></label><label className={label}>วันที่ *<input className={field} required type="date" max={today()} value={projectPaymentDraft.occurredOn} onChange={event => setProjectPaymentDraft({ ...projectPaymentDraft, occurredOn: event.target.value })} /></label><label className={label}>หมวด{projectPaymentDraft.direction === 'OUT' ? 'รายจ่าย' : 'รายรับ'} *<select className={field} required value={projectPaymentDraft.categoryCode} onChange={event => setProjectPaymentDraft({ ...projectPaymentDraft, categoryCode: event.target.value })}><option value="">เลือกหมวด</option>{financialCategories.filter(row => row.direction === projectPaymentDraft.direction).map(row => <option key={row.code} value={row.code}>{row.nameTh}</option>)}</select></label><label className={label}>ช่องทาง *<select className={field} required value={projectPaymentDraft.channelCode} onChange={event => setProjectPaymentDraft({ ...projectPaymentDraft, channelCode: event.target.value })}><option value="">เลือกช่องทาง</option>{channels.map(row => <option key={row.code} value={row.code}>{row.nameTh}</option>)}</select></label><label className={label}>ลักษณะรายการ<select className={field} value={projectPaymentDraft.paymentType} onChange={event => setProjectPaymentDraft({ ...projectPaymentDraft, paymentType: event.target.value as BuildingProjectPaymentDraft['paymentType'] })}>{projectPaymentDraft.direction === 'IN' ? <option value="refund">รับเงินคืน</option> : <><option value="deposit">มัดจำ</option><option value="progress">จ่ายตามงวดงาน</option><option value="final">งวดสุดท้าย</option></>}</select></label><label className={label}>เลขอ้างอิง / ใบเสร็จ<input className={field} maxLength={150} value={projectPaymentDraft.reference} onChange={event => setProjectPaymentDraft({ ...projectPaymentDraft, reference: event.target.value })} /></label><label className={`${label} sm:col-span-2`}>สลิป / เอกสารประกอบ<input className={field} type="file" accept="image/*,application/pdf" onChange={event => setProjectPaymentDraft({ ...projectPaymentDraft, slip: event.target.files?.[0] ?? null })} /></label><label className={`${label} sm:col-span-2`}>หมายเหตุ<textarea className={field} rows={2} maxLength={1000} value={projectPaymentDraft.note} onChange={event => setProjectPaymentDraft({ ...projectPaymentDraft, note: event.target.value })} /></label></div>{projectError ? <p role="alert" className="m-0 text-sm text-rose-700">{projectError}</p> : null}<p className="m-0 text-[11px] text-slate-400">รายการรับ–จ่ายที่เชื่อมกับสินทรัพย์ {usedLedgerIds.length} รายการ</p><div className="flex justify-end gap-2"><Button disabled={busy} onClick={() => { setPayingProject(null); setProjectPaymentDraft(null) }}>ยกเลิก</Button><Button type="submit" variant="primary" disabled={busy}>{busy ? 'กำลังบันทึก…' : 'บันทึกรับ–จ่าย'}</Button></div></form> : null}</Modal>

    <Modal open={itemOpen} title={`${asset.items.some(item => item.id === itemDraft?.id) ? 'แก้ไข' : 'เพิ่ม'}สิ่งของ / อุปกรณ์ · ${asset.name}`} description="ข้อมูลสิ่งของ ประกัน และเอกสารซื้อจะเก็บไว้กับรายการนี้" onClose={() => { if (!busy) { setItemOpen(false); setItemDraft(null) } }} className="max-w-3xl">{itemDraft ? <form className="space-y-4" onSubmit={saveHomeItem}><div className="grid gap-3 sm:grid-cols-2">
      <label className={label}>ชื่อสิ่งของ / อุปกรณ์ *<input className={field} required maxLength={300} value={itemDraft.name} onChange={event => setItemDraft({ ...itemDraft, name: event.target.value })} placeholder="เช่น เครื่องกรองอากาศ" /></label>
      <label className={label}>ห้อง / พื้นที่<select className={field} value={itemDraft.room} onChange={event => setItemDraft({ ...itemDraft, room: event.target.value })}><option value="">ทั้งอาคาร / ยังไม่ระบุ</option>{asset.rooms.map(room => <option key={room} value={room}>{room}</option>)}</select></label>
      <label className={label}>ขนาด / รุ่น<input className={field} maxLength={120} value={itemDraft.size} onChange={event => setItemDraft({ ...itemDraft, size: event.target.value })} /></label>
      <label className={label}>จำนวน<input className={field} type="number" min="1" step="1" value={itemDraft.quantity} onChange={event => setItemDraft({ ...itemDraft, quantity: Math.max(1, Number(event.target.value)) })} /></label>
      <label className={label}>ราคาต่อชิ้น (บาท)<input className={field} type="number" min="0" step="0.01" value={itemDraft.price} onChange={event => setItemDraft({ ...itemDraft, price: Number(event.target.value) })} /></label>
      <label className={label}>ร้านค้า / แหล่งซื้อ<input className={field} maxLength={300} value={itemDraft.shop} onChange={event => setItemDraft({ ...itemDraft, shop: event.target.value })} /></label>
      <label className={label}>วันที่ซื้อ<input className={field} type="date" max={today()} value={itemDraft.purchasedOn} onChange={event => setItemDraft({ ...itemDraft, purchasedOn: event.target.value, warrantyStart: event.target.value, warrantyUntil: warrantyEndDate(event.target.value, itemDraft.warrantyMonths) })} /></label>
      <label className={label}>ประกัน (เดือน)<input className={field} type="number" min="0" step="1" value={itemDraft.warrantyMonths} onChange={event => { const months = Math.max(0, Number(event.target.value)); setItemDraft({ ...itemDraft, warrantyMonths: months, warrantyStart: itemDraft.purchasedOn, warrantyUntil: warrantyEndDate(itemDraft.purchasedOn, months) }) }} /></label>
      <label className={label}>ประกันถึงวันที่<input className={`${field} bg-slate-50 text-slate-600`} type="date" readOnly value={warrantyEndDate(itemDraft.purchasedOn, itemDraft.warrantyMonths)} aria-describedby="home-item-warranty-help" /></label>
      <p id="home-item-warranty-help" className="m-0 self-end text-xs text-slate-500">คำนวณจากวันที่ซื้อ + จำนวนเดือนประกันอัตโนมัติ</p>
      <p className="m-0 self-end text-xs text-slate-500 sm:col-span-2">รวมราคาซื้อ {money(itemDraft.quantity * itemDraft.price)} บาท</p>
      <div className="space-y-2 sm:col-span-2"><label className={label}>บิล / ใบเสร็จ / เอกสารรับประกัน <span className="font-normal text-slate-400">(PDF, JPG, PNG · ไม่เกิน 5 MB · ไม่บังคับ)</span><input className={field} type="file" accept="application/pdf,image/jpeg,image/png,.pdf,.jpg,.jpeg,.png" onChange={event => { const file = event.currentTarget.files?.[0]; event.currentTarget.value = ''; if (file) void readReceipt(file).then(receipt => { setItemDraft(current => current ? { ...current, receipt } : current); setItemError('') }).catch(caught => setItemError(caught instanceof Error ? caught.message : 'อ่านไฟล์ไม่สำเร็จ')) }} /></label>{itemDraft.receipt ? <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-slate-50 px-3 py-2 text-xs"><span className="flex min-w-0 items-center gap-2 text-slate-700"><FileUp size={14} className="shrink-0" /><span className="truncate">{itemDraft.receipt.name}</span></span><button type="button" className="text-rose-700 hover:underline" onClick={() => setItemDraft({ ...itemDraft, receipt: undefined })}>นำไฟล์ออก</button></div> : <p className="m-0 text-[11px] text-slate-400">แนบภาพสแกนบิลหรือไฟล์ PDF เพื่อเปิดดูภายหลัง</p>}</div>
      <label className={`${label} sm:col-span-2`}>หมายเหตุ<textarea className={field} rows={2} maxLength={1000} value={itemDraft.notes} onChange={event => setItemDraft({ ...itemDraft, notes: event.target.value })} placeholder="รายละเอียดเพิ่มเติม (ไม่บังคับ)" /></label>
      </div>{itemError ? <p role="alert" className="m-0 text-sm text-rose-700">{itemError}</p> : null}<div className="flex justify-end gap-2"><Button type="button" disabled={busy} onClick={() => { setItemOpen(false); setItemDraft(null) }}>ยกเลิก</Button><Button type="submit" variant="primary" disabled={busy}>{busy ? 'กำลังบันทึก…' : 'บันทึกอุปกรณ์'}</Button></div></form> : null}</Modal>

    <Modal open={infoOpen} title={`ข้อมูลบ้าน · ${asset.name}`} onClose={() => { if (!busy) setInfoOpen(false) }} className="max-w-2xl"><form className="space-y-4" onSubmit={saveInfo}><div className="grid gap-3 sm:grid-cols-2"><label className={`${label} sm:col-span-2`}>ที่อยู่<input className={field} maxLength={1000} value={infoDraft.address} onChange={event => setInfoDraft({ ...infoDraft, address: event.target.value })} /></label><label className={label}>พื้นที่ใช้สอย (ตร.ม.)<input className={field} type="number" min="0" step="0.01" value={infoDraft.details.usableAreaSqm} onChange={event => setInfoDraft({ ...infoDraft, details: { ...infoDraft.details, usableAreaSqm: Number(event.target.value) } })} /></label><label className={label}>จำนวนชั้น<input className={field} type="number" min="0" step="1" value={infoDraft.details.floorCount} onChange={event => setInfoDraft({ ...infoDraft, details: { ...infoDraft.details, floorCount: Number(event.target.value) } })} /></label><label className={label}>ประเภทอาคาร<input className={field} maxLength={120} value={infoDraft.details.buildingType} onChange={event => setInfoDraft({ ...infoDraft, details: { ...infoDraft.details, buildingType: event.target.value } })} placeholder="เช่น บ้านเดี่ยว" /></label><label className={label}>วันที่สร้างเสร็จ<input className={field} type="date" max={today()} value={infoDraft.details.completedOn} onChange={event => setInfoDraft({ ...infoDraft, details: { ...infoDraft.details, completedOn: event.target.value } })} /></label>
        <label className={`${label} sm:col-span-2`}>วิธีอ้างอิงราคาก่อสร้าง<select className={field} value={infoDraft.costSource} onChange={event => setInfoDraft({ ...infoDraft, costSource: event.target.value as Home['costSource'] })}><option value="manual">ราคาเหมา / ราคาซื้อ</option><option value="boq">BOQ</option></select></label>{infoDraft.costSource === 'manual' ? <label className={`${label} sm:col-span-2`}>ราคาก่อสร้างอ้างอิง / ราคาซื้อ (บาท)<input className={field} type="number" min="0" step="0.01" value={infoDraft.purchasePrice} onChange={event => setInfoDraft({ ...infoDraft, purchasePrice: Number(event.target.value) })} /></label> : <div className="rounded-xl bg-blue-50 p-3 text-xs text-blue-800 sm:col-span-2">อ้างอิง BOQ ก่อสร้าง {constructionRows.length} รายการ · {money(constructionBoqTotal)} บาท · ใช้ปุ่ม “จัดการ BOQ” เพื่อแก้ไขรายการ</div>}
        <label className={`${label} sm:col-span-2`}>หมายเหตุ<textarea className={field} rows={2} maxLength={1000} value={infoDraft.details.notes} onChange={event => setInfoDraft({ ...infoDraft, details: { ...infoDraft.details, notes: event.target.value } })} /></label></div>
        <div className="rounded-xl border border-slate-200 p-3"><div className="flex items-center justify-between gap-2"><h3 className="m-0 text-sm font-semibold">ห้อง / พื้นที่</h3><span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs text-slate-600">รวม {totalRoomCount(infoDraft.rooms, infoDraft.details)} ห้อง</span></div><p className="mb-0 mt-1 text-[11px] text-slate-400">เพิ่มประเภทห้องและจำนวน เช่น ห้องน้ำ 4 ห้อง</p><div className="mt-2 space-y-1.5">{infoDraft.rooms.map(room => <div key={room} className="flex items-center gap-2 rounded-lg bg-slate-50 px-3 py-2 text-xs"><span className="min-w-0 flex-1">{room}</span><label className="flex items-center gap-1 text-slate-500">จำนวน<input className="w-16 rounded-lg border border-slate-200 bg-white px-2 py-1 text-right text-xs text-slate-800" type="number" min="1" step="1" value={roomCount(room)} onChange={event => updateRoomCount(room, Math.max(1, Number(event.target.value)))} aria-label={`จำนวน ${room}`} /></label><button type="button" disabled={roomInUse(room)} title={roomInUse(room) ? 'ห้องนี้มีรายการที่เชื่อมอยู่' : 'ลบห้อง'} className="rounded p-1 text-slate-400 hover:bg-rose-50 hover:text-rose-600 disabled:cursor-not-allowed disabled:opacity-40" aria-label={`ลบห้อง ${room}`} onClick={() => setInfoDraft({ ...infoDraft, rooms: infoDraft.rooms.filter(value => value !== room), details: { ...infoDraft.details, roomCounts: infoDraft.details.roomCounts?.filter(row => row.name !== room) } })}><Trash2 size={14} /></button></div>)}</div><div className="mt-2 grid grid-cols-[minmax(0,1fr)_5rem_auto] items-end gap-2"><label className={label}>ชื่อประเภทห้อง<input className={field} value={infoDraft.newRoom} onChange={event => setInfoDraft({ ...infoDraft, newRoom: event.target.value })} placeholder="เช่น ห้องทำงาน" /></label><label className={label}>จำนวน<input className={field} type="number" min="1" step="1" value={infoDraft.newRoomCount} onChange={event => setInfoDraft({ ...infoDraft, newRoomCount: Math.max(1, Number(event.target.value)) })} /></label><Button type="button" disabled={!infoDraft.newRoom.trim() || infoDraft.rooms.includes(infoDraft.newRoom.trim())} onClick={addRoom}><Plus size={13} />เพิ่ม</Button></div></div>
        {infoError ? <p role="alert" className="m-0 text-sm text-rose-700">{infoError}</p> : null}<div className="flex justify-end gap-2"><Button disabled={busy} onClick={() => setInfoOpen(false)}>ยกเลิก</Button><Button type="submit" variant="primary" disabled={busy}>{busy ? 'กำลังบันทึก…' : 'บันทึกข้อมูลบ้าน'}</Button></div></form></Modal>

    <Modal open={boqOpen} title={`BOQ ก่อสร้าง · ${asset.name}`} description="บันทึกการแก้ไขเพื่อปรับเวอร์ชันปัจจุบัน หรือเลือกบันทึกเป็นเวอร์ชันใหม่เมื่อเป็น BOQ คนละชุด" onClose={() => { if (!busy) setBoqOpen(false) }} className="w-[96vw] !max-w-[1600px] p-6"><form className="space-y-3" onSubmit={saveBoq}>
      <div className="grid gap-3 rounded-xl border border-slate-200 bg-white p-3 sm:grid-cols-3"><label className={label}>เวอร์ชันต้นแบบ<select className={field} value={boqBaseVersion} onChange={event => selectBoqBase(event.target.value)}><option value="current">เวอร์ชันปัจจุบัน · {asset.boqVersion ?? 1}</option>{[...boqVersions].sort((a, b) => b.version - a.version).map(version => <option key={version.id} value={version.id}>เวอร์ชัน {version.version} · {version.createdOn}</option>)}</select><span className="mt-1 block text-[11px] font-normal text-slate-400">บันทึกแก้ไขจะอัปเดตชุดนี้</span></label><label className={label}>ค่าดำเนินงานก่อสร้าง (บาท)<input className={field} type="number" min="0" step="0.01" value={boqFeeDraft} onChange={event => setBoqFeeDraft(Number(event.target.value))} /><span className="mt-1 block text-[11px] font-normal text-slate-400">บวกเพิ่มจากยอด BOQ</span></label><label className={label}>ยอดก่อสร้างตามข้อตกลง (บาท) · ไม่บังคับ<input className={field} type="number" min="0" step="0.01" value={boqAgreedTotalDraft} onChange={event => setBoqAgreedTotalDraft(event.target.value === '' ? '' : Number(event.target.value))} placeholder="ใช้ยอดรวม BOQ + ค่าดำเนินงาน" /><span className="mt-1 block text-[11px] font-normal text-slate-400">กรณีตกลงยอดปัด เช่น 2,662,000 บาท</span></label></div>
      <div className="grid gap-3 rounded-xl bg-slate-50 p-3 sm:grid-cols-2"><div><p className="m-0 text-xs font-medium text-slate-700">นำเข้า BOQ จาก Excel, PDF หรือไฟล์ข้อความ <span className="font-normal text-slate-500">(.xlsx, .xlsm, .pdf, .txt, .tsv ไม่เกิน 15 MB)</span></p><input className="mt-2 block max-w-full text-xs" type="file" accept=".xlsx,.xlsm,.pdf,.txt,.tsv,application/pdf,text/plain,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel.sheet.macroEnabled.12" onChange={event => { void importBoqFile(event.currentTarget.files?.[0]); event.currentTarget.value = '' }} /><p className="mb-0 mt-1 text-[11px] text-slate-400">PDF ต้องมีข้อความที่เลือกได้ ไฟล์สแกนภาพต้องผ่าน OCR</p></div><label className={label}>เมื่อนำเข้าไฟล์<select className={field} value={boqImportMode} onChange={event => setBoqImportMode(event.target.value as 'append' | 'replace')}><option value="append">เพิ่มต่อจากรายการในแบบร่าง</option><option value="replace">แทนที่รายการในแบบร่าง</option></select><span className="mt-1 block text-[11px] font-normal text-slate-400">แบบร่างเดิมยังไม่ถูกบันทึกจนกว่าจะกดบันทึกเวอร์ชัน</span></label></div>
      {boqImportNotice ? <p role="status" className="m-0 rounded-xl border border-emerald-100 bg-emerald-50 p-3 text-xs text-emerald-800">{boqImportNotice}</p> : null}
      {boqImportChoices.length ? <div className="flex flex-wrap items-end gap-2 rounded-xl border border-blue-100 bg-blue-50/60 p-3"><label className={`${label} min-w-48 flex-1`}>เลือกชีตที่ต้องการตรวจ<select className={field} value={boqImportSheet} onChange={event => setBoqImportSheet(event.target.value)}>{boqImportChoices.map(choice => { const total = choice.items.reduce((sum, row) => sum + row.quantity * row.price + row.labor, 0); return <option key={choice.sheetName} value={choice.sheetName}>{choice.sheetName} · {choice.items.length} รายการ · {money(total)} บาท</option> })}</select></label><Button type="button" variant="primary" disabled={busy} onClick={applyImportedBoq}><FileUp size={14} />แสดงรายการเพื่อตรวจ</Button></div> : null}
      <div className="flex flex-wrap items-center justify-between gap-2"><p className="m-0 text-xs text-slate-500">รวม BOQ ก่อสร้าง <strong className="text-slate-800">{money(boqTotal)} บาท</strong> · แยกตามหมวดและหมวดย่อย</p><Button type="button" onClick={() => editBoqItem()}><Plus size={13} />เพิ่มรายการ</Button></div>
      {boqDraft.length ? <div className="max-h-[58dvh] space-y-3 overflow-y-auto pr-1">{boqGroups.map(([category, entries]) => <section key={category} className="overflow-hidden rounded-xl border border-slate-200 bg-white"><div className="flex flex-wrap items-end gap-2 bg-slate-50 px-3 py-3"><label className={`${label} min-w-48 flex-1`}>หมวด · {entries.length} รายการ<input className={field} value={category === 'ยังไม่ระบุหมวด' ? '' : category} onChange={event => setBoqDraft(boqDraft.map(row => row.category === category || !row.category && category === 'ยังไม่ระบุหมวด' ? { ...row, category: event.target.value } : row))} placeholder="เช่น งานโครงสร้าง" /></label><Button type="button" onClick={() => editBoqItem(undefined, category === 'ยังไม่ระบุหมวด' ? '' : category)}><Plus size={13} />เพิ่มในหมวดนี้</Button><Button type="button" aria-label={`ลบหมวด ${category}`} onClick={() => setBoqDraft(boqDraft.filter(row => (row.category || 'ยังไม่ระบุหมวด') !== category))}><Trash2 size={14} />ลบทั้งหมวด</Button></div><div className="divide-y divide-slate-100">{entries.map(({ row }) => <article key={row.id} className="grid gap-3 px-3 py-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-start"><div className="min-w-0"><div className="flex flex-wrap items-center gap-x-3 gap-y-1"><strong className="text-sm text-slate-800">{row.name || 'ยังไม่ระบุชื่อรายการ'}</strong>{row.subcategory ? <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] text-slate-500">{row.subcategory}</span> : null}<span className="text-xs text-slate-500">{row.quantity} {row.unit}</span><strong className="text-sm text-slate-700">{money(row.quantity * row.price + row.labor)} บาท</strong></div>{row.spec ? <p className="mb-0 mt-1 text-xs text-slate-500">{row.spec}</p> : null}{row.materialTotal !== undefined || row.laborRate !== undefined || row.boqTotal !== undefined || row.note ? <p className="mb-0 mt-1 rounded-lg bg-slate-50 px-2.5 py-2 text-[11px] leading-5 text-slate-500">จากเอกสาร: วัสดุ {money(row.materialTotal ?? row.quantity * row.price)} บาท · ค่าแรง/หน่วย {money(row.laborRate ?? (row.quantity ? row.labor / row.quantity : 0))} บาท · รวม {money(row.boqTotal ?? row.quantity * row.price + row.labor)} บาท{row.note ? ` · ${row.note}` : ''}</p> : null}</div><div className="flex items-center gap-1 sm:justify-end"><Button type="button" onClick={() => editBoqItem(row)} aria-label={`แก้ไข ${row.name}`}><Pencil size={13} />แก้ไข</Button><button type="button" aria-label={`ลบ ${row.name || 'รายการ BOQ'}`} title="ลบรายการนี้" className="rounded-lg p-2 text-slate-400 hover:bg-rose-50 hover:text-rose-600" onClick={() => setBoqDraft(boqDraft.filter(value => value.id !== row.id))}><Trash2 size={15} /></button></div></article>)}</div></section>)}</div> : <p className="rounded-xl bg-slate-50 p-5 text-center text-sm text-slate-500">ยังไม่มีรายการ BOQ ก่อสร้าง</p>}
      {boqError ? <p role="alert" className="m-0 text-sm text-rose-700">{boqError}</p> : null}<div className="flex flex-wrap justify-end gap-2"><Button disabled={busy} onClick={() => setBoqOpen(false)}>ยกเลิก</Button><Button type="submit" disabled={busy}>{busy ? 'กำลังบันทึก…' : boqBaseVersion === 'current' ? `บันทึกการแก้ไข · เวอร์ชัน ${asset.boqVersion ?? 1}` : 'บันทึกจากต้นแบบเป็นเวอร์ชันใหม่'}</Button>{boqBaseVersion === 'current' ? <Button variant="primary" type="submit" value="new-version" disabled={busy}>{busy ? 'กำลังบันทึก…' : 'บันทึกเป็นเวอร์ชันใหม่'}</Button> : null}</div></form></Modal>

    <Modal open={Boolean(boqItemDraft)} title={`${boqItemDraft?.originalId ? 'แก้ไข' : 'เพิ่ม'}รายการ BOQ`} description="แก้ไขข้อมูลรายการนี้ในแบบร่าง แล้วตรวจยอดก่อนบันทึก BOQ ทั้งชุด" onClose={() => setBoqItemDraft(null)} className="max-w-2xl">{boqItemDraft ? <form className="space-y-4" onSubmit={saveBoqItem}><div className="grid gap-3 sm:grid-cols-2"><label className={`${label} sm:col-span-2`}>หมวด<input className={field} required maxLength={160} value={boqItemDraft.row.category} onChange={event => setBoqItemDraft({ ...boqItemDraft, row: { ...boqItemDraft.row, category: event.target.value } })} /></label><label className={label}>หมวดย่อย<input className={field} maxLength={160} value={boqItemDraft.row.subcategory ?? ''} onChange={event => setBoqItemDraft({ ...boqItemDraft, row: { ...boqItemDraft.row, subcategory: event.target.value } })} /></label><label className={label}>ชื่อรายการ *<input className={field} required maxLength={300} value={boqItemDraft.row.name} onChange={event => setBoqItemDraft({ ...boqItemDraft, row: { ...boqItemDraft.row, name: event.target.value } })} /></label><label className={label}>จำนวน<input className={field} required type="number" min="0.01" step="0.01" value={boqItemDraft.row.quantity} onChange={event => setBoqItemDraft({ ...boqItemDraft, row: { ...boqItemDraft.row, quantity: Number(event.target.value) } })} /></label><label className={label}>หน่วย<input className={field} required maxLength={40} value={boqItemDraft.row.unit} onChange={event => setBoqItemDraft({ ...boqItemDraft, row: { ...boqItemDraft.row, unit: event.target.value } })} /></label><label className={label}>ค่าวัสดุต่อหน่วย (บาท)<input className={field} type="number" min="0" step="0.01" value={boqItemDraft.row.price} onChange={event => setBoqItemDraft({ ...boqItemDraft, row: { ...boqItemDraft.row, price: Number(event.target.value) } })} /></label><label className={label}>ค่าแรงรวม (บาท)<input className={field} type="number" min="0" step="0.01" value={boqItemDraft.row.labor} onChange={event => setBoqItemDraft({ ...boqItemDraft, row: { ...boqItemDraft.row, labor: Number(event.target.value) } })} /></label><label className={`${label} sm:col-span-2`}>รายละเอียด / สเปก<input className={field} maxLength={1000} value={boqItemDraft.row.spec} onChange={event => setBoqItemDraft({ ...boqItemDraft, row: { ...boqItemDraft.row, spec: event.target.value } })} /></label><label className={`${label} sm:col-span-2`}>หมายเหตุ<input className={field} maxLength={1000} value={boqItemDraft.row.note ?? ''} onChange={event => setBoqItemDraft({ ...boqItemDraft, row: { ...boqItemDraft.row, note: event.target.value } })} /></label></div><p className="m-0 rounded-lg bg-slate-50 p-3 text-sm text-slate-700">รวมรายการ <strong>{money(boqItemDraft.row.quantity * boqItemDraft.row.price + boqItemDraft.row.labor)} บาท</strong></p><div className="flex justify-end gap-2"><Button type="button" onClick={() => setBoqItemDraft(null)}>ยกเลิก</Button><Button type="submit" variant="primary">เพิ่มลงแบบร่าง</Button></div></form> : null}</Modal>

    <Modal open={workOpen} title={`${workDraft && works.some(work => work.id === workDraft.id) ? 'แก้ไขรายการ' : workFlowKind === 'project' ? 'เพิ่มงานต่อเติม / ปรับปรุง' : workFlowKind === 'maintenance' ? 'เพิ่มงานซ่อมบำรุง' : 'เพิ่มรายการบ้าน'} · ${asset.name}`} description={workFlowKind === 'project' ? 'ระบุโครงการ ห้องที่เกี่ยวข้อง และงบต้นทุนปรับปรุง งานนี้จะบันทึกแยกจาก BOQ ก่อสร้างตั้งต้น' : 'เลือกห้องได้หลายห้อง หรือเว้นว่างเพื่อระบุว่าทำทั้งอาคาร'} onClose={() => { if (!busy) { setWorkOpen(false); setWorkDraft(null) } }} className="max-w-2xl">{workDraft ? <form className="space-y-4" onSubmit={saveWork}><div className="grid gap-3 sm:grid-cols-2"><label className={label}>ประเภทงาน<select disabled={workFlowKind !== 'edit'} className={field} value={workDraft.type} onChange={event => { const type = event.target.value as BuildingWorkType; setWorkDraft({ ...workDraft, type, treatment: type === 'repair' ? 'expense' : workDraft.treatment }) }}>{typeList.map(([value, name]) => <option key={value} value={value}>{name}</option>)}</select></label><label className={label}>{workFlowKind === 'project' ? 'ชื่อโครงการ *' : workFlowKind === 'maintenance' ? 'ชื่องานซ่อม *' : 'ชื่องาน *'}<input className={field} required maxLength={300} value={workDraft.name} onChange={event => setWorkDraft({ ...workDraft, name: event.target.value })} placeholder={workFlowKind === 'project' ? 'เช่น ต่อเติมห้องครัว' : workFlowKind === 'maintenance' ? 'เช่น ซ่อมหลังคา' : 'เช่น ทาสีห้องครัว'} /></label><label className={label}>วันที่ *<input className={field} type="date" required max={today()} value={workDraft.date} onChange={event => setWorkDraft({ ...workDraft, date: event.target.value })} /></label><label className={label}>{workFlowKind === 'project' ? 'งบประมาณโครงการ (บาท)' : 'ค่าใช้จ่าย (บาท)'}<input className={field} type="number" min="0" step="0.01" value={workDraft.amount} onChange={event => setWorkDraft({ ...workDraft, amount: Number(event.target.value) })} /></label>
        <fieldset className="rounded-xl border border-slate-200 p-3 sm:col-span-2"><legend className="px-1 text-xs font-medium text-slate-600">ห้องที่เกี่ยวข้อง · เลือกได้หลายห้อง</legend>{asset.rooms.length ? <div className="grid gap-2 sm:grid-cols-3">{asset.rooms.map(room => <label key={room} className="flex items-center gap-2 text-xs text-slate-700"><input type="checkbox" checked={workDraft.roomNames.includes(room)} onChange={event => setWorkDraft({ ...workDraft, roomNames: event.target.checked ? [...workDraft.roomNames, room] : workDraft.roomNames.filter(value => value !== room) })} />{room}</label>)}</div> : <p className="m-0 text-xs text-slate-400">ยังไม่มีห้อง ใช้ขอบเขตทั้งอาคารได้ หรือเพิ่มห้องจากข้อมูลบ้าน</p>}<p className="mb-0 mt-2 text-[11px] text-slate-400">ไม่เลือกห้อง = งานระดับทั้งอาคาร</p></fieldset>
        <label className={label}>บันทึกเป็น<select className={field} value={workDraft.treatment} onChange={event => setWorkDraft({ ...workDraft, treatment: event.target.value as BuildingWork['treatment'] })}><option value="capital">ต้นทุนปรับปรุงสินทรัพย์</option><option value="expense">ซ่อม / บริการ</option></select></label><label className={label}>ผู้รับเหมา / ร้านค้า<input className={field} maxLength={300} value={workDraft.vendor} onChange={event => setWorkDraft({ ...workDraft, vendor: event.target.value })} /></label><label className={label}>ประกันถึงวันที่<input className={field} type="date" value={workDraft.warrantyUntil} onChange={event => setWorkDraft({ ...workDraft, warrantyUntil: event.target.value })} /></label><label className={label}>เลขอ้างอิง / ใบเสร็จ<input className={field} maxLength={150} value={workDraft.reference} onChange={event => setWorkDraft({ ...workDraft, reference: event.target.value })} /></label><label className={`${label} sm:col-span-2`}>หมายเหตุ<textarea className={field} rows={2} maxLength={1000} value={workDraft.notes} onChange={event => setWorkDraft({ ...workDraft, notes: event.target.value })} /></label></div>{workError ? <p role="alert" className="m-0 text-sm text-rose-700">{workError}</p> : null}<div className="flex justify-end gap-2"><Button disabled={busy} onClick={() => { setWorkOpen(false); setWorkDraft(null) }}>ยกเลิก</Button><Button variant="primary" type="submit" disabled={busy}>{busy ? 'กำลังบันทึก…' : 'บันทึกรายการ'}</Button></div></form> : null}</Modal>
  </section>
}
