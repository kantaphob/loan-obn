import Link from 'next/link'
import { PageContainer } from '@/components/ui/page-container'
import { Header } from '@/components/ui/header'
export default function GuruAcademyPage() {
  return <PageContainer><Header title="Guru Academy" description="ติดตามสิ่งที่เรียนแล้วและบันทึกคะแนนสอบ" /><div className="grid gap-4 sm:grid-cols-2">{['guruacademy', 'examgurupolice'].map(name => <Link key={name} href={`/dashboard/personal/${name}`} className="rounded-xl border border-slate-200 bg-white p-6"><h2 className="font-semibold">{name}</h2><p className="mt-2 text-sm text-slate-500">{name === 'guruacademy' ? 'Checklist สิ่งที่เรียนแล้ว →' : 'บันทึกคะแนนสอบ →'}</p></Link>)}</div></PageContainer>
}
