import { Suspense } from 'react'
import { connection } from 'next/server'
import { FolderUser } from 'lucide-react'
import { PageContainer } from '@/components/ui/page-container'
import { SubpageHeader } from '@/components/ui/subpage-header'
import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/lib/auth/current-user'
import { PersuaderManager } from './persuader-manager'

export default function PersuadersPage({ searchParams }: { searchParams: Promise<{ q?: string; page?: string }> }) {
  return <Suspense fallback={<PageContainer><p role="status">กำลังโหลดผู้แนะนำ…</p></PageContainer>}><Content searchParams={searchParams} /></Suspense>
}
async function Content({ searchParams }: { searchParams: Promise<{ q?: string; page?: string }> }) {
  await connection()
  const params = await searchParams
  const q = (params.q ?? '').trim().slice(0, 100)
  const requested = Math.max(1, Math.min(100000, Number.parseInt(params.page ?? '1', 10) || 1))
  const where = q ? { OR: [{ name: { contains: q } }, { phone: { contains: q } }] } : {}
  const [user, total, banks] = await Promise.all([getCurrentUser(), prisma.persuader.count({ where }), prisma.bank.findMany({ select: { code: true, nameTh: true, isActive: true }, orderBy: { sortOrder: 'asc' } })])
  const page = Math.min(requested, Math.max(1, Math.ceil(total / 25)))
  const rows = await prisma.persuader.findMany({ where, orderBy: { id: 'desc' }, skip: (page - 1) * 25, take: 25, omit: { createdAt: true, updatedAt: true } })
  return <PageContainer><SubpageHeader title="Persuader · ผู้แนะนำ" eyebrow="Lenders" description="บันทึกผู้แนะนำ หรือเพิ่มจากรายชื่อ Borrower เพื่อเลือกใช้ในสัญญา" icon={<FolderUser size={21} />} /><PersuaderManager key={`${q}:${page}`} rows={rows} total={total} page={page} query={q} banks={banks} canEdit={Boolean(user && user.status === 'ACTIVE' && user.role !== 'REVIEWER')} /></PageContainer>
}
