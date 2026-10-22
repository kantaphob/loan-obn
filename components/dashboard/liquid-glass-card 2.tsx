import type { HTMLAttributes } from 'react'

type LiquidGlassCardProps = HTMLAttributes<HTMLElement> & {
  as?: 'div' | 'section' | 'article'
}

export function LiquidGlassCard({ as: Element = 'div', className = '', ...props }: LiquidGlassCardProps) {
  const { children, ...elementProps } = props

  return (
    <Element
      className={`liquid-glass rounded-[24px] ${className}`}
      {...elementProps}
    >
      <div className="liquid-glass-content">{children}</div>
    </Element>
  )
}
