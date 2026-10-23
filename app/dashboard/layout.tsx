import type { ReactNode } from "react";
import { Suspense } from "react";
import { connection } from "next/server";
import AppFrame from "@/components/AppFrame";
import { LoanNotifications } from "@/components/realtime/loan-notifications";

export default function DashboardLayout({ children }: { children: ReactNode }) {
  return <Suspense fallback={<div className="grid min-h-dvh place-items-center bg-[#a6a6a8] text-sm text-[#343537]">กำลังโหลดข้อมูล…</div>}><DashboardShell>{children}</DashboardShell></Suspense>;
}

async function DashboardShell({ children }: { children: ReactNode }) {
  await connection();
  return <AppFrame><LoanNotifications />{children}</AppFrame>;
}
