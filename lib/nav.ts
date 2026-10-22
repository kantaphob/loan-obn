import {
  FileSignature,
  House,
  Landmark,
  LayoutDashboard,
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
      { label: "ผู้กู้", href: "/dashboard/applications", icon: Users },
    ],
  },
  {
    title: "ผู้ให้กู้",
    items: [
      { label: "รายชื่อผู้ให้กู้", href: "/dashboard/lenders", icon: Landmark },
    ],
  },
  {
    title: "สัญญากู้",
    items: [
      { label: "สัญญาทั้งหมด", href: "/dashboard/contracts", icon: FileSignature },
    ],
  },
  {
    title: "บันทึกการทำงาน",
    items: [{ label: "Logs", href: "/dashboard/logs", icon: ScrollText }],
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
