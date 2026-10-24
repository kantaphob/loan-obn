import { contractLedgerBalance, type BalanceContract, type BalanceEntry } from './ledger'

export function paymentBehavior(contract: BalanceContract, entries: (BalanceEntry & { voidedAt?: unknown })[], asOf: string) {
  const active = entries.filter(e => !e.voidedAt && e.occurredOn <= asOf)
  const balance = contractLedgerBalance(contract, active, asOf)
  if (!balance.disbursed) return 'PENDING'
  if (balance.invalid) return 'UNKNOWN'
  if (balance.remaining > 0) return !contract.repaymentDueDate ? 'UNKNOWN' : balance.overdueDays > 0 ? 'OVERDUE' : 'CURRENT'
  // A legacy opening balance has no payment date. Do not infer punctuality from it.
  if (!contract.repaymentDueDate || (contract.legacyReceivedSatang ?? 0) >= contract.repaymentSatang) return 'UNKNOWN'
  const payments = active.filter(e => e.kind === 'REPAYMENT').sort((a, b) => a.occurredOn.localeCompare(b.occurredOn) || (a.id ?? 0) - (b.id ?? 0))
  const closedOn = payments.at(-1)?.occurredOn
  if (!closedOn) return 'UNKNOWN'
  return closedOn <= contract.repaymentDueDate ? 'ON_TIME' : 'LATE'
}

export const agingBands = [
  { label: '1–30 วัน', min: 1, max: 30 },
  { label: '31–60 วัน', min: 31, max: 60 },
  { label: '61–90 วัน', min: 61, max: 90 },
  { label: 'เกิน 90 วัน', min: 91, max: Infinity },
]

export function closureMethod(balance: { disbursed: boolean; remaining: number; invalid: boolean; settlementWaived: number; penaltyWaived: number }, historical: boolean) {
  if (!balance.disbursed || balance.remaining > 0) return 'OPEN'
  if (balance.invalid) return 'UNKNOWN'
  if (balance.settlementWaived > 0) return 'SETTLEMENT_WAIVER'
  if (balance.penaltyWaived > 0) return 'PENALTY_WAIVER'
  return historical ? 'HISTORICAL' : 'FULL_PAYMENT'
}

export function parseRevision(value: string): Record<string, unknown> | null {
  try {
    const parsed: unknown = JSON.parse(value)
    return parsed !== null && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed as Record<string, unknown> : null
  } catch { return null }
}

/** Split the remaining contract debt after interest-first repayment; fees stay separate. */
export function outstandingBreakdown(principalSatang: number, balance: { disbursed: boolean; baseRemaining: number; penaltyRemaining: number }) {
  if (!balance.disbursed) return { principal: 0, interest: 0, penalty: 0, total: 0 }
  const principal = Math.min(principalSatang, balance.baseRemaining)
  const interest = balance.baseRemaining - principal
  const penalty = balance.penaltyRemaining
  return { principal, interest, penalty, total: principal + interest + penalty }
}
