import type { HTMLAttributes, ReactNode } from 'react'
import { Layers3 } from 'lucide-react'

export type HeaderProps = Omit<HTMLAttributes<HTMLElement>, 'title'> & {
  title: string
  description?: ReactNode
  eyebrow?: string
  actions?: ReactNode
  icon?: ReactNode
  status?: { label: string; tone?: 'success' | 'warning' | 'neutral' }
}

/** Reusable page heading. Pass navigation or breadcrumbs as children. */
export function Header({ title, description, eyebrow, actions, icon, status, children, className = '', ...props }: HeaderProps) {
  return (
    <header className={`page-header mb-4 ${className}`} {...props}>
      {children}
      <div className="page-header-row flex flex-wrap items-center justify-between gap-3">
        <span className="page-header-emblem" aria-hidden="true">
          <span className="page-header-emblem-face">{icon ?? <Layers3 size={21} strokeWidth={1.7} />}</span>
        </span>
        <div className="min-w-0 flex-1 basis-60">
          {eyebrow ? <p className="m-0 mb-0.5 text-[9px] font-semibold uppercase tracking-[.08em] text-[#77787b]">{eyebrow}</p> : null}
          <h1 className="m-0 break-words text-xl font-semibold tracking-[-.4px] text-[#202a3c]">{title}</h1>
          {description ? <p className="m-0 mt-1 text-[11px] text-[#7c7d80]">{description}</p> : null}
        </div>
        {status || actions ? (
          <div className="page-header-tools flex flex-wrap items-center gap-3">
            {status ? (
              <span className="page-header-status" data-tone={status.tone ?? 'neutral'}>
                <span className="page-header-light" aria-hidden="true" />
                {status.label}
              </span>
            ) : null}
            {actions}
          </div>
        ) : null}
      </div>
    </header>
  )
}
