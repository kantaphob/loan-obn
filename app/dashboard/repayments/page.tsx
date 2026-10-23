import '../borrower/borrower.css'
import './repayments.css'
import { PageContainer } from '@/components/ui/page-container'
import { Header } from '@/components/ui/header'
import { HandCoins } from 'lucide-react'
import { getLedger } from '../ledger/actions'
import { RepaymentWorkspace } from './repayment-workspace'

export default async function RepaymentsPage() {
  const data = await getLedger()
  return <PageContainer className="borrower-page">
    <Header title="รับชำระตามสัญญา" eyebrow="Repayments" description="ค้นหาสัญญา ตรวจสอบยอดค้าง แล้วบันทึกเงินที่รับจริง" icon={<HandCoins size={21} />} />
    <RepaymentWorkspace data={data} />
  </PageContainer>
}
