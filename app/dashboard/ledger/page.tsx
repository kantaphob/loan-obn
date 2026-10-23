import '../borrower/borrower.css'
import { PageContainer } from '@/components/ui/page-container'
import { Header } from '@/components/ui/header'
import { BookOpen } from 'lucide-react'
import { getLedger } from './actions'
import { LedgerWorkspace } from './ledger-workspace'

export default async function LedgerPage() {
  const data = await getLedger()
  return <PageContainer className="borrower-page">
    <Header title="บัญชีรับ–จ่าย" eyebrow="Cash ledger" description="บันทึกเงินเข้า–ออก และติดตามการจ่ายเงินกู้กับการรับชำระตามสัญญา" icon={<BookOpen size={21} />} />
    <LedgerWorkspace data={data} />
  </PageContainer>
}
