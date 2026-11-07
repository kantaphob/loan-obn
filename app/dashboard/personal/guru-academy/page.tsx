import { Suspense } from 'react'
import Link from 'next/link'
import { connection } from 'next/server'
import { PageContainer } from '@/components/ui/page-container'
import { Header } from '@/components/ui/header'
import { summarizeStudyProgress } from '@/lib/study-progress'
import { getStudyChecklist } from '../guruacademy/actions'
import { StudyProgress } from './progress'
import { ExamCountdown } from './exam-countdown'

const links = [
  { path: 'guruacademy', label: 'รายการเรียน', description: 'Checklist สิ่งที่เรียนแล้ว' },
  { path: 'examgurupolice', label: 'examgurupolice', description: 'บันทึกคะแนนสอบ' },
]

export default function GuruAcademyPage() {
  return <PageContainer>
    <Header title="Guru Academy" description="ติดตามสิ่งที่เรียนแล้วและบันทึกคะแนนสอบ" />
    <ExamCountdown />
    <div className="mb-4 grid gap-4 sm:grid-cols-2">
      {links.map(({ path, label, description }) => <Link key={path} href={`/dashboard/personal/${path}`} className="rounded-xl border border-slate-200 bg-white p-4">
        <span className="font-semibold">{label}</span>
        <p className="mt-1 text-sm text-slate-500">{description} →</p>
      </Link>)}
    </div>
    <Suspense fallback={<p role="status">กำลังโหลดความคืบหน้า…</p>}>
      <ProgressContent />
    </Suspense>
  </PageContainer>
}

async function ProgressContent() {
  await connection()
  const { courses } = await getStudyChecklist()
  return <StudyProgress rows={summarizeStudyProgress(courses)} />
}
