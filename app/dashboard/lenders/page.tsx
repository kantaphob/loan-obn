import { PageContainer } from '@/components/ui/page-container'
import Link from "next/link";
import { Landmark } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Header } from "@/components/ui/header";

export default function LendersPage() {
  return (
    <div className="relative z-10 min-h-[calc(100dvh-24px)] font-sans text-[#202a3c]">
      <PageContainer>
        <Header title="ผู้ให้กู้" eyebrow="Loan" description="จัดการข้อมูลผู้ให้กู้และแหล่งเงินทุน">
          <Link href="/dashboard/applications" className="mb-3 inline-flex items-center gap-1 text-[11px] font-medium text-[#343537] no-underline hover:text-black">
            ← กลับไปผู้กู้
          </Link>
        </Header>
        <Card as="section" className="flex min-h-[340px] flex-col items-center justify-center px-6 py-12 text-center">
          <span className="grid h-12 w-12 place-items-center rounded-2xl border border-white/80 bg-white/60 text-[#555659] shadow-[inset_0_1px_0_#ffffff]">
            <Landmark size={21} aria-hidden="true" />
          </span>
          <h2 className="mb-0 mt-4 text-[13px] font-semibold text-[#343537]">ยังไม่มีข้อมูลผู้ให้กู้</h2>
          <p className="mb-0 mt-2 max-w-sm text-[11px] leading-5 text-[#7c7d80]">รายการผู้ให้กู้และแหล่งเงินทุนจะแสดงที่หน้านี้</p>
        </Card>
      </PageContainer>
    </div>
  );
}
