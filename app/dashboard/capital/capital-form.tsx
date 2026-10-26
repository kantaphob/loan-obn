'use client'
import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { addLendingCapital } from '../ledger/actions'
import { bangkokToday } from '@/lib/ledger'
import { Modal } from '@/components/ui/modal'

const field = 'mt-1 block w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm'
export function CapitalForm({ channels }: { channels: { code: string; nameTh: string }[] }) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [requestKey, setRequestKey] = useState('')
  const [direction, setDirection] = useState<'IN' | 'OUT'>('IN')
  const [message, setMessage] = useState('')
  const [open, setOpen] = useState(false)
  const [error, setError] = useState('')
  const launch = (value: 'IN' | 'OUT') => { setDirection(value); setRequestKey(''); setError(''); setMessage(''); setOpen(true) }
  return <>
    <div>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => launch('IN')} className="rounded-xl bg-slate-900 px-4 py-2 text-sm text-white">เพิ่มทุนสินเชื่อ</button>
          <button type="button" onClick={() => launch('OUT')} className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm text-slate-700">ถอนทุนสินเชื่อ</button>
        </div>
      </div>
      {message && <p role="status" className="mt-3 text-sm text-emerald-700">{message}</p>}
    </div>
    <Modal open={open} title="เพิ่มทุน / ถอนทุนสินเชื่อ" onClose={() => { if (!pending) { setOpen(false); setError('') } }} className="max-w-xl">
    <form onSubmit={event => {
    event.preventDefault()
    const form = event.currentTarget
    const data = new FormData(form)
    const key = requestKey || crypto.randomUUID()
    setRequestKey(key)
    startTransition(async () => {
      const result = await addLendingCapital({ requestKey: key, kind: 'GENERAL', contractId: null, direction, categoryCode: direction === 'IN' ? 'CAPITAL_INCREASE' : 'CAPITAL_WITHDRAWAL', amount: String(data.get('amount')), occurredOn: String(data.get('occurredOn')), channelCode: String(data.get('channelCode')), reference: String(data.get('reference') ?? ''), note: String(data.get('note') ?? '') })
      if (result.error) { setError(result.error); return }
      setMessage(`${direction === 'IN' ? 'เพิ่มทุน' : 'ถอนทุน'}สินเชื่อและบันทึกบัญชีรับ–จ่ายเรียบร้อยแล้ว`)
      setRequestKey(''); setError(''); form.reset(); setOpen(false); router.refresh()
    })
  }}><fieldset disabled={pending} className="grid gap-4 sm:grid-cols-2">
    <label className="block text-sm sm:col-span-2">ประเภทรายการ<select className={field} value={direction} onChange={event => { setDirection(event.target.value as 'IN' | 'OUT'); setRequestKey(''); setError('') }}><option value="IN">เพิ่มทุนสินเชื่อ</option><option value="OUT">ถอนทุนสินเชื่อ</option></select></label>
    <label className="block text-sm sm:col-span-2">จำนวนเงิน (บาท)<input name="amount" type="number" min="0.01" max="2000000000" step="0.01" required className={field} /></label>
    <label className="block text-sm">{direction === 'IN' ? 'วันที่รับเงินจริง' : 'วันที่จ่ายเงินจริง'}<input name="occurredOn" type="date" required defaultValue={bangkokToday()} max={bangkokToday()} className={field} /></label>
    <label className="block text-sm">{direction === 'IN' ? 'ช่องทางรับเงิน' : 'ช่องทางจ่ายเงิน'}<select name="channelCode" required defaultValue="" className={field}><option value="" disabled>เลือกช่องทาง</option>{channels.map(channel => <option key={channel.code} value={channel.code}>{channel.nameTh}</option>)}</select></label>
    <label className="block text-sm">เลขอ้างอิง<input name="reference" maxLength={150} className={field} /></label>
    <label className="block text-sm sm:col-span-2">หมายเหตุ<textarea name="note" maxLength={1000} className={field} /></label>
    <div className="flex justify-end gap-2 border-t border-slate-200 pt-4 sm:col-span-2">
      <button type="button" onClick={() => setOpen(false)} className="rounded-xl border border-slate-200 px-4 py-2 text-sm text-slate-600">ยกเลิก</button>
      <button type="submit" className="rounded-xl bg-slate-900 px-4 py-2 text-sm text-white">{pending ? 'กำลังบันทึก…' : direction === 'IN' ? 'บันทึกเพิ่มทุน' : 'บันทึกถอนทุน'}</button>
    </div>
  </fieldset>{error && <p role="alert" className="mt-3 text-sm text-rose-700">{error}</p>}</form>
    </Modal>
  </>
}
