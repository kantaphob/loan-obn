import { isLendingCashEntry, type LendingCashEntry } from './capital'

type ReceiptTotal = { total: number; repayments: number; funding: number; count: number; principal: number; interest: number; penalty: number; unallocated: number }
const empty = (): ReceiptTotal => ({ total: 0, repayments: 0, funding: 0, count: 0, principal: 0, interest: 0, penalty: 0, unallocated: 0 })
/** Calendar months, inclusive of the current partial month; cash receipts exclude withheld interest. */
export function lendingReceiptPeriods(entries: (LendingCashEntry & { allocation?: { principal: number; interest: number; penalty: number } })[], asOf: string) {
  const year = Number(asOf.slice(0, 4)), month = Number(asOf.slice(5, 7))
  const monthKey = (offset: number) => new Date(Date.UTC(year, month - 1 + offset, 1)).toISOString().slice(0, 7)
  const active = entries.filter(entry => isLendingCashEntry(entry) && !entry.voidedAt && entry.direction === 'IN' && entry.occurredOn <= asOf)
  const total = (from: string, to = asOf): ReceiptTotal => active.filter(entry => entry.occurredOn >= from && entry.occurredOn <= to).reduce((result, entry) => {
    result.total += entry.amountSatang
    result.count++
    if (entry.kind === 'REPAYMENT') {
      result.repayments += entry.amountSatang
      const parts = entry.allocation
      result.principal += parts?.principal ?? 0
      result.interest += parts?.interest ?? 0
      result.penalty += parts?.penalty ?? 0
      result.unallocated += entry.amountSatang - (parts ? parts.principal + parts.interest + parts.penalty : 0)
    }
    else result.funding += entry.amountSatang
    return result
  }, empty())
  const months = Array.from({ length: 12 }, (_, index) => {
    const key = `${year}-${String(index + 1).padStart(2, '0')}`
    return { key, future: index + 1 > month, ...total(`${key}-01`, `${key}-31` < asOf ? `${key}-31` : asOf) }
  })
  const sixMonthRows = Array.from({ length: 6 }, (_, index) => {
    const key = monthKey(index - 5)
    return { key, future: false, ...total(`${key}-01`, `${key}-31` < asOf ? `${key}-31` : asOf) }
  })
  const dayCount = new Date(Date.UTC(year, month, 0)).getUTCDate()
  const days = Array.from({ length: dayCount }, (_, index) => {
    const key = `${monthKey(0)}-${String(index + 1).padStart(2, '0')}`
    return { key, future: key > asOf, ...total(key, key < asOf ? key : asOf) }
  })
  return { year, asOf, months, sixMonthRows, days, thisMonth: { from: `${monthKey(0)}-01`, ...total(`${monthKey(0)}-01`) }, sixMonths: { from: `${monthKey(-5)}-01`, ...total(`${monthKey(-5)}-01`) }, thisYear: { from: `${year}-01-01`, ...total(`${year}-01-01`) } }
}
