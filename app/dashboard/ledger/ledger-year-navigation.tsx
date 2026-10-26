'use client'

import Link from 'next/link'
import { CalendarDays } from 'lucide-react'

export function LedgerYearNavigation({ year }: { year: 'all' | 2025 | 2026 }) {
  return <nav className="ledger-year-nav" aria-label="กรองรายการตามปี">
    <div className="ledger-year-title"><CalendarDays size={18} aria-hidden="true" /><span>ปีบัญชี</span></div>
    {(['all', 2026, 2025] as const).map(value => {
      const label = value === 'all' ? 'ทั้งหมด' : String(value)
      const href = value === 'all' ? '/dashboard/ledger' : `/dashboard/ledger?year=${value}`
      return value === year
        ? <span key={label} className="ledger-year-current" aria-current="page"><strong>{label}</strong>{value === 2026 && <small>ปีปัจจุบัน</small>}</span>
        : <Link key={label} href={href} className="ledger-year-history"><span>{label}</span></Link>
    })}
  </nav>
}
