'use client'
import { useState, useTransition } from 'react'
import { previousUtilityBill } from '@/lib/utility-readings'
import { Modal } from '@/components/ui/modal'
import { useRouter } from 'next/navigation'
import { saveUtilityBill, saveUtilityHome } from './actions'

type Home = { id: number; name: string; address: string; electricityMeter: string; waterMeter: string }
type Bill = { id: number; homeId: number; kind: string; meter: string; location: string; period: string; previousReading: number; currentReading: number; amountSatang: number; invoice: string; note: string }
const money = (n: number) => (n / 100).toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const month = (s: string) => `${s.slice(5)}/${Number(s.slice(0, 4)) + 543}`
export function UtilityWorkspace({ bills, homes, canWrite }: { bills: Bill[]; homes: Home[]; canWrite: boolean }) {
  const [selectedHomeId, setSelectedHomeId] = useState<number | null>(null)
  const selectedHome = homes.find(h => h.id === selectedHomeId) ?? homes[0]
  const [editingHome, setEditingHome] = useState<Home | null | undefined>(undefined)
  const [editing, setEditing] = useState<Bill | null | undefined>(undefined)
  const [filter, setFilter] = useState('')
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [pending, startTransition] = useTransition()
  const router = useRouter()
  const homeBills = bills.filter(b => b.homeId === selectedHome?.id)
  const shown = homeBills.filter(b => !filter || b.kind === filter)
  return <div className="space-y-4">
    <section aria-label="บ้านที่บันทึกสาธารณูปโภค" className="rounded-xl border border-slate-200 bg-white p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3"><h2 className="font-semibold">เลือกบ้าน</h2>{canWrite && <button disabled={pending} className="rounded border px-3 py-2 text-sm" onClick={() => { setEditingHome(null); setEditing(undefined); setError(''); setMessage('') }}>เพิ่มบ้าน</button>}</div>
      <div className="grid gap-3 sm:grid-cols-2">{homes.map(home => <button type="button" key={home.id} disabled={pending} aria-pressed={home.id === selectedHome?.id} className={`rounded-xl border p-4 text-left ${home.id === selectedHome?.id ? 'border-emerald-700 bg-emerald-50 ring-1 ring-emerald-700' : 'border-slate-200'}`} onClick={() => { setSelectedHomeId(home.id); setEditing(undefined); setEditingHome(undefined); setError(''); setMessage('') }}><span className="block font-semibold">{home.name}</span><span className="mt-1 block text-xs text-slate-500">{home.address || 'ยังไม่ได้ระบุที่อยู่'}</span><span className="mt-2 block text-xs">{bills.filter(b => b.homeId === home.id).length} รายการ</span></button>)}</div>
      {!homes.length && <p className="text-sm text-slate-500">เพิ่มบ้านเพื่อเริ่มเก็บประวัติค่าน้ำ–ค่าไฟแยกแต่ละหลัง</p>}
    </section>
    {editingHome !== undefined && canWrite && <Modal open title={editingHome ? 'แก้ไขข้อมูลบ้าน' : 'เพิ่มบ้าน'} description="บันทึกเลขมิเตอร์ประจำบ้านไว้ใช้กับรายการรายเดือน และแก้ไขภายหลังได้" onClose={() => { if (!pending) { setEditingHome(undefined); setError('') } }} className="!max-w-xl"><form key={`home-${editingHome?.id ?? 'new'}`} className="space-y-4" action={form => startTransition(async () => {
      setError('')
      try { const result = await saveUtilityHome(form); if (result.error) setError(result.error); else { setSelectedHomeId(result.homeId ?? null); setEditingHome(undefined); setMessage('บันทึกข้อมูลบ้านแล้ว'); router.refresh() } } catch { setError('เชื่อมต่อไม่สำเร็จ กรุณาลองใหม่') }
    })}>
      <input type="hidden" name="id" value={editingHome?.id ?? ''} />
      <fieldset disabled={pending} className="grid gap-3 sm:grid-cols-2">
        <label className="grid gap-1 text-sm">ชื่อบ้าน<input name="name" required maxLength={100} placeholder="เช่น บ้านพะเยา / บ้านเชียงใหม่" className="rounded border p-2" defaultValue={editingHome?.name} /></label>
        <label className="grid gap-1 text-sm">ที่อยู่บ้าน<input name="address" maxLength={300} className="rounded border p-2" defaultValue={editingHome?.address} /></label>
        <label className="grid gap-1 text-sm">เลขมิเตอร์ไฟฟ้า<input name="electricityMeter" maxLength={100} className="rounded border p-2" defaultValue={editingHome?.electricityMeter} placeholder="บันทึกครั้งเดียว ใช้ทุกเดือน" /></label>
        <label className="grid gap-1 text-sm">เลขมิเตอร์น้ำประปา<input name="waterMeter" maxLength={100} className="rounded border p-2" defaultValue={editingHome?.waterMeter} placeholder="บันทึกครั้งเดียว ใช้ทุกเดือน" /></label>
      </fieldset>
      <p className="text-xs text-slate-500">เปลี่ยนเลขมิเตอร์ได้เมื่อเปลี่ยนเครื่อง รายการเก่าจะเก็บเลขมิเตอร์ตามบิลเดิม</p>
      {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
      <div className="flex gap-3"><button disabled={pending} className="rounded bg-slate-800 px-4 py-2 text-white" type="submit">{pending ? 'กำลังบันทึก…' : 'บันทึกข้อมูลบ้าน'}</button><button type="button" disabled={pending} onClick={() => { setEditingHome(undefined); setError('') }}>ยกเลิก</button></div>
    </form></Modal>}
    {selectedHome && <div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-lg font-semibold">{selectedHome.name}</h2><p className="text-xs text-slate-500">ไฟฟ้า: {selectedHome.electricityMeter || 'ยังไม่ระบุมิเตอร์'} · น้ำประปา: {selectedHome.waterMeter || 'ยังไม่ระบุมิเตอร์'}</p></div>{canWrite && <button disabled={pending} className="text-sm underline" onClick={() => { setEditingHome(selectedHome); setEditing(undefined); setError(''); setMessage('') }}>แก้ไขบ้านและเลขมิเตอร์</button>}</div>}
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-4">
      <div><p className="font-semibold">{shown.length} รายการ · รวม {money(shown.reduce((sum, b) => sum + b.amountSatang, 0))} บาท</p><p className="text-xs text-slate-500">ทะเบียนค่าใช้บริการนี้ยังไม่ลงบัญชีรับ–จ่ายอัตโนมัติ</p></div>
      <label>ประเภท <select className="rounded border p-2" value={filter} onChange={e => setFilter(e.target.value)}><option value="">ทั้งหมด</option><option value="ELECTRICITY">ไฟฟ้า</option><option value="WATER">น้ำประปา</option></select></label>
      {canWrite && selectedHome && <button disabled={pending} className="rounded-lg bg-slate-800 px-4 py-2 text-white" onClick={() => { setEditing(null); setEditingHome(undefined); setError(''); setMessage('') }}>เพิ่มรายการ</button>}
    </div>
    {message && <p role="status">{message}</p>}
    {editing !== undefined && canWrite && selectedHome && <Modal open title={editing ? 'แก้ไขรายการสาธารณูปโภค' : 'เพิ่มรายการสาธารณูปโภค'} description={selectedHome.name} onClose={() => { if (!pending) { setEditing(undefined); setError('') } }} className="!max-w-3xl">
      <UtilityBillForm key={editing?.id ?? `new-${selectedHome.id}`} bill={editing} bills={homeBills} home={selectedHome} pending={pending} error={error} onCancel={() => { setEditing(undefined); setError('') }} onSave={form => startTransition(async () => {
        setError('')
        try { const result = await saveUtilityBill(form); if (result.error) setError(result.error); else { setEditing(undefined); setMessage('บันทึกรายการแล้ว'); router.refresh() } } catch { setError('เชื่อมต่อไม่สำเร็จ กรุณาลองใหม่') }
      })} />
    </Modal>}
    <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white"><table className="w-full whitespace-nowrap text-left text-sm"><caption className="sr-only">ประวัติมิเตอร์และค่าใช้บริการรายเดือน</caption><thead className="bg-slate-50"><tr>{['เดือน', 'ประเภท / สถานที่', 'มิเตอร์ / ใบแจ้งหนี้', 'ครั้งก่อน', 'ครั้งหลัง', 'หน่วยใช้', 'รวม (บาท)', 'หมายเหตุ', 'จัดการ'].map(h => <th key={h} scope="col" className="p-3">{h}</th>)}</tr></thead><tbody>
      {shown.map(b => <tr key={b.id} className="border-t border-slate-100"><td className="p-3">{month(b.period)}</td><td className="p-3">{b.kind === 'WATER' ? 'น้ำประปา' : 'ไฟฟ้า'}<p className="text-xs text-slate-500">{b.location}</p></td><td className="p-3">{b.meter}<p className="text-xs text-slate-500">{b.invoice || '—'}</p></td><td className="p-3">{b.previousReading.toLocaleString()}</td><td className="p-3">{b.currentReading.toLocaleString()}</td><td className="p-3">{Number((b.currentReading - b.previousReading).toFixed(3)).toLocaleString()}</td><td className="p-3 font-semibold">{money(b.amountSatang)}</td><td className="max-w-64 whitespace-normal p-3">{b.note || '—'}</td><td className="p-3">{canWrite && <button className="underline" onClick={() => { setEditing(b); setEditingHome(undefined); setError(''); setMessage('') }}>แก้ไข<span className="sr-only"> {b.meter} {month(b.period)}</span></button>}</td></tr>)}
      {!shown.length && <tr><td colSpan={9} className="p-8 text-center text-slate-500">ยังไม่มีรายการค่าน้ำ–ค่าไฟของบ้านหลังนี้</td></tr>}
    </tbody></table></div>
  </div>
}

function UtilityBillForm({ bill, bills, home, pending, error, onCancel, onSave }: {
  bill: Bill | null; bills: Bill[]; home: Home; pending: boolean; error: string; onCancel: () => void; onSave: (form: FormData) => void
}) {
  const [kind, setKind] = useState(bill?.kind ?? 'ELECTRICITY')
  const [period, setPeriod] = useState(bill?.period ?? new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Bangkok' }).format(new Date()).slice(0, 7))
  const meter = bill && bill.kind === kind ? bill.meter : kind === 'WATER' ? home.waterMeter : home.electricityMeter
  const prior = previousUtilityBill(bills, { homeId: home.id, kind, meter, period, excludeId: bill?.id })
  const [manualPrevious, setManualPrevious] = useState<string | null>(bill ? String(bill.previousReading) : null)
  const previous = manualPrevious ?? (prior ? String(prior.currentReading) : '')
  const [current, setCurrent] = useState(bill ? String(bill.currentReading) : '')
  const usage = previous !== '' && current !== '' ? Number(current) - Number(previous) : null
  const field = 'grid gap-1.5 text-sm font-medium text-slate-700'
  const input = 'w-full min-w-0 rounded-lg border border-slate-200 bg-white p-2.5 font-normal'
  return <form action={onSave} className="space-y-5">
    <input type="hidden" name="homeId" value={home.id} />
    <input type="hidden" name="id" value={bill?.id ?? ''} />
    <fieldset disabled={pending} className="grid gap-4 sm:grid-cols-2">
      <legend className="mb-3 text-sm font-semibold">1. ข้อมูลบริการ</legend>
      <label className={field}>ประเภทบริการ<select name="kind" className={input} value={kind} onChange={event => { setKind(event.target.value); setManualPrevious(null) }}><option value="ELECTRICITY">ไฟฟ้า</option><option value="WATER">น้ำประปา</option></select></label>
      <label className={field}>เดือนค่าใช้บริการ (ค.ศ.)<input type="month" name="period" required className={input} value={period} onChange={event => { setPeriod(event.target.value); setManualPrevious(null) }} /></label>
      <div className={field}><span>เลขมิเตอร์ประจำบ้าน</span><p className={`${input} bg-slate-50`}>{meter || 'ยังไม่ได้ตั้งค่าเลขมิเตอร์'}</p><p className="text-xs font-normal text-slate-500">{bill && bill.kind === kind ? 'เลขมิเตอร์ตามรายการเดิม' : 'ใช้เลขที่บันทึกไว้ในข้อมูลบ้าน'}</p></div>
      <label className={field}>จุดติดตั้งมิเตอร์ / สถานที่<input name="location" required maxLength={300} className={input} defaultValue={bill?.location ?? (home.address || home.name)} /></label>
    </fieldset>
    <fieldset disabled={pending} className="grid gap-4 border-t border-slate-200 pt-4 sm:grid-cols-2">
      <legend className="pr-3 text-sm font-semibold">2. หน่วยที่ใช้</legend>
      <label className={field}>เลขอ่านครั้งก่อน<input type="number" name="previousReading" min="0" max="1000000000000" step="0.001" required className={input} value={previous} onChange={event => setManualPrevious(event.target.value)} /></label>
      <label className={field}>เลขอ่านครั้งหลัง<input type="number" name="currentReading" min={previous || '0'} max="1000000000000" step="0.001" required className={input} value={current} onChange={event => setCurrent(event.target.value)} /></label>
      <div className="text-xs text-slate-500 sm:col-span-2">{prior ? <div className="flex flex-wrap items-center justify-between gap-2"><p>ดึงเลขอ่านครั้งหลังจากงวด {month(prior.period)} · {prior.currentReading.toLocaleString('th-TH')} หน่วย (แก้ไขได้)</p><button type="button" className="underline" onClick={() => setManualPrevious(null)}>ใช้ค่ารายการก่อนหน้า</button></div> : <p>ยังไม่มีรายการก่อนหน้าของมิเตอร์นี้ กรุณากรอกเลขอ่านครั้งก่อน</p>}</div>
      <div className="flex items-center justify-between rounded-lg bg-emerald-50 px-4 py-3 text-sm sm:col-span-2"><span>หน่วยที่ใช้ในเดือนนี้</span><output aria-live="polite" className="font-semibold text-emerald-800">{usage === null ? '—' : usage < 0 ? 'เลขครั้งหลังต้องไม่น้อยกว่าครั้งก่อน' : `${Number(usage.toFixed(3)).toLocaleString('th-TH')} หน่วย`}</output></div>
    </fieldset>
    <fieldset disabled={pending} className="grid gap-4 border-t border-slate-200 pt-4 sm:grid-cols-2">
      <legend className="pr-3 text-sm font-semibold">3. ยอดเงินและเอกสาร</legend>
      <label className={field}>ยอดรวมตามบิล (บาท รวมภาษี)<input type="number" name="amount" min="0.01" step="0.01" required className={`${input} text-lg font-semibold`} defaultValue={bill ? (bill.amountSatang / 100).toFixed(2) : ''} placeholder="0.00" /></label>
      <label className={field}>เลขที่ใบแจ้งหนี้ (ถ้ามี)<input name="invoice" maxLength={150} className={input} defaultValue={bill?.invoice} /></label>
      <label className={`${field} sm:col-span-2`}>หมายเหตุ (ถ้ามี)<textarea name="note" maxLength={1000} rows={2} className={input} defaultValue={bill?.note} /></label>
    </fieldset>
    {!meter && <p role="alert" className="text-sm text-amber-800">กรุณาตั้งค่าเลขมิเตอร์ที่ “แก้ไขบ้านและเลขมิเตอร์” ก่อนบันทึก</p>}
    {error && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
    <div className="sticky -bottom-5 -mx-5 flex items-center justify-end gap-3 border-t border-slate-200 bg-white px-5 py-4">
      <button disabled={pending} type="button" className="rounded-lg border border-slate-200 px-4 py-2.5 text-sm" onClick={onCancel}>ยกเลิก</button>
      <button disabled={pending || !meter} className="rounded-lg bg-emerald-800 px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-60" type="submit">{pending ? 'กำลังบันทึก…' : 'บันทึกรายการ'}</button>
    </div>
  </form>
}
