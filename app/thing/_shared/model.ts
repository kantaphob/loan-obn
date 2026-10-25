export type RatePeriod = { from: number; to: number; rate: number; installment: number; floating: boolean; discount: number }
export type LoanRound = { id: string; name: string; effectiveOn: string; opening: number; months: number; mrr: number; fee: number; referenceInterest: number; notes: string; periods: RatePeriod[] }
export type Payment = { id: string; date: string; amount: number; interest: number; principal: number; reference: string; roundId: string; ledgerEntryId?: number }
export type HomeItem = { id: string; room: string; name: string; size: string; quantity: number; price: number; shop: string; purchasedOn: string; warrantyStart: string; warrantyMonths: number; warrantyUntil: string; notes: string; serial?: string; status?: 'active' | 'repair' | 'removed' | 'sold' | 'retired'; includedInMainCost?: boolean; boqId?: string; events?: { date: string; from: string; to: string; status: string }[] }
export type BoqItem = { id: string; category: string; name: string; spec: string; quantity: number; unit: string; price: number; labor: number; paid: number; vendor: string; reference: string; ledgerEntryId?: number; scope?: 'construction' | 'builtin'; room?: string; replacesId?: string; cancelled?: boolean }
export type Valuation = { id: string; date: string; landValue: number; buildingValue: number; source: string; notes: string }
export type LandPriceType = 'appraisal' | 'official_appraisal' | 'market_appraisal' | 'asking' | 'sale'
export type LandDevelopmentType = 'site_clearing' | 'fill_compaction' | 'wall_fence' | 'gate' | 'road_concrete' | 'permanent_garage' | 'drainage' | 'utilities' | 'landscape' | 'planted_tree' | 'garden_light' | 'other'
export type LandMobility = 'fixed_to_land' | 'fixed_to_building' | 'detachable' | 'movable'
export type LandDevelopmentStatus = 'planned' | 'in_progress' | 'completed' | 'maintenance' | 'retired'
export type LandDevelopmentBoqLine = { id: string; name: string; specification: string; quantity: number; unit: string; materialCost: number; laborCost: number; paid: number; vendor: string; reference: string }
export type LandMaintenanceRecord = { id: string; date: string; description: string; cost: number; vendor: string; reference: string }
export type LandDevelopmentPayment = { id: string; ledgerEntryId: number; date: string; amount: number; direction?: 'IN' | 'OUT'; type: 'deposit' | 'progress' | 'final' | 'maintenance' | 'refund'; reference: string; note: string }
export type LandDevelopmentMaterial = { id: string; name: string; quantity: number; unit: string; unitPrice: number }
export type LandDevelopmentDocumentReference = { id: string; name: string; reference: string }
export type LandDevelopment = { id: string; name: string; type: LandDevelopmentType; mobility: LandMobility; status: LandDevelopmentStatus | 'approved' | 'cancelled'; treatment: 'capital' | 'expense'; costMethod: 'contract_lump_sum' | 'labor_plus_materials' | 'materials_self'; pricingMode: 'quantity' | 'lump_sum'; description: string; quantity: number; unit: string; unitPrice: number; lumpSum: number; laborCost: number; contractPrice: number; laborAmount: number; materials: LandDevelopmentMaterial[]; areaRai: number; areaNgan: number; areaSquareWah: number; fillHeightMeters: number; areaSquareMeters: number; lengthMeters: number; heightMeters: number; depthMeters: number; volumeCubicMeters: number; budget: number; actualCost: number; recognizedAssetValue: number; resultingAssetId: string; vendor: string; reference: string; documentRefs: LandDevelopmentDocumentReference[]; startedOn: string; completedOn: string; warrantyUntil: string; beforePhotoRef: string; afterPhotoRef: string; boq: LandDevelopmentBoqLine[]; maintenance: LandMaintenanceRecord[]; payments: LandDevelopmentPayment[] }
export type LandDetails = { deedNumber: string; areaSquareWa: number; valuationOn: string; valuationSource: string; titleType?: string; parcelNo?: string; surveyNo?: string; mapSheet?: string; mapScale?: string; titleBook?: string; titlePage?: string; village?: string; moo?: string; subdistrict?: string; district?: string; province?: string; postalCode?: string; landOffice?: string; latitude?: number; longitude?: number; landUse?: string; zoning?: string; roadAccess?: string; utilitiesNotes?: string; notes?: string; annualGrowthRate?: number; projectionYears?: number; priceType?: LandPriceType; priceNotes?: string; priceHistory?: { amount: number; date: string; source: string; type: LandPriceType; notes: string }[] }
export type Home = { id: string; assetCode?: string; categoryCode: string; kind: 'house' | 'vehicle' | 'other'; costSource: 'manual' | 'boq'; financing: 'cash' | 'loan'; name: string; address: string; purchasePrice: number; purchasedOn: string; landValue: number; buildingValue: number; rooms: string[]; items: HomeItem[]; boq: BoqItem[]; valuations?: Valuation[]; archivedOn?: string; vehicleType?: 'car' | 'pickup' | 'sedan' | 'other'; landDetails?: LandDetails; landDevelopments?: LandDevelopment[] }
export type BankLoan = { id: string; assetId: string | null; bank: string; name: string; accountNumber: string; rounds: LoanRound[]; payments: Payment[] }
export const propertyTypes = { RESIDENTIAL: 'ที่อยู่อาศัย', COMMERCIAL: 'พาณิชยกรรม', INDUSTRIAL: 'อุตสาหกรรม', AGRICULTURAL: 'เกษตรกรรม', LAND_ONLY: 'ที่ดินเปล่า', MIXED_USE: 'ใช้ประโยชน์ผสม', OTHER: 'อื่น ๆ' } as const
export const propertyStatuses = { PLANNING: 'วางแผน', DEVELOPING: 'กำลังพัฒนา', ACTIVE: 'ใช้งาน', INACTIVE: 'พักใช้งาน', DISPOSED: 'จำหน่ายแล้ว' } as const
export const propertyAddressFields = { houseNumber: 'บ้านเลขที่', moo: 'หมู่', village: 'หมู่บ้าน', subdistrict: 'ตำบล / แขวง', district: 'อำเภอ / เขต', province: 'จังหวัด', postalCode: 'รหัสไปรษณีย์', description: 'รายละเอียดเพิ่มเติม' } as const
export type Property = { id: string; code: string; name: string; assetIds?: string[]; landId?: string; buildingId?: string; type?: keyof typeof propertyTypes; status?: keyof typeof propertyStatuses; latitude?: number; longitude?: number } & Partial<Record<keyof typeof propertyAddressFields, string>>
/** Legacy one-land/one-building snapshots remain readable without rewriting their history. */
export function propertyAssetIds(property: Property): string[] {
  return property.assetIds ?? [property.landId, property.buildingId].filter((id): id is string => typeof id === 'string')
}
export function propertyTotalCost(property: Property, homes: Home[]) {
  return roundMoney(propertyAssetIds(property).reduce((sum, id) => {
    const asset = homes.find(home => home.id === id)
    if (!asset) throw new Error('ไม่พบสินทรัพย์ที่เชื่อมกับ PROPERTY')
    return sum + assetCosts(asset).total
  }, 0))
}
export type AssetData = { version: 2; revision: number; homes: Home[]; loans: BankLoan[]; properties?: Property[] }
export type LedgerOption = { id: number; occurredOn: string; amountSatang: number; reference: string; note: string; categoryName: string; direction?: string }
export const money = (n: number) => n.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
export const roundMoney = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100
export const today = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Bangkok', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date())
export function newHome(name: string, kind: Home['kind'] = 'house'): Home {
  return { id: crypto.randomUUID(), costSource: 'manual', categoryCode: kind === 'house' ? 'BUILDINGS' : kind === 'vehicle' ? 'VEHICLES' : '', kind, financing: kind === 'house' ? 'loan' : 'cash', name, address: '', purchasePrice: 0, purchasedOn: '', landValue: 0, buildingValue: 0, rooms: kind === 'vehicle' ? ['ตกแต่ง', 'บำรุงรักษา', 'อุปกรณ์เสริม'] : [], items: [], boq: [] }
}
export function initialData(): AssetData {
  const home = newHome('บ้านของฉัน')
  home.landValue = 400000
  home.rooms = ['ห้องนอน', 'ห้องนั่งเล่น', 'ห้องครัว', 'ห้องน้ำ', 'ส่วนกลาง']
  const loan: BankLoan = { id: crypto.randomUUID(), assetId: home.id, bank: 'ธนาคารอาคารสงเคราะห์', name: 'เงินกู้บ้าน GHB', accountNumber: '', payments: [], rounds: [{ id: 'original', name: 'สัญญาเริ่มต้น · GHB', effectiveOn: '', opening: 2600000, months: 480, mrr: 6.145, fee: 0, referenceInterest: 5413070, notes: 'ข้อมูลสัญญาอ้างอิงจากเจ้าของบ้าน กรุณาระบุวันที่เริ่มมีผลก่อนบันทึกชำระ', periods: [
    { from: 1, to: 3, rate: .73, installment: 7100, floating: false, discount: 0 },
    { from: 4, to: 9, rate: 1.73, installment: 8300, floating: false, discount: 0 },
    { from: 10, to: 24, rate: 2.73, installment: 11100, floating: false, discount: 0 },
    { from: 25, to: 72, rate: 3.73, installment: 12600, floating: false, discount: 0 },
    { from: 73, to: 480, rate: 5.145, installment: 12600, floating: false, discount: 0 },
  ] }] }
  return { version: 2, revision: 0, homes: [home], loans: [loan] }
}
export function balance(home: Pick<BankLoan, 'payments'>, loanRound: LoanRound) {
  return roundMoney(loanRound.opening - home.payments.filter(p => p.roundId === loanRound.id).reduce((s, p) => s + p.principal, 0))
}
export function forecast(loanRound: LoanRound, opening = loanRound.opening, extra = 0, startMonth = 1) {
  let remaining = opening
  const rows: { month: number; opening: number; rate: number; interest: number; payment: number; principal: number; remaining: number }[] = []
  for (let month = startMonth; month <= loanRound.months && remaining > 0; month++) {
    const period = loanRound.periods.find(p => month >= p.from && month <= p.to)
    if (!period) break
    const rate = period.floating ? Math.max(0, loanRound.mrr - period.discount) : period.rate
    const interest = roundMoney(remaining * rate / 1200)
    const payment = roundMoney(Math.min(remaining + interest, period.installment + extra))
    const principal = roundMoney(payment - interest)
    const openingBalance = remaining
    remaining = roundMoney(remaining - principal)
    rows.push({ month, opening: openingBalance, rate, interest, payment, principal, remaining })
    if (principal <= 0) break
  }
  return { rows, remaining, totalInterest: roundMoney(rows.reduce((sum, r) => sum + r.interest, 0)) }
}
export function parseCsv(text: string): string[][] {
  const rows: string[][] = []; let row: string[] = []; let cell = ''; let quoted = false
  text = text.replace(/^\uFEFF/, '')
  for (let i = 0; i < text.length; i++) {
    const c = text[i]
    if (c === '"') { if (quoted && text[i + 1] === '"') { cell += '"'; i++ } else quoted = !quoted }
    else if (c === ',' && !quoted) { row.push(cell); cell = '' }
    else if ((c === '\n' || c === '\r') && !quoted) { if (c === '\r' && text[i + 1] === '\n') i++; row.push(cell); rows.push(row); row = []; cell = '' }
    else cell += c
  }
  if (quoted) throw new Error('CSV มีเครื่องหมายคำพูดไม่ครบ')
  if (cell || row.length) { row.push(cell); rows.push(row) }
  return rows
}
export function ghbPayments(text: string) {
  const rows = parseCsv(text)
  const header = rows.findIndex(r => r.includes('ยอดชำระ') && r.includes('ตัดเงินต้น'))
  if (header < 0) throw new Error('ไม่พบหัวตารางยอดชำระและตัดเงินต้นในไฟล์ GHB')
  const h = rows[header]
  for (const label of ['ยอดชำระ', 'ดอกเบี้ยต่องวด', 'ตัดเงินต้น', 'งวดที่', 'วันเดือนปี']) if (!h.includes(label)) throw new Error(`ไม่พบคอลัมน์ ${label}`)
  const number = (row: string[], label: string) => {
    const raw = (row[h.indexOf(label)] ?? '').replaceAll(',', '').trim()
    if (!raw || !Number.isFinite(Number(raw))) throw new Error(`ยอด ${label} ไม่ครบหรือไม่ใช่ตัวเลข`)
    return Number(raw)
  }
  return rows.slice(header + 1).filter(r => (r[h.indexOf('ยอดชำระ')] ?? '').trim() !== '' && number(r, 'ยอดชำระ') > 0).map(r => ({
    date: r[h.indexOf('วันเดือนปี')] ?? '', amount: number(r, 'ยอดชำระ'), interest: number(r, 'ดอกเบี้ยต่องวด'), principal: number(r, 'ตัดเงินต้น'), reference: `GHB งวด ${r[h.indexOf('งวดที่')]}`,
  }))
}

export function assetCosts(home: Home) {
  const boq = roundMoney(home.boq.filter(row => !row.cancelled).reduce((sum, row) => sum + row.quantity * row.price + row.labor, 0))
  const additions = roundMoney(home.items.filter(row => !['removed', 'sold', 'retired'].includes(row.status ?? '') && !row.includedInMainCost && !(home.costSource === 'boq' && row.boqId && home.boq.some(b => b.id === row.boqId && !b.cancelled))).reduce((sum, row) => sum + row.quantity * row.price, 0))
  const main = home.costSource === 'boq' ? boq : home.purchasePrice
  return { main, boq, additions, total: roundMoney(main + additions) }
}
/** A property is a grouping only. Its cost always comes from its source assets. */
export function propertyCosts(property: Property, homes: Home[]) {
  const land = homes.find(home => home.id === property.landId)
  const building = homes.find(home => home.id === property.buildingId)
  if (!land || !building) throw new Error('ไม่พบที่ดินหรือบ้านที่เชื่อมกับ PROPERTY')
  return { land: assetCosts(land).total, building: assetCosts(building).total, total: roundMoney(assetCosts(land).total + assetCosts(building).total) }
}
export function activeRound(loan: BankLoan, asOf = today()) {
  return loan.rounds.filter(r => !r.effectiveOn || r.effectiveOn <= asOf).at(-1)
}
export function outstanding(loan: BankLoan, asOf = today()) {
  const round = activeRound(loan, asOf)
  return round ? balance({ payments: loan.payments.filter(p => p.date <= asOf) }, round) : 0
}
export function migrateAssetData(input: unknown): AssetData {
  const data = structuredClone(input) as AssetData & { version: number }
  if (!data || !Array.isArray(data.homes)) throw new Error('ไฟล์สินทรัพย์ไม่ถูกต้อง')
  if (Number(data.version) === 1) {
    data.loans = []
    for (const home of data.homes) {
      const legacy = home as Home & { rounds?: LoanRound[]; payments?: Payment[] }
      if (legacy.rounds?.length) data.loans.push({ id: `loan-${home.id}`, assetId: home.id, bank: 'ธนาคารเดิม', name: `เงินกู้ ${home.name}`, accountNumber: '', rounds: legacy.rounds, payments: legacy.payments ?? [] })
      delete legacy.rounds; delete legacy.payments
    }
    data.version = 2
  }
  for (const home of data.homes) {
    home.categoryCode ??= home.kind === 'house' ? 'BUILDINGS' : home.kind === 'vehicle' ? 'VEHICLES' : ''
    home.costSource ??= 'manual'
    const legacyHome = home as Home & { landImprovements?: LandDevelopment[] }
    home.landDevelopments ??= legacyHome.landImprovements
    delete legacyHome.landImprovements
    home.landDevelopments = (home.landDevelopments ?? []).map((work) => {
      const legacy = work as unknown as Record<string, unknown>
      const oldDocs = legacy.documentRefs
      return { ...legacy, treatment: legacy.treatment === 'expense' ? 'expense' : 'capital', costMethod: 'contract_lump_sum', contractPrice: Number(legacy.contractPrice ?? legacy.budget ?? 0), laborAmount: Number(legacy.laborAmount ?? 0), materials: Array.isArray(legacy.materials) ? legacy.materials : [], areaRai: Number(legacy.areaRai ?? 0), areaNgan: Number(legacy.areaNgan ?? 0), areaSquareWah: Number(legacy.areaSquareWah ?? 0), fillHeightMeters: Number(legacy.fillHeightMeters ?? 0), pricingMode: legacy.pricingMode === 'quantity' ? 'quantity' : 'lump_sum', unitPrice: Number(legacy.unitPrice ?? 0), lumpSum: Number(legacy.lumpSum ?? legacy.budget ?? 0), laborCost: Number(legacy.laborCost ?? 0), recognizedAssetValue: Number(legacy.recognizedAssetValue ?? 0), resultingAssetId: String(legacy.resultingAssetId ?? ''), documentRefs: Array.isArray(oldDocs) ? oldDocs : typeof oldDocs === 'string' && oldDocs ? oldDocs.split('\n').filter(Boolean).map((reference, index) => ({ id: `legacy-doc-${index}`, name: 'เอกสารเดิม', reference })) : [], payments: Array.isArray(legacy.payments) ? legacy.payments : [] } as LandDevelopment
    })
  }
  for (const loan of data.loans ?? []) for (const round of loan.rounds) round.referenceInterest ??= 0
  return data
}
