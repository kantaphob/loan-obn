import { ListChecks } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { PageContainer } from '@/components/ui/page-container'
import { SubpageHeader } from '@/components/ui/subpage-header'
import { MasterdataSubnav } from '@/components/dashboard/masterdata-subnav'
import { prisma } from '@/lib/prisma'

const tones: Record<string, string> = {
  AWAITING_FUNDS: 'border-sky-300/25 bg-sky-300/10 text-sky-200',
  AWAITING_REPAYMENT: 'border-amber-300/25 bg-amber-300/10 text-amber-200',
  OVERDUE: 'border-rose-300/25 bg-rose-300/10 text-rose-200',
  RETURNED: 'border-emerald-300/25 bg-emerald-300/10 text-emerald-200',
  CLOSED: 'border-slate-300/25 bg-slate-300/10 text-slate-200',
  UNDER_REVIEW: 'border-purple-300/25 bg-purple-300/10 text-purple-200',
  CONTRACT_RESERVED: 'border-orange-300/25 bg-orange-300/10 text-orange-200',
}

export default async function LoanStatusPage() {
  const statuses = await prisma.loanStatus.findMany({ where: { isActive: true }, orderBy: { sortOrder: 'asc' } })
  return (
    <PageContainer>
      <SubpageHeader title="สถานะสินเชื่อ" eyebrow="Administration" icon={<ListChecks size={21} />} description="รายการสถานะสำหรับใช้อ้างอิงในงานสินเชื่อ" status={{ label: `${statuses.length} สถานะ`, tone: 'neutral' }} />
      <MasterdataSubnav />
      <Card as="section" className="overflow-hidden">
        <div className="border-b border-white/10 px-5 py-4">
          <h2 className="m-0 text-sm font-semibold text-slate-100">สถานะสินเชื่อในระบบ</h2>
          <p className="mb-0 mt-2 text-xs leading-5 text-slate-400">เรียงตามรายการที่กำหนด ลำดับนี้เป็นลำดับแสดงผล</p>
        </div>
        <ul>
          {statuses.map((status, index) => (
            <li key={status.code} className="flex flex-wrap items-center gap-4 border-b border-white/10 px-5 py-4 last:border-0">
              <span className="font-mono text-xs text-slate-500">{String(index + 1).padStart(2, '0')}</span>
              <span className={`inline-flex min-h-9 min-w-32 items-center justify-center rounded-full border px-4 text-xs font-semibold ${tones[status.code] ?? 'border-slate-300/25 bg-slate-300/10 text-slate-200'}`}>{status.nameTh}</span>
              <span className="ml-auto break-all font-mono text-[11px] text-slate-400">{status.code}</span>
            </li>
          ))}
        </ul>
        {!statuses.length && <p className="py-8 text-center text-xs text-slate-400">ยังไม่มีสถานะสินเชื่อ</p>}
      </Card>
    </PageContainer>
  )
}
