import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { PageContainer } from '@/components/ui/page-container'
import { Header } from '@/components/ui/header'
import { ContractBorrowerStep } from '../contract-borrower-step'

export default function NewContractPage() {
  return <PageContainer>
    <Header title="สร้างสัญญา" eyebrow="Contracts" description="ค้นหาและเลือกผู้กู้ยืมเพื่อเริ่มต้นสร้างสัญญา"
      actions={<Link href="/dashboard/contracts" className="action-button action-button--secondary"><ArrowLeft size={16} aria-hidden="true" />กลับหน้ารวมสัญญา</Link>} />
    <ContractBorrowerStep />
  </PageContainer>
}
