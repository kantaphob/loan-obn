import {
  FileSignature,
  House,
  Landmark,
  LayoutDashboard,
  DatabaseBackup,
  ScrollText,
  Users,
  type LucideIcon,
} from "lucide-react";

export type NavItem = { label: string; href: string; icon: LucideIcon };
export type NavGroup = { title: string; items: NavItem[] };

/** Global navigation organized by the team's day-to-day work. */
export const NAV_GROUPS: NavGroup[] = [
  {
    title: "ภาพรวม",
    items: [{ label: "Dashboard", href: "/dashboard", icon: House }],
  },
  {
    title: "Admin",
    items: [
      { label: "Users", href: "/dashboard/admin/users", icon: Users },
      {
        label: "Masterdata",
        href: "/dashboard/admin/masterdata",
        icon: LayoutDashboard,
      },
    ],
  },
  {
    title: "Borrower",
    items: [
      { label: "Borrowers", href: "/dashboard/borrower", icon: Users },
    ],
  },
  {
    title: "Lenders",
    items: [
      { label: "Creditors", href: "/dashboard/lenders", icon: Landmark },
    ],
  },
  {
    title: "Contracts",
    items: [
      { label: "Contracts", href: "/dashboard/contracts", icon: FileSignature },
      { label: "Applications", href: "/dashboard/applications", icon: FileSignature },
    ],
  },
  {
    title: "Accounting",
    items: [
      { label: "Ledger", href: "/dashboard/ledger", icon: ScrollText },
      { label: "Accounting", href: "/dashboard/accounting", icon: ScrollText },
    ],
  },
  {
    title: "Logs",
    items: [{ label: "Logs", href: "/dashboard/logs", icon: ScrollText }],
  },
  {
    title: "Backups",
    items: [
      { label: "สำรองข้อมูล", href: "/dashboard/admin/backups", icon: DatabaseBackup },

    ],

  },
];

export function findActiveNavItem(pathname: string, search = "") {
  const items = NAV_GROUPS.flatMap((group) => group.items);
  const currentHref = `${pathname}${search}`;
  return (
    items.find((item) => item.href === currentHref) ??
    items.find((item) => item.href === pathname)
  );
}
