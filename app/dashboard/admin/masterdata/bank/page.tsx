import { Card } from '@/components/ui/card'
import { MasterdataSubnav } from '@/components/dashboard/masterdata-subnav'
import { PageContainer } from '@/components/ui/page-container'
import { SubpageHeader } from '@/components/ui/subpage-header'
import { prisma } from '@/lib/prisma'

const bankTones: Record<string, string> = {
  BBL: 'border-blue-300/35 bg-blue-400/15 text-blue-200',
  KBANK: 'border-emerald-300/35 bg-emerald-400/15 text-emerald-200',
  KTB: 'border-sky-300/35 bg-sky-400/15 text-sky-200',
  SCB: 'border-purple-300/35 bg-purple-400/15 text-purple-200',
  BAY: 'border-yellow-300/35 bg-yellow-400/15 text-yellow-200',
  TTB: 'border-orange-300/35 bg-orange-400/15 text-orange-200',
  GSB: 'border-pink-300/35 bg-pink-400/15 text-pink-200',
  BAAC: 'border-green-300/35 bg-green-400/15 text-green-200',
  GHB: 'border-amber-300/35 bg-amber-400/15 text-amber-200',
}

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
            <span className="rounded-full border border-emerald-300/25 bg-emerald-300/10 px-3 py-1.5 text-xs font-semibold text-emerald-200">{banks.length.toLocaleString('th-TH')} ธนาคาร</span>
          </div>
          {banks.length === 0 ? (
            <p className="m-0 px-5 py-12 text-center text-xs text-[#77787b]">ยังไม่มีข้อมูลธนาคาร</p>
          ) : (
            <div className="grid gap-3 p-4 sm:grid-cols-2 xl:grid-cols-3">
              {banks.map((bank) => (
                <div key={bank.code} className="flex min-h-[100px] items-start gap-3 rounded-xl border border-slate-400/15 bg-slate-400/5 p-4">
                  <span aria-label={`รหัสธนาคาร ${bank.code}`} className={`grid h-12 w-14 shrink-0 place-items-center rounded-xl border font-mono text-[11px] font-bold ${bankTones[bank.code] ?? 'border-slate-300/30 bg-slate-400/15 text-slate-200'}`}>{bank.code}</span>
                  <div className="min-w-0">
                    <p className="m-0 text-xs font-semibold leading-6 text-slate-100">{bank.nameTh}</p>
                    <p className="mb-0 mt-1 text-[11px] leading-5 text-slate-400">{bank.nameEn}</p>
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
