import type { ReactNode } from "react";
import { Sidebar } from "@/components/dashboard/sidebar";

export default function AppFrame({
  children,
  sidebar = true,
}: {
  children: ReactNode;
  sidebar?: boolean;
}) {
  return (
    <div className="workspace-theme dashboard-shell relative isolate flex h-dvh items-start gap-3 overflow-hidden bg-[#06131e] p-3 font-sans text-[#202124] max-[760px]:flex-col max-[760px]:gap-2 max-[760px]:p-2">
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 z-0 overflow-hidden">
        <span className="absolute -left-32 -top-40 h-[480px] w-[480px] rounded-full bg-[#34506d]/20 blur-[110px]" />
        <span className="absolute right-[8%] top-[12%] h-[380px] w-[380px] rounded-full bg-[#d5af73]/10 blur-[115px]" />
        <span className="absolute -bottom-48 right-[20%] h-[440px] w-[440px] rounded-full bg-[#173d55]/15 blur-[120px]" />
      </div>
      {sidebar && <div className="dashboard-sidebar relative z-10 max-[760px]:w-full"><Sidebar /></div>}
      <main className="relative z-10 h-full min-h-0 w-0 min-w-0 flex-1 max-[760px]:w-full">
        {children}
      </main>
    </div>
  );
}
