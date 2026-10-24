import { allocationAmount } from './accounting-period'
import type { ClosingLine, EquityTarget } from './account-closing'
export const accountTypes = { ASSET: 'สินทรัพย์', LIABILITY: 'หนี้สิน', EQUITY: 'ส่วนของเจ้าของ', REVENUE: 'รายได้', EXPENSE: 'ค่าใช้จ่าย', DRAWING: 'ถอนใช้ส่วนตัว', DIVIDEND: 'เงินปันผล' } as const
export type TrialAccount = { code: string; name: string; type: keyof typeof accountTypes; debit: string; credit: string }
export type AdjustmentLine = { code: string; debit: string; credit: string }
export type EquityMovement = { opening: string; contributions: string; withdrawals: string; target: EquityTarget }
export function validateTrialAccounts(input: TrialAccount[]) {
  if (!Array.isArray(input) || !input.length || input.length > 200) throw new Error('ระบุบัญชีในงบทดลอง 1–200 บัญชี')
  const seen = new Set<string>()
  return input.map(row => {
    if (!row || typeof row.code !== 'string' || !/^[A-Za-z0-9_-]{1,30}$/.test(row.code) || seen.has(row.code.toUpperCase()) || ['INCOME_SUMMARY', 'RETAINED_EARNINGS', 'CAPITAL'].includes(row.code.toUpperCase())) throw new Error('รหัสบัญชีซ้ำ ไม่ถูกต้อง หรือเป็นรหัสสงวน โปรดใช้รหัสบัญชีเช่น 3100')
    seen.add(row.code.toUpperCase())
    if (typeof row.name !== 'string' || !row.name.trim() || row.name.length > 150 || !Object.hasOwn(accountTypes, row.type)) throw new Error('ชื่อหรือประเภทบัญชีไม่ถูกต้อง')
    const debit = allocationAmount(row.debit), credit = allocationAmount(row.credit)
    if (debit && credit) throw new Error('ยอดคงเหลือแต่ละบัญชีต้องอยู่ด้านเดบิตหรือเครดิตด้านเดียว')
    return { code: row.code, name: row.name.trim(), type: row.type, debit: String(debit / 100), credit: String(credit / 100) }
  })
}
export function validateAdjustment(lines: AdjustmentLine[], accounts: TrialAccount[]) {
  if (!Array.isArray(lines) || lines.length < 2 || lines.length > 100) throw new Error('รายการปรับปรุงต้องมี 2–100 บรรทัด')
  const validCodes = new Set(accounts.map(a => a.code))
  const normalized = lines.map(line => {
    if (!line || !validCodes.has(line.code)) throw new Error('กรุณาใช้รหัสบัญชีที่มีในงบทดลอง')
    const debit = allocationAmount(line.debit), credit = allocationAmount(line.credit)
    if ((!debit && !credit) || debit && credit) throw new Error('แต่ละบรรทัดต้องลงยอดด้านเดบิตหรือเครดิตด้านเดียว')
    return { code: line.code, debit: String(debit / 100), credit: String(credit / 100) }
  })
  if (normalized.reduce((s, l) => s + allocationAmount(l.debit) - allocationAmount(l.credit), 0) !== 0) throw new Error('ยอดเดบิตและเครดิตของรายการปรับปรุงต้องเท่ากัน')
  return normalized
}
export function calculateWorkpaper(input: TrialAccount[], adjustments: AdjustmentLine[][], equity: EquityMovement) {
  const accounts = validateTrialAccounts(input)
  if (!equity || !['CAPITAL', 'RETAINED_EARNINGS'].includes(equity.target)) throw new Error('เลือกทุนหรือกำไรสะสมให้ถูกต้อง')
  const opening = typeof equity.opening === 'string' && equity.opening.startsWith('-') ? -allocationAmount(equity.opening.slice(1)) : allocationAmount(equity.opening), contributions = allocationAmount(equity.contributions), withdrawals = allocationAmount(equity.withdrawals)
  const adjusted = accounts.map(a => ({ ...a, balance: allocationAmount(a.debit) - allocationAmount(a.credit) }))
  for (const lines of adjustments) for (const line of validateAdjustment(lines, accounts)) adjusted.find(a => a.code === line.code)!.balance += allocationAmount(line.debit) - allocationAmount(line.credit)
  if (adjusted.some(a => !Number.isSafeInteger(a.balance))) throw new Error('ยอดบัญชีเกินช่วงจำนวนเงินที่ระบบรองรับ')
  const debit = adjusted.reduce((s, a) => s + Math.max(0, a.balance), 0), credit = adjusted.reduce((s, a) => s + Math.max(0, -a.balance), 0)
  const sum = (type: TrialAccount['type']) => adjusted.filter(a => a.type === type).reduce((s, a) => s + a.balance, 0)
  const revenue = -sum('REVENUE'), expense = sum('EXPENSE'), profit = revenue - expense
  const distributions = sum('DRAWING') + sum('DIVIDEND'), permanentEquity = -sum('EQUITY')
  const closingEquity = permanentEquity + profit - distributions
  const equityMovementClosing = opening + contributions - withdrawals + profit - distributions
  const lines: ClosingLine[] = []
  const post = (code: string, name: string, signedDebit: number, step: number) => { if (signedDebit) lines.push({ code, name, debit: Math.max(0, signedDebit), credit: Math.max(0, -signedDebit), step }) }
  const summary = 'สรุปผลกำไรขาดทุน (Income Summary)'
  for (const row of adjusted.filter(a => a.type === 'REVENUE')) post(row.code, row.name, -row.balance, 1)
  post('INCOME_SUMMARY', summary, -revenue, 1)
  post('INCOME_SUMMARY', summary, expense, 2)
  for (const row of adjusted.filter(a => a.type === 'EXPENSE')) post(row.code, row.name, -row.balance, 2)
  post('INCOME_SUMMARY', summary, profit, 3)
  post(equity.target, equity.target === 'CAPITAL' ? 'ทุน' : 'กำไรสะสม', -profit, 3)
  post(equity.target, equity.target === 'CAPITAL' ? 'ทุน' : 'กำไรสะสม', distributions, 4)
  for (const row of adjusted.filter(a => ['DRAWING', 'DIVIDEND'].includes(a.type))) post(row.code, row.name, -row.balance, 4)
  const incompatibleDistributions = adjusted.some(a => a.balance !== 0 && (a.type === 'DRAWING' && equity.target !== 'CAPITAL' || a.type === 'DIVIDEND' && equity.target !== 'RETAINED_EARNINGS'))
  return { adjusted, debit, credit, balanced: debit === credit, revenue, expense, profit, distributions, assets: sum('ASSET'), liabilities: -sum('LIABILITY'), permanentEquity, closingEquity, opening, contributions, withdrawals, equityMovementClosing, equityDifference: equityMovementClosing - closingEquity, positionDifference: sum('ASSET') + sum('LIABILITY') - closingEquity, incompatibleDistributions, lines }
}
