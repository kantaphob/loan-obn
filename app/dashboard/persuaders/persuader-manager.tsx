'use client'

import { useCallback, useState, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { useToast } from '@/components/ui/toast'
import { savePersuader, searchPersuaderBorrowers } from './actions'

type Row = { id: number; name: string; phone: string; bankCode: string; bankAccount: string; bankAccountName: string; notes: string; isActive: boolean; borrowerId: number | null }
const initial = () => ({ name: '', phone: '', bankCode: '', bankAccount: '', bankAccountName: '', notes: '', isActive: true, borrowerId: null as number | null })
const code = (id: number) => `PS-${String(id).padStart(4, '0')}`
const field = 'mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800'
export function PersuaderManager({ rows, total, page, query, banks, canEdit }: { rows: Row[]; total: number; page: number; query: string; banks: { code: string; nameTh: string; isActive: boolean }[]; canEdit: boolean }) {
  const router = useRouter()
  const { toast } = useToast()
  const [q, setQ] = useState(query)
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<number | undefined>()
  const [form, setForm] = useState(initial)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [borrowerQuery, setBorrowerQuery] = useState('')
  const [borrowers, setBorrowers] = useState<Awaited<ReturnType<typeof searchPersuaderBorrowers>>>([])
  const [searching, setSearching] = useState(false)
  const [searched, setSearched] = useState(false)
  const showDialog = useCallback((node: HTMLDialogElement | null) => { if (node && !node.open) node.showModal() }, [])
  function show(row?: Row) { setEditing(row?.id); setForm(row ?? initial()); setError(''); setBorrowers([]); setBorrowerQuery(''); setSearched(false); setOpen(true) }
  function navigate(next: number) { const params = new URLSearchParams(); if(q.trim()) params.set('q',q.trim()); if(next>1) params.set('page',String(next)); router.push(`/dashboard/persuaders?${params}`) }
  async function search() {
    if (searching) return
    setSearching(true); setError('')
    try { setBorrowers(await searchPersuaderBorrowers(borrowerQuery)); setSearched(true) }
    catch { setError('ค้นหา Borrower ไม่สำเร็จ กรุณาลองใหม่') }
    finally { setSearching(false) }
  }
  async function submit(event: FormEvent) {
    event.preventDefault(); if (busy || !canEdit) return
    setBusy(true); setError('')
    try { await savePersuader({ ...form, id: editing }); setOpen(false); router.refresh(); toast({ title: 'บันทึก Persuader แล้ว', variant: 'success' }) }
    catch (err) { const message = err instanceof Error ? err.message : 'บันทึกไม่สำเร็จ'; setError(message); toast({ title: 'บันทึกไม่สำเร็จ', description: message, variant: 'error' }) }
    finally { setBusy(false) }
  }
  return <Card className="overflow-hidden"><div className="flex flex-wrap items-center justify-between gap-3 p-4"><form onSubmit={e => { e.preventDefault(); navigate(1) }} className="flex gap-2"><input aria-label="ค้นหาผู้แนะนำ" placeholder="ค้นหาชื่อหรือเบอร์โทร" className={field} value={q} onChange={e=>setQ(e.target.value)} /><Button type="submit">ค้นหา</Button></form>{canEdit && <Button variant="primary" onClick={()=>show()}>เพิ่ม Persuader</Button>}</div>
    <div className="overflow-x-auto"><table className="w-full whitespace-nowrap text-left text-sm"><thead><tr>{['รหัส','ชื่อผู้แนะนำ','เบอร์โทร','แหล่งข้อมูล','สถานะ','จัดการ'].map(t=><th key={t} className="border-b px-4 py-3">{t}</th>)}</tr></thead><tbody>{rows.map(row=><tr key={row.id}><td className="border-b px-4 py-3">{code(row.id)}</td><td className="border-b px-4 py-3">{row.name}</td><td className="border-b px-4 py-3">{row.phone || '—'}</td><td className="border-b px-4 py-3">{row.borrowerId ? `Borrower #${row.borrowerId}` : 'เพิ่มโดยตรง'}</td><td className="border-b px-4 py-3">{row.isActive?'ใช้งาน':'ไม่ใช้งาน'}</td><td className="border-b px-4 py-3"><Button onClick={()=>show(row)}>{canEdit?'แก้ไข / รายละเอียด':'ดูรายละเอียด'}</Button></td></tr>)}</tbody></table>{!rows.length && <p className="p-10 text-center text-sm">ยังไม่มีรายชื่อที่ตรงกับการค้นหา</p>}</div>
    <div className="flex items-center justify-between gap-3 p-4 text-xs"><span>{total} รายการ · หน้า {page}</span><div className="flex gap-2"><Button disabled={page<=1} onClick={()=>navigate(page-1)}>ก่อนหน้า</Button><Button disabled={page*25>=total} onClick={()=>navigate(page+1)}>ถัดไป</Button></div></div>
    {open && <dialog ref={showDialog} onCancel={e=>{if(busy || searching)e.preventDefault();else setOpen(false)}} aria-labelledby="persuader-title" className="fixed inset-0 m-auto max-h-[90dvh] w-[calc(100%-2rem)] max-w-2xl overflow-y-auto rounded-3xl border border-slate-200 bg-white p-6 text-slate-800 shadow-xl backdrop:bg-slate-900/30"><h2 id="persuader-title" className="text-lg font-semibold">{editing?`${code(editing)} · ผู้แนะนำ`:'เพิ่ม Persuader'}</h2>
      {canEdit && !editing && <section className="my-4 rounded-xl border border-blue-200 bg-blue-50 p-4"><h3 className="text-sm font-medium">เพิ่มจากรายชื่อ Borrower</h3><div className="mt-2 flex gap-2"><input aria-label="ค้นหา Borrower" className={field} value={borrowerQuery} onChange={e=>setBorrowerQuery(e.target.value)} placeholder="ชื่อ ชื่อเล่น หรือรหัส Borrower" /><Button disabled={searching || busy} onClick={()=>void search()}>{searching?'กำลังค้นหา…':'ค้นหา'}</Button></div>{searched && !borrowers.length && <p className="mt-2 text-xs">ไม่พบ Borrower</p>}<ul className="mt-2 max-h-48 space-y-2 overflow-y-auto">{borrowers.map(b=><li key={b.id}><Button disabled={busy} onClick={()=>{setForm(current=>({...current,borrowerId:b.id,name:[b.firstName,b.lastName].filter(Boolean).join(' ')||b.nickname,phone:b.phone,bankCode:b.bankCode,bankAccount:b.bankAccount,bankAccountName:b.bankAccountName}));setBorrowers([]);setSearched(false)}}>{b.borrowerId || `BR-${b.id}`} · {b.firstName} {b.lastName} ({b.nickname})</Button></li>)}</ul><p className="mt-2 text-xs">คัดลอกข้อมูลติดต่อและบัญชี โดยเก็บประวัติ Borrower เดิมไว้ การแก้ผู้แนะนำจะไม่แก้ข้อมูลผู้กู้</p></section>}
      {form.borrowerId && <p className="my-3 text-sm">เชื่อมกับ Borrower #{form.borrowerId}</p>}
      <form onSubmit={submit}><fieldset disabled={busy || !canEdit} className="mt-4 grid gap-4 sm:grid-cols-2">{([['name','ชื่อผู้แนะนำ *'],['phone','เบอร์โทร'],['bankAccount','เลขบัญชี'],['bankAccountName','ชื่อบัญชี']] as const).map(([key,label])=><label key={key} className="text-xs">{label}<input className={field} required={key==='name'} maxLength={key==='phone'?10:key==='bankAccount'?20:200} value={form[key]} onChange={e=>setForm({...form,[key]:e.target.value})}/></label>)}<label className="text-xs">ธนาคาร<select className={field} value={form.bankCode} onChange={e=>setForm({...form,bankCode:e.target.value})}><option value="">ยังไม่ระบุ</option>{banks.filter(b=>b.isActive||b.code===form.bankCode).map(b=><option key={b.code} value={b.code}>{b.nameTh}</option>)}</select></label><label className="text-xs">สถานะ<select className={field} value={String(form.isActive)} onChange={e=>setForm({...form,isActive:e.target.value==='true'})}><option value="true">ใช้งาน</option><option value="false">ไม่ใช้งาน</option></select></label><label className="text-xs sm:col-span-2">หมายเหตุ<textarea className={field} rows={3} maxLength={2000} value={form.notes} onChange={e=>setForm({...form,notes:e.target.value})}/></label></fieldset>{error && <p role="alert" className="mt-4 text-sm text-red-700">{error}</p>}<div className="mt-5 flex justify-end gap-2"><Button disabled={busy||searching} onClick={()=>setOpen(false)}>ปิด</Button>{canEdit&&<Button type="submit" variant="primary" disabled={busy||searching}>{busy?'กำลังบันทึก…':'บันทึกผู้แนะนำ'}</Button>}</div></form>
    </dialog>}
  </Card>
}
