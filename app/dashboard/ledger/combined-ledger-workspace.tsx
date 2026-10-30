import Link from 'next/link'
import { CashActions } from '@/components/ui/cash-actions'
import { Card } from '@/components/ui/card'
import { contractCode, formatContractMoney as money } from '@/lib/contracts'
import { LedgerYearNavigation } from './ledger-year-navigation'
import type { getHistoricalLedger, getLedger } from './actions'

type CurrentData = Awaited<ReturnType<typeof getLedger>>
type HistoricalRows = Awaited<ReturnType<typeof getHistoricalLedger>>
type Params = Record<string, string | string[] | undefined>
const field = 'mt-1 block w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm'
const queryValue = (value: string | string[] | undefined) => typeof value === 'string' ? value : ''

export function CombinedLedgerWorkspace({ current, historical, params, year = 'all' }: { current: CurrentData; historical: HistoricalRows; params: Params; year?: 'all' | 2025 }) {
  const q = queryValue(params.q).trim().slice(0, 100).toLowerCase()
  const direction = ['IN', 'OUT'].includes(queryValue(params.direction)) ? queryValue(params.direction) : ''
  const rows = [
    ...current.entries.filter(entry => !entry.voidedAt).map(entry => ({
      key: `TX-${entry.id}`, year: Number(entry.occurredOn.slice(0, 4)), occurredOn: entry.occurredOn, direction: entry.direction, amountSatang: entry.amountSatang,
      category: entry.categoryName, account: entry.accountScope === 'LENDING' ? 'สินเชื่อ' : 'ทั่วไป', detail: [entry.contract ? `${entry.contract.borrowerName} · ${contractCode(entry.contractId!)}` : '', entry.reference, entry.note].filter(Boolean).join(' · '),
      channel: entry.channelName, code: `TX-${String(entry.id).padStart(6, '0')}`,
    })),
    ...historical.map(entry => ({
      key: `HIST-${entry.id}`, year: Number(entry.occurredOn.slice(0, 4)), occurredOn: entry.occurredOn, direction: entry.direction, amountSatang: entry.amountSatang,
      category: entry.category.nameTh, account: 'ทั่วไป', detail: [entry.description, entry.company].filter(Boolean).join(' · '),
      channel: entry.sourceChannel === 'MBK' ? 'KBank' : entry.sourceChannel || entry.channel.nameTh, code: `2025 · แถว ${entry.sourceRow}`,
    })),
  ].filter(row => year === 'all' || row.year === year).sort((a, b) => b.occurredOn.localeCompare(a.occurredOn) || b.key.localeCompare(a.key))
  const filtered = rows.filter(row => (!direction || row.direction === direction) && (!q || `${row.code} ${row.category} ${row.detail} ${row.channel}`.toLowerCase().includes(q)))
  const total = (items: typeof rows, kind: string) => items.filter(row => row.direction === kind).reduce((sum, row) => sum + row.amountSatang, 0)
  const incoming = total(rows, 'IN'), outgoing = total(rows, 'OUT')
  const pageCount = Math.max(1, Math.ceil(filtered.length / 30))
  const page = Math.min(pageCount, Math.max(1, Math.trunc(Number(queryValue(params.page)) || 1)))
  const pageHref = (value: number) => {
    const search = new URLSearchParams({ page: String(value) })
    if (year !== 'all') search.set('year', String(year))
    if (q) search.set('q', q)
    if (direction) search.set('direction', direction)
    return `/dashboard/ledger?${search}`
  }
  return <div className="borrower-workspace ledger-directory space-y-5">
    <LedgerYearNavigation year={year} />
    <div className="ledger-directory-metrics grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {[[ 'รับสะสมทุกปี', incoming, 'text-emerald-700'], ['จ่ายสะสมทุกปี', outgoing, 'text-rose-700'], ['รับสุทธิทุกปี', incoming - outgoing, 'text-blue-700']].map(([title, value, color]) => <Card key={String(title)} className="p-5"><p className="text-sm text-slate-500">{title}</p><p className={`mt-3 text-2xl font-semibold tabular-nums ${color}`}>{money(Number(value))}<span className="ml-1 text-xs font-normal">บาท</span></p><p className="mt-2 text-xs text-slate-400">{year === 'all' ? 'รายการปี 2025 และ 2026' : `รายการปี ${year}`}</p></Card>)}
    </div>
    <Card className="ledger-directory-card overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-3 p-5"><div><h2 className="font-semibold">รายการรับ–จ่าย <span className="ml-2 text-sm font-normal text-slate-500">{rows.length} รายการ</span></h2>{current.canWrite && <p className="mb-0 mt-1 text-xs text-slate-400">รายการใหม่จะบันทึกในบัญชีปี 2026</p>}</div>{current.canWrite && <CashActions incomeHref="/dashboard/ledger?year=2026&create=1&direction=IN" expenseHref="/dashboard/ledger?year=2026&create=1&direction=OUT" />}</div>
      <form className="flex flex-wrap items-end gap-3 border-y border-slate-200/70 p-4" action="/dashboard/ledger">{year !== 'all' && <input type="hidden" name="year" value={year} />}
        <label className="min-w-48 flex-1 text-xs text-slate-500">ค้นหารายการ<div className="relative mt-1"><input name="q" defaultValue={queryValue(params.q)} className={field} placeholder="เลขรายการ หมวดหมู่ สัญญา หรือรายละเอียด" /></div></label>
        <label className="text-xs text-slate-500">ประเภท<select name="direction" defaultValue={direction} className={field}><option value="">รับและจ่าย</option><option value="IN">รับเงิน</option><option value="OUT">จ่ายเงิน</option></select></label>
        <button className="rounded-xl bg-slate-800 px-4 py-2.5 text-sm text-white">ค้นหา</button>
        {(q || direction) && <Link href="/dashboard/ledger" className="py-2.5 text-xs text-slate-500 underline">ล้างตัวกรอง</Link>}
      </form>
      <div className="ledger-directory-caption"><span>{filtered.length} รายการตามตัวกรอง · เรียงจากวันล่าสุด</span><span>รับ {money(total(filtered, 'IN'))} · จ่าย {money(total(filtered, 'OUT'))} บาท</span></div>
      <div className="overflow-x-auto"><table className="ledger-directory-table min-w-[850px]"><thead><tr>{['วันที่ / ปี', 'รายการ / รายละเอียด', 'ช่องทาง', 'รับเงิน', 'จ่ายเงิน'].map((title, index) => <th key={title} scope="col" className={index > 2 ? 'ledger-cash-cell' : ''}>{title}</th>)}</tr></thead><tbody>{filtered.slice((page - 1) * 30, page * 30).map(row => <tr key={row.key}>
        <td className="ledger-date-cell"><p>{new Date(`${row.occurredOn}T00:00:00+07:00`).toLocaleDateString('th-TH', { timeZone: 'Asia/Bangkok', dateStyle: 'medium' })}</p><small>{row.code}</small></td>
        <td className="ledger-description-cell"><div className="ledger-row-title"><span className={`ledger-row-dot ${row.direction === 'IN' ? 'is-in' : 'is-out'}`} /><strong>{row.category}</strong><span className="ml-2 text-xs text-slate-500">{row.account}</span><span className="ledger-year-tag">{row.year}</span></div>{row.detail && <p className="ledger-row-person">{row.detail}</p>}</td>
        <td className="ledger-channel-cell">{row.channel}</td>
        <td className="ledger-cash-cell ledger-cash-in">{row.direction === 'IN' ? money(row.amountSatang) : <span className="ledger-empty-cash">—</span>}</td>
        <td className="ledger-cash-cell ledger-cash-out">{row.direction === 'OUT' ? money(row.amountSatang) : <span className="ledger-empty-cash">—</span>}</td>
      </tr>)}</tbody></table>{!filtered.length && <div className="py-14 text-center text-sm text-slate-500">ไม่พบรายการตามเงื่อนไข</div>}</div>
      <div className="flex items-center justify-between border-t border-slate-200/70 p-4 text-sm"><span>หน้า {page} / {pageCount}</span><nav className="flex gap-2" aria-label="หน้ารายการ">{page > 1 && <Link className="rounded-lg border border-slate-200 px-3 py-2 text-xs" href={pageHref(page - 1)}>ก่อนหน้า</Link>}{page < pageCount && <Link className="rounded-lg border border-slate-200 px-3 py-2 text-xs" href={pageHref(page + 1)}>ถัดไป</Link>}</nav></div>
    </Card>
  </div>
}
