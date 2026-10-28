import { DataLoading } from '@/components/ui/data-loading'
import { Suspense } from 'react'
import { connection } from 'next/server'
import { PageContainer } from '@/components/ui/page-container'
import { Header } from '@/components/ui/header'
import { HandCoins } from 'lucide-react'
import { getTradeReceivables } from './actions'
import { TradeReceivablesWorkspace } from './workspace'

export default function TradeReceivablesPage() {
  return <Suspense fallback={<PageContainer className="borrower-page"><DataLoading label="กำลังโหลดลูกหนี้ค้างรับ…" /></PageContainer>}><Content /></Suspense>
}

async function Content() {
  await connection()
  const data = await getTradeReceivables()
  return <PageContainer className="borrower-page">
    <Header title="ลูกหนี้ค้างรับ" eyebrow="Receivables · ไม่เกี่ยวกับเงินกู้" description="บันทึกยอดจากการขายหรือให้บริการที่ลูกค้ายังไม่ได้ชำระ และรับเงินจริงภายหลัง" icon={<HandCoins size={21} />} />
    <TradeReceivablesWorkspace data={data} />
  </PageContainer>
}
