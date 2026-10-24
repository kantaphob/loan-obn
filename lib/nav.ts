import {
  House,
  Landmark,
  LayoutDashboard,
  DatabaseBackup,
  ScrollText,
  type LucideIcon,
  UserShield,
  FolderUser,
  HandCoins,
  ReceiptText,
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
      { label: "Users", href: "/dashboard/admin/users", icon: UserShield },
      {
        label: "Masterdata",
        href: "/dashboard/admin/masterdata",
        icon: ScrollText,
      },
    ],
  },
  {
    title: "Lenders",
    items: [
      { label: "Creditors", href: "/dashboard/lenders", icon: HandCoins },
    ],
  },
    {
    title: "Borrower",
    items: [
      { label: "Borrowers", href: "/dashboard/borrower", icon: FolderUser },
      { label: "Credit Bureau", href: "/dashboard/credit-burea", icon: UserShield },
    ],
  },
  {
    title: "Contracts",
    items: [
      { label: "Contracts", href: "/dashboard/contracts", icon: ReceiptText },
    ],
  },
  {
    title: "Accounting",
    items: [
      { label: "ลูกหนี้และรับชำระ", href: "/dashboard/repayments", icon: HandCoins },

      { label: "จ่ายเงินตามสัญญา", href: "/dashboard/ap", icon: Landmark },
      { label: "เจ้าหนี้การค้า", href: "/dashboard/ap/trade", icon: ReceiptText },
      { label: "บัญชีรับ–จ่าย", href: "/dashboard/ledger", icon: ScrollText },
      { label: "รายงานบัญชี", href: "/dashboard/accounting", icon: LayoutDashboard },
      { label: "บัญชีทุน", href: "/dashboard/capital", icon: LayoutDashboard },
      { label: "ปิดดุล", href: "/dashboard/ac", icon: LayoutDashboard },
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
  const activePath = pathname === '/dashboard/ap/new' ? '/dashboard/ap/trade' : pathname;
  const currentHref = `${activePath}${search}`;
  return (
    items.find((item) => item.href === currentHref) ??
    items.find((item) => item.href === activePath) ??
    items.filter((item) => activePath.startsWith(`${item.href}/`)).sort((a, b) => b.href.length - a.href.length)[0]
  );
}
