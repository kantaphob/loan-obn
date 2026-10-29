export const incomeFields = [
  ['salary', 'เงินเดือน'], ['position', 'ค่าตำแหน่ง'], ['attendance', 'เบี้ยขยัน'],
  ['ot', 'OT'], ['commission', 'คอมมิชชัน'], ['incentive', 'Incentive'],
  ['phone', 'ค่ามือถือ'], ['travel', 'ค่าเดินทาง'], ['reimbursement', 'เงินเบิกคืนค่าใช้จ่าย'],
] as const
export const deductionFields = [
  ['socialSecurity', 'ประกันสังคม'], ['withholdingTax', 'ภาษีหัก ณ ที่จ่าย'],
  ['guarantee', 'เงินค้ำประกัน'], ['other', 'เงินหักอื่น ๆ'],
] as const
export type PayrollValues = Record<string, string>
export type PayrollItem = { id: string; label: string; type: 'INCOME' | 'DEDUCTION'; amount: string }
export type PayrollInput = { id?: number; month: string; employer: string; note: string; values: PayrollValues; customItems?: PayrollItem[]; hiddenFields?: string[] }
export function payrollReceiptWindow(month: string) {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) throw new Error('งวดเดือนไม่ถูกต้อง')
  const [year, number] = month.split('-').map(Number)
  const end = Date.UTC(year, number, 0)
  return { startOn: new Date(end - 5 * 86400000).toISOString().slice(0, 10), endOn: new Date(end + 5 * 86400000).toISOString().slice(0, 10) }
}
export function payrollTotals(values: PayrollValues, customItems: PayrollItem[] = [], hiddenFields: string[] = []) {
  const amount = (value: string) => {
    if (typeof value !== 'string' || (value !== '' && !/^\d{1,10}(?:\.\d{1,2})?$/.test(value))) throw new Error('จำนวนเงินต้องไม่ติดลบและมีทศนิยมไม่เกิน 2 ตำแหน่ง')
    const satang = value === '' ? 0 : Math.round(Number(value) * 100)
    if (!Number.isSafeInteger(satang) || satang > 200_000_000_000) throw new Error('ยอดเงินเกินขอบเขตที่รองรับ')
    return satang
  }
  if (!Array.isArray(customItems) || customItems.length > 50 || !Array.isArray(hiddenFields) || hiddenFields.some(key => ![...incomeFields, ...deductionFields].some(([id]) => id === key))) throw new Error('หัวข้อเงินได้–เงินหักไม่ถูกต้อง หรือเกิน 50 รายการเพิ่มเติม')
  const amounts = Object.fromEntries([...incomeFields, ...deductionFields].map(([key]) => [key, hiddenFields.includes(key) ? 0 : amount(values[key] ?? '')]))
  const ids = new Set<string>()
  const items = customItems.map(item => {
    if (!item || typeof item.id !== 'string' || !/^[a-zA-Z0-9-]{1,64}$/.test(item.id) || ids.has(item.id) || typeof item.label !== 'string' || item.label.length > 100 || !['INCOME', 'DEDUCTION'].includes(item.type)) throw new Error('ข้อมูลหัวข้อเพิ่มเติมไม่ถูกต้อง')
    ids.add(item.id)
    return { ...item, amountSatang: amount(item.amount) }
  })
  const gross = incomeFields.reduce((sum, [key]) => sum + amounts[key], 0) + items.filter(i => i.type === 'INCOME').reduce((sum, i) => sum + i.amountSatang, 0)
  const deductions = deductionFields.reduce((sum, [key]) => sum + amounts[key], 0) + items.filter(i => i.type === 'DEDUCTION').reduce((sum, i) => sum + i.amountSatang, 0)
  return { amounts, gross, deductions, net: gross - deductions }
}
export function validatePayroll(input: PayrollInput) {
  if (!input || !/^\d{4}-(0[1-9]|1[0-2])$/.test(input.month) || input.month < '1900-01' || input.month > '2200-12') throw new Error('กรุณาระบุงวดเดือนให้ถูกต้อง')
  if (typeof input.employer !== 'string' || !input.employer.trim() || input.employer.length > 200) throw new Error('กรุณาระบุนายจ้าง / แหล่งรายได้ ไม่เกิน 200 ตัวอักษร')
  if (typeof input.note !== 'string' || input.note.length > 1000 || !input.values || typeof input.values !== 'object') throw new Error('ข้อมูลเงินเดือนไม่ถูกต้อง')
  const totals = payrollTotals(input.values, input.customItems, input.hiddenFields)
  if (input.customItems?.some(item => !item.label.trim())) throw new Error('กรุณาระบุชื่อหัวข้อเพิ่มเติมให้ครบ')
  if (totals.gross <= 0 || totals.net < 0 || totals.net > 200_000_000_000) throw new Error('เงินได้ต้องมากกว่า 0 และยอดสุทธิต้องไม่ติดลบหรือเกินขอบเขต')
  return totals
}

export function parsePayrollDetails(json: string) {
  const data = JSON.parse(json)
  // Earlier records stored only the standard amounts.
  return { amounts: (data.amounts ?? data) as Record<string, number>, customItems: (data.customItems ?? []) as PayrollItem[], hiddenFields: (data.hiddenFields ?? []) as string[] }
}
