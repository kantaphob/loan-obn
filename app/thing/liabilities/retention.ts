import { balance, roundMoney, today, type BankLoan, type RatePeriod } from '@/app/thing/_shared/model'
export type LoanRetentionInput = { name: string; effectiveOn: string; bankOpening: number; months: number; mrr: number; periods: RatePeriod[]; reference: string; reason: string; notes: string; confirmed: boolean }
export function retentionSystemOpening(loan: BankLoan, effectiveOn: string) {
  const previous = loan.rounds.at(-1)
  return previous ? balance({ ...loan, payments: loan.payments.filter(row => row.date < effectiveOn), disbursements: loan.disbursements?.filter(row => row.date < effectiveOn) }, previous) : 0
}
export function retentionRemainingMonths(loan: BankLoan, effectiveOn: string) {
  const previous = loan.rounds.at(-1)
  if (!previous) return 1
  if (!previous.effectiveOn || !effectiveOn) return previous.months
  const start = new Date(`${previous.effectiveOn}T00:00:00Z`), end = new Date(`${effectiveOn}T00:00:00Z`)
  const elapsed = (end.getUTCFullYear()-start.getUTCFullYear())*12 + end.getUTCMonth()-start.getUTCMonth() - (end.getUTCDate()<start.getUTCDate()?1:0)
  return Math.max(1,previous.months-Math.max(0,elapsed))
}
export function appendLoanRetention(loan: BankLoan, input: LoanRetentionInput): BankLoan {
  const previous = loan.rounds.at(-1)
  if (!previous?.effectiveOn) throw new Error('ระบุวันเริ่มสัญญาเดิมก่อนทำรีเทนชัน')
  if (!input || typeof input.effectiveOn !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(input.effectiveOn) || !Number.isFinite(Date.parse(input.effectiveOn)) || new Date(input.effectiveOn).toISOString().slice(0,10) !== input.effectiveOn || input.effectiveOn <= previous.effectiveOn || input.effectiveOn > today()) throw new Error('วันที่เริ่มรีเทนชันต้องหลังรอบเดิมและไม่เป็นอนาคต')
  if (loan.payments.some(row => row.date >= input.effectiveOn) || loan.disbursements?.some(row => row.date >= input.effectiveOn)) throw new Error('มีรายการรับหรือชำระในวันที่เริ่มรอบหรือหลังจากนั้นแล้ว กรุณาเลือกวันเริ่มหลังรายการเดิม')
  if (!input.confirmed || typeof input.reference !== 'string' || !input.reference.trim() || typeof input.name !== 'string' || !input.name.trim() || !Number.isFinite(input.bankOpening) || input.bankOpening <= 0 || input.bankOpening > 1e12 || !Number.isInteger(input.months) || input.months<1 || input.months>600) throw new Error('ระบุยอดหนี้ธนาคาร จำนวนงวด เอกสารอ้างอิง และยืนยันข้อมูลให้ครบ')
  const systemOpening = retentionSystemOpening(loan,input.effectiveOn)
  if (systemOpening < 0) throw new Error('ยอดหนี้เดิมไม่ถูกต้อง กรุณาตรวจรายการชำระ')
  const opening = roundMoney(input.bankOpening), difference = roundMoney(opening-systemOpening)
  if (Math.abs(difference)>.009 && (typeof input.reason !== 'string' || !input.reason.trim())) throw new Error('ระบุเหตุผลที่ยอดธนาคารต่างจากยอดในระบบ')
  return { ...loan, rounds: [...loan.rounds, { id: crypto.randomUUID(), name: input.name.trim(), effectiveOn: input.effectiveOn, opening, months: input.months, mrr: input.mrr, fee: 0, referenceInterest: 0, notes: input.notes, insurance: previous.insurance, customerType: previous.customerType, periods: structuredClone(input.periods), retention: { previousRoundId: previous.id, systemOpening, bankOpening: opening, difference, reference: input.reference.trim(), reason: input.reason.trim() } }] }
}
