'use client'

import { useToast } from '@/components/ui/toast'
import { useFeedbackToast } from '@/components/ui/use-feedback-toast'
import { useState, useTransition, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Modal } from '@/components/ui/modal'
import { formatContractMoney, contractCode } from '@/lib/contracts'

const field = 'mt-1 w-full rounded-xl border border-slate-300 bg-white p-3 text-sm'
export function DisbursementButton({ contractId, amountSatang, borrowerName, today, channels, ready }: { contractId: number; amountSatang: number; borrowerName: string; today: string; channels: { code: string; nameTh: string }[]; ready: boolean }) {
  const [open, setOpen] = useState(false)
  const [requestKey, setRequestKey] = useState('')
  const [error, setError] = useState('')
  useFeedbackToast({ error })
  const { toast } = useToast()
  const [pending, startTransition] = useTransition()
  const router = useRouter()
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const file = form.get('slip')
    setError('')
    startTransition(async () => {
      try {
        const payload = new FormData()
        payload.set('input', JSON.stringify({ requestKey, kind: 'DISBURSEMENT', contractId, direction: 'OUT', categoryCode: '', amount: (amountSatang / 100).toFixed(2), occurredOn: String(form.get('occurredOn')), channelCode: String(form.get('channelCode')), reference: String(form.get('reference')), note: String(form.get('note')) }))
        if (file instanceof File && file.size) payload.set('file', file)
        const response = await fetch('/api/disbursements', { method: 'POST', body: payload })
        const result = await response.json()
        if (!response.ok && !result.error) throw new Error('บันทึกไม่สำเร็จ')
        if (result.error) { setError(result.error); return }
        toast({ title: 'บันทึกการจ่ายเงินเรียบร้อยแล้ว', variant: 'success' }); setOpen(false); router.refresh()
      } catch { setError('บันทึกไม่สำเร็จ กรุณาลองใหม่') }
    })
  }
  return <><Button disabled={!ready} title={!ready ? 'กรุณาลงนามให้ครบก่อนบันทึกจ่าย' : undefined} onClick={() => { setRequestKey(crypto.randomUUID()); setError(''); setOpen(true) }}>บันทึกจ่ายแล้ว</Button>
    <Modal open={open} title="บันทึกจ่ายเงินตามสัญญา" description={`${contractCode(contractId)} · ${borrowerName}`} onClose={() => { if (!pending) setOpen(false) }}>
      <form onSubmit={submit} className="space-y-4 whitespace-normal">
        <div className="rounded-xl bg-blue-50 p-4 text-sm text-slate-600">ยอดจ่ายสุทธิ <strong className="mt-1 block text-2xl text-blue-800">{formatContractMoney(amountSatang)} บาท</strong><p className="mt-2 text-xs">บันทึกเงินที่จ่ายจริงแล้ว สามารถเลือกวันที่ย้อนหลังตามสลิปได้</p></div>
        <label className="block text-sm">วันที่จ่ายเงินจริง<input className={field} name="occurredOn" type="date" defaultValue={today} max={today} required /></label>
        <label className="block text-sm">ช่องทางชำระ<select className={field} name="channelCode" defaultValue="" required><option value="" disabled>เลือกช่องทาง</option>{channels.map(c => <option key={c.code} value={c.code}>{c.nameTh}</option>)}</select></label>
        <label className="block text-sm">เลขอ้างอิง<input className={field} name="reference" maxLength={150} placeholder="เลขรายการจากสลิป" /></label>
        <label className="block text-sm">หลักฐานการจ่าย (ไม่เกิน 5 MB)<input className={field} name="slip" type="file" accept="image/jpeg,image/png,application/pdf" /></label>
        <label className="block text-sm">หมายเหตุ<input className={field} name="note" maxLength={1000} /></label>
        {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
        <div className="flex justify-end gap-2"><Button disabled={pending} onClick={() => setOpen(false)}>ยกเลิก</Button><Button type="submit" disabled={pending}>{pending ? 'กำลังบันทึก…' : 'ยืนยันบันทึกจ่ายแล้ว'}</Button></div>
      </form>
    </Modal>
  </>
}
