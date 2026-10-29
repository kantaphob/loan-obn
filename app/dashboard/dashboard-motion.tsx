'use client'

import { useEffect, useRef, type ReactNode } from 'react'

const amountFormat = new Intl.NumberFormat('th-TH', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

export function AnimatedMoney({ satang }: { satang: number }) {
  const formatted = `฿${amountFormat.format(satang / 100)}`
  return <span className="dash-animated-money">
    <span className="dash-money-exact">{formatted}</span>
    <span className="dash-money-size" aria-hidden="true">{formatted}</span>
    <span aria-hidden="true" data-dashboard-amount={satang}>{formatted}</span>
  </span>
}

export function DashboardMotion({ children }: { children: ReactNode }) {
  const root = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const container = root.current
    if (!container || !('IntersectionObserver' in window)) return
    const preference = window.matchMedia('(prefers-reduced-motion: reduce)')
    const scrollRegion = container.closest<HTMLElement>('.workspace-content')
    const frames = new Map<HTMLElement, number>()
    const amounts = new Map<HTMLElement, string>()
    const animated = new Set<HTMLElement>()
    const pending = new Set<HTMLElement>()
    const finish = () => {
      frames.forEach(frame => cancelAnimationFrame(frame))
      frames.clear()
      amounts.forEach((text, element) => { element.textContent = text })
      pending.forEach(element => element.classList.remove('dash-scroll-pending'))
      pending.clear()
      animated.forEach(element => element.classList.remove('dash-motion-enter', 'dash-motion-scroll', 'dash-motion-chart', 'dash-motion-bar', 'dash-motion-ring'))
    }
    const observer = new IntersectionObserver(entries => {
      let stagger = 0
      for (const entry of entries) {
        if (!entry.isIntersecting || preference.matches) continue
        const element = entry.target as HTMLElement
        observer.unobserve(element)
        const rawAmount = element.dataset.dashboardAmount
        if (rawAmount !== undefined) {
          const amount = Number(rawAmount)
          if (!Number.isFinite(amount) || amount === 0) continue
          const finalText = element.textContent ?? ''
          amounts.set(element, finalText)
          const start = performance.now()
          const tick = (now: number) => {
            const progress = Math.min(1, (now - start) / 650)
            const eased = 1 - (1 - progress) ** 3
            // Only the visual text changes; assistive technology keeps the exact total.
            element.textContent = progress === 1 ? finalText : `฿${amountFormat.format(Math.round(amount * eased) / 100)}`
            if (progress < 1) frames.set(element, requestAnimationFrame(tick))
            else frames.delete(element)
          }
          frames.set(element, requestAnimationFrame(tick))
          continue
        }
        const kind = element.matches('.dash-area-chart') ? 'chart'
          : element.matches('.dash-allocation-track, .dash-asset-track') ? 'bar'
          : element.matches('.dash-donut, .dash-recovery-ring') ? 'ring'
          : pending.has(element) ? 'scroll' : 'enter'
        element.classList.remove('dash-scroll-pending')
        pending.delete(element)
        element.style.setProperty('--dash-motion-delay', `${kind === 'enter' || kind === 'scroll' ? Math.min(stagger++ * 40, 120) : 0}ms`)
        element.classList.add(`dash-motion-${kind}`)
        animated.add(element)
      }
    }, { root: scrollRegion, threshold: 0, rootMargin: '0px 0px -24px 0px' })

    const observe = () => {
      if (preference.matches) return
      const revealSelector = '.dash-section-label, .dash-metric, .dash-panel, .dash-today-card, .dash-property-item, .dash-open-item'
      const viewportBottom = scrollRegion?.getBoundingClientRect().bottom ?? window.innerHeight
      const targets = container.querySelectorAll<HTMLElement>(`${revealSelector}, .dash-area-chart, .dash-allocation-track, .dash-asset-track, .dash-donut, .dash-recovery-ring, [data-dashboard-amount]`)
      // Read geometry before writing classes to avoid repeated layout work.
      const belowFold = Array.from(targets).filter(element => element.matches(revealSelector) && element.getBoundingClientRect().top >= viewportBottom - 24)
      belowFold.forEach(element => {
        element.classList.add('dash-scroll-pending')
        pending.add(element)
      })
      targets.forEach(element => observer.observe(element))
    }
    const revealFocused = (event: FocusEvent) => {
      if (!(event.target instanceof Element)) return
      // Keyboard navigation reveals the focused content immediately, including its parents.
      let hidden = event.target.closest<HTMLElement>('.dash-scroll-pending')
      while (hidden && container.contains(hidden)) {
        hidden.classList.remove('dash-scroll-pending')
        pending.delete(hidden)
        observer.unobserve(hidden)
        hidden = event.target.closest<HTMLElement>('.dash-scroll-pending')
      }
    }
    const onPreferenceChange = () => {
      observer.disconnect()
      finish()
      // Do not replay completed animations when motion is re-enabled.
    }
    observe()
    container.addEventListener('focusin', revealFocused)
    preference.addEventListener('change', onPreferenceChange)
    return () => {
      observer.disconnect()
      container.removeEventListener('focusin', revealFocused)
      preference.removeEventListener('change', onPreferenceChange)
      finish()
    }
  }, [children])

  return <div ref={root} className="dash-dashboard">{children}</div>
}
