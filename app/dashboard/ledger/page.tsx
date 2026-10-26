import '../borrower/borrower.css'
import { Suspense } from 'react'
import { connection } from 'next/server'
import { PageContainer } from '@/components/ui/page-container'
import { Header } from '@/components/ui/header'
import { BookOpen } from 'lucide-react'
import { getLedger } from './actions'
import { LedgerWorkspace } from './ledger-workspace'
import { getHistoricalLedger } from './actions'
import { CombinedLedgerWorkspace } from './combined-ledger-workspace'

export default function LedgerPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  return <Suspense fallback={<PageContainer className="borrower-page"><p role="status" className="p-6 text-sm text-slate-300">กำลังโหลดบัญชีรับ–จ่าย…</p></PageContainer>}><LedgerContent searchParams={searchParams} /></Suspense>
}

async function LedgerContent({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await connection()
  const params = await searchParams
  const year = params.year === '2025' ? 2025 : params.year === '2026' ? 2026 : 'all'
  const initialDirection = params.direction === 'OUT' ? 'OUT' : 'IN'
  const historical = year === 2025
  const workspace = year === 'all'
    ? <CombinedLedgerWorkspace current={await getLedger()} historical={await getHistoricalLedger()} params={params} />
    : historical
      ? <CombinedLedgerWorkspace current={await getLedger()} historical={await getHistoricalLedger()} params={params} year={2025} />
      : <LedgerWorkspace key={`${params.create === '1' ? 'create' : 'browse'}-${initialDirection}`} data={await getLedger()} initialCreate={params.create === '1'} initialDirection={initialDirection} />
  return <PageContainer className="borrower-page">
    <Header title="บัญชีรับ–จ่าย" eyebrow={year === 'all' ? 'รายการรวม · 2025–2026 · Cash ledger' : `รายการปี ${year} · Cash ledger`} description={year === 'all' ? 'ดูรายการรับ–จ่ายของทุกปีในบัญชีเดียว แล้วกรองตามปี ประเภท หรือค้นหาคำสำคัญ' : year === 2025 ? 'ดูรายการรับ–จ่ายย้อนหลังและกรองตามเดือนหรือประเภทรายการ' : 'ตรวจและบันทึกรายการรับ–จ่าย พร้อมหลักฐานและประวัติแก้ไข'} icon={<BookOpen size={21} />} />
    {workspace}
  </PageContainer>
}
