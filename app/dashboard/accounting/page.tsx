import Link from 'next/link'
import { Suspense } from 'react'
import { connection } from 'next/server'
import { ScrollText } from 'lucide-react'
import { PageContainer } from '@/components/ui/page-container'
import { Header } from '@/components/ui/header'
import { Card } from '@/components/ui/card'
import { getLedger } from '../ledger/actions'
import { capitalPosition } from '@/lib/capital'
import { validLedgerDate, bangkokToday } from '@/lib/ledger'

const money = (satang: number) => (satang / 100).toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const field = 'mt-1 block w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm'

export default function AccountingPage({ searchParams }: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  return <Suspense fallback={<PageContainer><p role="status" className="p-6 text-sm text-slate-500">กำลังโหลดรายงานบัญชี…</p></PageContainer>}><AccountingContent searchParams={searchParams} /></Suspense>
}

async function AccountingContent({ searchParams }: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  await connection()
  const params = await searchParams
  const read = (key: string) => typeof params[key] === 'string' ? params[key] as string : ''
  const from = validLedgerDate(read('from')) ? read('from') : ''
  const to = validLedgerDate(read('to')) ? read('to') : ''
  const direction = ['IN', 'OUT'].includes(read('direction')) ? read('direction') : ''
  const invalidRange = Boolean(from && to && from > to)
  const data = await getLedger()
  const entries = data.entries.filter(e => !e.voidedAt && (!direction || e.direction === direction) && !invalidRange && (!from || e.occurredOn >= from) && (!to || e.occurredOn <= to))
  const sum = (direction: string) => entries.filter(e => e.direction === direction).reduce((total, e) => total + e.amountSatang, 0)
  const incoming = sum('IN'), outgoing = sum('OUT')
  const categories = new Map<string, { name: string; direction: string; count: number; amount: number }>()
  const months = new Map<string, { incoming: number; outgoing: number; count: number }>()
  for (const entry of entries) {
    const key = `${entry.direction}:${entry.categoryCode}`
    const category = categories.get(key) ?? { name: entry.categoryName, direction: entry.direction, count: 0, amount: 0 }
    category.count++; category.amount += entry.amountSatang; categories.set(key, category)
    const monthKey = entry.occurredOn.slice(0, 7)
    const month = months.get(monthKey) ?? { incoming: 0, outgoing: 0, count: 0 }
    if (entry.direction === 'IN') month.incoming += entry.amountSatang
    else month.outgoing += entry.amountSatang
    month.count++; months.set(monthKey, month)
  }
  const outstanding = data.contracts.filter(c => c.disbursed).reduce((total, c) => total + c.remaining, 0)
  const disbursed = entries.filter(e => e.kind === 'DISBURSEMENT').reduce((total, e) => total + e.amountSatang, 0)
  const repaid = entries.filter(e => e.kind === 'REPAYMENT').reduce((total, e) => total + e.amountSatang, 0)

  const endOn = to || bangkokToday()
  const beforeOn = from ? new Date(Date.parse(`${from}T00:00:00Z`) - 86400000).toISOString().slice(0, 10) : null
  let upfrontInterest = 0, receivedInterest = 0
  const activeEntries = data.entries.filter(e => !e.voidedAt)
  for (const contract of data.contracts) {
    if (invalidRange || contract.status === 'CANCELLED') continue
    const history = activeEntries.filter(e => e.contractId === contract.id)
    const fundedOn = history.find(e => e.kind === 'DISBURSEMENT')?.occurredOn ?? (contract.paidAt ? new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Bangkok', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(contract.paidAt)) : null)
    if (!fundedOn || fundedOn > endOn) continue
    if (contract.interestMethod === 'INTEREST_UPFRONT' && (!from || fundedOn >= from)) upfrontInterest += contract.interestSatang
    const position = capitalPosition(contract, history, endOn)
    const before = beforeOn && fundedOn <= beforeOn ? capitalPosition(contract, history, beforeOn) : null
    receivedInterest += Math.max(0, (position?.interestReceived ?? 0) - (before?.interestReceived ?? 0))
  }
  // Unlinked interest receipts are outside the per-contract allocation above.
  receivedInterest += entries.filter(e => e.occurredOn <= endOn && !e.contractId && e.direction === 'IN' && e.categoryCode === 'INTEREST_RECEIVED').reduce((sum, e) => sum + e.amountSatang, 0)

  return <PageContainer>
    <Header title="รายงานบัญชี" eyebrow="Accounting" description="รวมบัญชีทั่วไปและสินเชื่อ · ไม่นับรายการที่ยกเลิก" icon={<ScrollText size={21} aria-hidden="true" />} />
    <div className="space-y-5">
      <Card as="section" className="p-5">
        <form action="/dashboard/accounting" className="flex flex-wrap items-end gap-3">
          <label className="min-w-40 flex-1 text-xs text-slate-600">ตั้งแต่วันที่<input className={field} type="date" name="from" defaultValue={from} max={bangkokToday()} /></label>
          <label className="min-w-40 flex-1 text-xs text-slate-600">ถึงวันที่<input className={field} type="date" name="to" defaultValue={to} max={bangkokToday()} /></label>
          <label className="text-xs text-slate-600">ประเภท<select name="direction" defaultValue={direction} className={field}><option value="">รายรับและรายจ่ายทั้งหมด</option><option value="IN">รายรับ</option><option value="OUT">รายจ่าย</option></select></label>
          <button className="rounded-xl bg-slate-900 px-4 py-2 text-sm text-white" type="submit">แสดงรายงาน</button>
          <Link href="/dashboard/accounting" className="px-3 py-2 text-sm text-slate-600 underline">ดูทั้งหมด</Link>
          <Link href="/dashboard/ledger" className="px-3 py-2 text-sm text-blue-700 underline">ไปหน้าบัญชีรับ–จ่าย ↗</Link>
        </form>
        {invalidRange && <p role="alert" className="mt-3 text-sm text-rose-700">วันที่เริ่มต้นต้องไม่เกินวันที่สิ้นสุด กรุณาเลือกช่วงเวลาใหม่</p>}
        <p className="mt-3 text-xs text-slate-500">{from || to ? `${from || 'เริ่มต้น'} ถึง ${to || 'ปัจจุบัน'}` : 'ข้อมูลทุกช่วงเวลา'} · {entries.length.toLocaleString('th-TH')} รายการ · หน่วย: บาท</p>
      </Card>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[
          { label: 'รับเงินรวม', amount: incoming, color: 'text-emerald-700' },
          { label: 'จ่ายเงินรวม', amount: outgoing, color: 'text-rose-700' },
          { label: 'กระแสเงินสดสุทธิ', amount: incoming - outgoing, color: 'text-blue-700' },
          { label: 'ยอดค้างชำระปัจจุบัน', amount: outstanding, color: 'text-amber-700' },
        ].map(item => <Card key={item.label} className="p-5"><p className="text-xs text-slate-600">{item.label}</p><p className={`mt-3 break-words text-2xl font-semibold tabular-nums ${item.color}`}>{money(item.amount)}</p></Card>)}
      </div>
      <p className="text-xs leading-5 text-slate-500">กระแสเงินสดสุทธิคือเงินรับหักเงินจ่าย รวมเงินปล่อยกู้และรับชำระ จึงไม่ใช่กำไรสุทธิ ส่วนยอดค้างชำระเป็นยอดปัจจุบันทุกสัญญาที่จ่ายเงินแล้ว รวมยอดยกมาและค่าปรับตามระบบ ไม่เปลี่ยนตามตัวกรองวันที่</p>
      <Card as="section" className="min-w-0 p-5">
        <h2 className="text-base font-semibold">ดอกเบี้ยได้รับสะสม{from || to ? 'ในช่วงที่เลือก' : ''}</h2>
        <div className="mt-4 grid gap-5 sm:grid-cols-3">
          {[{ label: 'รับดอกเบี้ยจากการชำระแล้ว', amount: receivedInterest }, { label: 'รับดอกเบี้ยล่วงหน้าแล้ว', amount: upfrontInterest }, { label: 'ดอกเบี้ยได้รับรวม', amount: receivedInterest + upfrontInterest }].map(item => <div key={item.label} className="min-w-0"><p className="text-xs text-slate-600">{item.label}</p><p className="mt-2 break-words text-xl font-semibold tabular-nums text-emerald-700">{money(item.amount)} บาท</p></div>)}
        </div>
        <p className="mt-4 text-xs leading-5 text-slate-500">ดอกล่วงหน้าคิดจากสัญญาที่จ่ายแล้ว ตามวันที่จ่ายเงิน ส่วนดอกที่รับชำระคำนวณตามลำดับตัดค่าปรับ → ดอกเบี้ย → เงินต้น รวมยอดชำระยกมาในยอดสะสม ดอกล่วงหน้าแสดงเพื่อสรุปเท่านั้น ไม่บวกซ้ำในเงินรับหรือเงินสดคงเหลือ</p>
      </Card>
      <div className="grid gap-4 sm:grid-cols-2">
        <Card className="p-5"><h2 className="text-sm font-semibold">จ่ายเงินกู้ในช่วงที่เลือก</h2><p className="mt-2 text-xl font-semibold tabular-nums">{money(disbursed)} บาท</p></Card>
        <Card className="p-5"><h2 className="text-sm font-semibold">รับชำระตามสัญญาในช่วงที่เลือก</h2><p className="mt-2 text-xl font-semibold tabular-nums">{money(repaid)} บาท</p><p className="mt-2 text-xs text-slate-500">ยอดรับเงินจริงตาม Ledger ไม่รวมยอดยกมาที่ไม่มีรายการรับเงิน</p></Card>
      </div>
      <div className="grid gap-5 xl:grid-cols-2">
        {['IN', 'OUT'].map(direction => {
          const rows = [...categories.values()].filter(c => c.direction === direction).sort((a, b) => b.amount - a.amount)
          return <Card as="section" key={direction} className="min-w-0 overflow-hidden [&>.liquid-glass-content]:min-w-0 [&>.liquid-glass-content]:max-w-full"><h2 className="p-5 text-base font-semibold">{direction === 'IN' ? 'รับเงินแยกหมวด' : 'จ่ายเงินแยกหมวด'}</h2><div className="w-full min-w-0 overflow-x-auto"><table className="w-full table-fixed text-left text-sm"><thead className="bg-slate-50 text-xs text-slate-500"><tr><th scope="col" className="w-[40%] p-3 sm:p-4">หมวดหมู่</th><th scope="col" className="w-[18%] px-2 py-4 text-right">รายการ</th><th scope="col" className="w-[42%] p-3 text-right sm:p-4">ยอดเงิน</th></tr></thead><tbody>{rows.map(row => <tr key={row.name + row.amount} className="border-t border-slate-200/60"><td className="break-words p-3 sm:p-4">{row.name}</td><td className="p-4 text-right">{row.count}</td><td className="break-words p-3 text-right tabular-nums sm:p-4">{money(row.amount)}</td></tr>)}</tbody><tfoot className="border-t border-slate-200 font-semibold"><tr><th scope="row" className="p-4">รวม</th><td className="p-4 text-right">{rows.reduce((n, r) => n + r.count, 0)}</td><td className="break-words p-3 text-right tabular-nums sm:p-4">{money(direction === 'IN' ? incoming : outgoing)}</td></tr></tfoot></table></div>{!rows.length && <p className="p-6 text-center text-sm text-slate-500">ไม่มีรายการในช่วงเวลาที่เลือก</p>}</Card>
        })}
      </div>
      <Card as="section" className="min-w-0 overflow-hidden [&>.liquid-glass-content]:min-w-0 [&>.liquid-glass-content]:max-w-full"><h2 className="p-5 text-base font-semibold">สรุปรายเดือน</h2><div className="w-full min-w-0 overflow-x-auto"><table className="w-full whitespace-nowrap text-left text-sm"><thead className="bg-slate-50 text-xs text-slate-500"><tr>{['เดือน (ค.ศ.)', 'รายการ', 'รับเงิน', 'จ่ายเงิน', 'กระแสเงินสดสุทธิ'].map(label => <th scope="col" key={label} className="p-4">{label}</th>)}</tr></thead><tbody>{[...months.entries()].sort(([a], [b]) => b.localeCompare(a)).map(([month, row]) => <tr key={month} className="border-t border-slate-200/60"><th scope="row" className="p-4 font-medium">{month}</th><td className="p-4">{row.count}</td><td className="p-4 tabular-nums text-emerald-700">{money(row.incoming)}</td><td className="p-4 tabular-nums text-rose-700">{money(row.outgoing)}</td><td className="p-4 tabular-nums">{money(row.incoming - row.outgoing)}</td></tr>)}</tbody></table></div>{!months.size && <p className="p-8 text-center text-sm text-slate-500">ไม่มีรายการในช่วงเวลาที่เลือก</p>}</Card>
    </div>
  </PageContainer>
}
