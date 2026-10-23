import { ShieldCheck } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { PageContainer } from '@/components/ui/page-container'
import { SubpageHeader } from '@/components/ui/subpage-header'
import { MasterdataSubnav } from '@/components/dashboard/masterdata-subnav'
import { prisma } from '@/lib/prisma'

export default async function RiskRatingPage() {
  const ratings = await prisma.riskRating.findMany({
    where: { isActive: true },
    orderBy: { score: 'asc' },
  })

  return (
    <PageContainer>
      <SubpageHeader title="ระดับความเสี่ยง" eyebrow="Administration" description="ระดับความเสี่ยงและรายการระงับที่ใช้ในระบบ" icon={<ShieldCheck size={21} />} />
      <MasterdataSubnav />
      <Card as="section" className="overflow-hidden">
        <div className="flex items-center justify-between gap-3 border-b border-white/10 px-5 py-4">
          <h2 className="m-0 text-sm font-semibold text-slate-100">รายการระดับความเสี่ยง</h2>
          <span className="rounded-full border border-slate-400/15 bg-slate-400/10 px-3 py-1 text-xs text-slate-300">{ratings.length} รายการ</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[480px] text-left text-xs">
            <thead className="bg-white/[0.03] text-slate-400">
              <tr><th scope="col" className="px-5 py-3 font-medium">ระดับความเสี่ยง</th><th scope="col" className="px-5 py-3 font-medium">รหัส</th><th scope="col" className="px-5 py-3 font-medium">ลำดับ</th><th scope="col" className="px-5 py-3 font-medium">ประเภท</th></tr>
            </thead>
            <tbody>
              {ratings.map((rating) => (
                <tr key={rating.code} className="border-t border-white/10">
                  <th scope="row" className="px-5 py-4 font-semibold text-slate-100">{rating.nameTh}</th>
                  <td className="px-5 py-4 font-mono text-slate-300">{rating.code}</td>
                  <td className="px-5 py-4 tabular-nums text-slate-300">{rating.score}</td>
                  <td className="px-5 py-4"><span className={`inline-flex rounded-full border px-3 py-1.5 text-xs ${rating.isBlacklist ? 'border-rose-300/25 bg-rose-300/10 text-rose-200' : 'border-slate-400/20 bg-slate-400/10 text-slate-300'}`}>{rating.isBlacklist ? 'รายการระงับ' : 'ระดับความเสี่ยง'}</span></td>
                </tr>
              ))}
              {ratings.length === 0 ? <tr><td colSpan={4} className="px-5 py-12 text-center text-slate-400">ยังไม่มีข้อมูลระดับความเสี่ยง</td></tr> : null}
            </tbody>
          </table>
        </div>
      </Card>
    </PageContainer>
  )
}
