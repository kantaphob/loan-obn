import '../borrower/borrower.css'
import './credit-workspace.css'
import { connection } from 'next/server'
import { ShieldCheck } from 'lucide-react'
import { PageContainer } from '@/components/ui/page-container'
import { Header } from '@/components/ui/header'
import { getCreditDirectory } from './actions'
import { CreditWorkspace } from './credit-workspace'

export default async function CreditBureauPage() {
  await connection()
  const people = await getCreditDirectory()
  return <PageContainer className="borrower-page credit-page">
    <Header title="Credit Bureau" eyebrow="ประวัติการเงินรายบุคคล" description="ประวัติสัญญาและการชำระภายในระบบ OBN" icon={<ShieldCheck size={21} aria-hidden="true" />} />
    <CreditWorkspace people={people} />
  </PageContainer>
}
