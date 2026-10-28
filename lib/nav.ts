import {
  House,
  Landmark,
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
  Trash2,
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
      { label: "Logs", href: "/dashboard/logs", icon: ClipboardClock },
    ],
  },
  {
    title: "Lenders",
    items: [
      { label: "Creditors", href: "/dashboard/lenders", icon: HandCoins },
      { label: "Persuader", href: "/dashboard/persuaders", icon: FolderUser },
    ],
  },
  {
    title: "Borrower",
    items: [
      { label: "Borrowers", href: "/dashboard/borrower", icon: FolderUser },
      {
        label: "Credit Bureau",
        href: "/dashboard/credit-burea",
        icon: UserShield,
      },
    ],
  },
  {
    title: "Contracts",
    items: [
      { label: "Contracts", href: "/dashboard/contracts", icon: ReceiptText },
    ],
  },
  {
    title: "Receivables",
    items: [
      {
        label: "ลูกหนี้ค้างรับ",
        href: "/dashboard/receivables",
        icon: BanknoteArrowUp,
      },
    ],
  },
  {
    title: "Accounting",
    items: [
      {
        label: "รายงานบัญชี",
        href: "/dashboard/accounting",
        icon: WalletCards,
      },
      { label: "บัญชีรับ–จ่าย", href: "/dashboard/ledger", icon: Banknote },
      {
        label: "จ่ายเงินตามสัญญา",
        href: "/dashboard/ap",
        icon: BanknoteArrowDown,
      },
      {
        label: "รับชำระตามสัญญา",
        href: "/dashboard/repayments",
        icon: BanknoteArrowUp,
      },
      { label: "บัญชีทุนสินเชื่อ", href: "/dashboard/capital", icon: BanknoteCheck },
      { label: "ปิดดุลบัญชี", href: "/dashboard/ac", icon: BanknoteX },
    ],
  },
  {
    title: "Thing",
    items: [
      { label: "Property", href: "/thing/property", icon: DatabaseBackup },
      { label: "Asset", href: "/thing/asset", icon: Landmark },
      { label: "Liabilities", href: "/thing/liabilities", icon: Landmark },
      { label: "รายการที่ลบ", href: "/thing/deleted", icon: Trash2 },
    ],
  },
  {
    title: "Backups",
    items: [
      {
        label: "สำรองข้อมูล",
        href: "/dashboard/admin/backups",
        icon: DatabaseBackup,
      },
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
    items
      .filter((item) => pathname.startsWith(`${item.href}/`))
      .sort((a, b) => b.href.length - a.href.length)[0]
  );
}
