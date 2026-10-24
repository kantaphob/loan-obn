import { connection } from 'next/server'
import Link from 'next/link'
import { BookOpen } from 'lucide-react'
import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/lib/auth/current-user'
import { formatContractMoney as money } from '@/lib/contracts'
import { PageContainer } from '@/components/ui/page-container'
import { Header } from '@/components/ui/header'
import { Card } from '@/components/ui/card'

const field = 'mt-1 block w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm'
export default async function Cashbook2025({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await connection()
  const user = await getCurrentUser()
  if (!user || user.status !== 'ACTIVE') return <PageContainer>ไม่มีสิทธิ์ดูบัญชี</PageContainer>
  const params = await searchParams
  const q = typeof params.q === 'string' ? params.q.trim().slice(0, 100) : ''
  const direction = ['IN', 'OUT'].includes(String(params.direction)) ? String(params.direction) : ''
  const month = typeof params.month === 'string' && /^2025-(0[1-9]|1[0-2])$/.test(params.month) ? params.month : ''
  const rows = await prisma.historicalCashEntry.findMany({ where: { accountCode: 'DAILY_2025' }, include: { category: { select: { nameTh: true } } }, orderBy: [{ occurredOn: 'desc' }, { sourceRow: 'desc' }] })
  const filtered = rows.filter(e => (!direction || e.direction === direction) && (!month || e.occurredOn.startsWith(month)) && (!q || `${e.description} ${e.category.nameTh} ${e.company} ${e.sourceChannel}`.toLowerCase().includes(q.toLowerCase())))
  const total = (items: typeof rows, dir: string) => items.filter(e => e.direction === dir).reduce((s, e) => s + e.amountSatang, 0)
  const incoming = total(rows, 'IN'), outgoing = total(rows, 'OUT')
  const pageCount = Math.max(1, Math.ceil(filtered.length / 30)), page = Math.min(pageCount, Math.max(1, Math.trunc(Number(params.page) || 1)))
  const href = (value: number) => `/dashboard/cashbook-2025?${new URLSearchParams({ q, direction, month, page: String(value) })}`
  return <PageContainer>
    <Header title="บัญชีรับ–จ่าย" eyebrow="ประวัติรายการ · ปี 2025" description="รายการรับและจ่ายย้อนหลัง" icon={<BookOpen size={21} />} />
    <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-3">{[['รับทั้งปี', incoming, 'text-emerald-700'], ['จ่ายทั้งปี', outgoing, 'text-rose-700'], ['คงเหลือสุทธิทั้งปี', incoming - outgoing, 'text-blue-700']].map(([title, value, tone]) => <Card key={String(title)} className="p-5"><p className="text-xs text-slate-500">{title}</p><p className={`mt-3 text-2xl font-semibold tabular-nums ${tone}`}>{money(Number(value))} <span className="text-xs font-normal">บาท</span></p></Card>)}</div>
      <Card className="overflow-hidden"><div className="flex items-center justify-between p-5"><h2 className="font-semibold">ประวัติรับ–จ่าย <span className="ml-2 text-xs text-slate-400">{rows.length} รายการ</span></h2><Link href="/dashboard/ledger" className="text-xs text-blue-700 underline">ดูรายการปี 2026 ↗</Link></div>
        <form className="flex flex-wrap items-end gap-3 border-y border-slate-100 p-4" action="/dashboard/cashbook-2025"><label className="min-w-40 flex-1 text-xs text-slate-500">ค้นหารายการ<input name="q" defaultValue={q} className={field} placeholder="หมวด รายละเอียด หรือช่องทาง" /></label><label className="text-xs text-slate-500">เดือน<select name="month" defaultValue={month} className={field}><option value="">ทั้งปี 2025</option>{Array.from({ length: 12 }, (_, i) => <option key={i} value={`2025-${String(i + 1).padStart(2, '0')}`}>{new Intl.DateTimeFormat('th-TH', { month: 'long', timeZone: 'Asia/Bangkok' }).format(new Date(Date.UTC(2025, i, 1)))}</option>)}</select></label><label className="text-xs text-slate-500">ประเภท<select name="direction" defaultValue={direction} className={field}><option value="">ทั้งหมด</option><option value="IN">รับเงิน</option><option value="OUT">จ่ายเงิน</option></select></label><button className="rounded-xl bg-slate-800 px-4 py-2.5 text-sm text-white">ค้นหา</button><Link href="/dashboard/cashbook-2025" className="py-2.5 text-xs text-slate-500 underline">ล้างตัวกรอง</Link></form>
        <div className="flex flex-wrap justify-between gap-2 bg-slate-50 px-5 py-3 text-xs text-slate-500"><span>{filtered.length} รายการตามตัวกรอง</span><span>รับ {money(total(filtered, 'IN'))} · จ่าย {money(total(filtered, 'OUT'))} บาท</span></div>
        <div className="overflow-auto"><table className="w-full min-w-[650px] text-left text-sm"><thead className="bg-slate-100/70 text-xs text-slate-500"><tr>{['วันที่', 'หมวด / รายละเอียด', 'ช่องทาง', 'รับเงิน', 'จ่ายเงิน'].map((title, i) => <th key={title} scope="col" className={`p-4 ${i > 2 ? 'text-right' : ''}`}>{title}</th>)}</tr></thead><tbody>{filtered.slice((page - 1) * 30, page * 30).map(e => <tr key={e.id} className="border-t border-slate-100 align-top hover:bg-slate-50"><td className="whitespace-nowrap p-4 text-xs">{new Date(`${e.occurredOn}T00:00:00+07:00`).toLocaleDateString('th-TH', { timeZone: 'Asia/Bangkok', dateStyle: 'medium' })}</td><td className="max-w-md p-4"><p className="font-medium">{e.category.nameTh}</p><p className="mt-1 text-xs text-slate-500">{e.description}</p></td><td className="whitespace-nowrap p-4 text-xs">{e.sourceChannel === 'MBK' ? 'KBank' : e.sourceChannel}</td><td className="p-4 text-right tabular-nums text-emerald-700">{e.direction === 'IN' ? money(e.amountSatang) : '—'}</td><td className="p-4 text-right tabular-nums text-rose-700">{e.direction === 'OUT' ? money(e.amountSatang) : '—'}</td></tr>)}</tbody></table>{!filtered.length && <p className="p-12 text-center text-sm text-slate-500">ไม่มีรายการตามเงื่อนไข</p>}</div>
        <div className="flex justify-between border-t border-slate-100 p-4 text-xs"><span>หน้า {page} / {pageCount}</span><nav className="flex gap-4" aria-label="หน้ารายการ">{page > 1 && <Link className="underline" href={href(page - 1)}>ก่อนหน้า</Link>}{page < pageCount && <Link className="underline" href={href(page + 1)}>ถัดไป</Link>}</nav></div>
      </Card>
    </div>
  </PageContainer>
}
