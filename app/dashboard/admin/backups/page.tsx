import { redirect } from 'next/navigation'
import { PageContainer } from '@/components/ui/page-container'
import { SubpageHeader } from '@/components/ui/subpage-header'
import { getCurrentUser } from '@/lib/auth/current-user'
import { BackupManager } from './backup-manager'

export default async function BackupsPage() {
  const user = await getCurrentUser()
  if (!user || !['ADMIN', 'SUPER_ADMIN'].includes(user.role)) redirect('/dashboard')

  return (
    <div className="relative z-10 min-h-[calc(100dvh-24px)] font-sans text-[#222325]">
      <PageContainer>
        <SubpageHeader
          eyebrow="Administration"
          title="สำรองข้อมูล"
          description="สร้างและดาวน์โหลดสำเนาฐานข้อมูล SQLite"
        />
        <BackupManager />
      </PageContainer>
    </div>
  )
}
