'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { LayoutGrid } from 'lucide-react'
import { MASTERDATA_MENUS } from '@/lib/masterdata-nav'

const items = [
  { title: 'เมนูทั้งหมด', href: '/dashboard/admin/masterdata', icon: LayoutGrid },
  ...MASTERDATA_MENUS,
]

export function MasterdataSubnav() {
  const pathname = usePathname()

  return (
    <nav aria-label="เมนูย่อย Masterdata" className="liquid-glass mb-5 rounded-[18px] p-1.5">
      <ul className="liquid-glass-content flex flex-wrap gap-1">
        {items.map(({ title, href, icon: Icon }) => {
          const active = pathname === href || (href !== '/dashboard/admin/masterdata' && pathname.startsWith(`${href}/`))
          return (
            <li key={href}>
              <Link
                href={href}
                aria-current={active ? 'page' : undefined}
                className={`inline-flex min-h-11 items-center gap-2 rounded-xl border px-4 text-xs font-semibold transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#8bb2ff] ${active ? 'border-[#8bb2ff]/40 bg-[#3476df]/20 text-[#8bb2ff] shadow-[inset_0_1px_0_#ffffff15]' : 'border-transparent text-[#77787b] hover:bg-white/10 hover:text-[#343537]'}`}
              >
                <Icon size={16} aria-hidden="true" className="shrink-0" />
                {title}
              </Link>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
