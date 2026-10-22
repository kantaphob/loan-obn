import Link from 'next/link'
import { Icon } from './icon'

export function DashboardTopbar({ current = 'ภาพรวม' }: { current?: string }) {
  return (
    <header className="sticky top-0 z-10 flex h-[68px] items-center justify-between border-b border-white/70 bg-[#eeeeef]/45 px-[38px] shadow-[0_8px_30px_#00000008] backdrop-blur-2xl max-[1050px]:px-[25px] max-[760px]:h-[58px] max-[760px]:px-[18px]">
      <div className="flex items-center gap-[9px] text-[11px] text-[#77787b]"><Link href="/dashboard" className="text-inherit no-underline transition hover:text-[#242527]">Workspace</Link><Icon name="chevron" /><strong className="font-semibold text-[#292a2c]">{current}</strong></div>
      <div className="flex items-center gap-[17px] text-[10px] text-[#85868a] max-[760px]:gap-0">
        <span className="flex items-center gap-[7px] text-[#56575a] max-[760px]:hidden"><i className="h-[7px] w-[7px] rounded-full bg-[#6b6c6f] shadow-[0_0_0_3px_#ffffff80]" />ระบบทำงานปกติ</span>
        <span className="h-[18px] w-px bg-[#c9c9cb] max-[760px]:hidden" />
        <span className="text-[11px] max-[760px]:hidden">22 ตุลาคม 2569</span>
      </div>
    </header>
  )
}
