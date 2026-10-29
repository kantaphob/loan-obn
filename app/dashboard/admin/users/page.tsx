'use client'

import { DataLoading } from '@/components/ui/data-loading'

import { PageContainer } from '@/components/ui/page-container'
import { Button } from '@/components/ui/button'
import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react'
import { Card } from '@/components/ui/card'
import { Header } from '@/components/ui/header'
import { Modal } from '@/components/ui/modal'
import { StatusBadge } from '@/components/ui/status-badge'
import { useToast } from '@/components/ui/toast'

type Role = 'SUPER_ADMIN' | 'ADMIN' | 'LOAN_OFFICER' | 'REVIEWER'
type Status = 'ACTIVE' | 'INACTIVE'
type User = { id: string; acccode: string; role: Role; level: number; status: Status; createdAt: string; updatedAt: string; userprofile: { firstName: string; lastName: string; email: string; phone: string | null } | null }
type UserDraft = { acccode: string; password: string; firstName: string; lastName: string; email: string; phone: string; role: Role; level: number; status: Status }
type ApiResult = { user?: User; users?: User[]; message?: string }

const roleOptions: { value: Role; label: string }[] = [
  { value: 'SUPER_ADMIN', label: 'Super Admin' },
  { value: 'ADMIN', label: 'Admin' },
  { value: 'LOAN_OFFICER', label: 'Loan Officer' },
  { value: 'REVIEWER', label: 'Reviewer' },
]
const blankDraft: UserDraft = { acccode: '', password: '', firstName: '', lastName: '', email: '', phone: '', role: 'LOAN_OFFICER', level: 9, status: 'ACTIVE' }
const inputClass = 'w-full rounded-xl border border-white/85 bg-white/45 px-3.5 py-3 text-sm text-[#343537] outline-none placeholder:text-[#85868a] focus:border-[#8b8c8f] focus:ring-4 focus:ring-[#555659]/15'

function fullName(user: User) {
  return [user.userprofile?.firstName, user.userprofile?.lastName].filter(Boolean).join(' ') || user.acccode
}

function initials(name: string) {
  return name.trim().split(/\s+/).slice(0, 2).map((part) => part[0] ?? '').join('').toUpperCase() || 'U'
}

function roleLabel(role: Role) {
  return roleOptions.find((option) => option.value === role)?.label ?? role
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat('th-TH', { dateStyle: 'medium' }).format(new Date(value))
}

async function readResult(response: Response): Promise<ApiResult> {
  return response.json().catch(() => ({})) as Promise<ApiResult>
}

export default function AdminUsersPage() {
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [query, setQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<'ALL' | Status>('ALL')
  const [modalOpen, setModalOpen] = useState(false)
  const [editingUser, setEditingUser] = useState<User | null>(null)
  const [draft, setDraft] = useState<UserDraft>(blankDraft)
  const [formError, setFormError] = useState('')
  const [saving, setSaving] = useState(false)
  const [deletingUser, setDeletingUser] = useState<User | null>(null)
  const [deleting, setDeleting] = useState(false)
  const { toast } = useToast()

  const loadUsers = useCallback(async (signal?: AbortSignal) => {
    if (signal?.aborted) return
    setLoading(true)
    setLoadError('')
    try {
      const response = await fetch('/api/admin/users', { cache: 'no-store', signal })
      const result = await readResult(response)
      if (!response.ok) throw new Error(result.message || 'โหลดรายชื่อผู้ใช้ไม่สำเร็จ')
      setUsers(result.users ?? [])
    } catch (error) {
      if (signal?.aborted || (error instanceof Error && error.name === 'AbortError')) return
      setLoadError(error instanceof Error ? error.message : 'เกิดข้อผิดพลาดในการโหลดข้อมูล')
    } finally {
      if (!signal?.aborted) setLoading(false)
    }
  }, [])

  useEffect(() => {
    const controller = new AbortController()
    queueMicrotask(() => {
      if (!controller.signal.aborted) void loadUsers(controller.signal)
    })
    return () => controller.abort()
  }, [loadUsers])

  const filteredUsers = useMemo(() => users.filter((user) => {
    const name = fullName(user)
    const email = user.userprofile?.email ?? ''
    const searchable = `${name} ${user.acccode} ${email} ${roleLabel(user.role)}`.toLocaleLowerCase('th')
    return searchable.includes(query.trim().toLocaleLowerCase('th')) && (statusFilter === 'ALL' || user.status === statusFilter)
  }), [users, query, statusFilter])
  const activeCount = users.filter((user) => user.status === 'ACTIVE').length
  const inactiveCount = users.length - activeCount

  function openCreate() {
    setEditingUser(null)
    setDraft(blankDraft)
    setFormError('')
    setModalOpen(true)
  }

  function openEdit(user: User) {
    setEditingUser(user)
    setDraft({ acccode: user.acccode, password: '', firstName: user.userprofile?.firstName ?? '', lastName: user.userprofile?.lastName ?? '', email: user.userprofile?.email ?? '', phone: user.userprofile?.phone ?? '', role: user.role, level: user.level, status: user.status })
    setFormError('')
    setModalOpen(true)
  }

  async function saveUser(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSaving(true)
    setFormError('')
    try {
      const response = await fetch('/api/admin/users', {
        method: editingUser ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editingUser ? { id: editingUser.id, ...draft } : draft),
      })
      const result = await readResult(response)
      if (!response.ok) throw new Error(result.message || 'บันทึกข้อมูลไม่สำเร็จ')
      setModalOpen(false)
      await loadUsers()
      toast({ title: editingUser ? 'อัปเดตผู้ใช้แล้ว' : 'เพิ่มผู้ใช้แล้ว', description: `${draft.acccode} · ${draft.firstName} ${draft.lastName}`, variant: 'success' })
    } catch (error) {
      setFormError(error instanceof Error ? error.message : 'เกิดข้อผิดพลาดในการบันทึก')
    } finally {
      setSaving(false)
    }
  }

  async function deleteUser() {
    if (!deletingUser) return
    setDeleting(true)
    try {
      const response = await fetch('/api/admin/users', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: deletingUser.id }) })
      const result = await readResult(response)
      if (!response.ok) throw new Error(result.message || 'ลบผู้ใช้ไม่สำเร็จ')
      const name = fullName(deletingUser)
      setDeletingUser(null)
      await loadUsers()
      toast({ title: 'ลบผู้ใช้แล้ว', description: name, variant: 'success' })
    } catch (error) {
      toast({ title: 'ลบผู้ใช้ไม่สำเร็จ', description: error instanceof Error ? error.message : 'เกิดข้อผิดพลาด', variant: 'error' })
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="relative z-10 min-h-[calc(100dvh-24px)] font-sans text-[#222325]">
      <PageContainer className="users-page-container">
        <Header
          eyebrow="Administration"
          title="Users"
          description="จัดการรหัสผู้ใช้ บทบาท และระดับสิทธิ์การเข้าถึงระบบ (Level 0 มีสิทธิ์สูงสุด)"
          className="w-full"
          actions={<Button variant="primary" type="button" onClick={openCreate} className=""><span className="text-2xl leading-none">＋</span>เพิ่มผู้ใช้</Button>}
        />

        <div className="users-page-body w-full">
        <div className="mb-5 grid grid-cols-3 gap-3 max-[760px]:grid-cols-1"><StatCard label="ผู้ใช้ทั้งหมด" value={users.length} description="บัญชีในระบบ" symbol="♙" tone="bg-[#e5f4ed] text-[#18805e]" /><StatCard label="ใช้งานอยู่" value={activeCount} description="สามารถเข้าสู่ระบบได้" symbol="✓" tone="bg-[#e9f7ef] text-[#27895c]" /><StatCard label="ปิดใช้งาน" value={inactiveCount} description="ยังเก็บข้อมูลไว้ในระบบ" symbol="◌" tone="bg-[#f1f2f5] text-[#7a8793]" /></div>

        <Card as="section" className="users-table-card overflow-hidden rounded-[22px]">
          <div className="flex items-center justify-between gap-4 border-b border-white/75 px-5 py-[17px] max-[760px]:flex-col max-[760px]:items-stretch max-[760px]:px-4"><div><h2 className="m-0 text-[13px] font-semibold text-[#292a2c]">รายชื่อผู้ใช้งาน</h2><p className="mb-0 mt-1 text-[10px] text-[#77787b]">เพิ่ม แก้ไข และลบบัญชีผู้ใช้งาน</p></div><div className="flex gap-2 max-[500px]:flex-col"><label className="flex min-h-9 items-center gap-2 rounded-xl border border-white/90 bg-white/55 px-3 text-[#77787b] focus-within:border-[#a4a5a7]"><span aria-hidden="true" className="text-[15px]">⌕</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="ค้นหารหัส ชื่อ หรืออีเมล" aria-label="ค้นหาผู้ใช้" className="w-[210px] bg-transparent text-[10px] text-[#343537] outline-none placeholder:text-[#85868a] max-[500px]:w-full" /></label><select aria-label="กรองตามสถานะ" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as 'ALL' | Status)} className="min-h-9 rounded-xl border border-white/90 bg-white/55 px-3 text-[10px] font-medium text-[#56575a] outline-none focus:border-[#a4a5a7]"><option value="ALL">ทุกสถานะ</option><option value="ACTIVE">ใช้งานอยู่</option><option value="INACTIVE">ปิดใช้งาน</option></select></div></div>
          <div className="users-table-scroll overflow-x-auto" tabIndex={0} role="region" aria-label="ตารางผู้ใช้งาน เลื่อนเพื่อดูข้อมูล"><table className="w-full min-w-[900px] border-collapse text-left"><thead><tr className="text-[9px] font-semibold uppercase tracking-[.07em] text-[#879990]"><th className="px-5 py-3 font-semibold">ผู้ใช้งาน</th><th className="px-4 py-3 font-semibold">บทบาท</th><th className="px-4 py-3 font-semibold">Level</th><th className="px-4 py-3 font-semibold">สถานะ</th><th className="px-4 py-3 font-semibold">วันที่เพิ่ม</th><th className="w-[180px] px-4 py-3 text-right font-semibold">จัดการ</th></tr></thead><tbody>
            {loading && <tr><td colSpan={6} className="px-5 py-4"><DataLoading compact label="กำลังโหลดรายชื่อผู้ใช้…" /></td></tr>}
            {!loading && loadError && <tr><td colSpan={6} className="px-5 py-14 text-center"><p className="text-xs text-[#b64b55]">{loadError}</p><button type="button" onClick={() => void loadUsers()} className="mt-3 rounded-lg border border-white/80 bg-white/60 px-3 py-2 text-[10px] font-semibold text-[#286e5b]">ลองอีกครั้ง</button></td></tr>}
            {!loading && !loadError && filteredUsers.map((user, index) => { const name = fullName(user); return <tr key={user.id} className="border-t border-white/70 text-[10px] text-[#56575a] transition hover:bg-white/25"><td className="px-5 py-3.5"><div className="flex items-center gap-3"><span className={`grid h-9 w-9 shrink-0 place-items-center rounded-full text-[10px] font-bold ${avatarTone(index)}`}>{initials(name)}</span><span className="min-w-0"><strong className="block truncate text-[11px] font-semibold text-[#343537]">{user.acccode}</strong><span className="mt-1 block truncate text-[9px] text-[#77787b]">{name} · {user.userprofile?.email}</span></span></div></td><td className="px-4 py-3.5"><span className="rounded-lg border border-white/90 bg-white/45 px-2.5 py-1.5 text-[9px] font-medium text-[#56575a]">{roleLabel(user.role)}</span></td><td className="px-4 py-3.5"><span className={`rounded-lg px-2.5 py-1.5 font-semibold ${user.level === 0 ? 'bg-[#fff0e4] text-[#be7b3e]' : 'bg-white/50 text-[#56575a]'}`}>{user.level}</span></td><td className="px-4 py-3.5"><StatusBadge status={user.status} /></td><td className="px-4 py-3.5 text-[9px] text-[#77787b]">{formatDate(user.createdAt)}</td><td className="px-4 py-3.5"><div className="flex justify-end gap-2 whitespace-nowrap"><Button variant="edit" type="button" onClick={() => openEdit(user)} title={`แก้ไข ${user.acccode}`} aria-label={`แก้ไขผู้ใช้ ${user.acccode}`} className="min-w-[84px] !px-3"><svg aria-hidden="true" className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="m14 5 5 5M4 20l4.2-.8L19 8.4a2.1 2.1 0 0 0-3-3L5.2 16.2 4 20Z" /></svg>แก้ไข</Button><Button variant="danger" type="button" onClick={() => setDeletingUser(user)} title={`ลบ ${user.acccode}`} aria-label={`ลบผู้ใช้ ${user.acccode}`} className="min-w-[72px] !px-3"><svg aria-hidden="true" className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M4 7h16M10 11v6m4-6v6M5 7l1 14h12l1-14M9 7V4h6v3" /></svg>ลบ</Button></div></td></tr> })}
            {!loading && !loadError && filteredUsers.length === 0 && <tr><td colSpan={6} className="px-5 py-14 text-center text-xs text-[#77787b]">{users.length ? 'ไม่พบผู้ใช้ที่ตรงกับการค้นหา' : 'ยังไม่มีผู้ใช้ เพิ่มบัญชีแรกเพื่อเริ่มต้น'}</td></tr>}
          </tbody></table></div>
          <div className="flex items-center justify-between border-t border-white/70 px-5 py-3 text-[9px] text-[#77787b]"><span>แสดง {filteredUsers.length} จาก {users.length} รายการ</span><span>จัดเก็บในฐานข้อมูล</span></div>
        </Card>
        </div>
      </PageContainer>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editingUser ? 'แก้ไขผู้ใช้งาน' : 'เพิ่มผู้ใช้งาน'} description={editingUser ? 'อัปเดตข้อมูลบัญชีและสิทธิ์ของผู้ใช้' : 'สร้างบัญชีผู้ใช้งานใหม่ โดยกำหนด Level 0 สำหรับผู้ดูแลระบบระดับสูง'}>
        <form onSubmit={saveUser} className="space-y-4"><div className="grid grid-cols-2 gap-3 max-[500px]:grid-cols-1"><label className="block space-y-1.5 text-xs font-medium text-[#465267]">รหัสผู้ใช้<input required minLength={3} maxLength={40} pattern="[a-zA-Z0-9._-]+" autoComplete="username" value={draft.acccode} onChange={(event) => setDraft({ ...draft, acccode: event.target.value })} placeholder="เช่น sadmin หรือ admin" className={inputClass} /></label><label className="block space-y-1.5 text-xs font-medium text-[#465267]">{editingUser ? 'รหัสผ่านใหม่ (เว้นว่างถ้าไม่เปลี่ยน)' : 'รหัสผ่าน'}<input required={!editingUser} minLength={8} maxLength={128} type="password" autoComplete={editingUser ? 'new-password' : 'new-password'} value={draft.password} onChange={(event) => setDraft({ ...draft, password: event.target.value })} placeholder={editingUser ? 'อย่างน้อย 8 ตัวอักษร' : 'อย่างน้อย 8 ตัวอักษร'} className={inputClass} /></label></div><div className="grid grid-cols-2 gap-3 max-[500px]:grid-cols-1"><label className="block space-y-1.5 text-xs font-medium text-[#465267]">ชื่อ<input required maxLength={80} autoComplete="given-name" value={draft.firstName} onChange={(event) => setDraft({ ...draft, firstName: event.target.value })} placeholder="ชื่อ" className={inputClass} /></label><label className="block space-y-1.5 text-xs font-medium text-[#465267]">นามสกุล<input required maxLength={80} autoComplete="family-name" value={draft.lastName} onChange={(event) => setDraft({ ...draft, lastName: event.target.value })} placeholder="นามสกุล" className={inputClass} /></label></div><label className="block space-y-1.5 text-xs font-medium text-[#465267]">อีเมล<input required type="email" maxLength={254} autoComplete="email" value={draft.email} onChange={(event) => setDraft({ ...draft, email: event.target.value })} placeholder="name@company.co.th" className={inputClass} /></label><label className="block space-y-1.5 text-xs font-medium text-[#465267]">เบอร์โทรศัพท์ (ไม่บังคับ)<input maxLength={40} autoComplete="tel" value={draft.phone} onChange={(event) => setDraft({ ...draft, phone: event.target.value })} placeholder="เบอร์โทรศัพท์" className={inputClass} /></label><div className="grid grid-cols-3 gap-3 max-[500px]:grid-cols-1"><label className="block space-y-1.5 text-xs font-medium text-[#465267]">บทบาท<select value={draft.role} onChange={(event) => { const role = event.target.value as Role; setDraft({ ...draft, role, level: role === 'SUPER_ADMIN' || role === 'ADMIN' ? 0 : 9 }) }} className={inputClass}>{roleOptions.map((role) => <option key={role.value} value={role.value}>{role.label}</option>)}</select></label><label className="block space-y-1.5 text-xs font-medium text-[#465267]">Level<input required type="number" min={0} max={9} step={1} value={draft.level} onChange={(event) => setDraft({ ...draft, level: Number(event.target.value) })} className={inputClass} /><span className="block text-[10px] font-normal text-[#77787b]">0 สูงสุด · 9 ต่ำสุด</span></label><label className="block space-y-1.5 text-xs font-medium text-[#465267]">สถานะ<select value={draft.status} onChange={(event) => setDraft({ ...draft, status: event.target.value as Status })} className={inputClass}><option value="ACTIVE">ใช้งานอยู่</option><option value="INACTIVE">ปิดใช้งาน</option></select></label></div>{formError && <p role="alert" className="m-0 rounded-xl bg-[#fff0f1] px-3 py-2.5 text-xs text-[#b64b55]">{formError}</p>}<div className="flex justify-end gap-2 pt-2"><Button variant="secondary" type="button" disabled={saving} onClick={() => setModalOpen(false)} className="">ยกเลิก</Button><Button variant="primary" type="submit" disabled={saving} className="">{saving ? 'กำลังบันทึก…' : editingUser ? 'บันทึกการแก้ไข' : 'เพิ่มผู้ใช้'}</Button></div></form>
      </Modal>

      <Modal open={Boolean(deletingUser)} onClose={() => setDeletingUser(null)} title="ยืนยันการลบผู้ใช้" description={deletingUser ? `ต้องการลบบัญชี ${deletingUser.acccode} หรือไม่ การลบนี้ไม่สามารถย้อนกลับได้` : undefined}>
        <div className="flex justify-end gap-2"><Button variant="secondary" type="button" disabled={deleting} onClick={() => setDeletingUser(null)} className="">ยกเลิก</Button><Button variant="danger" type="button" disabled={deleting} onClick={() => void deleteUser()} className="">{deleting ? 'กำลังลบ…' : 'ลบผู้ใช้'}</Button></div>
      </Modal>
    </div>
  )
}

function StatCard({ label, value, description, symbol, tone }: { label: string; value: number; description: string; symbol: string; tone: string }) {
  return <Card className="compact-stat-card rounded-[12px] p-3"><div className="flex items-start justify-between gap-3"><div><p className="m-0 text-[10px] font-medium text-[#77787b]">{label}</p><p className="mb-0 mt-2 text-[25px] font-bold tracking-[-.7px] text-[#263b33]">{String(value).padStart(2, '0')}</p></div><span className={`grid h-9 w-9 place-items-center rounded-xl text-[14px] font-bold ${tone}`}>{symbol}</span></div><p className="mb-0 mt-3 text-[10px] text-[#77787b]">{description}</p></Card>
}

function avatarTone(index: number) {
  return ['bg-[#e5f4ed] text-[#18805e]', 'bg-[#e8efff] text-[#3970d3]', 'bg-[#f0ebff] text-[#8064ca]', 'bg-[#fff0e4] text-[#be7b3e]', 'bg-[#fbeaf0] text-[#bd6686]'][index % 5]
}
