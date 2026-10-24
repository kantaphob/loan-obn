import '../borrower/borrower.css'
import { Suspense } from 'react'
import { connection } from 'next/server'
import { PageContainer } from '@/components/ui/page-container'
import { Header } from '@/components/ui/header'
import { BookOpen } from 'lucide-react'
import { getLedger } from './actions'
import { LedgerWorkspace } from './ledger-workspace'

export default function LedgerPage() {
  return <Suspense fallback={<PageContainer className="borrower-page"><p role="status" className="p-6 text-sm text-slate-300">กำลังโหลดบัญชีรับ–จ่าย…</p></PageContainer>}><LedgerContent /></Suspense>
}

async function LedgerContent() {
  await connection()
  const data = await getLedger()
  return <PageContainer className="borrower-page">
    <Header title="บัญชีรับ–จ่าย" eyebrow="รายการปี 2026 · Cash ledger" description="ตรวจและบันทึกรายการรับ–จ่าย พร้อมหลักฐานและประวัติแก้ไข" icon={<BookOpen size={21} />} />
    <LedgerWorkspace data={data} />
  </PageContainer>
}
