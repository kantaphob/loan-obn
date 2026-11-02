'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'
import { ChevronDown, ChevronLeft, LayoutGrid, Menu, X } from 'lucide-react'
import { getWorkspaceContext, NAV_GROUPS, WORKSPACE_HOME } from '@/lib/nav'

export function Sidebar() {
  const pathname = usePathname()
  const { group: currentGroup, item: currentItem } = getWorkspaceContext(pathname)
  const [collapsed, setCollapsed] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [expanded, setExpanded] = useState<Record<string,boolean>>({})
  const aside = useRef<HTMLElement>(null)
  const mobileToggle = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (!mobileOpen) return
    const closeOutside = (event: PointerEvent) => {
      if (event.target instanceof Node && !aside.current?.contains(event.target)) setMobileOpen(false)
    }
    document.addEventListener('pointerdown', closeOutside)
    return () => document.removeEventListener('pointerdown', closeOutside)
  }, [mobileOpen])

  return <aside ref={aside} aria-label="เมนูหลัก" className={`workspace-sidebar liquid-sidebar-panel ${collapsed ? 'is-collapsed' : ''} ${mobileOpen ? 'is-mobile-open' : ''}`} onKeyDown={event => { if (event.key === 'Escape') { setMobileOpen(false); mobileToggle.current?.focus() } }}>
    <div className="workspace-sidebar-brand">
      <Link href="/dashboard/workspace" aria-label="OBN พื้นที่ทำงานทั้งหมด" onClick={() => setMobileOpen(false)}><span className="workspace-brand-symbol"><LayoutGrid size={21} aria-hidden="true" /></span><span className="workspace-brand-copy"><strong>OBN Workspace</strong><small>พื้นที่ทำงานของคุณ</small></span></Link>
      <button className="workspace-collapse-toggle" type="button" onClick={() => setCollapsed(value => !value)} aria-label={collapsed ? 'ขยายเมนู' : 'ย่อเมนู'} title={collapsed ? 'ขยายเมนู' : 'ย่อเมนู'} aria-expanded={!collapsed}><ChevronLeft size={16} aria-hidden="true" /></button>
      <button ref={mobileToggle} className="workspace-mobile-toggle" type="button" onClick={() => setMobileOpen(value => !value)} aria-label={mobileOpen ? 'ปิดเมนู' : 'เปิดเมนู'} aria-expanded={mobileOpen} aria-controls="workspace-main-nav">{mobileOpen ? <X size={19} aria-hidden="true" /> : <Menu size={19} aria-hidden="true" />}</button>
    </div>
    <nav id="workspace-main-nav" className="workspace-main-nav">
      <Link href={WORKSPACE_HOME.href} onClick={() => setMobileOpen(false)} className="workspace-all-link" aria-current={pathname === WORKSPACE_HOME.href ? 'page' : undefined} title={collapsed ? WORKSPACE_HOME.label : undefined}><LayoutGrid size={17} aria-hidden="true" /><span>{WORKSPACE_HOME.label}</span></Link>
      <p className="workspace-nav-caption">กลุ่มงาน</p>
      {NAV_GROUPS.map(group => {
        const open = expanded[group.id] ?? currentGroup?.id === group.id
        const selected = currentGroup?.id === group.id
        const Icon = group.icon
        return <section key={group.id} className="workspace-nav-group" data-active={selected}>
          <div className="workspace-group-row">
            <Link href={group.href} className="workspace-group-link" title={collapsed ? group.title : undefined} aria-label={collapsed ? group.title : undefined} aria-current={pathname === group.href ? 'page' : undefined} onClick={() => setMobileOpen(false)}><Icon size={18} aria-hidden="true" /><span>{group.title}</span></Link>
            {group.id !== 'overview' && <button type="button" className="workspace-group-toggle" aria-label={`${open ? 'ย่อ' : 'ขยาย'}หมวด${group.title}`} aria-expanded={open} aria-controls={`workspace-group-${group.id}`} onClick={() => setExpanded(state => ({...state,[group.id]:!open}))}><ChevronDown size={14} aria-hidden="true" /></button>}
          </div>
          {group.id !== 'overview' && <div id={`workspace-group-${group.id}`} className="sidebar-group-motion" data-open={open} inert={!open}><ul>{group.items.map(item => <li key={item.href}><Link href={item.href} aria-current={currentItem?.href === item.href ? 'page' : undefined} onClick={() => setMobileOpen(false)}>{item.label}</Link></li>)}</ul></div>}
        </section>
      })}
    </nav>
    <footer className="workspace-sidebar-footer"><span className="workspace-brand-symbol"><LayoutGrid size={16} aria-hidden="true" /></span><div><strong>Loan OBN</strong><small>ระบบจัดการธุรกิจ</small></div></footer>
  </aside>
}
