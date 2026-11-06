import { Suspense } from 'react'
import { connection } from 'next/server'
import { FolderUser } from 'lucide-react'
import { PageContainer } from '@/components/ui/page-container'
import { Header } from '@/components/ui/header'
import { getPersonalPlans } from './actions'
import { PersonalWorkspace } from './workspace'

export default function PersonalPage() {
  return <PageContainer><Header title="ส่วนตัว" description="รายรับ–รายจ่ายส่วนตัวและ Guru Academy พร้อมงบประมาณและรายการบัญชีที่เชื่อมกับ Ledger" icon={<FolderUser size={21} />} /><Suspense fallback={<p role="status">กำลังโหลดแผนส่วนตัว…</p>}><Content /></Suspense></PageContainer>
}
async function Content() {
  await connection()
  return <PersonalWorkspace data={await getPersonalPlans()} />
}
