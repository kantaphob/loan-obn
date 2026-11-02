'use client'

import { usePathname } from 'next/navigation'
import { DashboardSkeleton } from '@/app/dashboard/dashboard-skeleton'
import { PageContainer } from './page-container'
import { DataLoading } from './data-loading'
import { WorkspaceDirectory } from '@/components/dashboard/workspace-directory'
import { getWorkspaceContext, WORKSPACE_HOME } from '@/lib/nav'

/** Every loading boundary keeps the same page insets as the loaded route. */
export function RouteLoading() {
  const pathname = usePathname()
  // These directories contain navigation only, so the complete static shell is ready immediately.
  if (pathname === WORKSPACE_HOME.href) return <WorkspaceDirectory />
  const {group,isHub} = getWorkspaceContext(pathname)
  if (isHub && group) return <WorkspaceDirectory group={group} />
  return pathname === '/dashboard' ? <DashboardSkeleton /> : <PageContainer><DataLoading /></PageContainer>
}
