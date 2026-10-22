import { Card } from '@/components/ui/card'
import { MasterdataSubnav } from '@/components/dashboard/masterdata-subnav'
import { PageContainer } from '@/components/ui/page-container'
import { SubpageHeader } from '@/components/ui/subpage-header'
import { prisma } from '@/lib/prisma'

export default async function BankMasterdataPage() {
  const banks = await prisma.bank.findMany({
    where: { isActive: true },
    orderBy: { sortOrder: 'asc' },
  })

  return (
    <div className="relative z-10 min-h-[calc(100dvh-24px)] font-sans text-[#222325]">
      <PageContainer>
        <SubpageHeader title="ธนาคาร" eyebrow="Administration" description="รายชื่อธนาคารสำหรับเลือกเป็นช่องทางรับหรือจ่ายเงิน" />
        <MasterdataSubnav />
        <Card as="section" className="overflow-hidden rounded-[20px]">
          <div className="flex items-center justify-between border-b border-white/75 px-5 py-4">
            <h2 className="m-0 text-sm font-semibold">ธนาคารในระบบ</h2>
            <span className="rounded-full bg-[#e9f7ef] px-3 py-1.5 text-xs font-semibold text-[#27895c]">{banks.length.toLocaleString('th-TH')} ธนาคาร</span>
          </div>
          {banks.length === 0 ? (
            <p className="m-0 px-5 py-12 text-center text-xs text-[#77787b]">ยังไม่มีข้อมูลธนาคาร</p>
          ) : (
            <div className="grid gap-px bg-white/60 sm:grid-cols-2 lg:grid-cols-3">
              {banks.map((bank) => (
                <div key={bank.code} className="flex min-h-[82px] items-center gap-3 bg-white/30 px-5 py-4">
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[#eaf1ff] text-[10px] font-bold text-[#3476df]">{bank.shortName.slice(0, 4)}</span>
                  <div className="min-w-0">
                    <p className="m-0 truncate text-xs font-semibold text-[#343537]">{bank.nameTh}</p>
                    <p className="mb-0 mt-1 truncate text-[10px] text-[#8992a3]">{bank.nameEn}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </PageContainer>
    </div>
  )
}
