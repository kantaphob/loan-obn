'use client'

import { useToast } from '@/components/ui/toast'
import { useFeedbackToast } from '@/components/ui/use-feedback-toast'
import { useState, useTransition, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Modal } from '@/components/ui/modal'
import { ContractReviewSummary } from './contract-review-summary'
import { useContractReview } from './use-contract-review'
import { contractCode } from '@/lib/contracts'

const field = 'mt-1 w-full rounded-xl border border-slate-300 bg-white p-3 text-sm'
export function DisbursementButton({ contractId, today, channels, ready }: { contractId: number; today: string; channels: { code: string; nameTh: string }[]; ready: boolean }) {
  const dialog = useContractReview(contractId)
  const [requestKey, setRequestKey] = useState('')
  const [error, setError] = useState('')
  useFeedbackToast({ error })
  const { toast } = useToast()
  const [pending, startTransition] = useTransition()
  const router = useRouter()
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!dialog.review) return
    const review = dialog.review
    const form = new FormData(event.currentTarget)
    const file = form.get('slip')
    setError('')
    startTransition(async () => {
      try {
        const payload = new FormData()
        payload.set('input', JSON.stringify({ contractReviewToken: review.reviewToken, requestKey, kind: 'DISBURSEMENT', contractId, direction: 'OUT', categoryCode: '', amount: (review.netSatang / 100).toFixed(2), occurredOn: String(form.get('occurredOn')), channelCode: String(form.get('channelCode')), reference: String(form.get('reference')), note: String(form.get('note')) }))
        if (file instanceof File && file.size) payload.set('file', file)
        const response = await fetch('/api/disbursements', { method: 'POST', body: payload })
        const result = await response.json()
        if (!response.ok && !result.error) throw new Error('บันทึกไม่สำเร็จ')
        if (result.error) { setError(result.error); return }
        toast({ title: 'บันทึกการจ่ายเงินเรียบร้อยแล้ว', variant: 'success' }); dialog.close(); router.refresh()
      } catch { setError('บันทึกไม่สำเร็จ กรุณาลองใหม่') }
    })
  }
  return <><Button disabled={!ready} title={!ready ? 'กรุณาลงนามให้ครบก่อนบันทึกจ่าย' : undefined} onClick={() => { setRequestKey(crypto.randomUUID()); setError(''); void dialog.show() }}>บันทึกจ่ายแล้ว</Button>
    <Modal open={dialog.open} className="invoice-review-modal" title="ตรวจสอบสัญญาและบันทึกจ่ายเงินจริง" description={contractCode(contractId)} onClose={() => { if (!pending) dialog.close() }}>
      <form onSubmit={submit} className="space-y-4 whitespace-normal">
        {dialog.loading && <p role="status">กำลังโหลดข้อมูลสัญญาล่าสุด…</p>}
        {dialog.error && <p role="alert" className="text-red-700">{dialog.error}</p>}
        {dialog.review && <ContractReviewSummary review={dialog.review} />}
        <p className="text-xs leading-6 text-slate-500">ตรวจข้อมูลสัญญาด้านบน แล้วบันทึกเงินที่จ่ายจริงแล้ว เลือกวันที่ย้อนหลังตามสลิปได้</p>
        <fieldset disabled={pending || !dialog.review} className="space-y-4">
        <label className="block text-sm">วันที่จ่ายเงินจริง<input className={field} name="occurredOn" type="date" defaultValue={today} max={today} required /></label>
        <label className="block text-sm">ช่องทางชำระ<select className={field} name="channelCode" defaultValue="" required><option value="" disabled>เลือกช่องทาง</option>{channels.map(c => <option key={c.code} value={c.code}>{c.nameTh}</option>)}</select></label>
        <label className="block text-sm">เลขอ้างอิง<input className={field} name="reference" maxLength={150} placeholder="เลขรายการจากสลิป" /></label>
        <label className="block text-sm">สลิปการจ่าย (ถ้ามี · ไม่เกิน 5 MB)<input className={field} name="slip" type="file" accept="image/jpeg,image/png,application/pdf" /></label>
        <label className="block text-sm">หมายเหตุ<input className={field} name="note" maxLength={1000} /></label>
        {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
        <div className="flex justify-end gap-2"><Button disabled={pending} onClick={dialog.close}>ยกเลิก</Button><Button type="submit" disabled={pending || !dialog.review || Boolean(dialog.review.limitApprovalRequired) || !dialog.review.signaturesReady}>{pending ? 'กำลังบันทึก…' : 'ยืนยันบันทึกจ่ายแล้ว'}</Button></div>
        </fieldset>
      </form>
    </Modal>
  </>
}
