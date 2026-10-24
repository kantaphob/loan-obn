import { bangkokToday, contractLedgerBalance, type BalanceContract, type BalanceEntry } from './ledger'

type CapitalContract = BalanceContract & {
  principalSatang: number; interestSatang: number; netSatang: number; interestMethod: string
}
type Entry = BalanceEntry & { voidedAt?: unknown }

/** Cash allocation follows the existing penalty → interest → principal policy. */
export function capitalPosition(contract: CapitalContract, entries: Entry[], asOf = bangkokToday()) {
  const valid = entries.filter(e => !e.voidedAt && e.occurredOn <= asOf)
  const balance = contractLedgerBalance(contract, valid, asOf)
  if (!balance.disbursed) return null
  const upfront = contract.interestMethod === 'INTEREST_UPFRONT' ? contract.interestSatang : 0
  let interestRemaining = contract.repaymentSatang - contract.principalSatang
  let principalRemaining = contract.principalSatang
  let principalReceived = 0, interestReceived = 0, principalWaived = 0
  const allocate = (amount: number, waived = false) => {
    const interest = Math.min(Math.max(0, interestRemaining), amount)
    interestRemaining -= interest
    const principal = Math.min(principalRemaining, Math.max(0, amount - interest))
    principalRemaining -= principal
    if (waived) principalWaived += principal
    else { principalReceived += principal; interestReceived += interest }
  }
  allocate(balance.legacyReceivedSatang)
  const history = valid.filter(e => e.kind !== 'REPAYMENT')
  let penaltyPaid = 0
  for (const entry of valid.filter(e => e.kind === 'REPAYMENT').sort((a, b) => a.occurredOn.localeCompare(b.occurredOn) || (a.id ?? Number.MAX_SAFE_INTEGER) - (b.id ?? Number.MAX_SAFE_INTEGER))) {
    history.push(entry)
    const next = contractLedgerBalance(contract, history, entry.occurredOn)
    allocate(entry.amountSatang - (next.penaltyPaid - penaltyPaid))
    allocate(entry.settlementWaivedSatang ?? 0, true)
    penaltyPaid = next.penaltyPaid
  }
  const disbursement = valid.find(e => e.kind === 'DISBURSEMENT')
  return {
    principal: contract.principalSatang, cashOut: disbursement?.amountSatang ?? contract.netSatang,
    principalReceived, principalRemaining, principalWaived,
    interestReceived, interestRemaining: Math.max(0, interestRemaining), upfrontInterest: upfront, penaltyReceived: balance.penaltyPaid,
    cashReceived: balance.received, legacyReceived: balance.legacyReceivedSatang,
  }
}

export const capitalPercent = (amount: number, total: number) => total > 0 ? amount / total * 100 : 0

type CashEntry = { direction: string; categoryCode: string; amountSatang: number; occurredOn: string; voidedAt?: unknown }
/** Ledger cash includes every actual receipt/payment, never receivables or waivers. */
export function capitalCash(entries: CashEntry[], asOf = bangkokToday()) {
  const active = entries.filter(e => !e.voidedAt && e.occurredOn <= asOf)
  const incoming = active.filter(e => e.direction === 'IN').reduce((n, e) => n + e.amountSatang, 0)
  const outgoing = active.filter(e => e.direction === 'OUT').reduce((n, e) => n + e.amountSatang, 0)
  const opening = active.filter(e => e.direction === 'IN' && e.categoryCode === 'OPENING_CAPITAL').reduce((n, e) => n + e.amountSatang, 0)
  return { incoming, outgoing, balance: incoming - outgoing, opening, hasOpening: active.some(e => e.direction === 'IN' && e.categoryCode === 'OPENING_CAPITAL') }
}
