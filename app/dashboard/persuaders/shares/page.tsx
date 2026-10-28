import { connection } from 'next/server'
import { HandCoins } from 'lucide-react'
import { PageContainer } from '@/components/ui/page-container'
import { SubpageHeader } from '@/components/ui/subpage-header'
import { getPersuaderShares } from './actions'
import { PersuaderSharesWorkspace } from './workspace'

export default async function PersuaderSharesPage() {
  await connection()
  const data = await getPersuaderShares()
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Bangkok', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date())
  return <PageContainer className="borrower-page">
    <SubpageHeader title="ส่วนแบ่งผู้แนะนำ" eyebrow="Persuader shares" description="เกิดยอดรอจ่ายเมื่อผู้กู้ชำระครบสัญญา และบันทึกการโอนผ่านบัญชีสินเชื่อ" icon={<HandCoins size={21} />} />
    <PersuaderSharesWorkspace rows={data.rows} channels={data.channels} today={today} />
  </PageContainer>
}
