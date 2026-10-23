import Link from 'next/link'
import { Header } from '@/components/ui/header'
import { PageContainer } from '@/components/ui/page-container'
import { Card } from '@/components/ui/card'
import { Icon } from '@/components/dashboard/icon'
import { prisma } from '@/lib/prisma'

const money = (value: number) => new Intl.NumberFormat('th-TH', { maximumFractionDigits: 0 }).format(value)
const date = (value: Date) => new Intl.DateTimeFormat('th-TH', { dateStyle: 'medium', timeZone: 'Asia/Bangkok' }).format(value)

export default async function DashboardPage() {
  const [borrowerCount, activeCount, reviewCount, limits, recentBorrowers, lenderCount] = await Promise.all([
    prisma.borrower.count(),
    prisma.borrower.count({ where: { status: 'ACTIVE' } }),
    prisma.borrower.count({ where: { status: 'UNDER_REVIEW' } }),
    prisma.borrower.aggregate({ _sum: { approvedLimit: true, usedLimit: true } }),
    prisma.borrower.findMany({ orderBy: { id: 'desc' }, take: 6, select: { id: true, borrowerId: true, nickname: true, firstName: true, lastName: true, status: true, registeredAt: true } }),
    prisma.lender.count(),
  ])
  const approved = limits._sum.approvedLimit ?? 0
  const used = limits._sum.usedLimit ?? 0
  const metrics = [
    { label: 'ผู้กู้ทั้งหมด', value: money(borrowerCount), note: `ใช้งาน ${money(activeCount)} คน`, icon: 'users' as const, tone: 'emerald' },
    { label: 'อยู่ระหว่างพิจารณา', value: money(reviewCount), note: 'ผู้กู้ที่มีสถานะพิจารณา', icon: 'file' as const, tone: 'amber' },
    { label: 'วงเงินอนุมัติรวม', value: `฿${money(approved)}`, note: `ใช้ไป ฿${money(used)} · คงเหลือ ฿${money(Math.max(0, approved - used))}`, icon: 'chart' as const, tone: 'green' },
  ]

  return <div className="relative z-10 min-h-[calc(100dvh-24px)] font-sans text-[#202a3c]"><PageContainer>
    <Header title="ภาพรวม" eyebrow="Workspace" description="ภาพรวมข้อมูลผู้กู้ยืม วงเงิน และผู้ให้กู้" />
    <div id="metrics" className="grid grid-cols-3 gap-3 max-[760px]:grid-cols-1">{metrics.map(metric => <Card key={metric.label} className="p-5"><div className="flex items-center justify-between text-xs text-slate-500"><span>{metric.label}</span><Icon name={metric.icon} /></div><p className="mb-0 mt-3 text-2xl font-semibold text-slate-800">{metric.value}</p><p className="mb-0 mt-2 text-[11px] text-slate-500">{metric.note}</p></Card>)}</div>
    <div className="mt-5 grid gap-5 lg:grid-cols-[1.5fr_1fr]">
      <Card as="section" className="overflow-hidden"><div className="flex items-center justify-between border-b border-white/70 px-5 py-4"><div><h2 className="m-0 text-sm font-semibold text-slate-800">ผู้กู้ที่เพิ่มล่าสุด</h2><p className="mb-0 mt-1 text-xs text-slate-500">แสดงข้อมูลล่าสุดจากทะเบียนผู้กู้</p></div><Link href="/dashboard/borrower" className="text-xs font-semibold text-blue-600">ดูทั้งหมด</Link></div>
        {recentBorrowers.length ? <div className="divide-y divide-slate-200/60">{recentBorrowers.map(b => <div key={b.id} className="flex items-center justify-between gap-3 px-5 py-3 text-xs"><div><p className="m-0 font-medium text-slate-800">{b.nickname} · {[b.firstName, b.lastName].filter(Boolean).join(' ')}</p><p className="mb-0 mt-1 text-slate-500">{b.borrowerId ?? `BR-${String(b.id).padStart(5, '0')}`} · {date(b.registeredAt)}</p></div><span className="rounded-full bg-slate-100 px-2.5 py-1 text-slate-600">{b.status}</span></div>)}</div> : <p className="p-8 text-center text-sm text-slate-500">ยังไม่มีข้อมูลผู้กู้</p>}
      </Card>
      <Card as="section" className="p-5"><h2 className="m-0 text-sm font-semibold text-slate-800">ทะเบียนข้อมูล</h2><div className="mt-4 space-y-3 text-xs"><div className="flex justify-between"><span className="text-slate-500">ผู้กู้ยืม</span><strong>{money(borrowerCount)} คน</strong></div><div className="flex justify-between"><span className="text-slate-500">ผู้ให้กู้</span><strong>{money(lenderCount)} ราย</strong></div><div className="flex justify-between"><span className="text-slate-500">วงเงินคงเหลือ</span><strong>฿{money(Math.max(0, approved - used))}</strong></div></div><div className="mt-5 grid gap-2"><Link href="/dashboard/borrower" className="portfolio-link">จัดการผู้กู้ <Icon name="chevron" /></Link><Link href="/dashboard/lenders" className="portfolio-link">จัดการผู้ให้กู้ <Icon name="chevron" /></Link></div></Card>
    </div>
  </PageContainer></div>
}
