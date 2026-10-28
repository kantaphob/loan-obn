import { DataLoading } from '@/components/ui/data-loading'
import type { ReactNode } from "react";
import { Suspense } from "react";
import { connection } from "next/server";
import AppFrame from "@/components/AppFrame";
import { LoanNotifications } from "@/components/realtime/loan-notifications";

export default function DashboardLayout({ children }: { children: ReactNode }) {
  return <Suspense fallback={<AppFrame><DataLoading /></AppFrame>}><DashboardShell>{children}</DashboardShell></Suspense>;
}

async function DashboardShell({ children }: { children: ReactNode }) {
  await connection();
  return <AppFrame><LoanNotifications />{children}</AppFrame>;
}
