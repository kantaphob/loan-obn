import { Card } from '@/components/ui/card'
import { MasterdataSubnav } from '@/components/dashboard/masterdata-subnav'
import { PageContainer } from '@/components/ui/page-container'
import { SubpageHeader } from '@/components/ui/subpage-header'
import { prisma } from '@/lib/prisma'

const groupLabels: Record<string, string> = {
  CAPITAL: 'เงินทุน',
  LOAN: 'สินเชื่อ',
  INCOME: 'รายรับ',
  EXPENSE: 'รายจ่าย',
}

export default async function Page() {
  const [categories, riskRatings, paymentChannels] = await Promise.all([
    prisma.financialCategory.findMany({ where: { isActive: true }, orderBy: { sortOrder: 'asc' } }),
    prisma.riskRating.findMany({ where: { isActive: true }, orderBy: { score: 'asc' } }),
    prisma.paymentChannel.findMany({ where: { isActive: true }, orderBy: { code: 'asc' } }),
  ])
  const groups = [...new Set(categories.map(({ group }) => group))]

  return (
    <div className="relative z-10 min-h-[calc(100dvh-24px)] font-sans text-[#222325]">
      <PageContainer>
        <SubpageHeader title="หมวดหมู่" eyebrow="Administration" description="ข้อมูลหมวดรับ-จ่าย ช่องทางการเงิน และระดับความเสี่ยง" />
        <MasterdataSubnav />

        <div className="grid gap-4 lg:grid-cols-2">
          {groups.map((group) => (
            <Card key={group} as="section" className="overflow-hidden rounded-[20px]">
              <div className="flex items-center justify-between border-b border-white/75 px-5 py-4">
                <h2 className="m-0 text-sm font-semibold">{groupLabels[group] ?? group}</h2>
                <span className="rounded-full bg-white/65 px-3 py-1 text-xs text-[#667085]">
                  {categories.filter((category) => category.group === group).length} รายการ
                </span>
              </div>
              <div className="divide-y divide-white/65">
                {categories.filter((category) => category.group === group).map((category) => (
                  <div key={category.code} className="flex items-center justify-between gap-4 px-5 py-3.5 text-xs">
                    <div>
                      <p className="m-0 font-medium text-[#343537]">{category.nameTh}</p>
                      <p className="mb-0 mt-1 text-[10px] text-[#8992a3]">{category.nameEn} · {category.code}</p>
                    </div>
                    <span className={`shrink-0 rounded-full px-2.5 py-1 text-[10px] font-semibold ${category.direction === 'IN' ? 'bg-[#e9f7ef] text-[#27895c]' : 'bg-[#fff1e8] text-[#bd6b2a]'}`}>
                      {category.direction === 'IN' ? 'เงินเข้า' : 'เงินออก'}
                    </span>
                  </div>
                ))}
              </div>
            </Card>
          ))}

          <Card as="section" className="overflow-hidden rounded-[20px]">
            <div className="flex items-center justify-between border-b border-white/75 px-5 py-4">
              <h2 className="m-0 text-sm font-semibold">ระดับความเสี่ยง</h2>
              <span className="rounded-full bg-white/65 px-3 py-1 text-xs text-[#667085]">{riskRatings.length} รายการ</span>
            </div>
            <div className="divide-y divide-white/65">
              {riskRatings.map((rating) => (
                <div key={rating.code} className="flex items-center justify-between px-5 py-3.5 text-xs">
                  <span className="font-medium text-[#343537]">{rating.nameTh}</span>
                  <span className="text-[10px] text-[#8992a3]">{rating.isBlacklist ? 'รายการระงับ' : `ลำดับ ${rating.score}`}</span>
                </div>
              ))}
            </div>
          </Card>

          <Card as="section" className="overflow-hidden rounded-[20px]">
            <div className="flex items-center justify-between border-b border-white/75 px-5 py-4">
              <h2 className="m-0 text-sm font-semibold">ช่องทางการเงิน</h2>
              <span className="rounded-full bg-white/65 px-3 py-1 text-xs text-[#667085]">{paymentChannels.length} รายการ</span>
            </div>
            <div className="divide-y divide-white/65">
              {paymentChannels.map((channel) => (
                <div key={channel.code} className="flex items-center justify-between px-5 py-3.5 text-xs">
                  <span className="font-medium text-[#343537]">{channel.nameTh}</span>
                  <span className="text-[10px] text-[#8992a3]">{channel.nameEn ?? channel.code}</span>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </PageContainer>
    </div>
  )
}
