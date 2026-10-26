import { balance, type BankLoan, type LoanRound, type RatePeriod } from '@/app/thing/_shared/model'

export type InitialLoanSettings = { opening: number; creditLimit?: number; months: number; mrr: number; effectiveOn: string; referenceInterest: number; annualInstallments: number[]; rate: number; applyAnnualInstallments?: boolean; ratePeriods?: RatePeriod[]; insurance?: LoanRound['insurance']; customerType?: LoanRound['customerType']; roundName?: string; fee?: number; notes?: string }

/** Split rate periods at annual installment boundaries, retaining their interest terms. */
export function configureInitialLoan(loan: BankLoan, input: InitialLoanSettings): BankLoan {
  if (!Number.isInteger(input.months) || input.months < 1 || input.months > 600 || !input.annualInstallments.length || input.annualInstallments.some(value => !Number.isFinite(value) || value <= 0)) throw new Error('ระยะเวลาหรือค่างวดไม่ถูกต้อง')
  const previous = loan.rounds[0]
  const periods: RatePeriod[] = []
  for (let month = 1; month <= input.months; month++) {
    const sources = input.ratePeriods ?? previous?.periods
    const source = sources?.find(p => p.from <= month && p.to >= month) ?? sources?.at(-1)
    const period = source ? { ...source } : { from: 1, to: input.months, rate: input.rate, installment: 0, floating: false, discount: 0 }
    period.installment = input.applyAnnualInstallments === false && source ? source.installment : input.annualInstallments[Math.min(Math.floor((month - 1) / 12), input.annualInstallments.length - 1)]
    const last = periods.at(-1)
    if (last && last.rate === period.rate && last.floating === period.floating && last.discount === period.discount && last.installment === period.installment) last.to = month
    else periods.push({ ...period, from: month, to: month })
  }
  const round: LoanRound = { id: previous?.id ?? crypto.randomUUID(), name: previous?.name ?? 'สัญญาเริ่มต้น', opening: input.opening, ...(input.creditLimit !== undefined ? { creditLimit: input.creditLimit } : previous?.creditLimit !== undefined ? { creditLimit: previous.creditLimit } : {}), months: input.months, mrr: input.mrr, effectiveOn: input.effectiveOn, referenceInterest: input.referenceInterest, fee: previous?.fee ?? 0, notes: previous?.notes ?? '', periods }
  round.insurance = input.insurance ?? previous?.insurance
  round.customerType = input.customerType ?? previous?.customerType
  round.name = input.roundName ?? round.name
  round.fee = input.fee ?? round.fee
  round.notes = input.notes ?? round.notes
  const updated = { ...loan, ...(input.creditLimit !== undefined ? { openingBalance: input.opening } : {}), rounds: [round, ...loan.rounds.slice(1).map(row => ({ ...row }))] }
  for (let i = 1; i < updated.rounds.length; i++) updated.rounds[i].opening = balance(updated, updated.rounds[i - 1])
  return updated
}

/** Terms supplied by the owner; no current MRR or customer eligibility is inferred. */
export function ghbRatePeriods(months: number, insurance: NonNullable<LoanRound['insurance']>, customer: NonNullable<LoanRound['customerType']>): RatePeriod[] {
  const insured = insurance === 'qualifying'
  return [
    { from: 1, to: 3, rate: insured ? .73 : .98, floating: false, discount: 0 },
    { from: 4, to: 9, rate: insured ? 1.73 : 1.98, floating: false, discount: 0 },
    { from: 10, to: 24, rate: 0, floating: true, discount: insured ? 3.415 : 3.165 },
    { from: 25, to: 72, rate: 0, floating: true, discount: insured ? 2.415 : 2.165 },
    { from: 73, to: months, rate: 0, floating: true, discount: customer === 'welfare' ? 1 : customer === 'retail' ? .5 : 0 },
  ].filter(p => p.from <= months).map(p => ({ ...p, to: Math.min(p.to, months), installment: 0 }))
}
