import { PageContainer } from '@/components/ui/page-container'
import { Header } from "@/components/ui/header";
import { FileSignature } from "lucide-react";
import { Card } from "@/components/ui/card";

export default function ContractsPage() {
  return (
    <div className="relative z-10 min-h-[calc(100dvh-24px)] font-sans text-[#202a3c]">
      <PageContainer>
        <Header title="สัญญา" eyebrow="Loan" description="จัดการสัญญาสินเชื่อที่ทำกับผู้กู้" />

        <Card as="section" className="flex min-h-[340px] flex-col items-center justify-center px-6 py-12 text-center">
          <span className="grid h-12 w-12 place-items-center rounded-2xl border border-white/80 bg-white/60 text-[#555659] shadow-[inset_0_1px_0_#ffffff]">
            <FileSignature size={21} aria-hidden="true" />
          </span>
          <h2 className="mb-0 mt-4 text-[13px] font-semibold text-[#343537]">ยังไม่มีสัญญาสินเชื่อ</h2>
          <p className="mb-0 mt-2 max-w-sm text-[11px] leading-5 text-[#7c7d80]">เมื่อมีการสร้างสัญญา รายการจะปรากฏที่หน้านี้</p>
        </Card>
      </PageContainer>
    </div>
  );
}
