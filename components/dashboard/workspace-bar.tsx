'use client'

import Link from 'next/link'
import { FocusMode } from './focus-mode'
import { usePathname } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'
import { ChevronRight, Search, X, LayoutGrid } from 'lucide-react'
import { getWorkspaceContext, searchWorkspace, WORKSPACE_HOME } from '@/lib/nav'

export function WorkspaceBar() {
  const pathname = usePathname()
  const { group, item, page, isHub } = getWorkspaceContext(pathname)
  const [query, setQuery] = useState('')
  const [expanded, setExpanded] = useState(false)
  const field = useRef<HTMLInputElement>(null)
  const results = useRef<HTMLDivElement>(null)
  const matches = searchWorkspace(query)
  const workspaceHome = pathname === WORKSPACE_HOME.href
  const closeSearch = () => { setQuery(''); setExpanded(false) }

  useEffect(() => {
    const shortcut = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault()
        field.current?.focus()
      }
    }
    window.addEventListener('keydown', shortcut)
    return () => window.removeEventListener('keydown', shortcut)
  }, [])

  return <div className="workspace-bar workspace-structure-bar">
    <nav aria-label="ตำแหน่งปัจจุบัน" className="workspace-bar-path"><Link href={WORKSPACE_HOME.href} aria-label="พื้นที่ทำงานทั้งหมด"><LayoutGrid size={16} aria-hidden="true" /></Link>
      <ChevronRight size={12} aria-hidden="true" />
      {workspaceHome ? <span aria-current="page">พื้นที่ทำงานทั้งหมด</span> : <>
        {group && !isHub && group.id !== 'overview' ? <><Link href={group.href}>{group.title}</Link><ChevronRight size={12} aria-hidden="true" /></> : null}
        {page && item && page.href !== item.href ? <><Link href={item.href}>{item.label}</Link><ChevronRight size={12} aria-hidden="true" /></> : null}
        <span aria-current="page">{isHub ? group?.title : page?.label ?? 'พื้นที่ทำงาน'}</span>
      </>}
    </nav>
    <div className="workspace-bar-actions"><FocusMode />
    <div className="workspace-nav-search" onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget)) setExpanded(false) }}>
      <Search size={15} aria-hidden="true" />
      <input ref={field} aria-label="ค้นหาหน้าและเมนู" aria-controls={expanded && query.trim() ? 'workspace-search-results' : undefined} placeholder="ค้นหาหน้าและเมนู…" value={query} onFocus={() => setExpanded(true)} onChange={event => { setQuery(event.target.value); setExpanded(true) }} onKeyDown={event => {
        if (event.key === 'Escape') { setExpanded(false); field.current?.focus() }
        if (event.key === 'ArrowDown') { event.preventDefault(); results.current?.querySelector<HTMLAnchorElement>('a')?.focus() }
      }} />
      {query ? <button type="button" aria-label="ล้างการค้นหา" onClick={() => { setQuery(''); field.current?.focus() }}><X size={14} aria-hidden="true" /></button> : <kbd>⌘ K</kbd>}
      {expanded && query.trim() && <div ref={results} id="workspace-search-results" className="workspace-search-results" aria-label="ผลค้นหาเมนู" onKeyDown={event => {
        if (event.key === 'Escape') { setExpanded(false); field.current?.focus() }
        if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return
        event.preventDefault()
        const links = Array.from(event.currentTarget.querySelectorAll('a'))
        const index = links.indexOf(event.target as HTMLAnchorElement)
        const next = event.key === 'ArrowDown' ? index + 1 : index - 1
        if (next < 0) field.current?.focus()
        else links[Math.min(next,links.length-1)]?.focus()
      }}>
        <div className="workspace-search-caption" aria-live="polite">{matches.length} หน้าที่เกี่ยวข้อง</div>
        {matches.length ? matches.map(result => <Link key={result.href} href={result.href} onClick={closeSearch}><result.icon size={16} aria-hidden="true" /><span>{result.label}<small>{result.description}</small></span><ChevronRight size={12} aria-hidden="true" /></Link>) : <p>ไม่พบหน้าที่ค้นหา ลองชื่อเมนูหรือคำอื่น</p>}
      </div>}
    </div></div>
  </div>
}
