import { Suspense } from 'react'
import { connection } from 'next/server'
import { PageContainer } from '@/components/ui/page-container'
import { Header } from '@/components/ui/header'
import { getCurrentUser } from '@/lib/auth/current-user'
import { prisma } from '@/lib/prisma'
import { UtilityWorkspace } from './utility-workspace'

export default function UtilitiesPage() {
  return <PageContainer><Header title="สาธารณูปโภค" description="แยกค่าน้ำ–ค่าไฟตามบ้าน เก็บข้อมูลมิเตอร์ ยอดเงิน และประวัติรายเดือนสำหรับใช้ย้อนหลัง" /><Suspense fallback={<p role="status">กำลังโหลดรายการ…</p>}><Content /></Suspense></PageContainer>
}
async function Content() {
  await connection()
  const user = await getCurrentUser()
  if (!user || user.status !== 'ACTIVE') return <p>ไม่มีสิทธิ์เข้าถึงข้อมูล</p>
  const [bills, homes] = await Promise.all([
    prisma.utilityBill.findMany({ where: { operatorId: user.id }, orderBy: [{ period: 'desc' }, { id: 'desc' }] }),
    prisma.utilityHome.findMany({ where: { operatorId: user.id }, orderBy: { id: 'asc' } }),
  ])
  return <UtilityWorkspace homes={homes} bills={bills} canWrite={user.role !== 'REVIEWER'} />
}
