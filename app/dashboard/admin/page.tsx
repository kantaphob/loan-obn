'use client'

import { Header } from '@/components/ui/header'
import { PageContainer } from '@/components/ui/page-container'
import { Button } from '@/components/ui/button'
import { Suspense, useMemo, useState, type FormEvent, type ReactNode } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Icon } from '@/components/dashboard/icon'
import { Card } from '@/components/ui/card'
import { Modal } from '@/components/ui/modal'
import { StatusBadge } from '@/components/ui/status-badge'
import { useToast } from '@/components/ui/toast'

type Section = 'users' | 'masterdata' | 'settings'
type UserStatus = 'Active' | 'Inactive'
type AdminUser = { name: string; email: string; role: string; team: string; status: UserStatus; initials: string; color: string }

const initialUsers: AdminUser[] = [
  { name: 'Nattaya Prasert', email: 'nattaya@novafinance.co.th', role: 'Super Admin', team: 'ผู้ดูแลระบบ', status: 'Active', initials: 'NP', color: 'blue' },
  { name: 'Krit Sutham', email: 'krit@novafinance.co.th', role: 'Admin', team: 'ฝ่ายสินเชื่อ', status: 'Active', initials: 'KS', color: 'violet' },
  { name: 'Pimchanok Rattanakul', email: 'pimchanok@novafinance.co.th', role: 'Loan Officer', team: 'ฝ่ายสินเชื่อ', status: 'Active', initials: 'PR', color: 'peach' },
  { name: 'Thanawat Boonmee', email: 'thanawat@novafinance.co.th', role: 'Reviewer', team: 'ฝ่ายอนุมัติ', status: 'Active', initials: 'TB', color: 'mint' },
  { name: 'Sirin Chaiyasit', email: 'sirin@novafinance.co.th', role: 'Loan Officer', team: 'ฝ่ายสินเชื่อ', status: 'Inactive', initials: 'SC', color: 'rose' },
]

const sections: { id: Section; label: string; description: string; icon: 'users' | 'grid' | 'settings' }[] = [
  { id: 'users', label: 'Users', description: 'จัดการบัญชีผู้ใช้งานและสิทธิ์การเข้าถึง', icon: 'users' },
  { id: 'masterdata', label: 'Masterdata', description: 'จัดการข้อมูลอ้างอิงที่ใช้ในระบบสินเชื่อ', icon: 'grid' },
  { id: 'settings', label: 'Settings', description: 'ตั้งค่าการทำงานและความปลอดภัยของระบบ', icon: 'settings' },
]

function AdminHeader({ section, children }: { section: Section; children?: ReactNode }) {
  const active = sections.find((item) => item.id === section)!
  return <Header title={active.label} eyebrow="Administration" description={active.description} actions={children} />
}

function SectionTabs({ active, onChange }: { active: Section; onChange: (section: Section) => void }) {
  return (
    <div role="tablist" aria-label="Admin sections" className="mb-6 flex gap-1 overflow-x-auto rounded-[15px] border border-white/80 bg-white/35 p-1.5 shadow-[inset_0_1px_0_#ffffff]">
      {sections.map((section) => (
        <button key={section.id} type="button" role="tab" aria-selected={active === section.id} onClick={() => onChange(section.id)} className={`flex min-h-10 shrink-0 items-center gap-2 rounded-[11px] px-4 text-xs font-semibold transition ${active === section.id ? 'bg-white/85 text-[#1769e8] shadow-[0_4px_14px_#53678312,inset_0_1px_0_white]' : 'text-[#77787b] hover:bg-white/50 hover:text-[#343537]'}`}>
          <Icon name={section.icon} className="h-[17px] w-[17px]" />{section.label}
        </button>
      ))}
    </div>
  )
}

function SummaryCard({ label, value, note, mark, tone }: { label: string; value: string; note: string; mark: string; tone: string }) {
  return (
    <Card className="rounded-[19px] p-[17px]">
      <div className="flex items-start justify-between gap-3">
        <div><p className="m-0 text-[10px] font-medium text-[#77787b]">{label}</p><p className="mb-0 mt-2 text-[25px] font-bold tracking-[-.7px] text-[#252629]">{value}</p></div>
        <span className={`grid h-9 w-9 place-items-center rounded-xl text-[14px] font-bold ${tone}`}>{mark}</span>
      </div>
      <p className="mb-0 mt-3 text-[10px] text-[#77787b]">{note}</p>
    </Card>
  )
}

function UsersSection({ users, onAdd }: { users: AdminUser[]; onAdd: (user: AdminUser) => void }) {
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState('All users')
  const [open, setOpen] = useState(false)
  const [newUser, setNewUser] = useState({ name: '', email: '', role: 'Loan Officer', team: 'ฝ่ายสินเชื่อ' })
  const { toast } = useToast()
  const filtered = useMemo(() => users.filter((user) => {
    const matchesQuery = `${user.name} ${user.email} ${user.role} ${user.team}`.toLowerCase().includes(query.toLowerCase())
    const matchesStatus = status === 'All users' || user.status === status
    return matchesQuery && matchesStatus
  }), [users, query, status])
  const activeCount = users.filter((user) => user.status === 'Active').length

  function submitUser(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const name = newUser.name.trim()
    const email = newUser.email.trim()
    if (!name || !email) return
    onAdd({ name, email, role: newUser.role, team: newUser.team, status: 'Active', initials: name.split(/\s+/).map((part) => part[0]).join('').slice(0, 2).toUpperCase(), color: 'blue' })
    setNewUser({ name: '', email: '', role: 'Loan Officer', team: 'ฝ่ายสินเชื่อ' })
    setOpen(false)
    toast({ title: 'เพิ่มผู้ใช้งานแล้ว', description: `ส่งคำเชิญไปที่ ${email}`, variant: 'success' })
  }

  return (
    <>
      <AdminHeader section="users">
        <Button variant="primary" type="button" onClick={() => setOpen(true)} className=""><span className="text-base">＋</span>เพิ่มผู้ใช้งาน</Button>
      </AdminHeader>

      <div className="mb-5 grid grid-cols-3 gap-3 max-[760px]:grid-cols-1">
        <SummaryCard label="ผู้ใช้งานทั้งหมด" value={String(users.length).padStart(2, '0')} note="บัญชีใน workspace นี้" mark="♙" tone="bg-[#eaf1ff] text-[#3476df]" />
        <SummaryCard label="ใช้งานอยู่" value={String(activeCount).padStart(2, '0')} note="สามารถเข้าสู่ระบบได้" mark="✓" tone="bg-[#e7f7ef] text-[#299d69]" />
        <SummaryCard label="บทบาทในระบบ" value="04" note="กำหนดสิทธิ์ตามหน้าที่" mark="◇" tone="bg-[#f1ecff] text-[#8464d8]" />
      </div>

      <Card as="section" className="overflow-hidden rounded-[22px]">
        <div className="flex items-center justify-between gap-4 border-b border-white/75 px-5 py-[17px] max-[760px]:flex-col max-[760px]:items-stretch max-[760px]:px-4">
          <div><h2 className="m-0 text-[13px] font-semibold text-[#292a2c]">รายชื่อผู้ใช้งาน</h2><p className="mb-0 mt-1 text-[10px] text-[#77787b]">ดูแลสมาชิกและบทบาทการเข้าถึงระบบ</p></div>
          <div className="flex gap-2 max-[500px]:flex-col">
            <label className="flex min-h-9 items-center gap-2 rounded-xl border border-white/90 bg-white/55 px-3 text-[#85868a] focus-within:border-[#9bb9ef]">
              <span aria-hidden="true" className="text-[15px]">⌕</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="ค้นหาชื่อหรืออีเมล" aria-label="ค้นหาผู้ใช้" className="w-[170px] bg-transparent text-[10px] text-[#343537] outline-none placeholder:text-[#85868a] max-[500px]:w-full" />
            </label>
            <select aria-label="กรองตามสถานะ" value={status} onChange={(event) => setStatus(event.target.value)} className="min-h-9 rounded-xl border border-white/90 bg-white/55 px-3 text-[10px] font-medium text-[#56575a] outline-none focus:border-[#9bb9ef]"><option>All users</option><option>Active</option><option>Inactive</option></select>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[690px] border-collapse text-left">
            <thead><tr className="text-[9px] font-semibold uppercase tracking-[.07em] text-[#9aa4b2]"><th className="px-5 py-3 font-semibold">ชื่อผู้ใช้งาน</th><th className="px-4 py-3 font-semibold">บทบาท</th><th className="px-4 py-3 font-semibold">ทีม</th><th className="px-4 py-3 font-semibold">สถานะ</th><th className="w-12 px-4 py-3" /></tr></thead>
            <tbody>
              {filtered.map((user) => <tr key={user.email} className="border-t border-white/70 text-[10px] text-[#56575a] transition hover:bg-white/25">
                <td className="px-5 py-3.5"><div className="flex items-center gap-3"><span className={`grid h-9 w-9 shrink-0 place-items-center rounded-full text-[10px] font-bold ${avatarTone(user.color)}`}>{user.initials}</span><span className="min-w-0"><strong className="block truncate text-[11px] font-semibold text-[#343537]">{user.name}</strong><span className="mt-1 block truncate text-[9px] text-[#77787b]">{user.email}</span></span></div></td>
                <td className="px-4 py-3.5"><span className="rounded-lg border border-white/90 bg-white/45 px-2.5 py-1.5 text-[9px] font-medium text-[#56575a]">{user.role}</span></td>
                <td className="px-4 py-3.5">{user.team}</td>
                <td className="px-4 py-3.5"><StatusBadge status={user.status === 'Active' ? 'ACTIVE' : 'INACTIVE'} label={user.status} /></td>
                <td className="px-4 py-3.5 text-right"><button type="button" title={`จัดการ ${user.name}`} onClick={() => toast({ title: user.name, description: `บทบาท ${user.role} · ${user.status}` })} className="grid h-8 w-8 place-items-center rounded-lg border-0 bg-transparent text-base text-[#9aa4b2] transition hover:bg-white/65 hover:text-[#4d5f7b]">•••</button></td>
              </tr>)}
              {filtered.length === 0 && <tr><td colSpan={5} className="px-5 py-12 text-center text-xs text-[#77787b]">ไม่พบผู้ใช้ที่ตรงกับการค้นหา</td></tr>}
            </tbody>
          </table>
        </div>
        <div className="flex items-center justify-between border-t border-white/70 px-5 py-3 text-[9px] text-[#77787b]"><span>แสดง {filtered.length} จาก {users.length} รายการ</span><span>อัปเดตล่าสุดวันนี้</span></div>
      </Card>

      <Modal open={open} onClose={() => setOpen(false)} title="เพิ่มผู้ใช้งาน" description="ส่งคำเชิญให้สมาชิกใหม่เข้าร่วม workspace">
        <form onSubmit={submitUser} className="space-y-4">
          <label className="block space-y-1.5 text-xs font-medium text-[#465267]">ชื่อ-นามสกุล<input required value={newUser.name} onChange={(event) => setNewUser({ ...newUser, name: event.target.value })} placeholder="เช่น กานต์ชนก ใจดี" className={inputClass} /></label>
          <label className="block space-y-1.5 text-xs font-medium text-[#465267]">อีเมล<input required type="email" value={newUser.email} onChange={(event) => setNewUser({ ...newUser, email: event.target.value })} placeholder="name@company.co.th" className={inputClass} /></label>
          <div className="grid grid-cols-2 gap-3 max-[500px]:grid-cols-1">
            <label className="block space-y-1.5 text-xs font-medium text-[#465267]">บทบาท<select value={newUser.role} onChange={(event) => setNewUser({ ...newUser, role: event.target.value })} className={inputClass}><option>Loan Officer</option><option>Reviewer</option><option>Admin</option></select></label>
            <label className="block space-y-1.5 text-xs font-medium text-[#465267]">ทีม<select value={newUser.team} onChange={(event) => setNewUser({ ...newUser, team: event.target.value })} className={inputClass}><option>ฝ่ายสินเชื่อ</option><option>ฝ่ายอนุมัติ</option><option>ผู้ดูแลระบบ</option></select></label>
          </div>
          <div className="flex justify-end gap-2 pt-2"><Button variant="secondary" type="button" onClick={() => setOpen(false)} className="">ยกเลิก</Button><Button variant="primary" type="submit" className="">ส่งคำเชิญ</Button></div>
        </form>
      </Modal>
    </>
  )
}

const masterdataGroups = [
  { icon: '⌂', name: 'ประเภทสินเชื่อ', english: 'Loan products', count: '06 รายการ', detail: 'สินเชื่อส่วนบุคคล, รถยนต์, ธุรกิจ', color: 'bg-[#eaf1ff] text-[#3476df]', updated: 'แก้ไข 21 ต.ค. 2569' },
  { icon: '◎', name: 'สถานะคำขอ', english: 'Application statuses', count: '08 รายการ', detail: 'รอตรวจสอบ, พิจารณา, อนุมัติ, ปฏิเสธ', color: 'bg-[#f1ecff] text-[#8464d8]', updated: 'แก้ไข 19 ต.ค. 2569' },
  { icon: '♙', name: 'อาชีพ', english: 'Occupations', count: '24 รายการ', detail: 'รายการอาชีพสำหรับข้อมูลผู้ขอสินเชื่อ', color: 'bg-[#e7f7ef] text-[#299d69]', updated: 'แก้ไข 18 ต.ค. 2569' },
  { icon: '⌖', name: 'จังหวัดและพื้นที่', english: 'Locations', count: '8,438 รายการ', detail: '77 จังหวัด · 928 อำเภอ · 7,433 ตำบล', color: 'bg-[#fff3e7] text-[#d18a35]', updated: 'ข้อมูลกลางประเทศไทย' },
  { icon: '⌖', name: 'รหัสไปรษณีย์', english: 'Postcodes', count: '956 รหัส', detail: 'รหัสไปรษณีย์ 5 หลักที่เชื่อมกับตำบล', color: 'bg-[#e7f7ef] text-[#299d69]', updated: 'ข้อมูลกลางประเทศไทย' },
]

function MasterdataSection() {
  const { toast } = useToast()
  const router = useRouter()
  return <>
    <AdminHeader section="masterdata"><Button variant="primary" type="button" onClick={() => toast({ title: 'สร้างรายการข้อมูล', description: 'เลือกหมวดหมู่ที่ต้องการเพิ่มรายการ' })} className=""><span className="text-base">＋</span>เพิ่มข้อมูล</Button></AdminHeader>
    <div className="mb-5 flex items-center justify-between rounded-[17px] border border-white/75 bg-white/35 px-5 py-4 shadow-[inset_0_1px_0_#ffffff] max-[600px]:items-start max-[600px]:gap-3"><div><p className="m-0 text-[11px] font-semibold text-[#343537]">ข้อมูลกลางของระบบ</p><p className="mb-0 mt-1 text-[10px] text-[#77787b]">จัดการตัวเลือกที่ใช้ในแบบฟอร์มและขั้นตอนพิจารณาสินเชื่อ</p></div><span className="shrink-0 rounded-full bg-[#e9f7ef] px-3 py-1.5 text-[9px] font-semibold text-[#27895c]">9,394 รายการพื้นที่</span></div>
    <div className="grid grid-cols-2 gap-4 max-[760px]:grid-cols-1">{masterdataGroups.map((group) => <Card key={group.name} className="rounded-[20px] p-5"><div className="flex items-start justify-between"><span className={`grid h-10 w-10 place-items-center rounded-[13px] text-lg ${group.color}`}>{group.icon}</span><button type="button" onClick={() => toast({ title: group.name, description: `เปิดจัดการ ${group.count}` })} aria-label={`จัดการ ${group.name}`} className="grid h-8 w-8 place-items-center rounded-lg border-0 bg-transparent text-base text-[#9aa4b2] hover:bg-white/60">•••</button></div><div className="mt-4 flex items-start justify-between gap-3"><div><h2 className="m-0 text-[13px] font-semibold text-[#292a2c]">{group.name}</h2><p className="mb-0 mt-1 text-[10px] text-[#77787b]">{group.english}</p></div><span className="shrink-0 rounded-lg border border-white/90 bg-white/50 px-2.5 py-1.5 text-[9px] font-semibold text-[#56575a]">{group.count}</span></div><p className="mb-0 mt-4 text-[10px] text-[#7e8a9e]">{group.detail}</p><div className="mt-4 flex items-center justify-between border-t border-white/70 pt-3"><span className="text-[9px] text-[#a0a9b6]">{group.updated}</span><button type="button" onClick={() => group.english === 'Postcodes' ? router.push('/dashboard/admin/masterdata/postcode') : toast({ title: 'กำลังเปิดรายการ', description: `หมวดหมู่ ${group.name}` })} className="flex items-center gap-1 border-0 bg-transparent text-[10px] font-semibold text-[#3476df]">ดูรายการ <Icon name="chevron" className="h-3 w-3" /></button></div></Card>)}</div>
  </>
}

function SettingsSection() {
  const { toast } = useToast()
  const [settings, setSettings] = useState({ invite: true, twoFactor: true, notices: false, audit: true })
  const settingRows: { key: keyof typeof settings; title: string; description: string }[] = [
    { key: 'invite', title: 'อนุญาตให้เชิญผู้ใช้งาน', description: 'ผู้ดูแลระบบสามารถส่งคำเชิญสมาชิกใหม่เข้าร่วม workspace' },
    { key: 'twoFactor', title: 'บังคับใช้การยืนยันตัวตนสองขั้นตอน', description: 'เพิ่มความปลอดภัยให้บัญชีผู้ใช้งานทุกคน' },
    { key: 'notices', title: 'แจ้งเตือนกิจกรรมทางอีเมล', description: 'ส่งอีเมลเมื่อมีการเปลี่ยนแปลงสำคัญในระบบ' },
    { key: 'audit', title: 'บันทึกประวัติการใช้งาน', description: 'เก็บประวัติการเปลี่ยนแปลงเพื่อการตรวจสอบย้อนหลัง' },
  ]
  return <>
    <AdminHeader section="settings"><Button variant="primary" type="button" onClick={() => toast({ title: 'บันทึกการตั้งค่าแล้ว', description: 'การตั้งค่าระบบได้รับการอัปเดต', variant: 'success' })} className="">บันทึกการตั้งค่า</Button></AdminHeader>
    <div className="grid grid-cols-[1.4fr_.9fr] gap-4 max-[900px]:grid-cols-1">
      <Card as="section" className="rounded-[22px] p-5"><div className="mb-4"><h2 className="m-0 text-[13px] font-semibold text-[#292a2c]">ความปลอดภัยและการเข้าถึง</h2><p className="mb-0 mt-1 text-[10px] text-[#77787b]">กำหนดนโยบายสำหรับ workspace ของคุณ</p></div><div className="divide-y divide-white/75">{settingRows.map((row) => <div key={row.key} className="flex items-center justify-between gap-4 py-4"><div><p className="m-0 text-[11px] font-semibold text-[#465267]">{row.title}</p><p className="mb-0 mt-1 max-w-[440px] text-[9px] leading-4 text-[#77787b]">{row.description}</p></div><button type="button" role="switch" aria-checked={settings[row.key]} aria-label={row.title} onClick={() => setSettings({ ...settings, [row.key]: !settings[row.key] })} className={`relative h-[23px] w-[41px] shrink-0 rounded-full border-0 transition ${settings[row.key] ? 'bg-[#3476df]' : 'bg-[#c9d0dc]'}`}><span className={`absolute top-[3px] h-[17px] w-[17px] rounded-full bg-white shadow-sm transition-all ${settings[row.key] ? 'left-[21px]' : 'left-[3px]'}`} /></button></div>)}</div></Card>
      <div className="space-y-4"><Card className="rounded-[22px] p-5"><div className="flex items-center gap-3"><span className="grid h-10 w-10 place-items-center rounded-[13px] bg-[#eaf1ff] text-[#3476df]"><Icon name="settings" /></span><div><h2 className="m-0 text-[12px] font-semibold text-[#292a2c]">ข้อมูล workspace</h2><p className="mb-0 mt-1 text-[9px] text-[#77787b]">รายละเอียดองค์กรของคุณ</p></div></div><div className="mt-5 space-y-3"><InfoRow label="ชื่อ workspace" value="Nova Finance" /><InfoRow label="รหัสองค์กร" value="OBN-TH-00428" /><InfoRow label="เขตเวลา" value="Asia/Bangkok (UTC+7)" /><InfoRow label="ภาษา" value="ไทย (TH)" /></div><button type="button" onClick={() => toast({ title: 'ข้อมูล workspace', description: 'การแก้ไขข้อมูล workspace จะพร้อมใช้งานเร็ว ๆ นี้' })} className="mt-5 min-h-9 w-full rounded-xl border border-white/90 bg-white/50 text-[10px] font-semibold text-[#56575a] transition hover:bg-white/80">แก้ไขข้อมูล</button></Card><div className="rounded-[19px] border border-[#dce8ff]/80 bg-[#e9f1ff]/65 p-4"><div className="flex gap-3"><span className="grid h-8 w-8 shrink-0 place-items-center rounded-[10px] bg-white/70 text-sm text-[#3476df]">i</span><div><p className="m-0 text-[10px] font-semibold text-[#3d5e91]">การเปลี่ยนแปลงมีผลทันที</p><p className="mb-0 mt-1 text-[9px] leading-4 text-[#7185a6]">ระบบจะบันทึกและนำการตั้งค่าใหม่ไปใช้กับสมาชิกใน workspace</p></div></div></div></div>
    </div>
  </>
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return <div className="flex items-center justify-between gap-3 border-b border-white/65 pb-2.5 last:border-0 last:pb-0"><span className="text-[9px] text-[#77787b]">{label}</span><span className="text-right text-[9px] font-medium text-[#56575a]">{value}</span></div>
}

function avatarTone(color: string) {
  const tones: Record<string, string> = { blue: 'bg-[#e8efff] text-[#3970d3]', violet: 'bg-[#f0ebff] text-[#8064ca]', peach: 'bg-[#fff0e4] text-[#be7b3e]', mint: 'bg-[#e5f5ef] text-[#348b68]', rose: 'bg-[#fbeaf0] text-[#bd6686]' }
  return tones[color] ?? tones.blue
}

const inputClass = 'w-full rounded-xl border border-white/90 bg-white/65 px-3.5 py-3 text-sm text-[#26354d] outline-none ring-[#80aaff]/30 placeholder:text-[#a0aabc] focus:border-[#8bb2ff] focus:ring-4'

function AdminContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const requestedSection = searchParams.get('section')
  const section = sections.find((item) => item.id === requestedSection)?.id ?? 'users'
  const [users, setUsers] = useState(initialUsers)

  return (
    <div className="relative z-10 min-h-[calc(100dvh-24px)] font-sans text-[#222325]">
        <PageContainer>
          <SectionTabs active={section} onChange={(nextSection) => router.replace(`/dashboard/admin?section=${nextSection}`, { scroll: false })} />
          {section === 'users' && <UsersSection users={users} onAdd={(user) => setUsers((current) => [user, ...current])} />}
          {section === 'masterdata' && <MasterdataSection />}
          {section === 'settings' && <SettingsSection />}
        </PageContainer>
    </div>
  )
}

export default function AdminPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#eef3fc]" />}>
      <AdminContent />
    </Suspense>
  )
}
