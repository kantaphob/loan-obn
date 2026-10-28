import { DataLoading } from '@/components/ui/data-loading'
import '../borrower/borrower.css'
import { Suspense } from 'react'
import { connection } from 'next/server'
import { Landmark } from 'lucide-react'
import { PageContainer } from '@/components/ui/page-container'
import { SubpageHeader } from '@/components/ui/subpage-header'
import { getCurrentUser } from '@/lib/auth/current-user'
import { prisma } from '@/lib/prisma'
import { LenderManager } from './lender-manager'

export default function LendersPage({ searchParams }: { searchParams: Promise<{ q?: string; role?: string; status?: string; page?: string }> }) {
  return <Suspense fallback={<PageContainer><DataLoading label="กำลังโหลดข้อมูลผู้ให้กู้…" /></PageContainer>}><LenderContent searchParams={searchParams} /></Suspense>
}
async function LenderContent({ searchParams }: { searchParams: Promise<{ q?: string; role?: string; status?: string; page?: string }> }) {
  await connection()
  const params = await searchParams
  const query = (params.q ?? '').trim().slice(0, 100)
  const role = ['FUNDER', 'REPRESENTATIVE', 'BOTH'].includes(params.role ?? '') ? params.role! : ''
  const status = ['ACTIVE', 'INACTIVE'].includes(params.status ?? '') ? params.status! : ''
  const page = Math.max(1, Math.min(100000, Number.parseInt(params.page ?? '1', 10) || 1))
  const where = {
    ...(status ? { status } : {}),
    ...(role ? { role: role === 'BOTH' ? 'BOTH' : { in: [role, 'BOTH'] } } : {}),
    ...(query ? { OR: ['nickname', 'firstName', 'lastName', 'phone', 'nationalId'].map(field => ({ [field]: { contains: query } })) } : {}),
  }
  const [user, lenders, total, allLenders, provinces, banks, channels] = await Promise.all([
    getCurrentUser(), prisma.lender.findMany({ where, omit: { updatedAt: true, cardData: true }, orderBy: { id: 'desc' }, skip: (page - 1) * 25, take: 25 }),
    prisma.lender.count({ where }), prisma.lender.findMany({ select: { role: true, status: true } }),
    prisma.province.findMany({ select: { id: true, nameTh: true }, orderBy: { nameTh: 'asc' } }),
    prisma.bank.findMany({ select: { code: true, nameTh: true, isActive: true }, orderBy: { sortOrder: 'asc' } }),
    prisma.paymentChannel.findMany({ select: { code: true, nameTh: true, isActive: true }, orderBy: { code: 'asc' } }),
  ])
  return <PageContainer className="borrower-page">
    <SubpageHeader title="รายชื่อผู้ให้กู้" eyebrow="Lenders" description="บันทึกข้อมูลผู้ปล่อยเงินและผู้ทำสัญญาแทน" icon={<Landmark size={21} />} />
    <LenderManager key={`${page}:${query}:${role}:${status}`} lenders={lenders.map(({ createdAt, cardReadAt, nationalId, ...lender }) => ({ ...lender, nationalId: nationalId ?? '', cardReadAt: cardReadAt?.toISOString() ?? null, createdAt: createdAt.toISOString() }))} total={total} page={page} query={query} role={role} status={status} metrics={{ total: allLenders.length, funders: allLenders.filter(l => l.status === 'ACTIVE' && ['FUNDER', 'BOTH'].includes(l.role)).length, representatives: allLenders.filter(l => l.status === 'ACTIVE' && ['REPRESENTATIVE', 'BOTH'].includes(l.role)).length }} provinces={provinces} banks={banks} channels={channels} canEdit={Boolean(user && user.role !== 'REVIEWER')} />
  </PageContainer>
}
