import { notFound } from 'next/navigation'
import { Suspense } from 'react'
import { WorkspaceDirectory } from '@/components/dashboard/workspace-directory'
import { NAV_GROUPS } from '@/lib/nav'
import { RouteLoading } from '@/components/ui/route-loading'

export function generateStaticParams() {
  return NAV_GROUPS.filter(group=>group.id!=='overview').map(group=>({section:group.id}))
}

export async function generateMetadata({ params }: { params: Promise<{section:string}> }) {
  const {section}=await params
  const group=NAV_GROUPS.find(group=>group.id===section)
  return {title:`${group?.title ?? 'พื้นที่ทำงาน'} | Loan OBN`}
}

export default function WorkspaceSectionPage(props: { params: Promise<{section:string}> }) {
  return <Suspense fallback={<RouteLoading />}><SectionContent {...props} /></Suspense>
}

async function SectionContent({ params }: { params: Promise<{section:string}> }) {
  const {section}=await params
  const group=NAV_GROUPS.find(group=>group.id===section && group.id!=='overview')
  if (!group) notFound()
  return <WorkspaceDirectory group={group} />
}
