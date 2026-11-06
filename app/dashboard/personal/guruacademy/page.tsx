import { Suspense } from 'react'
import { connection } from 'next/server'
import { PageContainer } from '@/components/ui/page-container'
import { Header } from '@/components/ui/header'
import { getStudyChecklist } from './actions'
import { StudyChecklist } from './checklist'
export default function Page() {
  return <PageContainer><Header title="guruacademy" /><Suspense fallback={<p role="status">กำลังโหลดรายการเรียน…</p>}><Content /></Suspense></PageContainer>
}
async function Content() {
  await connection()
  return <StudyChecklist data={await getStudyChecklist()} />
}
