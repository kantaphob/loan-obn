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
    interestReceived, upfrontInterest: upfront, penaltyReceived: balance.penaltyPaid,
    cashReceived: balance.received, legacyReceived: balance.legacyReceivedSatang,
  }
}

export const capitalPercent = (amount: number, total: number) => total > 0 ? amount / total * 100 : 0
