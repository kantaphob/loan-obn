import { PageContainer } from '@/components/ui/page-container'
import Link from 'next/link'
import { ArrowRight } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Header } from '@/components/ui/header'
import { MasterdataSubnav } from '@/components/dashboard/masterdata-subnav'

import { MASTERDATA_MENUS } from '@/lib/masterdata-nav'

export default function Masterdata() {
  return (
    <div className="relative z-10 min-h-[calc(100dvh-24px)] font-sans text-[#222325]">
      <PageContainer>
        <Header
          title="Masterdata"
          eyebrow="Administration"
          description="เลือกเมนูข้อมูลหลักที่ต้องการใช้งาน"
          status={{ label: `${MASTERDATA_MENUS.length} เมนูข้อมูลหลัก`, tone: 'success' }}
        />
        <MasterdataSubnav />
        <nav aria-label="เมนูข้อมูลหลัก">
          <ul className="grid grid-cols-2 gap-4 max-[760px]:grid-cols-1">
            {MASTERDATA_MENUS.map(({ title, description, href, icon: Icon, tone }) => (
              <li key={href} className="min-w-0">
                <Link href={href} className="group block h-full rounded-[20px] transition hover:-translate-y-0.5 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#3476df]">
                  <Card className="h-full rounded-[20px] p-5">
                    <div className="flex items-center justify-between gap-3">
                      <span className={`grid h-11 w-11 place-items-center rounded-[13px] ${tone}`}><Icon size={22} aria-hidden="true" /></span>
                      <ArrowRight size={18} aria-hidden="true" className="text-[#77787b] transition group-hover:translate-x-1 group-hover:text-[#3476df]" />
                    </div>
                    <h2 className="mb-0 mt-5 text-base font-semibold">{title}</h2>
                    <p className="mb-0 mt-2 text-xs leading-6 text-[#77787b]">{description}</p>
                    <p className="mb-0 mt-5 border-t border-white/70 pt-3 text-xs font-semibold text-[#3476df]">ดูรายการ</p>
                  </Card>
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </PageContainer>
    </div>
  )
}
