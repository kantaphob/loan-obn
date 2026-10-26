import Link from 'next/link'
import { Card } from '@/components/ui/card'
import { formatContractMoney as money } from '@/lib/contracts'
import { LedgerYearNavigation } from './ledger-year-navigation'

type Rows = Awaited<ReturnType<typeof import('./actions').getHistoricalLedger>>
type Params = Record<string, string | string[] | undefined>
const field = 'mt-1 block w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm'
const queryValue = (value: string | string[] | undefined) => typeof value === 'string' ? value : ''

export function HistoricalLedgerWorkspace({ rows, params }: { rows: Rows; params: Params }) {
  const q = queryValue(params.q).trim().slice(0, 100)
  const direction = ['IN', 'OUT'].includes(queryValue(params.direction)) ? queryValue(params.direction) : ''
  const month = /^2025-(0[1-9]|1[0-2])$/.test(queryValue(params.month)) ? queryValue(params.month) : ''
  const filtered = rows.filter(entry => (!direction || entry.direction === direction) && (!month || entry.occurredOn.startsWith(month)) && (!q || `${entry.description} ${entry.category.nameTh} ${entry.company} ${entry.sourceChannel}`.toLowerCase().includes(q.toLowerCase())))
  const total = (items: typeof rows, kind: string) => items.filter(entry => entry.direction === kind).reduce((sum, entry) => sum + entry.amountSatang, 0)
  const incoming = total(rows, 'IN'), outgoing = total(rows, 'OUT')
  const pageCount = Math.max(1, Math.ceil(filtered.length / 30))
  const page = Math.min(pageCount, Math.max(1, Math.trunc(Number(queryValue(params.page)) || 1)))
  const pageHref = (value: number) => {
    const search = new URLSearchParams({ year: '2025', page: String(value) })
    if (q) search.set('q', q)
    if (direction) search.set('direction', direction)
    if (month) search.set('month', month)
    return `/dashboard/ledger?${search}`
  }
  return <div className="borrower-workspace ledger-directory space-y-5">
    <LedgerYearNavigation year={2025} />
    <div className="ledger-directory-metrics grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {[[ 'รับทั้งปี', incoming, 'text-emerald-700'], ['จ่ายทั้งปี', outgoing, 'text-rose-700'], ['คงเหลือสุทธิทั้งปี', incoming - outgoing, 'text-blue-700']].map(([title, value, color]) => <Card key={String(title)} className="p-5"><p className="text-sm text-slate-500">{title}</p><p className={`mt-3 text-2xl font-semibold tabular-nums ${color}`}>{money(Number(value))}<span className="ml-1 text-xs font-normal">บาท</span></p><p className="mt-2 text-xs text-slate-400">รายการรับ–จ่ายปี 2025</p></Card>)}
    </div>
    <Card className="ledger-directory-card overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-3 p-5"><h2 className="font-semibold">รายการรับ–จ่าย <span className="ml-2 text-sm font-normal text-slate-500">{rows.length} รายการ</span></h2><span className="text-xs text-slate-500">ประวัติปี 2025</span></div>
      <form className="flex flex-wrap items-end gap-3 border-y border-slate-200/70 p-4" action="/dashboard/ledger">
        <input type="hidden" name="year" value="2025" />
        <label className="min-w-40 flex-1 text-xs text-slate-500">ค้นหารายการ<input name="q" defaultValue={q} className={field} placeholder="หมวดหมู่ รายละเอียด หรือช่องทาง" /></label>
        <label className="text-xs text-slate-500">เดือน<select name="month" defaultValue={month} className={field}><option value="">ทั้งปี 2025</option>{Array.from({ length: 12 }, (_, index) => <option key={index} value={`2025-${String(index + 1).padStart(2, '0')}`}>{new Intl.DateTimeFormat('th-TH', { month: 'long', timeZone: 'Asia/Bangkok' }).format(new Date(Date.UTC(2025, index, 1)))}</option>)}</select></label>
        <label className="text-xs text-slate-500">ประเภท<select name="direction" defaultValue={direction} className={field}><option value="">รับและจ่าย</option><option value="IN">รับเงิน</option><option value="OUT">จ่ายเงิน</option></select></label>
        <button className="rounded-xl bg-slate-800 px-4 py-2.5 text-sm text-white">ค้นหา</button>
        {(q || direction || month) && <Link href="/dashboard/ledger?year=2025" className="py-2.5 text-xs text-slate-500 underline">ล้างตัวกรอง</Link>}
      </form>
      <div className="ledger-directory-caption"><span>{filtered.length} รายการตามตัวกรอง</span><span>รับ {money(total(filtered, 'IN'))} · จ่าย {money(total(filtered, 'OUT'))} บาท</span></div>
      <div className="overflow-x-auto"><table className="ledger-directory-table min-w-[760px]"><thead><tr>{['วันที่', 'รายการ / รายละเอียด', 'ช่องทาง', 'รับเงิน', 'จ่ายเงิน'].map((title, index) => <th key={title} scope="col" className={index > 2 ? 'ledger-cash-cell' : ''}>{title}</th>)}</tr></thead><tbody>{filtered.slice((page - 1) * 30, page * 30).map(entry => <tr key={entry.id}>
        <td className="ledger-date-cell"><p>{new Date(`${entry.occurredOn}T00:00:00+07:00`).toLocaleDateString('th-TH', { timeZone: 'Asia/Bangkok', dateStyle: 'medium' })}</p><small>แถว {entry.sourceRow}</small></td>
        <td className="ledger-description-cell"><div className="ledger-row-title"><span className={`ledger-row-dot ${entry.direction === 'IN' ? 'is-in' : 'is-out'}`} /><strong>{entry.category.nameTh}</strong></div><p className="ledger-row-person">{entry.description}{entry.company ? ` · ${entry.company}` : ''}</p></td>
        <td className="ledger-channel-cell">{entry.sourceChannel === 'MBK' ? 'KBank' : entry.sourceChannel || entry.channel.nameTh}</td>
        <td className="ledger-cash-cell ledger-cash-in">{entry.direction === 'IN' ? money(entry.amountSatang) : <span className="ledger-empty-cash">—</span>}</td>
        <td className="ledger-cash-cell ledger-cash-out">{entry.direction === 'OUT' ? money(entry.amountSatang) : <span className="ledger-empty-cash">—</span>}</td>
      </tr>)}</tbody></table>{!filtered.length && <div className="py-14 text-center text-sm text-slate-500">ไม่พบรายการตามเงื่อนไข</div>}</div>
      <div className="flex items-center justify-between border-t border-slate-200/70 p-4 text-sm"><span>หน้า {page} / {pageCount}</span><nav className="flex gap-2" aria-label="หน้ารายการ">{page > 1 && <Link className="rounded-lg border border-slate-200 px-3 py-2 text-xs" href={pageHref(page - 1)}>ก่อนหน้า</Link>}{page < pageCount && <Link className="rounded-lg border border-slate-200 px-3 py-2 text-xs" href={pageHref(page + 1)}>ถัดไป</Link>}</nav></div>
    </Card>
  </div>
}
