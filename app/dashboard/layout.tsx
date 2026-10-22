import type { ReactNode } from "react";
import { Suspense } from "react";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import AppFrame from "@/components/AppFrame";
import { LoanNotifications } from "@/components/realtime/loan-notifications";
import { getCurrentUser } from "@/lib/auth/current-user";

export default function DashboardLayout({ children }: { children: ReactNode }) {
  return <Suspense fallback={<div className="grid min-h-dvh place-items-center bg-[#a6a6a8] text-sm text-[#343537]">กำลังตรวจสอบการเข้าสู่ระบบ…</div>}><AuthenticatedDashboard>{children}</AuthenticatedDashboard></Suspense>;
}

async function AuthenticatedDashboard({ children }: { children: ReactNode }) {
  await connection();
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return <AppFrame><LoanNotifications />{children}</AppFrame>;
}
