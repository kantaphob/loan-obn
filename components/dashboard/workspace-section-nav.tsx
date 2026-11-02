'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useRef } from 'react'
import { getWorkspaceContext } from '@/lib/nav'

/** Related pages stay one click away on every screen in a work area. */
export function WorkspaceSectionNav() {
  const pathname = usePathname()
  const {group, item, isHub} = getWorkspaceContext(pathname)
  const nav = useRef<HTMLElement>(null)
  useEffect(() => {
    nav.current?.querySelector('[aria-current="page"]')?.scrollIntoView({block:'nearest',inline:'nearest'})
  }, [pathname])
  if (!group || group.id === 'overview' || isHub) return null
  return <nav ref={nav} className="workspace-section-nav" aria-label={`หน้าที่เกี่ยวข้องในหมวด${group.title}`}>
    <Link href={group.href} className="workspace-section-home">รวมงาน{group.title}</Link>
    {group.items.map(page => <Link key={page.href} href={page.href} aria-current={item?.href === page.href ? 'page' : undefined}>{page.label}</Link>)}
  </nav>
}
