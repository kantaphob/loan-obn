import { DataLoading } from '@/components/ui/data-loading'
import './borrower.css'
import { Suspense } from 'react'
import { connection } from 'next/server'
import { UsersRound } from 'lucide-react'
import { PageContainer } from '@/components/ui/page-container'
import { SubpageHeader } from '@/components/ui/subpage-header'
import { getCurrentUser } from '@/lib/auth/current-user'
import { prisma } from '@/lib/prisma'
import { BorrowerManager } from './borrower-manager'
import { borrowerPosition } from '@/lib/borrower-position'
import { bangkokToday } from '@/lib/ledger'
import { borrowerStatuses } from '@/lib/borrower'

export default function BorrowerPage({ searchParams }: { searchParams: Promise<{ q?: string; status?: string; page?: string }> }) {
  return <Suspense fallback={<PageContainer className="borrower-page"><DataLoading label="กำลังโหลดข้อมูลผู้กู้ยืม…" /></PageContainer>}><BorrowerContent searchParams={searchParams} /></Suspense>
}

async function BorrowerContent({ searchParams }: { searchParams: Promise<{ q?: string; status?: string; page?: string }> }) {
  await connection()
  const params = await searchParams
  const query = (params.q ?? '').trim().slice(0, 100)
  const status = Object.hasOwn(borrowerStatuses, params.status ?? '') ? params.status! : ''
  const page = Math.max(1, Math.min(100000, Number.parseInt(params.page ?? '1', 10) || 1))
  const where = {
    ...(status ? { status } : {}),
    ...(query ? { OR: ['borrowerId', 'nickname', 'firstName', 'lastName', 'phone', 'nationalId', 'workplace', 'referrer'].map(field => ({ [field]: { contains: query } })) } : {}),
  }
  const user = await getCurrentUser()
  const [borrowers, total, allCount, totals, activeCount, channels, ratings, provinces, banks, positions] = await Promise.all([
    prisma.borrower.findMany({ where, omit: { cardData: true }, orderBy: { id: 'desc' }, skip: (page - 1) * 25, take: 25 }),
    prisma.borrower.count({ where }),
    prisma.borrower.count(),
    prisma.borrower.aggregate({ _sum: { approvedLimit: true, usedLimit: true } }),
    prisma.borrower.count({ where: { status: 'ACTIVE' } }),
    prisma.paymentChannel.findMany({ orderBy: { code: 'asc' } }),
    prisma.riskRating.findMany({ orderBy: { score: 'asc' } }),
    prisma.province.findMany({ select: { id: true, nameTh: true }, orderBy: { nameTh: 'asc' } }),
    prisma.bank.findMany({ select: { code: true, nameTh: true, isActive: true }, orderBy: { sortOrder: 'asc' } }),
    prisma.borrower.findMany({ select: { id: true, approvedLimit: true, usedLimit: true, contracts: { select: { principalSatang: true, interestSatang: true, repaymentSatang: true, status: true, paidAt: true, legacyReceivedSatang: true, repaymentDueDate: true, penaltyMaxDays: true, ledgerEntries: { where: { voidedAt: null }, select: { id: true, kind: true, amountSatang: true, occurredOn: true, penaltyWaivedSatang: true, penaltyAssessed: true, settlementWaivedSatang: true } } } } } }),
  ])
  const today = bangkokToday()
  const currentPositions = new Map(positions.map(b => [b.id, borrowerPosition(b.contracts, b.usedLimit, today)]))
  const currentUsed = positions.reduce((sum, b) => sum + currentPositions.get(b.id)!.currentUsedLimit, 0)
  const currentAvailable = positions.reduce((sum, b) => sum + Math.max(0, b.approvedLimit - currentPositions.get(b.id)!.committedLimit), 0)
  return <PageContainer className="borrower-page">
    <SubpageHeader title="ระบบผู้กู้ยืม" eyebrow="Borrowers" description="จัดการข้อมูลผู้กู้ยืม ช่องทางติดต่อ และวงเงิน" icon={<UsersRound size={21} />} />
    <BorrowerManager key={`${page}:${query}:${status}`} borrowers={borrowers.map(b => ({ ...b, ...currentPositions.get(b.id)!, cardData: null, hasLineQr: Boolean(b.lineQrImage), lineQrImage: undefined, registeredAt: b.registeredAt.toISOString(), cardReadAt: b.cardReadAt?.toISOString() ?? null, createdAt: undefined, updatedAt: undefined }))} total={total} page={page} query={query} status={status} aggregate={{ approved: totals._sum.approvedLimit ?? 0, used: currentUsed, available: currentAvailable, active: activeCount, total: allCount }} today={new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Bangkok', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date())} banks={banks} provinces={provinces} channels={channels} ratings={ratings} canCreate={user?.role !== 'REVIEWER'} />
  </PageContainer>
}
