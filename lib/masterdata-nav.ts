import { FolderTree, Landmark, MapPin } from 'lucide-react'

/** Add new Masterdata menus here to update both the overview and sidebar. */
export const MASTERDATA_MENUS = [
  { title: 'หมวดหมู่', description: 'ข้อมูลหมวดหมู่สำหรับใช้อ้างอิงในระบบ', href: '/dashboard/admin/masterdata/category', icon: FolderTree, tone: 'bg-[#eaf1ff] text-[#3476df]' },
  { title: 'ธนาคาร', description: 'รายชื่อธนาคารสำหรับช่องทางรับและจ่ายเงิน', href: '/dashboard/admin/masterdata/bank', icon: Landmark, tone: 'bg-[#f2edff] text-[#7954c7]' },
  { title: 'รหัสไปรษณีย์', description: 'ข้อมูลรหัสไปรษณีย์และพื้นที่ในประเทศไทย', href: '/dashboard/admin/masterdata/postcode', icon: MapPin, tone: 'bg-[#e7f7ef] text-[#299d69]' },
]
