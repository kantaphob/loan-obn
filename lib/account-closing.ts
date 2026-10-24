export type EquityTarget = 'RETAINED_EARNINGS' | 'CAPITAL'
export type ClosingBalance = { code: string; name: string; type: 'REVENUE' | 'EXPENSE' | 'DRAWING' | 'DIVIDEND'; amount: string }
export type ClosingLine = { code: string; name: string; debit: number; credit: number; step?: number }
export const closingSteps = ['ปิดรายได้เข้าสรุปผลกำไรขาดทุน', 'ปิดค่าใช้จ่ายเข้าสรุปผลกำไรขาดทุน', 'โอนผลกำไรขาดทุนเข้าทุนหรือกำไรสะสม', 'ปิดถอนใช้ส่วนตัวหรือเงินปันผล']
export function closingJournal(input: ClosingBalance[], equity: EquityTarget = 'RETAINED_EARNINGS', options: { allowEmpty?: boolean } = {}) {
  if (!['RETAINED_EARNINGS', 'CAPITAL'].includes(equity)) throw new Error('กรุณาเลือกบัญชีทุนหรือกำไรสะสมให้ถูกต้อง')
  if (!Array.isArray(input) || (input.length < 1 && !options.allowEmpty) || input.length > 100) throw new Error('กรุณาระบุยอดบัญชี 1–100 รายการ')
  const codes = new Set<string>()
  const balances = input.map(row => {
    if (!row || typeof row.code !== 'string' || !/^[A-Za-z0-9_-]{1,30}$/.test(row.code) || ['RETAINED_EARNINGS', 'CAPITAL', 'INCOME_SUMMARY'].includes(row.code.toUpperCase()) || codes.has(row.code.toUpperCase())) throw new Error('รหัสบัญชีไม่ถูกต้อง ซ้ำกัน หรือเป็นรหัสสงวน')
    codes.add(row.code.toUpperCase())
    if (typeof row.name !== 'string' || !row.name.trim() || row.name.length > 150 || !['REVENUE', 'EXPENSE', 'DRAWING', 'DIVIDEND'].includes(row.type)) throw new Error('ชื่อหรือประเภทบัญชีไม่ถูกต้อง')
    if ((row.type === 'DRAWING' && equity !== 'CAPITAL') || (row.type === 'DIVIDEND' && equity !== 'RETAINED_EARNINGS')) throw new Error('ถอนใช้ส่วนตัวต้องปิดเข้าทุน และเงินปันผลต้องปิดเข้ากำไรสะสม')
    if (typeof row.amount !== 'string' || !/^\d+(\.\d{1,2})?$/.test(row.amount)) throw new Error('ยอดบัญชีต้องเป็นจำนวนบวก ทศนิยมไม่เกิน 2 ตำแหน่ง')
    const amount = Math.round(Number(row.amount) * 100)
    if (!Number.isSafeInteger(amount) || amount <= 0 || amount > 200_000_000_000) throw new Error('ยอดบัญชีต้องมากกว่า 0 และไม่เกิน 2,000,000,000 บาท')
    return { ...row, name: row.name.trim(), satang: amount }
  })
  const lines: ClosingLine[] = []
  const summary = { code: 'INCOME_SUMMARY', name: 'สรุปผลกำไรขาดทุน (Income Summary)' }
  const target = { code: equity, name: equity === 'CAPITAL' ? 'ทุน' : 'กำไรสะสม' }
  const revenues = balances.filter(row => row.type === 'REVENUE')
  const expenses = balances.filter(row => row.type === 'EXPENSE')
  const distributions = balances.filter(row => ['DRAWING', 'DIVIDEND'].includes(row.type))
  const revenue = revenues.reduce((s, row) => s + row.satang, 0)
  const expense = expenses.reduce((s, row) => s + row.satang, 0)
  const distributed = distributions.reduce((s, row) => s + row.satang, 0)
  if (revenue) {
    lines.push(...revenues.map(row => ({ code: row.code, name: row.name, debit: row.satang, credit: 0, step: 1 })))
    lines.push({ ...summary, debit: 0, credit: revenue, step: 1 })
  }
  if (expense) {
    lines.push({ ...summary, debit: expense, credit: 0, step: 2 })
    lines.push(...expenses.map(row => ({ code: row.code, name: row.name, debit: 0, credit: row.satang, step: 2 })))
  }
  const profit = revenue - expense
  if (profit) {
    lines.push({ ...summary, debit: Math.max(0, profit), credit: Math.max(0, -profit), step: 3 })
    lines.push({ ...target, debit: Math.max(0, -profit), credit: Math.max(0, profit), step: 3 })
  }
  if (distributed) {
    lines.push({ ...target, debit: distributed, credit: 0, step: 4 })
    lines.push(...distributions.map(row => ({ code: row.code, name: row.name, debit: 0, credit: row.satang, step: 4 })))
  }
  return { lines, profit }
}
