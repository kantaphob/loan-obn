import { Card } from '@/components/ui/card'
import { MasterdataSubnav } from '@/components/dashboard/masterdata-subnav'
import { PageContainer } from '@/components/ui/page-container'
import { SubpageHeader } from '@/components/ui/subpage-header'
import { prisma } from '@/lib/prisma'
import { CategoryManager } from './category-manager'
import { getCurrentUser } from '@/lib/auth/current-user'

export default async function Page() {
  const [categories, paymentChannels, user] = await Promise.all([
    prisma.financialCategory.findMany({ where: { isActive: true }, orderBy: { sortOrder: 'asc' } }),
    prisma.paymentChannel.findMany({ where: { isActive: true }, orderBy: { code: 'asc' } }),
    getCurrentUser(),
  ])

  return (
    <div className="relative z-10 min-h-[calc(100dvh-24px)] font-sans text-[#222325]">
      <PageContainer>
        <SubpageHeader title="หมวดหมู่" eyebrow="Administration" description="ข้อมูลหมวดรับ-จ่าย และช่องทางการเงิน" />
        <MasterdataSubnav />

        <CategoryManager categories={categories.map(({ code, nameTh, nameEn, group, direction, sortOrder }) => ({ code, nameTh, nameEn, group, direction, sortOrder }))} canEdit={user?.role === 'ADMIN' || user?.role === 'SUPER_ADMIN'} />
        <div>
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
