import type { HTMLAttributes } from 'react'

type CardElement = 'div' | 'section' | 'article'

export type CardProps = HTMLAttributes<HTMLElement> & {
  as?: CardElement
}

export function Card({ as: Element = 'div', className = '', children, ...props }: CardProps) {
  return (
    <Element className={`liquid-glass rounded-[24px] ${className}`} {...props}>
      <div className="liquid-glass-content">{children}</div>
    </Element>
  )
}

export function CardHeader({ className = '', ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={`flex flex-col gap-1.5 p-5 ${className}`} {...props} />
}

export function CardTitle({ className = '', ...props }: HTMLAttributes<HTMLHeadingElement>) {
  return <h2 className={`m-0 text-base font-semibold text-[#202a3c] ${className}`} {...props} />
}

export function CardDescription({ className = '', ...props }: HTMLAttributes<HTMLParagraphElement>) {
  return <p className={`m-0 text-sm text-[#788497] ${className}`} {...props} />
}

export function CardContent({ className = '', ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={`p-5 pt-0 ${className}`} {...props} />
}

export function CardFooter({ className = '', ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={`flex items-center p-5 pt-0 ${className}`} {...props} />
}
