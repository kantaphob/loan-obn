import { contractCode } from './contracts'
import { contractLedgerBalance, type BalanceContract, type BalanceEntry } from './ledger'

type SummaryContract = BalanceContract & {
  id: number; borrowerId: number; borrowerName: string; borrowerCode: string;
  legacySourceCode: string | null; principalSatang: number; interestSatang: number; interestMethod: string;
  ledgerEntries: BalanceEntry[];
}
export type SummaryAmounts = { principal: number; interest: number; penalty: number; total: number }
const zeroAmounts = (): SummaryAmounts => ({ principal: 0, interest: 0, penalty: 0, total: 0 })
function addAmounts(target: SummaryAmounts, amounts: SummaryAmounts) {
  target.principal += amounts.principal; target.interest += amounts.interest
  target.penalty += amounts.penalty; target.total += amounts.total
}

/** Use the same balance and interest-before-principal allocation as the borrower workspace. */
export function buildLoanRepaymentSummary(contracts: SummaryContract[], asOf: string, query = '') {
  const search = query.trim().toLocaleLowerCase('th-TH')
  const rows = contracts.flatMap(contract => {
    if (['CANCELLED', 'REJECTED', 'VOID', 'RESERVED'].includes(contract.status)) return []
    const balance = contractLedgerBalance(contract, contract.ledgerEntries, asOf)
    if (!balance.disbursed || balance.remaining <= 0) return []
    const code = contractCode(contract.id)
    if (search && ![contract.borrowerName, contract.borrowerCode, code, contract.legacySourceCode ?? ''].some(value => value.toLocaleLowerCase('th-TH').includes(search))) return []
    // baseRemaining contains only contractual debt. Upfront interest is already excluded by repaymentSatang.
    const principal = Math.min(contract.principalSatang, balance.baseRemaining)
    const interest = Math.max(0, balance.baseRemaining - principal)
    return [{ id: contract.id, code, legacyCode: contract.legacySourceCode, borrowerId: contract.borrowerId,
      borrowerName: contract.borrowerName, borrowerCode: contract.borrowerCode,
      dueDate: contract.repaymentDueDate ?? null, principal, interest, penalty: balance.penaltyRemaining,
      total: balance.remaining, upfrontInterestReceived: contract.interestMethod === 'INTEREST_UPFRONT' ? contract.interestSatang : 0,
      originalPrincipal: contract.principalSatang, originalInterest: contract.interestSatang,
      overdue: balance.overdueDays > 0, invalid: balance.invalid }]
  }).sort((a, b) => (a.dueDate ?? '9999').localeCompare(b.dueDate ?? '9999') || a.id - b.id)
  const people = new Map<number, { id: number; name: string; code: string; contracts: typeof rows; amounts: SummaryAmounts }>()
  const totals = zeroAmounts()
  for (const row of rows) {
    const person = people.get(row.borrowerId) ?? { id: row.borrowerId, name: row.borrowerName, code: row.borrowerCode, contracts: [], amounts: zeroAmounts() }
    person.contracts.push(row); addAmounts(person.amounts, row); addAmounts(totals, row)
    people.set(row.borrowerId, person)
  }
  return { asOf, people: [...people.values()].sort((a, b) => a.name.localeCompare(b.name, 'th') || a.id - b.id),
    totals, contractCount: rows.length, borrowerCount: people.size, invalidCount: rows.filter(row => row.invalid).length }
}

export type LoanRepaymentSummary = ReturnType<typeof buildLoanRepaymentSummary>

export function loanSummaryCsv(summary: LoanRepaymentSummary) {
  // Spreadsheet applications must not interpret borrower names or imported contract codes as formulas.
  const cell = (value: string | number) => {
    const text = typeof value === 'string' && /^[\s]*[=+\-@]/.test(value) ? `'${value}` : String(value)
    return `"${text.replaceAll('"', '""')}"`
  }
  const baht = (satang: number) => (satang / 100).toFixed(2)
  const lines: (string | number)[][] = [['ข้อมูล ณ วันที่', 'รหัสผู้กู้', 'ผู้กู้', 'เลขที่สัญญา', 'เลขสัญญาเดิม', 'ครบกำหนด', 'เงินต้นคงค้าง (บาท)', 'ดอกเบี้ยคงค้าง (บาท)', 'ค่าปรับคงค้าง (บาท)', 'รวมต้องคืน (บาท)', 'ดอกเบี้ยรับล่วงหน้าแล้ว (ไม่รวมยอดคืน)']]
  for (const person of summary.people) {
    for (const row of person.contracts) lines.push([summary.asOf, person.code, person.name, row.code, row.legacyCode ?? '', row.dueDate ?? '', baht(row.principal), baht(row.interest), baht(row.penalty), baht(row.total), baht(row.upfrontInterestReceived)])
    lines.push([summary.asOf, person.code, `รวม ${person.name}`, '', '', '', baht(person.amounts.principal), baht(person.amounts.interest), baht(person.amounts.penalty), baht(person.amounts.total), ''])
  }
  lines.push([summary.asOf, '', 'รวมทั้งหมด', '', '', '', baht(summary.totals.principal), baht(summary.totals.interest), baht(summary.totals.penalty), baht(summary.totals.total), ''])
  return '\uFEFF' + lines.map(line => line.map(cell).join(',')).join('\r\n')
}

export function borrowerSummaryText(person: LoanRepaymentSummary['people'][number], asOf: string, filtered = false) {
  const amount = (satang: number | null | undefined) => ((satang ?? 0) / 100).toLocaleString('th-TH', { maximumFractionDigits: 2 })
  const date = (value: string | null) => value ? value.slice(0, 10).split('-').reverse().join('/') : 'ไม่ระบุ'
  const lines = [`ข้อมูล ณ วันที่ ${date(asOf)}`]
  if (filtered) lines.push('เฉพาะรายการที่แสดงตามการค้นหา')
  for (const row of person.contracts) {
    lines.push(`${row.code} ${amount(row.principal)} ${amount(row.interest)} ${amount(row.penalty)} ${amount(row.total)} ${date(row.dueDate)}`)
    if (row.invalid) lines.push(`หมายเหตุ ${row.code}: ต้องตรวจสอบยอดบัญชีก่อนนำไปใช้`)
  }
  lines.push(`รวม ${amount(person.amounts.principal)} ${amount(person.amounts.interest)} ${amount(person.amounts.penalty)} ${amount(person.amounts.total)} บาท`)
  return lines.join('\n')
}
