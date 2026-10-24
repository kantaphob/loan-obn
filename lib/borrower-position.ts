import { bangkokToday, contractLedgerBalance, type BalanceContract, type BalanceEntry } from './ledger'

type Contract = BalanceContract & { principalSatang: number; interestSatang: number; ledgerEntries: BalanceEntry[] }
/** Repayments cover penalties, then contractual interest, then principal. */
export function borrowerPosition(contracts: Contract[], fallbackUsed: number, asOf = bangkokToday()) {
  const relevant = contracts.filter(c => !['CANCELLED', 'REJECTED', 'VOID'].includes(c.status))
  let reserved = 0, principal = 0, overdueDays = 0, outstanding = false, waiting = false
  for (const c of relevant) {
    const balance = contractLedgerBalance(c, c.ledgerEntries, asOf)
    if (!balance.disbursed) { waiting = true; if (c.status === 'WAITING_PAYMENT') reserved += c.principalSatang; continue }
    principal += Math.min(c.principalSatang, balance.baseRemaining)
    if (balance.remaining > 0) { outstanding = true; overdueDays = Math.max(overdueDays, balance.overdueDays) }
  }
  return {
    currentUsedLimit: relevant.length ? principal / 100 : fallbackUsed,
    reservedLimit: reserved / 100,
    committedLimit: (relevant.length ? principal / 100 : fallbackUsed) + reserved / 100,
    positionSource: relevant.length ? 'contracts' as const : 'import' as const,
    currentLoanStatus: relevant.length ? outstanding ? overdueDays > 0 ? `ค้างชำระ ${overdueDays} วัน` : 'รอชำระคืน' : waiting ? 'รอจ่ายเงินกู้' : 'ปิดยอด' : 'ยังไม่มีสัญญาเชื่อมโยง',
    overdueDays,
    currentRiskRating: overdueDays > 30 ? 'D' : overdueDays > 7 ? 'C' : overdueDays > 0 ? 'B' : 'A',
  }
}
