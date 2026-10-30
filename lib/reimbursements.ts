import { ledgerAmount, validLedgerDate } from './ledger'
export type ExpenseLineInput = { description: string; categoryCode: string; amount: string; vendor: string }
export type ClaimInput = { requestKey: string; claimantId: number; payerId: number; spentOn: string; title: string; note: string; lines: ExpenseLineInput[] }
export type ClaimLine = { description: string; categoryCode: string; categoryName: string; amountSatang: number; vendor: string }
export type VoucherInput = { requestKey: string; allocations: { claimId: number; amount: string }[]; existingKey?: string; paidOn: string; channelCode: string; reference: string; note: string }
export const claimCode = (id: number, date: string) => `CLM-${date.slice(0, 4)}-${String(id).padStart(6, '0')}`
export const voucherCode = (id: number, date: string) => `PV-${date.slice(0, 4)}-${String(id).padStart(6, '0')}`
export function personLabel(person: { nickname: string; firstName: string; lastName: string }) {
  const alias = person.firstName === 'ศุภกิจ' ? 'K.OHM' : person.firstName === 'โอบนิธิ' ? 'K.OB' : person.nickname
  return `${alias} · ${[person.firstName, person.lastName].filter(Boolean).join(' ') || person.nickname}`
}
export function requestKey(value: string) { if (typeof value !== 'string' || !/^[a-f0-9-]{36}$/i.test(value)) throw new Error('รหัสคำขอไม่ถูกต้อง กรุณาเปิดฟอร์มใหม่') }
export function shortText(value: string, label: string, max: number, required = false) {
  if (typeof value !== 'string' || value.length > max || (required && !value.trim())) throw new Error(`กรุณาระบุ${label}ให้ถูกต้อง ไม่เกิน ${max} ตัวอักษร`)
  return value.trim()
}
export function claimLines(input: ClaimInput) {
  requestKey(input.requestKey)
  if (!Number.isSafeInteger(input.claimantId) || !Number.isSafeInteger(input.payerId) || input.claimantId <= 0 || input.payerId <= 0 || input.claimantId === input.payerId) throw new Error('ผู้สำรองจ่ายและผู้คืนเงินต้องเป็นคนละคน')
  if (!validLedgerDate(input.spentOn)) throw new Error('วันที่สำรองจ่ายไม่ถูกต้องหรืออยู่ในอนาคต')
  shortText(input.title, 'หัวข้อใบเบิก', 200, true); shortText(input.note, 'หมายเหตุ', 1000)
  if (!Array.isArray(input.lines) || !input.lines.length || input.lines.length > 30) throw new Error('ใบเบิกต้องมี 1–30 รายการ')
  const lines = input.lines.map(l => ({ description: shortText(l.description, 'ชื่อรายการ', 200, true), vendor: shortText(l.vendor, 'ร้านค้า', 200), categoryCode: shortText(l.categoryCode, 'หมวดค่าใช้จ่าย', 100, true), amountSatang: ledgerAmount(l.amount) }))
  const total = lines.reduce((sum, l) => sum + l.amountSatang, 0)
  if (!Number.isSafeInteger(total) || total > 200_000_000_000) throw new Error('ยอดรวมเกินขอบเขตที่รองรับ')
  return { lines, total }
}
export function allocations(input: VoucherInput) {
  requestKey(input.requestKey); shortText(input.note, 'หมายเหตุ', 1000); shortText(input.reference, 'เลขอ้างอิง', 150)
  if (!Array.isArray(input.allocations) || !input.allocations.length || input.allocations.length > 30) throw new Error('เลือกใบเบิก 1–30 ใบต่อการคืนเงิน')
  const ids = new Set<number>()
  const rows = input.allocations.map(a => {
    if (!Number.isSafeInteger(a.claimId) || a.claimId <= 0 || ids.has(a.claimId)) throw new Error('ใบเบิกซ้ำหรือไม่ถูกต้อง')
    ids.add(a.claimId); return { claimId: a.claimId, amountSatang: ledgerAmount(a.amount) }
  }).sort((a, b) => a.claimId - b.claimId)
  const total = rows.reduce((s, a) => s + a.amountSatang, 0)
  if (!Number.isSafeInteger(total) || total > 200_000_000_000) throw new Error('ยอดคืนเงินเกินขอบเขตที่รองรับ')
  return { rows, total }
}
export function reimbursementBalance(amount: number, paid: number) {
  if (!Number.isSafeInteger(amount) || !Number.isSafeInteger(paid) || paid < 0 || paid > amount) throw new Error('ยอดเบิกคืนไม่สัมพันธ์กัน กรุณาตรวจสอบ')
  return { paid, remaining: amount - paid, status: paid === amount ? 'PAID' : paid ? 'PARTIAL' : 'PENDING' }
}
