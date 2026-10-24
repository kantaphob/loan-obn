import '../borrower/borrower.css'
import './repayments.css'
import { Suspense } from 'react'
import { PageContainer } from '@/components/ui/page-container'
import { Header } from '@/components/ui/header'
import { HandCoins } from 'lucide-react'
import { connection } from 'next/server'
import { getReceivables } from './actions'
import { RepaymentWorkspace } from './repayment-workspace'

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> }

export default function RepaymentsPage(props: Props) {
  return <PageContainer className="borrower-page">
    <Header title="ลูกหนี้และรับชำระ" eyebrow="Repayments" description="ติดตามลูกหนี้ ตรวจสัญญาและประวัติ แล้วรับชำระตามวันโอนเงินจริง" icon={<HandCoins size={21} aria-hidden="true" />} />
    <Suspense fallback={<p role="status" className="p-8 text-center text-sm text-slate-500">กำลังโหลดรายการลูกหนี้…</p>}>
      <ReceivablesContent {...props} />
    </Suspense>
  </PageContainer>
}

async function ReceivablesContent({ searchParams }: Props) {
  const params = await searchParams
  const initialQuery = typeof params.q === 'string' ? params.q.slice(0, 100) : ''
  const initialView = typeof params.view === 'string' && ['OPEN', 'OVERDUE', 'TODAY', 'UPCOMING', 'CLOSED', 'ALL'].includes(params.view) ? params.view : 'OPEN'
  const value = Number(params.page)
  const initialPage = Number.isFinite(value) ? Math.max(1, Math.floor(value)) : 1
  await connection()
  const data = await getReceivables({ q: initialQuery, view: initialView, page: initialPage })
  return <RepaymentWorkspace key={`${initialQuery}:${initialView}:${data.page}`} data={data} initialQuery={initialQuery} initialView={initialView} />
}
