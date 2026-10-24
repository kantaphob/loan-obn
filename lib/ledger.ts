export const ledgerKinds = { GENERAL: 'รับ–จ่ายทั่วไป', DISBURSEMENT: 'จ่ายเงินกู้', REPAYMENT: 'รับชำระคืน' } as const
export type LedgerInput = {
  contractReviewToken?: string;
  requestKey: string; kind: keyof typeof ledgerKinds; contractId: number | null;
  direction: string; categoryCode: string; amount: string; occurredOn: string;
  channelCode: string; reference: string; note: string;
  settleRemaining?: boolean; settlementWaiverReason?: string;
  waivePenalty?: boolean; penaltyWaiverReason?: string;
}
export function ledgerAmount(value: string) {
  if (typeof value !== 'string' || !/^\d+(?:\.\d{1,2})?$/.test(value)) throw new Error('ระบุจำนวนเงินให้ถูกต้อง ไม่เกิน 2 ตำแหน่งทศนิยม')
  const amount = Math.round(Number(value) * 100)
  if (!Number.isSafeInteger(amount) || amount <= 0 || amount > 200_000_000_000) throw new Error('จำนวนเงินต้องมากกว่า 0 และไม่เกิน 2,000,000,000 บาท')
  return amount
}
export function validLedgerDate(value: string) {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value && value <= bangkokToday()
}
export function bangkokToday() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Bangkok', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date())
}
export const DAILY_PENALTY_SATANG = 5000
export const MAX_DAILY_PENALTY_DAYS = 30
export type BalanceContract = { repaymentSatang: number; status: string; paidAt: unknown; legacyReceivedSatang?: number; repaymentDueDate?: string | null; penaltyMaxDays?: number }
export type BalanceEntry = { id?: number; kind: string; amountSatang: number; occurredOn: string; penaltyWaivedSatang?: number; penaltyAssessed?: boolean; settlementWaivedSatang?: number }
export function contractLedgerBalance(contract: BalanceContract, entries: BalanceEntry[], asOf = bangkokToday()) {
  const disbursement = entries.find(e => e.kind === 'DISBURSEMENT' && e.occurredOn <= asOf)
  const paidOn = contract.paidAt instanceof Date ? contract.paidAt.toLocaleDateString('en-CA', { timeZone: 'Asia/Bangkok' })
    : typeof contract.paidAt === 'string' ? new Date(contract.paidAt).toLocaleDateString('en-CA', { timeZone: 'Asia/Bangkok' }) : null
  // A recorded future disbursement must not fall back to today's contract status.
  const hasDisbursement = entries.some(e => e.kind === 'DISBURSEMENT')
  const disbursed = Boolean(disbursement || !hasDisbursement && (paidOn ? paidOn <= asOf : ['PAID', 'CLOSED'].includes(contract.status)))
  const fundedOn = disbursement?.occurredOn ?? paidOn
  const penaltyStart = contract.repaymentDueDate && fundedOn && fundedOn > contract.repaymentDueDate ? fundedOn : contract.repaymentDueDate
  const maxPenaltyDays = contract.penaltyMaxDays === undefined ? MAX_DAILY_PENALTY_DAYS : contract.penaltyMaxDays > 0 ? contract.penaltyMaxDays : Number.POSITIVE_INFINITY
  const legacyReceivedSatang = disbursed ? contract.legacyReceivedSatang ?? 0 : 0
  let baseRemaining = disbursed ? Math.max(0, contract.repaymentSatang - legacyReceivedSatang) : 0
  let penaltyRemaining = 0, penaltyAccrued = 0, penaltyAccruedDays = 0, penaltyWaived = 0, penaltyPaid = 0, received = legacyReceivedSatang, settlementWaived = 0, invalid = false
  let cursor = penaltyStart ?? asOf
  const accrue = (until: string) => {
    if (!disbursed || !contract.repaymentDueDate || until <= cursor) return
    const days = Math.max(0, Math.round((Date.parse(until) - Date.parse(cursor)) / 86400000))
    if (baseRemaining > 0) {
      const chargeableDays = Math.min(days, Math.max(0, maxPenaltyDays - penaltyAccruedDays))
      penaltyRemaining += chargeableDays * DAILY_PENALTY_SATANG
      penaltyAccrued += chargeableDays * DAILY_PENALTY_SATANG
      penaltyAccruedDays += chargeableDays
    }
    cursor = until
  }
  for (const e of entries.filter(e => disbursed && e.kind === 'REPAYMENT' && e.occurredOn <= asOf).sort((a, b) => a.occurredOn.localeCompare(b.occurredOn) || (a.id ?? Number.MAX_SAFE_INTEGER) - (b.id ?? Number.MAX_SAFE_INTEGER))) {
    accrue(e.occurredOn)
    const waived = e.penaltyWaivedSatang ?? 0
    if (waived > penaltyRemaining) invalid = true
    penaltyRemaining = Math.max(0, penaltyRemaining - waived); penaltyWaived += waived
    const feePayment = e.penaltyAssessed === false ? 0 : Math.min(penaltyRemaining, e.amountSatang)
    penaltyRemaining -= feePayment; penaltyPaid += feePayment
    const basePayment = e.amountSatang - feePayment
    if (basePayment > baseRemaining) invalid = true
    baseRemaining = Math.max(0, baseRemaining - basePayment)
    const settlement = e.settlementWaivedSatang ?? 0
    if (settlement > baseRemaining || settlement < 0) invalid = true
    baseRemaining = Math.max(0, baseRemaining - settlement); settlementWaived += settlement
    // Historical payments retain their original allocation; fully settled contracts stay settled.
    if (e.penaltyAssessed === false && baseRemaining === 0) { penaltyRemaining = 0; penaltyAccrued = penaltyPaid + penaltyWaived }
    received += e.amountSatang
  }
  accrue(asOf)
  const overdueDays = disbursed && penaltyStart && asOf > penaltyStart ? Math.round((Date.parse(asOf) - Date.parse(penaltyStart)) / 86400000) : 0
  return { disbursed, received, legacyReceivedSatang, remaining: baseRemaining + penaltyRemaining, baseRemaining, penaltyRemaining, penaltyAccrued, penaltyWaived, penaltyPaid, settlementWaived, overdueDays, renegotiationRequired: Number.isFinite(maxPenaltyDays) && disbursed && baseRemaining > 0 && overdueDays > maxPenaltyDays, invalid, disbursementOn: disbursed ? fundedOn : null }
}
