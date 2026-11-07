import { Suspense } from 'react'
import { connection } from 'next/server'
import { PageContainer } from '@/components/ui/page-container'
import { Header } from '@/components/ui/header'
import { getExamScores } from './actions'
import { ScoreWorkspace } from './score-workspace'
import { ExamCountdown } from '../guru-academy/exam-countdown'
export default function Page() {
  return <PageContainer><Header title="examgurupolice" description="บันทึกคะแนนข้อสอบ 6 วิชา ติดตามประวัติและความแม่นยำรายวิชา" /><ExamCountdown /><Suspense fallback={<p role="status">กำลังโหลดคะแนน…</p>}><Content /></Suspense></PageContainer>
}
async function Content() {
  await connection()
  return <ScoreWorkspace data={await getExamScores()} />
}
