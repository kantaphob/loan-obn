import { PageContainer } from '@/components/ui/page-container'
import { Header } from '@/components/ui/header'
import { Card } from '@/components/ui/card'

export default function Page() {
  return (
    <PageContainer>
      <Header title="บันทึกการทำงาน" eyebrow="Workspace" description="ติดตามประวัติการทำงานในระบบ" />
      <Card className="px-6 py-12 text-center">
        <p className="m-0 text-xs text-[#77787b]">ยังไม่มีรายการแสดงในหน้านี้</p>
      </Card>
    </PageContainer>
  )
}
