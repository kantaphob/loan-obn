import type { CSSProperties } from 'react'
import { Card } from './card'
import { Header } from './header'

type DataLoadingProps = {
  label?: string
  compact?: boolean
  fullScreen?: boolean
  variant?: 'page' | 'document'
  showHeader?: boolean
}

export function Skeleton({ width = '100%', className = '' }: { width?: string; className?: string }) {
  return <span className={`loading-skeleton ${className}`} style={{ '--skeleton-width': width } as CSSProperties} />
}

/** Fills its parent's content region without adding another page container. */
export function DataLoading({ label = 'กำลังโหลดข้อมูล…', compact = false, fullScreen = false, variant = 'page', showHeader = true }: DataLoadingProps) {
  return <div className={`data-loading ${compact ? 'data-loading--compact' : ''} ${fullScreen ? 'data-loading--screen' : ''} data-loading--${variant}`} role="status" aria-live="polite" aria-busy="true">
    <span className="data-loading-label">{label}</span>
    <div aria-hidden="true" className="data-loading-content">
      {compact ? <div className="loading-compact-list">{[0, 1, 2].map(row => <div key={row} className="loading-compact-row"><Skeleton className="loading-skeleton--avatar" /><div><Skeleton width={`${76 - row * 12}%`} /><Skeleton width="42%" className="loading-skeleton--small" /></div></div>)}</div>
        : variant === 'document' ? <div className="loading-document"><Skeleton width="48%" className="loading-skeleton--title" />{[92, 100, 86, 100, 72, 95, 100, 66].map((width, index) => <Skeleton key={index} width={`${width}%`} />)}</div>
          : <>
            {showHeader && <Header title={<Skeleton width="180px" className="loading-skeleton--title" />} description={<Skeleton width="min(65%,320px)" className="loading-skeleton--small" />} />}
            <Card className="loading-table"><div className="loading-table-row loading-table-head">{[0, 1, 2, 3].map(i => <Skeleton key={i} width="65%" />)}</div>{[0, 1, 2, 3, 4, 5].map(row => <div key={row} className="loading-table-row">{[70, 88, 55, 66].map((width, i) => <Skeleton key={i} width={`${width - row % 3 * 6}%`} />)}</div>)}</Card>
          </>}
    </div>
  </div>
}
