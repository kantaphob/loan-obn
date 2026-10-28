import { DataLoading } from '@/components/ui/data-loading'
import '../borrower/borrower.css'
import './credit-workspace.css'
import { Suspense } from 'react'
import { connection } from 'next/server'
import { ShieldCheck } from 'lucide-react'
import { PageContainer } from '@/components/ui/page-container'
import { Header } from '@/components/ui/header'
import { getCreditDirectory } from './actions'
import { CreditWorkspace } from './credit-workspace'

export default function CreditBureauPage() {
  return <Suspense fallback={<PageContainer className="borrower-page credit-page"><DataLoading label="กำลังโหลดประวัติเครดิต…" /></PageContainer>}><CreditBureauContent /></Suspense>
}

async function CreditBureauContent() {
  await connection()
  const people = await getCreditDirectory()
  return <PageContainer className="borrower-page credit-page">
    <Header title="Credit Bureau" eyebrow="ประวัติการเงินรายบุคคล" description="ประวัติสัญญาและการชำระภายในระบบ OBN" icon={<ShieldCheck size={21} aria-hidden="true" />} />
    <CreditWorkspace people={people} />
  </PageContainer>
}
