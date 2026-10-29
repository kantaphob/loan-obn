import { DataLoading } from '@/components/ui/data-loading'
import '../borrower/borrower.css'
import './repayments.css'
import { Suspense } from 'react'
import { PageContainer } from '@/components/ui/page-container'
import { Header } from '@/components/ui/header'
import { HandCoins, FileText } from 'lucide-react'
import Link from 'next/link'
import { connection } from 'next/server'
import { getReceivables } from './actions'
import { RepaymentWorkspace } from './repayment-workspace'

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> }

export default function RepaymentsPage(props: Props) {
  return <PageContainer className="borrower-page">
    <Header title="ลูกหนี้และรับชำระ" eyebrow="Repayments" description="ติดตามลูกหนี้ ตรวจสัญญาและประวัติ แล้วรับชำระตามวันโอนเงินจริง" icon={<HandCoins size={21} aria-hidden="true" />} actions={<Link className="action-button action-button--primary" href="/dashboard/repayments/summary"><FileText size={16} aria-hidden="true" />สรุปยอดรายบุคคล</Link>} />
    <Suspense fallback={<DataLoading showHeader={false} label="กำลังโหลดรายการลูกหนี้…" />}>
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
