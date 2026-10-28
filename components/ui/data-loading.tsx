import type { CSSProperties } from 'react'

type DataLoadingProps = {
  label?: string
  compact?: boolean
  fullScreen?: boolean
}

/** Suspense and request loading UI. No simulated percentage or artificial delay. */
export function DataLoading({ label = 'กำลังโหลดข้อมูล…', compact = false, fullScreen }: DataLoadingProps) {
  const coversViewport = fullScreen ?? !compact
  return (
    <div className={`data-loading ${compact ? 'data-loading--compact' : ''} ${coversViewport ? 'data-loading--screen' : ''}`} role="status" aria-live="polite" aria-busy="true">
      <div className="data-loading-panel">
        {!compact && <>
          <div className="data-loading-caption" aria-hidden="true"><span />OBN WORKSPACE</div>
          <div className="data-loading-landscape" aria-hidden="true">
            <svg viewBox="0 0 320 80" preserveAspectRatio="none"><path d="M0 65 C40 10 60 90 105 48 S160 6 205 42 S267 60 320 14 L320 80 L0 80Z" /></svg>
          </div>
        </>}
        <div className="data-loading-pill"><span className="data-loading-ring" aria-hidden="true" /><span>{label}</span><span className="data-loading-dots" aria-hidden="true"><i /><i /><i /></span></div>
        {!compact && <>
          <p className="data-loading-note">กำลังเตรียมข้อมูลสำหรับคุณ</p>
          <div className="data-loading-skeleton" aria-hidden="true">{[88, 65, 76].map((width, index) => <span key={index} style={{ '--skeleton-width': `${width}%` } as CSSProperties} />)}</div>
        </>}
      </div>
    </div>
  )
}
