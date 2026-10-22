import {
  FileText,
  House,
  LayoutDashboard,
  ShieldUser,
  Users,
  Wallet,
  FileSignature,
  Landmark,
  type LucideIcon,
} from "lucide-react";

export type NavItem = { label: string; href: string; icon: LucideIcon };
export type NavGroup = { title: string; items: NavItem[] };

export type SystemKey = "dashboard" | "loan" | "admin";
export type System = {
  key: SystemKey;
  label: string;
  shortLabel: string;
  description: string;
  href: string;
  color: string;
  icon: LucideIcon;
  groups: NavGroup[];
};

export const SYSTEMS: Record<SystemKey, System> = {
  dashboard: {
    key: "dashboard",
    label: "ภาพรวม",
    shortLabel: "Home",
    description: "ภาพรวมการดำเนินงานสินเชื่อ",
    href: "/dashboard",
    color: "#76dfbd",
    icon: House,
    groups: [
      {
        title: "เมนูหลัก",
        items: [{ label: "ภาพรวม", href: "/dashboard", icon: LayoutDashboard }],
      },
      {
        title: "รายการ",
        items: [
          {
            label: "คำขอล่าสุด",
            href: "/dashboard/applications",
            icon: FileText,
          },
          {
            label: "Logs",
            href: "/dashboard/logs",
            icon: FileText,
          },
        ],
      },
    ],
  },
  loan: {
    key: "loan",
    label: "คำขอสินเชื่อ",
    shortLabel: "Loan",
    description: "ติดตามและจัดการคำขอสินเชื่อ",
    href: "/dashboard/applications",
    color: "#b6f1dc",
    icon: Wallet,
    groups: [
      {
        title: "Application",
        items: [
          { label: "Contracts", href: "/dashboard/contracts", icon: FileSignature },
        ],
      },
      {
        title: "Loan",
        items: [
          { label: "ผู้กู้", href: "/dashboard/applications", icon: Users },
          { label: "ผู้ให้กู้", href: "/dashboard/lenders", icon: Landmark },
          { label: "สัญญา", href: "/dashboard/contracts", icon: FileSignature },
        ],
      },
      {
        title: "Accounting",
        items: [
          { label: "Logs", href: "/dashboard/logs", icon: FileText },
        ],
      },
      
    ],
  },
  admin: {
    key: "admin",
    label: "ผู้ดูแลระบบ",
    shortLabel: "Admin",
    description: "จัดการผู้ใช้และการตั้งค่าระบบ",
    href: "/dashboard/admin",
    color: "#d9c8ff",
    icon: ShieldUser,
    groups: [
      {
        title: "Admin",
        items: [
          { label: "Users", href: "/dashboard/admin/users", icon: Users },
          {
            label: "Masterdata",
            href: "/dashboard/admin?section=masterdata",
            icon: LayoutDashboard,
          },
        ],
      },
    ],
  },
};

export function getSystem(pathname: string): System {
  if (
    pathname === "/admin" ||
    pathname.startsWith("/admin/") ||
    pathname === "/dashboard/admin" ||
    pathname.startsWith("/dashboard/admin/")
  )
    return SYSTEMS.admin;
  if (
    pathname === "/dashboard/contracts" ||
    pathname.startsWith("/dashboard/contracts/")
  )
    return SYSTEMS.loan;
  if (
    pathname === "/dashboard/lenders" ||
    pathname.startsWith("/dashboard/lenders/")
  )
    return SYSTEMS.loan;
  if (
    pathname === "/dashboard/applications" ||
    pathname.startsWith("/dashboard/applications/")
  )
    return SYSTEMS.loan;
  return SYSTEMS.dashboard;
}
