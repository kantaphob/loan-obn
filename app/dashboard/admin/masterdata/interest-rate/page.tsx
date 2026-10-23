import { Percent } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { PageContainer } from '@/components/ui/page-container'
import { SubpageHeader } from '@/components/ui/subpage-header'
import { MasterdataSubnav } from '@/components/dashboard/masterdata-subnav'
import { prisma } from '@/lib/prisma'

export default async function InterestRatePage() {
  const rates = await prisma.interestRate.findMany({ where: { isActive: true }, orderBy: { sortOrder: 'asc' } })
  return (
    <PageContainer>
      <SubpageHeader title="ร้อยละดอกเบี้ย" eyebrow="Administration" icon={<Percent size={21} />} description="ตัวเลือกอัตราดอกเบี้ยสำหรับใช้อ้างอิงในสินเชื่อ" status={{ label: `${rates.length} อัตราดอกเบี้ย`, tone: 'neutral' }} />
      <MasterdataSubnav />
      <Card as="section" className="p-5">
        <h2 className="m-0 text-sm font-semibold text-slate-100">อัตราดอกเบี้ยในระบบ</h2>
        <p className="mb-5 mt-2 text-xs leading-6 text-slate-400">เป็นค่าร้อยละที่ยังไม่กำหนดรอบเวลา ต้องระบุรายวัน รายเดือน หรือรายปี รวมถึงวิธีคิดดอกเบี้ยในเงื่อนไขสินเชื่อก่อนนำไปคำนวณ</p>
        <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          {rates.map((rate) => (
            <li key={rate.code} className="rounded-2xl border border-sky-300/20 bg-sky-300/5 p-5">
              <p className="m-0 text-[10px] text-slate-400">ร้อยละดอกเบี้ย</p>
              <p className="mb-0 mt-3 font-mono text-3xl font-semibold text-sky-200">{rate.percent}<span className="ml-1 text-lg">%</span></p>
              <p className="mb-0 mt-4 text-xs text-slate-300">{rate.percent === 0 ? 'ไม่มีดอกเบี้ย' : `ร้อยละ ${rate.percent}`}</p>
            </li>
          ))}
        </ul>
        {!rates.length && <p className="py-8 text-center text-xs text-slate-400">ยังไม่มีอัตราดอกเบี้ย</p>}
      </Card>
    </PageContainer>
  )
}
