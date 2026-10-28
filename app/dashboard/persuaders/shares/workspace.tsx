'use client'

import { useMemo, useState, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import { ClipboardList, HandCoins } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Modal } from '@/components/ui/modal'
import { payPersuaderShare } from './actions'

type Data = Awaited<ReturnType<typeof import('./actions').getPersuaderShares>>
type ShareRow = Data['rows'][number]
const field = 'mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-sky-400'
const money = (satang: number) => new Intl.NumberFormat('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(satang / 100)
const date = (value: string) => value ? new Intl.DateTimeFormat('th-TH', { timeZone: 'Asia/Bangkok', dateStyle: 'medium' }).format(new Date(`${value.slice(0, 10)}T00:00:00+07:00`)) : '—'

export function PersuaderSharesWorkspace({ rows, channels, today }: { rows: Data['rows']; channels: Data['channels']; today: string }) {
  const router = useRouter()
  const [selected, setSelected] = useState<ShareRow | null>(null)
  const [amount, setAmount] = useState('')
  const [occurredOn, setOccurredOn] = useState(today)
  const [channelCode, setChannelCode] = useState('')
  const [reference, setReference] = useState('')
  const [note, setNote] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [requestKey, setRequestKey] = useState('')
  const totals = useMemo(() => ({
    payable: rows.reduce((sum, row) => sum + Math.max(0, row.dueSatang), 0),
    paid: rows.reduce((sum, row) => sum + row.paidSatang, 0),
    adjustment: rows.reduce((sum, row) => sum + Math.max(0, -row.dueSatang), 0),
  }), [rows])
  function openPayment(row: ShareRow) {
    setSelected(row); setAmount((row.dueSatang / 100).toFixed(2)); setOccurredOn(today)
    setChannelCode(channels[0]?.code ?? ''); setReference(''); setNote(''); setFile(null); setError(''); setRequestKey(crypto.randomUUID())
  }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!selected || saving) return
    setSaving(true); setError('')
    try {
      const result = await payPersuaderShare({ requestKey, contractId: selected.contractId, amount, occurredOn, channelCode, reference, note }, file)
      if (result.error) { setError(result.error); return }
      setSelected(null); router.refresh()
    } catch { setError('บันทึกไม่สำเร็จ กรุณาลองใหม่') }
    finally { setSaving(false) }
  }
  return <div className="space-y-4">
    <div className="grid gap-3 sm:grid-cols-3">
      <Card className="p-4"><p className="m-0 text-xs text-slate-500">รอจ่าย</p><p className="mb-0 mt-1 text-xl font-semibold tabular-nums">{money(totals.payable)} บาท</p></Card>
      <Card className="p-4"><p className="m-0 text-xs text-slate-500">จ่ายแล้ว</p><p className="mb-0 mt-1 text-xl font-semibold tabular-nums">{money(totals.paid)} บาท</p></Card>
      <Card className="p-4"><p className="m-0 text-xs text-slate-500">ต้องปรับปรุง / เรียกคืน</p><p className="mb-0 mt-1 text-xl font-semibold tabular-nums">{money(totals.adjustment)} บาท</p></Card>
    </div>
    <Card className="overflow-hidden p-0">
      <div className="border-b border-slate-200 p-4"><h2 className="m-0 text-base font-semibold">รายการส่วนแบ่ง</h2><p className="mb-0 mt-1 text-xs text-slate-500">เงื่อนไขตัวอย่าง: 5% ของเงินต้น · ตั้งยอดรอจ่ายเมื่อรับชำระครบตามสัญญา</p></div>
      <div className="overflow-x-auto"><table className="w-full min-w-[1050px] text-left text-sm"><thead className="bg-slate-50 text-xs text-slate-500"><tr>{['สัญญา / ผู้กู้', 'Persuader / ช่องทางจ่าย', 'เงินต้น / ดอกเบี้ย', 'ตามเงื่อนไข', 'เกิดสิทธิแล้ว', 'จ่ายแล้ว', 'คงเหลือ', ''].map(item => <th key={item} className="p-3 font-medium">{item}</th>)}</tr></thead><tbody>
        {rows.map(row => <tr key={row.contractId} className="border-t border-slate-100 align-top">
          <td className="p-3"><strong>CT-{String(row.contractId).padStart(6, '0')}</strong><p className="mb-0 mt-1 text-xs text-slate-500">{row.borrowerName}</p><p className="mb-0 mt-1 text-[11px] text-slate-400">รายการล่าสุด {date(row.lastActivity)}</p>{row.payments.length > 0 && <details className="mt-2 text-xs"><summary className="cursor-pointer text-sky-700">ประวัติการจ่าย {row.payments.length} รายการ</summary><ul className="mb-0 mt-1 space-y-1 p-0">{row.payments.map(payment => <li key={payment.id} className={payment.voidedAt ? 'list-none text-slate-400 line-through' : 'list-none text-slate-600'}>{date(payment.occurredOn)} · {money(payment.amountSatang)} · {payment.channelName}{payment.voidedAt ? ' · ยกเลิกแล้ว' : ''}{payment.reference ? ` · ${payment.reference}` : ''}</li>)}</ul></details>}</td>
          <td className="p-3"><p className="m-0 font-medium">{row.persuaderName}</p><p className="mb-0 mt-1 text-xs text-slate-500">{row.phone || 'ไม่ระบุโทรศัพท์'}</p><p className="mb-0 mt-1 text-xs text-slate-500">{row.bankAccount ? `${row.bankCode} · ${row.bankAccount} · ${row.bankAccountName}` : 'ยังไม่บันทึกบัญชีธนาคาร'}</p></td>
          <td className="p-3 tabular-nums">{money(row.principalSatang)} / {money(row.interestSatang)}</td>
          <td className="p-3 tabular-nums">{(row.shareBasisPoints / 100).toFixed(2)}% · {money(row.shareSatang)}</td>
          <td className="p-3 tabular-nums">{money(row.accruedSatang)}</td><td className="p-3 tabular-nums">{money(row.paidSatang)}</td>
          <td className={`p-3 font-semibold tabular-nums ${row.dueSatang < 0 ? 'text-rose-700' : row.dueSatang > 0 ? 'text-emerald-800' : 'text-slate-600'}`}>{row.dueSatang < 0 ? `ปรับปรุง ${money(-row.dueSatang)}` : money(row.dueSatang)}</td>
          <td className="p-3">{row.dueSatang > 0 ? <Button variant="primary" onClick={() => openPayment(row)}><HandCoins size={15} aria-hidden="true" />บันทึกจ่าย</Button> : row.dueSatang < 0 ? <span className="text-xs text-rose-700">ต้องตรวจยอดที่จ่ายไปแล้ว</span> : <span className="text-xs text-slate-500">{row.accruedSatang ? 'จ่ายครบ' : 'รอผู้กู้ชำระครบ'}</span>}</td>
        </tr>)}
        {!rows.length && <tr><td colSpan={8} className="p-10 text-center text-slate-500"><ClipboardList className="mx-auto mb-2" size={22} aria-hidden="true" />ยังไม่มีส่วนแบ่งที่เกิดสิทธิ์ รอผู้กู้ชำระครบตามสัญญา</td></tr>}
      </tbody></table></div>
    </Card>
    <Modal open={Boolean(selected)} title={selected ? `บันทึกจ่ายส่วนแบ่ง · CT-${String(selected.contractId).padStart(6, '0')}` : 'บันทึกจ่ายส่วนแบ่ง'} onClose={() => { if (!saving) setSelected(null) }}>
      {selected && <form onSubmit={submit} className="space-y-4">
        <div className="rounded-lg bg-violet-50 p-3 text-sm"><p className="m-0">ผู้รับ <strong>{selected.persuaderName}</strong></p><p className="mb-0 mt-1">ยอดค้างจ่าย {money(selected.dueSatang)} บาท</p>{selected.bankAccount && <p className="mb-0 mt-1 text-xs text-slate-600">บัญชีรับโอน {selected.bankCode} · {selected.bankAccount} · {selected.bankAccountName}</p>}</div>
        <div className="grid gap-3 sm:grid-cols-2"><label className="text-sm">ยอดจ่าย (บาท)<input required type="number" min="0.01" max={(selected.dueSatang / 100).toFixed(2)} step="0.01" value={amount} onChange={event => setAmount(event.target.value)} className={field} /></label><label className="text-sm">วันที่จ่าย<input required type="date" max={today} value={occurredOn} onChange={event => setOccurredOn(event.target.value)} className={field} /></label></div>
        <label className="block text-sm">ช่องทางจ่าย<select required value={channelCode} onChange={event => setChannelCode(event.target.value)} className={field}><option value="">เลือกช่องทาง</option>{channels.map(channel => <option key={channel.code} value={channel.code}>{channel.nameTh}</option>)}</select></label>
        <label className="block text-sm">เลขอ้างอิง / หลักฐานโอน<input maxLength={150} value={reference} onChange={event => setReference(event.target.value)} className={field} /></label>
        <label className="block text-sm">แนบหลักฐานการโอน (ถ้ามี)<input type="file" accept="application/pdf,image/jpeg,image/png,image/webp" onChange={event => setFile(event.target.files?.[0] ?? null)} className={field} /></label>
        <label className="block text-sm">หมายเหตุ<textarea maxLength={1000} value={note} onChange={event => setNote(event.target.value)} rows={2} className={field} /></label>
        {error && <p role="alert" className="m-0 text-sm text-rose-700">{error}</p>}
        <p className="m-0 text-xs text-slate-500">บันทึกรายจ่ายในบัญชีสินเชื่อและผูกกับรายการส่วนแบ่งเดียวกัน ป้องกันการลงเงินซ้ำ · ไฟล์ไม่เกิน 5 MB</p>
        <div className="flex justify-end"><Button type="submit" variant="primary" disabled={saving}>{saving ? 'กำลังบันทึก…' : 'ยืนยันการจ่าย'}</Button></div>
      </form>}
    </Modal>
  </div>
}
