import Link from 'next/link'
import { Suspense } from 'react'
import { connection } from 'next/server'
import { BanknoteX } from 'lucide-react'
import { PageContainer } from '@/components/ui/page-container'
import { Header } from '@/components/ui/header'
import { Card } from '@/components/ui/card'
import { getCurrentUser } from '@/lib/auth/current-user'
import { prisma } from '@/lib/prisma'
import { bangkokToday } from '@/lib/ledger'
import { nextMonth } from '@/lib/monthly-accounting'
import type { ClosingLine } from '@/lib/account-closing'
import { ClosingForm } from './closing-form'
import { MonthReview } from './month-review'
import { getMonthReview } from './month-actions'
const money = (n: number) => (n / 100).toLocaleString('th-TH', { minimumFractionDigits: 2 })
type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> }
export default function AC(props: Props) {
  return <Suspense fallback={<PageContainer><p role="status">กำลังโหลดงวดบัญชี…</p></PageContainer>}><ClosingContent {...props} /></Suspense>
}
async function ClosingContent({ searchParams }: Props) {
  await connection()
  const user = await getCurrentUser()
  if (!user || user.status !== 'ACTIVE') return <PageContainer>ไม่มีสิทธิ์เข้าถึงข้อมูล</PageContainer>
  const [closes, locks, firstEntry, params] = await Promise.all([
    prisma.accountingClose.findMany({ orderBy: { endOn: 'desc' } }),
    prisma.accountingMonthLock.findMany({ orderBy: { month: 'desc' } }),
    prisma.ledgerEntry.findFirst({ orderBy: { occurredOn: 'asc' }, select: { occurredOn: true } }),
    searchParams,
  ])
  const today = bangkokToday()
  const canWrite = ['ADMIN', 'SUPER_ADMIN'].includes(user.role)
  const latest = locks[0]
  const defaultMonth = latest ? nextMonth(latest.month) : `${(firstEntry?.occurredOn ?? today).slice(0, 4)}-01`
  const selectedMonth = typeof params.month === 'string' && /^(19|[2-9]\d)\d{2}-(0[1-9]|1[0-2])$/.test(params.month) && params.month <= today.slice(0, 7) ? params.month : defaultMonth > today.slice(0, 7) ? today.slice(0, 7) : defaultMonth
  const locked = locks.find(lock => lock.month === selectedMonth)
  const review = locked ? { snapshot: JSON.parse(locked.snapshotJson) as Awaited<ReturnType<typeof getMonthReview>>['snapshot'], reviewToken: '' } : await getMonthReview(selectedMonth)
  const annualStart = closes[0] ? new Date(Date.parse(closes[0].endOn) + 86400000).toISOString().slice(0, 10) : `${locks.length ? locks[locks.length - 1].month.slice(0, 4) : Number(today.slice(0, 4)) - 1}-01-01`
  return <PageContainer>
    <Header title="ตรวจยอดและปิดบัญชี" eyebrow="Account Closing" description="ล็อกรายเดือนหลังตรวจยอด แล้วปิดรายได้–ค่าใช้จ่ายสิ้นปี โดยยกยอดลูกหนี้ไปงวดถัดไป" icon={<BanknoteX size={21} aria-hidden="true" />} />
    <div className="space-y-5">
      <Card className="p-5"><h2 className="font-semibold">{latest ? `ล็อกรายการถึง ${latest.endOn}` : 'ยังไม่มีเดือนที่ล็อก'}</h2><p className="mt-2 text-sm text-slate-600">การล็อกเดือนไม่โอนกำไร ไม่ตัดยอดเงินต้นค้าง และไม่ปิดสัญญากู้ สัญญาจะปิดในหน้ารับชำระเมื่อยอดที่ต้องชำระเหลือศูนย์ หรือบันทึกยกเว้นพร้อมเหตุผลครบถ้วน</p><Link href="/dashboard/repayments" className="mt-3 inline-block text-sm text-blue-700 underline">ไปหน้ารับชำระและปิดสัญญา ↗</Link></Card>
      <Card as="section" className="space-y-5 p-5"><h2 className="text-lg font-semibold">1. ตรวจยอดและล็อกเดือน</h2>
        <form action="/dashboard/ac" className="flex flex-wrap items-end gap-3"><label className="text-sm">เดือนที่ตรวจยอด<input required type="month" name="month" defaultValue={selectedMonth} max={today.slice(0, 7)} className="ml-3 rounded-xl border border-slate-300 bg-white px-3 py-2" /></label><button className="rounded-xl border border-slate-300 px-4 py-2 text-sm">แสดงยอดตรวจสอบ</button></form>
        <MonthReview key={`${selectedMonth}:${review.reviewToken}:${locked?.id ?? ''}`} review={review} canWrite={canWrite} locked={Boolean(locked)} completed={review.snapshot.endOn < today} />
        {locked && <p className="whitespace-pre-wrap text-xs text-slate-500">ตรวจโดย {locked.createdBy} · {locked.createdAt.toLocaleString('th-TH', { timeZone: 'Asia/Bangkok' })} · {locked.note}</p>}
      </Card>
      <Card as="section" className="p-5"><h2 className="text-lg font-semibold">ประวัติการล็อกเดือน</h2>{!locks.length ? <p className="mt-3 text-sm text-slate-500">ยังไม่มีประวัติ</p> : <ul className="mt-3 flex flex-wrap gap-3">{locks.map(lock => <li key={lock.id}><Link href={`/dashboard/ac?month=${lock.month}`} className="inline-block rounded-xl border border-slate-200 px-3 py-2 text-sm text-blue-700">{lock.month} · ล็อกแล้ว</Link></li>)}</ul>}</Card>
      <Card as="section" className="p-5"><details><summary className="cursor-pointer text-lg font-semibold">2. ปิดบัญชีสิ้นปี (Closing Entries)</summary><div className="mt-5">{canWrite ? <ClosingForm nextStart={annualStart} today={today} /> : <p className="text-sm">เฉพาะผู้ดูแลระบบที่ปิดบัญชีสิ้นปีได้</p>}</div></details></Card>
      <section className="space-y-4"><h2 className="font-semibold">ประวัติรายการปิดบัญชีสิ้นปี</h2>{!closes.length && <Card className="p-6 text-sm text-slate-500">ยังไม่มีรายการปิดบัญชีสิ้นปี การล็อกเดือนจะไม่สร้างรายการในส่วนนี้</Card>}{closes.map(close => {
        const lines = JSON.parse(close.journalJson) as ClosingLine[]
        return <Card key={close.id} className="p-5"><details><summary className="cursor-pointer font-semibold">AC-{close.id} · {close.kind === 'YEAR_END' ? 'ปิดสิ้นปี' : 'รายการเดิม'} · {close.startOn} ถึง {close.endOn} · กำไร (ขาดทุน) {money(close.profitSatang)} บาท</summary><p className="mt-3 whitespace-pre-wrap text-sm">{close.note}</p><p className="mt-2 text-xs text-slate-500">บันทึกโดย {close.createdBy} · {close.createdAt.toLocaleString('th-TH', { timeZone: 'Asia/Bangkok' })}</p><div className="mt-4 overflow-x-auto"><table className="w-full text-left text-sm"><thead><tr><th className="p-3">ขั้นตอน</th><th className="p-3">บัญชี</th><th className="p-3 text-right">เดบิต</th><th className="p-3 text-right">เครดิต</th></tr></thead><tbody>{lines.map((line, index) => <tr key={`${line.step}-${line.code}-${index}`} className="border-t border-slate-200"><td className="p-3">{line.step ?? 'รายการเดิม'}</td><td className="p-3">{line.code} · {line.name}</td><td className="p-3 text-right">{money(line.debit)}</td><td className="p-3 text-right">{money(line.credit)}</td></tr>)}</tbody></table></div></details></Card>
      })}</section>
    </div>
  </PageContainer>
}
