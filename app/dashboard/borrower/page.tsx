import './borrower.css'
import { Suspense } from 'react'
import { connection } from 'next/server'
import { UsersRound } from 'lucide-react'
import { PageContainer } from '@/components/ui/page-container'
import { SubpageHeader } from '@/components/ui/subpage-header'
import { getCurrentUser } from '@/lib/auth/current-user'
import { prisma } from '@/lib/prisma'
import { BorrowerManager } from './borrower-manager'

export default function BorrowerPage() {
  return <Suspense fallback={<PageContainer className="borrower-page"><p role="status" className="p-6 text-sm text-slate-300">กำลังโหลดข้อมูลผู้กู้ยืม…</p></PageContainer>}><BorrowerContent /></Suspense>
}

async function BorrowerContent() {
  await connection()
  const user = await getCurrentUser()
  const [borrowers, channels, ratings, provinces, banks] = await Promise.all([
    prisma.borrower.findMany({ orderBy: { id: 'desc' } }),
    prisma.paymentChannel.findMany({ orderBy: { code: 'asc' } }),
    prisma.riskRating.findMany({ orderBy: { score: 'asc' } }),
    prisma.province.findMany({ select: { id: true, nameTh: true }, orderBy: { nameTh: 'asc' } }),
    prisma.bank.findMany({ select: { code: true, nameTh: true, isActive: true }, orderBy: { sortOrder: 'asc' } }),
  ])
  return <PageContainer className="borrower-page">
    <SubpageHeader title="ระบบผู้กู้ยืม" eyebrow="Borrowers" description="จัดการข้อมูลผู้กู้ยืม ช่องทางติดต่อ และวงเงิน" icon={<UsersRound size={21} />} />
    <BorrowerManager borrowers={borrowers.map(b => ({ ...b, registeredAt: b.registeredAt.toISOString(), cardReadAt: b.cardReadAt?.toISOString() ?? null, createdAt: undefined, updatedAt: undefined }))} today={new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Bangkok', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date())} banks={banks} provinces={provinces} channels={channels} ratings={ratings} canCreate={user?.role !== 'REVIEWER'} />
  </PageContainer>
}
