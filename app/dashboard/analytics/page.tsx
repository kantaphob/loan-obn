import { connection } from 'next/server'
import { ChartNoAxesCombined, CircleAlert, Filter, Landmark, Wallet } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Header } from '@/components/ui/header'
import { PageContainer } from '@/components/ui/page-container'
import { bangkokToday } from '@/lib/ledger'
import { getDashboardAnalytics } from '@/lib/dashboard-analytics'

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> }
const money = (satang: number | null) => satang === null ? 'แยกแหล่งข้อมูล' : new Intl.NumberFormat('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(satang / 100)
const number = (value: number) => new Intl.NumberFormat('th-TH').format(value)
const monthLabel = (value: string) => new Intl.DateTimeFormat('th-TH', { month: 'short', year: '2-digit', timeZone: 'Asia/Bangkok' }).format(new Date(`${value}-01T00:00:00+07:00`))
const validDate = (value: unknown): value is string => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(`${value}T00:00:00+07:00`))

function defaultFrom(today: string) {
  const [year, month] = today.split('-').map(Number)
  const date = new Date(Date.UTC(year, month - 12, 1))
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}-01`
}

export default function AnalyticsPage({ searchParams }: Props) {
  return <PageContainer><Header title="วิเคราะห์ข้อมูล" eyebrow="Business intelligence" description="วิเคราะห์กระแสเงินสด พอร์ตสินเชื่อ ความเสี่ยง และหมวดรายการจากฐานข้อมูลจริง" icon={<ChartNoAxesCombined size={21} aria-hidden="true" />} />
    <AnalyticsContent searchParams={searchParams} />
  </PageContainer>
}

async function AnalyticsContent({ searchParams }: Props) {
  await connection()
  const params = await searchParams
  const today = bangkokToday()
  const fromParam = Array.isArray(params.from) ? params.from[0] : params.from
  const toParam = Array.isArray(params.to) ? params.to[0] : params.to
  const to = validDate(toParam) && toParam <= today ? toParam : today
  const from = validDate(fromParam) && fromParam <= to ? fromParam : defaultFrom(to)
  const data = await getDashboardAnalytics(from, to)
  const maxMonthly = Math.max(1, ...data.months.flatMap(row => [row.incoming, row.outgoing]))
  const maxCategory = Math.max(1, ...data.categories.slice(0, 8).map(row => row.amount))
  const maxChannel = Math.max(1, ...data.channels.map(row => row.amount))
  const cashMetrics = data.cash.available
    ? [{ label: 'รับในช่วงที่เลือก', value: data.cash.incoming, note: 'รวมแหล่งข้อมูลที่ตรวจสอบแล้ว' }, { label: 'จ่ายในช่วงที่เลือก', value: data.cash.outgoing, note: 'รวมแหล่งข้อมูลที่ตรวจสอบแล้ว' }, { label: 'สุทธิในช่วงที่เลือก', value: data.cash.net, note: 'ยอดรับลบยอดจ่าย' }]
    : []

  return <div className="space-y-5">
    <form action="/dashboard/analytics" className="flex flex-wrap items-end gap-3 rounded-2xl border border-slate-200 bg-white/80 p-4 shadow-sm">
      <div className="flex items-center gap-2 self-center pr-1 text-sm font-semibold text-slate-700"><Filter size={16} aria-hidden="true" /> ช่วงเวลารายการ</div>
      <label className="grid gap-1 text-xs text-slate-500">ตั้งแต่<input type="date" name="from" defaultValue={from} max={to} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800" /></label>
      <label className="grid gap-1 text-xs text-slate-500">ถึง<input type="date" name="to" defaultValue={to} max={today} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800" /></label>
      <button className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700" type="submit">วิเคราะห์ช่วงนี้</button>
      <span className="text-xs text-slate-500">ยอดพอร์ตและสถานะสัญญาแสดง ณ {today}</span>
    </form>

    <section aria-label="ภาพรวมพอร์ตสินเชื่อ" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {[
        { label: 'จ่ายปล่อยกู้จริงสะสม', value: data.loan.actualDisbursement, sub: `${number(data.loan.contracts)} สัญญาทั้งหมด` },
        { label: 'รับคืนรวมสะสม', value: data.loan.received, sub: `รับเงินต้นคืนแล้ว ฿${money(data.loan.principalReturned)}` },
        { label: 'เงินต้นคงค้าง', value: data.loan.principalOutstanding, sub: `${number(data.loan.active)} สัญญายังติดตาม` },
        { label: 'ดอกเบี้ยตามสัญญาคงค้าง', value: data.loan.interestOutstanding, sub: `เกินกำหนด ${number(data.loan.overdue)} สัญญา` },
      ].map(item => <Card key={item.label} className="border border-slate-200 bg-white p-4 shadow-sm"><p className="m-0 text-xs text-slate-500">{item.label}</p><strong className="mt-2 block text-xl font-semibold tracking-tight text-slate-900">฿{money(item.value)}</strong><small className="mt-1 block text-xs text-slate-500">{item.sub}</small></Card>)}
    </section>

    <section className="grid gap-4 xl:grid-cols-[1.4fr_1fr]">
      <Card as="section" className="border border-slate-200 bg-white p-4 shadow-sm">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2"><div><h2 className="m-0 text-base font-semibold text-slate-900">กระแสเงินสดรายเดือน</h2><p className="mb-0 mt-1 text-xs text-slate-500">บัญชีหลัก · {from} ถึง {to}</p></div><span className="text-xs text-slate-500">หน่วย: บาท</span></div>
        {data.months.length ? <div className="space-y-3">{data.months.map(row => <div key={row.month} className="grid grid-cols-[54px_minmax(0,1fr)_110px] items-center gap-2 text-xs"><span className="text-slate-500">{monthLabel(row.month)}</span><div className="space-y-1"><div className="h-2 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-emerald-500" style={{ width: `${row.incoming / maxMonthly * 100}%` }} /></div><div className="h-2 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-rose-400" style={{ width: `${row.outgoing / maxMonthly * 100}%` }} /></div></div><div className="text-right tabular-nums"><span className="block text-emerald-700">+{money(row.incoming)}</span><span className="block text-rose-600">−{money(row.outgoing)}</span></div></div>)}</div> : <p className="text-sm text-slate-500">ไม่มีรายการบัญชีหลักในช่วงเวลานี้</p>}
        <div className="mt-4 flex gap-4 border-t border-slate-100 pt-3 text-xs text-slate-500"><span><i className="mr-1 inline-block h-2 w-2 rounded-full bg-emerald-500" />รับ</span><span><i className="mr-1 inline-block h-2 w-2 rounded-full bg-rose-400" />จ่าย</span><span className="ml-auto">{number(data.ledgerEntries)} รายการ</span></div>
      </Card>

      <Card as="section" className="border border-slate-200 bg-white p-4 shadow-sm">
        <div className="mb-3 flex items-center gap-2"><Wallet size={17} className="text-slate-500" aria-hidden="true" /><h2 className="m-0 text-base font-semibold text-slate-900">รับ–จ่ายตามแหล่งข้อมูล</h2></div>
        {cashMetrics.length ? <div className="space-y-3">{cashMetrics.map(row => <div key={row.label} className="flex items-end justify-between gap-3 border-b border-slate-100 pb-3"><div><p className="m-0 text-xs text-slate-500">{row.label}</p><small className="text-[10px] text-slate-400">{row.note}</small></div><strong className="text-right text-sm tabular-nums text-slate-900">฿{money(row.value)}</strong></div>)}</div> : <div role="status" className="mb-3 rounded-xl bg-amber-50 p-3 text-xs leading-5 text-amber-900">มีรายการซ้ำระหว่างแหล่งข้อมูลในปี {data.cash.overlappingYears.join(', ')} จึงแสดงแยกแหล่งเพื่อป้องกันยอดซ้ำ</div>}
        <div className="overflow-x-auto"><table className="w-full text-left text-xs"><thead><tr className="text-slate-500"><th className="py-2 font-medium">แหล่งข้อมูล</th><th className="py-2 text-right font-medium">รับ</th><th className="py-2 text-right font-medium">จ่าย</th></tr></thead><tbody>{data.cash.sources.map(row => <tr key={row.source} className="border-t border-slate-100"><th className="py-2 font-medium text-slate-700">{row.source === 'LEDGER' ? 'บัญชีหลัก' : 'ประวัติเดิม'}<small className="block font-normal text-slate-400">{number(row.count)} รายการ</small></th><td className="py-2 text-right tabular-nums">฿{money(row.incoming)}</td><td className="py-2 text-right tabular-nums">฿{money(row.outgoing)}</td></tr>)}</tbody></table></div>
      </Card>
    </section>

    <section className="grid gap-4 xl:grid-cols-2">
      <Card as="section" className="border border-slate-200 bg-white p-4 shadow-sm"><div className="mb-3 flex items-center justify-between gap-2"><div><h2 className="m-0 text-base font-semibold text-slate-900">หมวดรับ–จ่าย</h2><p className="mb-0 mt-1 text-xs text-slate-500">รายการบัญชีหลัก · เรียงตามยอดในช่วงที่เลือก</p></div></div>
        {data.categories.length ? <div className="space-y-3">{data.categories.slice(0, 8).map(row => <div key={`${row.direction}-${row.code}`}><div className="mb-1 flex justify-between gap-3 text-xs"><span className="truncate text-slate-700">{row.label}<small className="ml-2 text-slate-400">{row.direction === 'IN' ? 'รับ' : 'จ่าย'} · {number(row.count)} รายการ</small></span><strong className="shrink-0 tabular-nums">฿{money(row.amount)}</strong></div><div className="h-1.5 overflow-hidden rounded-full bg-slate-100"><div className={`h-full rounded-full ${row.direction === 'IN' ? 'bg-emerald-500' : 'bg-rose-400'}`} style={{ width: `${row.amount / maxCategory * 100}%` }} /></div></div>)}</div> : <p className="text-sm text-slate-500">ไม่มีข้อมูลหมวดบัญชีในช่วงนี้</p>}
      </Card>
      <Card as="section" className="border border-slate-200 bg-white p-4 shadow-sm"><div className="mb-3 flex items-center gap-2"><Landmark size={17} className="text-slate-500" aria-hidden="true" /><div><h2 className="m-0 text-base font-semibold text-slate-900">ช่องทางการเงิน</h2><p className="mb-0 mt-1 text-xs text-slate-500">นับรายการบัญชีหลักตามช่วงที่เลือก</p></div></div>
        {data.channels.length ? <div className="space-y-3">{data.channels.map(row => <div key={row.code}><div className="mb-1 flex justify-between gap-3 text-xs"><span className="text-slate-700">{row.label}<small className="ml-2 text-slate-400">{number(row.count)} รายการ</small></span><strong className="tabular-nums">฿{money(row.amount)}</strong></div><div className="h-1.5 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-blue-500" style={{ width: `${row.amount / maxChannel * 100}%` }} /></div></div>)}</div> : <p className="text-sm text-slate-500">ไม่มีข้อมูลช่องทางในช่วงนี้</p>}
      </Card>
    </section>

    <section className="grid gap-4 xl:grid-cols-[1fr_1.5fr]">
      <Card as="section" className="border border-slate-200 bg-white p-4 shadow-sm"><h2 className="mb-3 mt-0 text-base font-semibold text-slate-900">สถานะสัญญา</h2><div className="grid grid-cols-2 gap-2">{data.loan.statuses.map(row => <div key={row.code} className="rounded-xl bg-slate-50 p-3"><span className="block text-xs text-slate-500">{row.label}</span><strong className="mt-1 block text-lg text-slate-900">{number(row.count)}</strong></div>)}</div><div className="mt-3 flex items-start gap-2 rounded-xl bg-slate-50 p-3 text-xs leading-5 text-slate-600"><CircleAlert size={15} className="mt-0.5 shrink-0 text-slate-400" aria-hidden="true" />ตรวจพบ {number(data.loan.invalid)} สัญญาที่ควรตรวจสอบยอด</div></Card>
      <Card as="section" className="border border-slate-200 bg-white p-4 shadow-sm"><div className="mb-3"><h2 className="m-0 text-base font-semibold text-slate-900">พอร์ตตาม Risk Rating</h2><p className="mb-0 mt-1 text-xs text-slate-500">ยอดคงค้าง ณ {data.today} · รวมระดับจากข้อมูลผู้กู้</p></div><div className="overflow-x-auto"><table className="w-full min-w-[560px] text-left text-xs"><thead><tr className="border-b border-slate-200 text-slate-500"><th className="py-2 font-medium">ระดับ</th><th className="py-2 text-right font-medium">สัญญา</th><th className="py-2 text-right font-medium">กำลังติดตาม</th><th className="py-2 text-right font-medium">เงินต้นคงค้าง</th><th className="py-2 text-right font-medium">เกินกำหนด</th></tr></thead><tbody>{data.risk.map(row => <tr key={row.code} className="border-b border-slate-100"><th className="py-2 font-medium text-slate-700">{row.code === 'UNRATED' ? 'ไม่ระบุ' : row.code}</th><td className="py-2 text-right tabular-nums">{number(row.contracts)}</td><td className="py-2 text-right tabular-nums">{number(row.active)}</td><td className="py-2 text-right tabular-nums">฿{money(row.principal)}</td><td className="py-2 text-right tabular-nums">{number(row.overdue)}</td></tr>)}</tbody></table></div><p className="mb-0 mt-3 flex items-center gap-2 text-xs text-amber-800"><CircleAlert size={14} aria-hidden="true" />ผู้กู้ยังไม่ได้จัดระดับความเสี่ยง {number(data.unratedBorrowers)} คน</p></Card>
    </section>
    <p className="m-0 text-[11px] leading-5 text-slate-500">ยอดรับ–จ่ายตามแหล่งข้อมูลรวมประวัติเดิมเมื่อระบบตรวจสอบแล้วว่าไม่ซ้ำกัน ส่วนการแยกหมวดและช่องทางใช้รายการบัญชีหลักที่บันทึกใน PostgreSQL</p>
  </div>
}
