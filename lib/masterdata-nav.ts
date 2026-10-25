import { FolderTree, Landmark, MapPin, ShieldCheck, Percent, ListChecks, Boxes } from 'lucide-react'

/** Add new Masterdata menus here to update both the overview and subnav. */
export const MASTERDATA_MENUS = [
  { title: 'หมวดหมู่สินทรัพย์', description: 'สินทรัพย์หมุนเวียนและไม่หมุนเวียน พร้อมหมวดย่อย', href: '/dashboard/admin/masterdata/asset-category', icon: Boxes, tone: 'bg-sky-300/10 text-sky-200' },
  { title: 'หมวดหมู่', description: 'ข้อมูลหมวดหมู่สำหรับใช้อ้างอิงในระบบ', href: '/dashboard/admin/masterdata/category', icon: FolderTree, tone: 'bg-[#eaf1ff] text-[#3476df]' },
  { title: 'ร้อยละดอกเบี้ย', description: 'ตัวเลือกอัตราดอกเบี้ยสำหรับสินเชื่อ', href: '/dashboard/admin/masterdata/interest-rate', icon: Percent, tone: 'bg-sky-300/10 text-sky-200' },
  { title: 'สถานะสินเชื่อ', description: 'สถานะสำหรับใช้อ้างอิงในงานสินเชื่อ', href: '/dashboard/admin/masterdata/loan-status', icon: ListChecks, tone: 'bg-teal-300/10 text-teal-200' },
  { title: 'ระดับความเสี่ยง', description: 'ระดับความเสี่ยง ลำดับ และรายการระงับที่ใช้ในระบบ', href: '/dashboard/admin/masterdata/risk-rating', icon: ShieldCheck, tone: 'bg-amber-300/10 text-amber-200' },
  { title: 'ธนาคาร', description: 'รายชื่อธนาคารสำหรับช่องทางรับและจ่ายเงิน', href: '/dashboard/admin/masterdata/bank', icon: Landmark, tone: 'bg-[#f2edff] text-[#7954c7]' },
  { title: 'รหัสไปรษณีย์', description: 'ข้อมูลรหัสไปรษณีย์และพื้นที่ในประเทศไทย', href: '/dashboard/admin/masterdata/postcode', icon: MapPin, tone: 'bg-[#e7f7ef] text-[#299d69]' },
]
