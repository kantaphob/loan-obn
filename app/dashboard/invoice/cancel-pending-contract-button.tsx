'use client'

import { CircleX } from 'lucide-react'
import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Modal } from '@/components/ui/modal'
import { DataLoading } from '@/components/ui/data-loading'
import { useToast } from '@/components/ui/toast'
import { contractCode, formatContractMoney } from '@/lib/contracts'
import { useContractReview } from './use-contract-review'
import { cancelPendingContract } from './review-actions'

export function CancelPendingContractButton({ contractId }: { contractId: number }) {
  const dialog = useContractReview(contractId)
  const [reason, setReason] = useState('')
  const [pending, startTransition] = useTransition()
  const router = useRouter()
  const { toast } = useToast()
  function cancel() {
    if (!dialog.review || !reason.trim() || pending) return
    const token = dialog.review.reviewToken
    dialog.setError('')
    startTransition(async () => {
      try {
        const result = await cancelPendingContract(contractId, token, reason)
        if (!result.success) { dialog.setError(result.error); return }
        toast({ title: `ยกเลิก ${contractCode(contractId)} แล้ว`, description: 'คืนวงเงินจองแล้ว และเก็บเหตุผลไว้ในประวัติสัญญา', variant: 'success' })
        dialog.close(); router.refresh()
      } catch { dialog.setError('ยกเลิกไม่สำเร็จ กรุณาลองใหม่') }
    })
  }
  return <><Button variant="danger" className="invoice-icon-action" aria-label="ยกเลิกสัญญา" title="ยกเลิกสัญญา" onClick={() => { setReason(''); void dialog.show() }}><CircleX size={18} aria-hidden="true" /></Button>
    <Modal open={dialog.open} className="invoice-review-modal" title="ยกเลิกสัญญาที่ยังไม่จ่ายเงิน" description={contractCode(contractId)} onClose={() => { if (!pending) dialog.close() }}>
      <div className="space-y-4 whitespace-normal text-sm">
        {dialog.loading && <DataLoading compact label="กำลังตรวจสอบสถานะสัญญา…" />}
        {dialog.review && <><div className="rounded-xl bg-slate-50 p-4"><strong>{dialog.review.borrowerName}</strong><p>เงินต้น {formatContractMoney(dialog.review.principalSatang)} บาท · ยอดรอจ่าย {formatContractMoney(dialog.review.netSatang)} บาท</p></div><p className="rounded-xl bg-red-50 p-4 text-red-900">เมื่อยืนยัน สัญญาจะออกจากรายการรอจ่ายและคืนวงเงินจอง เก็บสัญญา เอกสาร และประวัติไว้ ไม่มีรายการเงินเข้า–ออกเกิดขึ้น</p><label className="block">เหตุผลยกเลิก <span className="text-red-700">*</span><textarea className="mt-2 block w-full rounded-xl border border-slate-300 p-3" rows={3} maxLength={500} required value={reason} onChange={e => setReason(e.target.value)} disabled={pending} /></label></>}
        {dialog.error && <p role="alert" className="text-red-700">{dialog.error}</p>}
        <div className="flex justify-end gap-2"><Button disabled={pending} onClick={dialog.close}>ปิดหน้าต่าง</Button><Button variant="danger" disabled={pending || dialog.loading || !dialog.review || !reason.trim()} onClick={cancel}>{pending ? 'กำลังยกเลิก…' : 'ยืนยันยกเลิกสัญญา'}</Button></div>
      </div>
    </Modal>
  </>
}
