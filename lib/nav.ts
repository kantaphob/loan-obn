import {
  House, Landmark, DatabaseBackup, ScrollText, UserShield, FolderUser,
  HandCoins, ReceiptText, BanknoteArrowDown, Banknote, BanknoteArrowUp,
  WalletCards, BanknoteCheck, BanknoteX, ClipboardClock, Trash2,
  Building2, UsersRound, Settings2, ChartNoAxesCombined, LayoutGrid,
  type LucideIcon,
} from 'lucide-react'

export type NavItem = { label: string; href: string; icon: LucideIcon; description: string; keywords?: string }
export type NavGroup = { id: string; title: string; href: string; description: string; icon: LucideIcon; items: NavItem[]; workflow?: string[] }

/** One registry powers the sidebar, section pages, breadcrumbs, tabs, and search. */
export const NAV_GROUPS: NavGroup[] = [
  { id: 'overview', title: 'ภาพรวม', href: '/dashboard', icon: House, description: 'ยอดรวม สถานะวันนี้ และงานที่ต้องติดตาม', items: [
    { label: 'Dashboard', href: '/dashboard', icon: House, description: 'รับ จ่าย สุทธิ เงินทุน สินเชื่อ และทรัพย์สินในหน้าเดียว', keywords: 'home dashboard ภาพรวม' },
  ] },
  { id: 'finance', title: 'การเงิน', href: '/dashboard/workspace/finance', icon: WalletCards, description: 'บันทึกรับ–จ่าย ติดตามยอดค้าง และจัดการรายการประจำ', items: [
    { label: 'บัญชีรับ–จ่าย', href: '/dashboard/ledger', icon: Banknote, description: 'รายการเงินจริงทุกปี พร้อมหมวด หลักฐาน และประวัติ', keywords: 'ledger cashbook เงินสด' },
    { label: 'ลูกหนี้ค้างรับ', href: '/dashboard/receivables', icon: BanknoteArrowUp, description: 'ติดตามเงินที่ต้องรับและการชำระนอกสินเชื่อ', keywords: 'receivables' },
    { label: 'สำรองจ่ายและเบิกคืน', href: '/dashboard/reimbursements', icon: ReceiptText, description: 'บันทึกเงินสำรองจ่าย ตรวจยอดค้าง และการคืนเงิน', keywords: 'reimbursement' },
    { label: 'เงินเดือนและรายได้ประจำ', href: '/dashboard/payroll', icon: BanknoteCheck, description: 'จัดการเงินเดือนและรายได้ที่ได้รับเป็นประจำ', keywords: 'payroll salary' },
    { label: 'สาธารณูปโภค', href: '/dashboard/utilities', icon: ReceiptText, description: 'แยกบ้าน บันทึกมิเตอร์และค่าน้ำ–ค่าไฟรายเดือน', keywords: 'water electricity meter ค่าน้ำ ค่าไฟ' },
    { label: 'รายการรับ–จ่ายประจำ', href: '/dashboard/recurring', icon: ClipboardClock, description: 'กำหนดรายการและติดตามรอบรับ–จ่ายที่เกิดซ้ำ', keywords: 'recurring' },
  ], workflow: ['/dashboard/ledger', '/dashboard/receivables', '/dashboard/reimbursements'] },
  { id: 'loans', title: 'สินเชื่อ', href: '/dashboard/workspace/loans', icon: HandCoins, description: 'ดูแลผู้กู้ ตั้งแต่ตรวจข้อมูล สร้างสัญญา จ่ายเงิน จนถึงรับคืน', items: [
    { label: 'ทะเบียนผู้กู้', href: '/dashboard/borrower', icon: FolderUser, description: 'ข้อมูลผู้กู้ วงเงิน และเอกสารประกอบ', keywords: 'borrower borrowers ลูกค้า' },
    { label: 'ประวัติเครดิต', href: '/dashboard/credit-burea', icon: UserShield, description: 'ข้อมูลเครดิตและการประเมินผู้กู้', keywords: 'credit bureau' },
    { label: 'สัญญาสินเชื่อ', href: '/dashboard/contracts', icon: ReceiptText, description: 'สร้างและติดตามสัญญา พร้อมเอกสารและลายมือชื่อ', keywords: 'contract contracts' },
    { label: 'จ่ายเงินตามสัญญา', href: '/dashboard/ap', icon: BanknoteArrowDown, description: 'ตรวจรายการรอจ่ายและบันทึกเงินปล่อยกู้จริง', keywords: 'invoice disbursement รอจ่าย' },
    { label: 'รับชำระและติดตามหนี้', href: '/dashboard/repayments', icon: BanknoteArrowUp, description: 'รับชำระ ดูประวัติ และติดตามสัญญาค้างชำระ', keywords: 'ar repayments ลูกหนี้' },
    { label: 'ยอดคืนรายบุคคล', href: '/dashboard/repayments/summary', icon: ScrollText, description: 'รวมยอดที่ผู้กู้แต่ละรายต้องคืน แยกตามสัญญา', keywords: 'สรุปยอดผู้กู้ต้องคืน' },
    { label: 'เงินทุนสินเชื่อ', href: '/dashboard/capital', icon: Landmark, description: 'เงินทุน เงินพร้อมปล่อย เงินต้น และดอกเบี้ยรับคืน', keywords: 'capital บัญชีทุนสินเชื่อ' },
  ], workflow: ['/dashboard/borrower', '/dashboard/contracts', '/dashboard/ap', '/dashboard/repayments'] },
  { id: 'assets', title: 'ทรัพย์สินและหนี้สิน', href: '/dashboard/workspace/assets', icon: Building2, description: 'ทะเบียน Property, ASSET งานพัฒนา และภาระหนี้', items: [
    { label: 'อสังหาริมทรัพย์', href: '/thing/property', icon: Building2, description: 'Property ที่ถืออยู่ งานพัฒนา ต้นทุน และการขาย', keywords: 'property บ้าน ที่ดิน' },
    { label: 'ทะเบียนสินทรัพย์', href: '/thing/asset', icon: Landmark, description: 'ASSET ยานพาหนะ อาคาร และทรัพย์สินอื่น', keywords: 'asset assets รถ' },
    { label: 'หนี้สินและสัญญางาน', href: '/thing/liabilities', icon: HandCoins, description: 'หนี้ธนาคาร สัญญาผู้รับเหมา ค่างวด และการชำระ', keywords: 'liabilities loan boq contractor หนี้สิน' },
    { label: 'รายการที่ลบ', href: '/thing/deleted', icon: Trash2, description: 'ตรวจรายการทรัพย์สินที่ลบและข้อมูลที่กู้คืนได้', keywords: 'deleted trash' },
  ], workflow: ['/thing/property', '/thing/asset', '/thing/liabilities'] },
  { id: 'partners', title: 'คู่ค้าและผู้ให้ทุน', href: '/dashboard/workspace/partners', icon: UsersRound, description: 'ข้อมูลผู้ให้กู้ ผู้แนะนำ และส่วนแบ่ง', items: [
    { label: 'ผู้ให้กู้และเจ้าหนี้', href: '/dashboard/lenders', icon: HandCoins, description: 'ทะเบียนผู้ให้กู้และข้อมูลเจ้าหนี้', keywords: 'lenders creditors' },
    { label: 'ผู้แนะนำ', href: '/dashboard/persuaders', icon: FolderUser, description: 'ทะเบียนผู้แนะนำและข้อมูลที่เกี่ยวข้อง', keywords: 'persuader' },
    { label: 'ส่วนแบ่งผู้แนะนำ', href: '/dashboard/persuaders/shares', icon: ReceiptText, description: 'ตรวจและจัดการส่วนแบ่งตามรายการผู้แนะนำ', keywords: 'shares commission ค่านายหน้า' },
  ] },
  { id: 'reports', title: 'รายงานและปิดบัญชี', href: '/dashboard/workspace/reports', icon: ChartNoAxesCombined, description: 'วิเคราะห์ผลการดำเนินงาน ตรวจบัญชี และปิดยอดรายเดือน', items: [
    { label: 'วิเคราะห์ข้อมูล', href: '/dashboard/analytics', icon: ChartNoAxesCombined, description: 'วิเคราะห์กระแสเงินสด สินเชื่อ ความเสี่ยง และหมวดรายการ', keywords: 'analytics report' },
    { label: 'รายงานบัญชี', href: '/dashboard/accounting', icon: WalletCards, description: 'สรุปและตรวจข้อมูลบัญชีตามช่วงเวลา', keywords: 'accounting' },
    { label: 'ปิดดุลบัญชี', href: '/dashboard/ac', icon: BanknoteX, description: 'ตรวจยอดรายเดือนและจัดทำแฟ้มปิดดุล', keywords: 'closing ปิดบัญชี' },
  ], workflow: ['/dashboard/analytics', '/dashboard/accounting', '/dashboard/ac'] },
  { id: 'system', title: 'ตั้งค่าระบบ', href: '/dashboard/workspace/system', icon: Settings2, description: 'บัญชีผู้ใช้ ข้อมูลตั้งต้น ประวัติ และสำรองข้อมูล', items: [
    { label: 'ผู้ใช้งาน', href: '/dashboard/admin/users', icon: UserShield, description: 'บัญชีผู้ใช้งานและสิทธิ์ในระบบ', keywords: 'users admin' },
    { label: 'ข้อมูลตั้งต้น', href: '/dashboard/admin/masterdata', icon: ScrollText, description: 'หมวดรายการ ธนาคาร สถานะ และข้อมูลอ้างอิง', keywords: 'masterdata master data ตั้งค่า' },
    { label: 'ประวัติการทำงาน', href: '/dashboard/logs', icon: ClipboardClock, description: 'ตรวจประวัติการเปลี่ยนแปลงและการทำรายการ', keywords: 'logs audit' },
    { label: 'สำรองข้อมูล', href: '/dashboard/admin/backups', icon: DatabaseBackup, description: 'สำรองฐานข้อมูลพร้อมไฟล์แนบ และดาวน์โหลดสำเนา', keywords: 'backups backup' },
  ] },
]

export const WORKSPACE_HOME: NavItem = { label: 'พื้นที่ทำงานทั้งหมด', href: '/dashboard/workspace', icon: LayoutGrid, description: 'เลือกหมวดงานและทางลัดของทุกส่วนในระบบ' }

/** Child pages remain reachable in search and have precise breadcrumbs. */
export const NAV_CHILD_PAGES: (NavItem & { parentHref: string })[] = [
  { label: 'สร้างสัญญาสินเชื่อ', href: '/dashboard/contracts/new', parentHref: '/dashboard/contracts', icon: ReceiptText, description: 'เลือกผู้กู้เพื่อเริ่มสร้างสัญญา', keywords: 'new contract' },
  ...[
    ['boq', 'ประมาณราคา BOQ'], ['built-in', 'งาน Built-in'], ['inventory', 'วัสดุและสินค้าคงคลัง'], ['valuations', 'ประเมินมูลค่า'], ['history', 'ประวัติการขาย'],
  ].map(([path,label]) => ({ label, href: `/thing/property/${path}`, parentHref: '/thing/property', icon: Building2, description: `${label}ของอสังหาริมทรัพย์` })),
  { label: 'ชำระค่าสินทรัพย์', href: '/thing/asset/payments', parentHref: '/thing/asset', icon: Banknote, description: 'รายการชำระเงินของสินทรัพย์', keywords: 'payments' },
  ...[
    ['loan-status', 'สถานะสินเชื่อ'], ['interest-rate', 'อัตราดอกเบี้ย'], ['category', 'หมวดรับ–จ่าย'], ['asset-category', 'หมวดสินทรัพย์'], ['risk-rating', 'ระดับความเสี่ยง'], ['bank', 'ธนาคาร'], ['postcode', 'ข้อมูลที่อยู่'],
  ].map(([path,label]) => ({ label, href: `/dashboard/admin/masterdata/${path}`, parentHref: '/dashboard/admin/masterdata', icon: ScrollText, description: `จัดการ${label}` })),
]

const aliases: Record<string,string> = {
  '/dashboard/cashbook-2025': '/dashboard/ledger',
  '/dashboard/ar': '/dashboard/repayments',
  '/dashboard/invoice': '/dashboard/ap',
}

export function findActiveNavItem(pathname: string, search = '') {
  const path = aliases[pathname] ?? pathname
  const items = NAV_GROUPS.flatMap(group => group.items)
  const child = NAV_CHILD_PAGES.find(page => page.href === path)
  if (child) return items.find(item => item.href === child.parentHref)
  return items.find(item => item.href === `${path}${search}`) ?? items.find(item => item.href === path)
    ?? items.filter(item => item.href !== '/dashboard' && path.startsWith(`${item.href}/`)).sort((a,b) => b.href.length-a.href.length)[0]
}

export function getWorkspaceContext(pathname: string) {
  const item = findActiveNavItem(pathname)
  const group = NAV_GROUPS.find(group => group.href === pathname || group.items.some(candidate => candidate.href === item?.href))
  const page = NAV_CHILD_PAGES.find(page => page.href === pathname) ?? item
  return { group, item, page, isHub: group?.href === pathname && pathname !== '/dashboard' }
}

export function searchWorkspace(query: string) {
  const term = query.trim().toLocaleLowerCase()
  if (!term) return []
  const pages = [WORKSPACE_HOME, ...NAV_GROUPS.flatMap(group => [
    ...(group.id === 'overview' ? [] : [{ label: group.title, href: group.href, icon: group.icon, description: group.description }]),
    ...group.items,
  ]), ...NAV_CHILD_PAGES]
  const words = term.split(/\s+/)
  return pages.filter(item => words.every(word => `${item.label} ${item.description} ${item.href} ${'keywords' in item ? item.keywords : ''}`.toLocaleLowerCase().includes(word)))
}
