'use client'

import { useEffect, useRef, type ReactNode } from 'react'
import { usePathname } from 'next/navigation'

/** Animate route arrival without remounting page state or delaying navigation. */
export function WorkspaceMotion({ children }: { children: ReactNode }) {
  const pathname = usePathname()
  const region = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const animation = region.current?.animate(
      [{ opacity: .55, transform: 'translateY(6px)' }, { opacity: 1, transform: 'translateY(0)' }],
      { duration: 180, easing: 'cubic-bezier(.2,.7,.2,1)' },
    )
    return () => animation?.cancel()
  }, [pathname])

  return <div ref={region} className="workspace-route-motion">{children}</div>
}
