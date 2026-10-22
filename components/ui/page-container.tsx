import type { ComponentProps } from 'react'

/** Shared dashboard width and responsive spacing. */
export function PageContainer({ className = '', ...props }: ComponentProps<'section'>) {
  return <section className={`dashboard-page-container w-full min-w-0 px-[38px] pb-[60px] pt-[30px] max-[1050px]:px-[25px] max-[760px]:px-[18px] max-[760px]:pb-10 max-[760px]:pt-[20px] ${className}`} {...props} />
}
