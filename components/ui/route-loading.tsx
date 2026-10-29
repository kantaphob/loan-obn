'use client'

import { usePathname } from 'next/navigation'
import { DashboardSkeleton } from '@/app/dashboard/dashboard-skeleton'
import { PageContainer } from './page-container'
import { DataLoading } from './data-loading'

/** Every loading boundary keeps the same page insets as the loaded route. */
export function RouteLoading() {
  const pathname = usePathname()
  return pathname === '/dashboard' ? <DashboardSkeleton /> : <PageContainer><DataLoading /></PageContainer>
}
