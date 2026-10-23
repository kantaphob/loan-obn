import '../borrower/borrower.css'
import { PageContainer } from '@/components/ui/page-container'
import { Header } from '@/components/ui/header'
import { FileSignature } from 'lucide-react'
import { ContractsDirectory } from './contracts-directory'

export default function ContractsPage() {
  return <PageContainer className="borrower-page">
    <Header title="รายการสัญญา" eyebrow="Contracts" description="จัดการสัญญาสินเชื่อและติดตามสถานะการจ่ายเงิน" icon={<FileSignature size={21} />} />
    <ContractsDirectory />
  </PageContainer>
}
