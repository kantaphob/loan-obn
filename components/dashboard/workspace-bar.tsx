'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState } from 'react'
import { ChevronRight, Search, X } from 'lucide-react'
import { NAV_GROUPS } from '@/lib/nav'

const pages = NAV_GROUPS.flatMap(group => group.items.map(item => ({ ...item, group: group.title })))

export function WorkspaceBar() {
  const pathname = usePathname()
  const [query, setQuery] = useState('')
  const [expanded, setExpanded] = useState(false)
  const current = pages.find(item => pathname === item.href) ?? pages.filter(item => pathname.startsWith(`${item.href}/`)).sort((a, b) => b.href.length - a.href.length)[0]
  const matches = pages.filter(item => `${item.label} ${item.group} ${item.href}`.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()))
  return <div className="workspace-bar">
    <nav aria-label="ตำแหน่งปัจจุบัน" className="workspace-bar-path"><Link href="/dashboard">OBN</Link><ChevronRight size={12} aria-hidden="true" /><span aria-current="page">{current?.label ?? 'Workspace'}</span></nav>
    <div className="workspace-nav-search" onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget)) setExpanded(false) }}>
      <Search size={14} aria-hidden="true" />
      <input aria-label="ค้นหาเมนู" aria-controls="workspace-search-results" placeholder="ค้นหาเมนู…" value={query} onFocus={() => setExpanded(true)} onChange={event => { setQuery(event.target.value); setExpanded(true) }} onKeyDown={event => { if (event.key === 'Escape') setExpanded(false) }} />
      {query && <button type="button" aria-label="ล้างการค้นหา" onClick={() => setQuery('')}><X size={13} /></button>}
      {expanded && query.trim() && <div id="workspace-search-results" className="workspace-search-results" aria-label="ผลค้นหาเมนู">
        {matches.length ? matches.map(item => <Link key={`${item.group}-${item.href}`} href={item.href} onClick={() => { setQuery(''); setExpanded(false) }}><item.icon size={15} aria-hidden="true" /><span>{item.label}<small>{item.group}</small></span><ChevronRight size={12} aria-hidden="true" /></Link>) : <p>ไม่พบเมนูที่ค้นหา</p>}
      </div>}
    </div>
  </div>
}
