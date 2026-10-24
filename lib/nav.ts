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
  BanknoteArrowDown,
  Banknote,
  BanknoteArrowUp,
  WalletCards,
  BanknoteCheck,
  BanknoteX,
  ClipboardClock,
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
{ label: "Logs", href: "/dashboard/logs", icon: ClipboardClock  },

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
      { label: "บัญชีรับ–จ่าย", href: "/dashboard/ledger", icon: Banknote },
      { label: "จ่ายเงินตามสัญญา", href: "/dashboard/ap", icon: BanknoteArrowDown },
      { label: "รับชำระตามสัญญา", href: "/dashboard/repayments", icon: BanknoteArrowUp },
      { label: "รายงานบัญชี", href: "/dashboard/accounting", icon: WalletCards },
      { label: "บัญชีทุน", href: "/dashboard/capital", icon: BanknoteCheck },
      { label: "ปิดดุลบัญชี", href: "/dashboard/ac", icon: BanknoteX },
    ],
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
  if (pathname.startsWith("/dashboard/cashbook-2025")) {
    return items.find((item) => item.href === "/dashboard/ledger");
  }
  const currentHref = `${pathname}${search}`;
  return (
    items.find((item) => item.href === currentHref) ??
    items.find((item) => item.href === pathname) ??
    items.filter((item) => pathname.startsWith(`${item.href}/`)).sort((a, b) => b.href.length - a.href.length)[0]
  );
}
