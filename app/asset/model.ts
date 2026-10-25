export type RatePeriod = { from: number; to: number; rate: number; installment: number; floating: boolean; discount: number }
export type LoanRound = { id: string; name: string; effectiveOn: string; opening: number; months: number; mrr: number; fee: number; referenceInterest: number; notes: string; periods: RatePeriod[] }
export type Payment = { id: string; date: string; amount: number; interest: number; principal: number; reference: string; roundId: string }
export type HomeItem = { id: string; room: string; name: string; size: string; quantity: number; price: number; shop: string; purchasedOn: string; warrantyStart: string; warrantyMonths: number; warrantyUntil: string; notes: string }
export type BoqItem = { id: string; category: string; name: string; spec: string; quantity: number; unit: string; price: number; labor: number; paid: number; vendor: string; reference: string }
export type Home = { id: string; kind: 'house' | 'vehicle' | 'other'; financing: 'cash' | 'loan'; name: string; address: string; purchasePrice: number; purchasedOn: string; landValue: number; buildingValue: number; rooms: string[]; items: HomeItem[]; boq: BoqItem[]; rounds: LoanRound[]; payments: Payment[] }
export type AssetData = { version: 1; revision: number; homes: Home[] }
export const money = (n: number) => n.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
export const roundMoney = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100
export const today = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Bangkok', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date())
export function newHome(name: string, kind: Home['kind'] = 'house'): Home {
  return { id: crypto.randomUUID(), kind, financing: kind === 'house' ? 'loan' : 'cash', name, address: '', purchasePrice: 0, purchasedOn: '', landValue: 0, buildingValue: 0, rooms: kind === 'vehicle' ? ['ตกแต่ง', 'บำรุงรักษา', 'อุปกรณ์เสริม'] : [], items: [], boq: [], rounds: [], payments: [] }
}
export function initialData(): AssetData {
  const home = newHome('บ้านของฉัน')
  home.landValue = 400000
  home.rooms = ['ห้องนอน', 'ห้องนั่งเล่น', 'ห้องครัว', 'ห้องน้ำ', 'ส่วนกลาง']
  home.rounds = [{ id: 'original', name: 'สัญญาเริ่มต้น · GHB', effectiveOn: '', opening: 2600000, months: 480, mrr: 6.145, fee: 0, referenceInterest: 5413070, notes: 'ข้อมูลสัญญาอ้างอิงจากเจ้าของบ้าน กรุณาระบุวันที่เริ่มมีผลก่อนบันทึกชำระ', periods: [
    { from: 1, to: 3, rate: .73, installment: 7100, floating: false, discount: 0 },
    { from: 4, to: 9, rate: 1.73, installment: 8300, floating: false, discount: 0 },
    { from: 10, to: 24, rate: 2.73, installment: 11100, floating: false, discount: 0 },
    { from: 25, to: 72, rate: 3.73, installment: 12600, floating: false, discount: 0 },
    { from: 73, to: 480, rate: 5.145, installment: 12600, floating: false, discount: 0 },
  ] }]
  return { version: 1, revision: 0, homes: [home] }
}
export function balance(home: Home, loanRound: LoanRound) {
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
