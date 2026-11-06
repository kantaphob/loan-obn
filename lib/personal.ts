export const personalCategories = { FINANCE: 'รายรับ–รายจ่าย', GURUACADEMY: 'guruacademy', EXAMGURUPOLICE: 'examgurupolice' }
export const personalStatuses = { PLANNED: 'ตั้งใจทำ', ACTIVE: 'กำลังดำเนินการ', DONE: 'สำเร็จแล้ว', CANCELLED: 'ยกเลิก' }
export function personalAmount(value: string) {
  if (!/^\d{1,8}(\.\d{1,2})?$/.test(value)) throw new Error('จำนวนเงินต้องไม่ติดลบและมีทศนิยมไม่เกิน 2 ตำแหน่ง')
  const amount = Math.round(Number(value) * 100)
  if (amount > 2_000_000_000) throw new Error('จำนวนเงินเกินขอบเขตที่รองรับ')
  return amount
}
export function personalDate(value: string) {
  if (value && (!/^\d{4}-\d{2}-\d{2}$/.test(value) || !Number.isFinite(Date.parse(value)) || new Date(value).toISOString().slice(0, 10) !== value)) throw new Error('วันที่ไม่ถูกต้อง')
  return value
}
export function personalSummary(plans: { category: string; status: string; budgetSatang: number; expenses: { amountSatang: number; direction: string; voidedAt: unknown }[] }[]) {
  return Object.entries(personalCategories).map(([key, label]) => {
    const entries = plans.filter(p => p.category === key && p.status !== 'CANCELLED')
    const budget = entries.reduce((s, p) => s + p.budgetSatang, 0)
    const spent = entries.reduce((s, p) => s + p.expenses.filter(e => e.direction === 'OUT' && !e.voidedAt).reduce((a, e) => a + e.amountSatang, 0), 0)
    const needed = entries.filter(p => p.status !== 'DONE').reduce((s, p) => s + Math.max(0, p.budgetSatang - p.expenses.filter(e => e.direction === 'OUT' && !e.voidedAt).reduce((a, e) => a + e.amountSatang, 0)), 0)
    return { key, label, budget, spent, needed }
  })
}
