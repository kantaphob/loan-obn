import Link from 'next/link'
import { ArrowUpRight, Boxes } from 'lucide-react'
import { PageContainer } from '@/components/ui/page-container'
import { SubpageHeader } from '@/components/ui/subpage-header'
import { MasterdataSubnav } from '@/components/dashboard/masterdata-subnav'
import { prisma } from '@/lib/prisma'

import { getCurrentUser } from '@/lib/auth/current-user'
import { AssetCategoryManager } from './asset-category-manager'

export default async function AssetCategoryPage() {
  const [categories, user] = await Promise.all([
    prisma.assetCategory.findMany({ where: { isActive: true }, orderBy: [{ sortOrder: 'asc' }, { code: 'asc' }] }),
    getCurrentUser(),
  ])
  const roots = categories.filter((item) => !item.parentCode)
  return (
    <PageContainer>
      <SubpageHeader title="หมวดหมู่สินทรัพย์" eyebrow="Administration" description="จัดกลุ่มสินทรัพย์ตามลักษณะและระยะเวลาการใช้ประโยชน์" icon={<Boxes size={21} />} status={{ label: `${roots.length} ประเภทหลัก · ${categories.length - roots.length} หมวดย่อย`, tone: 'neutral' }} actions={<Link href="/asset" className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-slate-300/25 px-3 text-xs font-semibold text-slate-600">เปิดหน้าสินทรัพย์<ArrowUpRight size={14} aria-hidden="true" /></Link>} />
      <MasterdataSubnav />
      <AssetCategoryManager categories={categories} canEdit={user?.status === 'ACTIVE' && (user.role === 'ADMIN' || user.role === 'SUPER_ADMIN')} />
    </PageContainer>
  )
}
