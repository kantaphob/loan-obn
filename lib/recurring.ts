import { ledgerAmount } from './ledger'

export type RecurringInput = {
  assetId?: string;
  id?: number; name: string; direction: string; amount: string; frequency: string;
  dueDay: string; dueMonth: string; startMonth: string; note: string
}
export function validMonth(value: string) {
  return typeof value === 'string' && /^(19|20|21)\d{2}-(0[1-9]|1[0-2])$/.test(value)
}
export function recurringData(input: RecurringInput) {
  if (!input || typeof input.name !== 'string' || !input.name.trim() || input.name.length > 150) throw new Error('กรุณาระบุชื่อรายการไม่เกิน 150 ตัวอักษร')
  if (!['IN', 'OUT'].includes(input.direction) || !['MONTHLY', 'YEARLY'].includes(input.frequency)) throw new Error('ประเภทหรือรอบรายการไม่ถูกต้อง')
  if (!validMonth(input.startMonth)) throw new Error('กรุณาระบุเดือนที่เริ่มวางแผน')
  const optional = (value: string, max: number) => {
    if (value === '') return null
    if (typeof value !== 'string' || !/^\d{1,2}$/.test(value) || Number(value) < 1 || Number(value) > max) throw new Error('วันหรือเดือนครบกำหนดไม่ถูกต้อง')
    return Number(value)
  }
  if (typeof input.note !== 'string' || input.note.length > 1000) throw new Error('หมายเหตุยาวเกินกำหนด')
  return { name: input.name.trim(), direction: input.direction, amountSatang: ledgerAmount(input.amount), frequency: input.frequency, dueDay: optional(input.dueDay, 31), dueMonth: input.frequency === 'YEARLY' ? optional(input.dueMonth, 12) : null, startMonth: input.startMonth, note: input.note.trim() }
}
export function recurringPeriod(item: { frequency: string }, month: string) {
  if (!validMonth(month)) throw new Error('งวดเดือนไม่ถูกต้อง')
  return item.frequency === 'YEARLY' ? month.slice(0, 4) : month
}
export function recurringDue(item: { dueDay: number | null; dueMonth: number | null; frequency: string }, month: string) {
  if (!validMonth(month)) throw new Error('งวดเดือนไม่ถูกต้อง')
  if (!item.dueDay || (item.frequency === 'YEARLY' && !item.dueMonth)) return null
  const year = Number(month.slice(0, 4)), m = item.frequency === 'YEARLY' ? item.dueMonth! : Number(month.slice(5))
  const day = Math.min(item.dueDay, new Date(Date.UTC(year, m, 0)).getUTCDate())
  return `${year}-${String(m).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}
export function recurringInMonth(item: { frequency: string; dueMonth: number | null; startMonth: string }, month: string) {
  return item.startMonth <= month && (item.frequency === 'MONTHLY' || item.dueMonth === Number(month.slice(5)))
}
