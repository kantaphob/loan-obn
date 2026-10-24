'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { useToast } from '@/components/ui/toast'
import { Button } from '@/components/ui/button'
import { Modal } from '@/components/ui/modal'
import { contractCode } from '@/lib/contracts'
import { approveContractLimit } from '@/app/dashboard/contracts/actions'
import { ContractReviewSummary } from './contract-review-summary'
import { rejectPendingContract } from './review-actions'
import { useContractReview } from './use-contract-review'

export function LimitApprovalButton({ contractId }: { contractId: number }) {
  const dialog = useContractReview(contractId)
  const [confirmed, setConfirmed] = useState(false), [pending, startTransition] = useTransition()
  const [rejecting, setRejecting] = useState(false), [reason, setReason] = useState('')
  const router = useRouter(), { toast } = useToast()
  function approve() {
    if (!dialog.review || !confirmed) return
    const token = dialog.review.reviewToken
    dialog.setError('')
    startTransition(async () => {
      try {
        const result = await approveContractLimit(contractId, token)
        if (result.error) { dialog.setError(result.error); return }
        toast({ title: `อนุมัติ ${contractCode(contractId)} แล้ว · รอจ่ายเงินจริง`, variant: 'success' })
        dialog.close(); router.refresh()
      } catch { dialog.setError('อนุมัติไม่สำเร็จ กรุณาลองใหม่') }
    })
  }
  function open(reject = false) { setConfirmed(false); setRejecting(reject); setReason(''); void dialog.show() }
  function reject() {
    if (!dialog.review || !reason.trim()) return
    const token = dialog.review.reviewToken
    dialog.setError('')
    startTransition(async () => {
      try {
        const result = await rejectPendingContract(contractId, token, reason)
        if (!result.success) { dialog.setError(result.error); return }
        toast({ title: `ไม่อนุมัติ ${contractCode(contractId)} แล้ว`, description: 'นำออกจากรายการรอจ่ายและคืนวงเงินที่จองไว้แล้ว เก็บเหตุผลไว้ในหน้าสัญญา', variant: 'success' })
        dialog.close(); router.refresh()
      } catch { dialog.setError('บันทึกไม่อนุมัติไม่สำเร็จ กรุณาลองใหม่') }
    })
  }
  return <><div className="flex flex-col items-start gap-2"><Button variant="primary" onClick={() => open()}>ตรวจสอบและอนุมัติ</Button><Button variant="danger" onClick={() => open(true)}>ไม่อนุมัติ</Button></div>
    <Modal open={dialog.open} className="invoice-review-modal" title={rejecting ? 'ไม่อนุมัติรายการจอง' : 'ตรวจสอบก่อนอนุมัติวงเงิน'} description={contractCode(contractId)} onClose={() => { if (!pending) dialog.close() }}>
      <div className="space-y-4 whitespace-normal text-sm">
        {dialog.loading && <p role="status">กำลังโหลดวงเงินและรายการค้างล่าสุด…</p>}
        {dialog.review && <><ContractReviewSummary review={dialog.review} />{rejecting ? <div className="space-y-3 rounded-xl border border-red-200 bg-red-50 p-4 text-red-900"><p className="m-0">ยืนยันไม่อนุมัติรายการนี้ ระบบจะคืนวงเงินที่จองและนำออกจากรายการรอจ่าย โดยยังเก็บสัญญาและประวัติไว้</p><label className="block">เหตุผลไม่อนุมัติ <span aria-hidden="true">*</span><textarea className="mt-2 block w-full rounded-xl border border-red-200 bg-white p-3 text-sm text-slate-800" maxLength={500} rows={3} required value={reason} onChange={e => setReason(e.target.value)} disabled={pending} placeholder="ระบุเหตุผล เช่น มียอดค้างเดิมสูง หรือเอกสารไม่ครบ" /></label></div> : <label className="flex items-start gap-2 rounded-xl bg-amber-50 p-3 text-amber-900"><input type="checkbox" className="mt-1" checked={confirmed} onChange={e => setConfirmed(e.target.checked)} disabled={pending} /><span>ตรวจสอบวงเงิน รายการค้าง และยอดจ่ายแล้ว ยืนยันอนุมัติรายการนี้ การอนุมัติยังไม่มีเงินออก</span></label>}</>}
        {dialog.error && <p role="alert" className="text-red-700">{dialog.error}</p>}
        <div className="flex flex-wrap justify-end gap-2"><Button disabled={pending} onClick={dialog.close}>ปิดหน้าต่าง</Button>{rejecting ? <><Button disabled={pending} onClick={() => { setRejecting(false); dialog.setError('') }}>กลับไปตรวจสอบ</Button><Button variant="danger" disabled={pending || !dialog.review || !reason.trim()} onClick={reject}>{pending ? 'กำลังบันทึก…' : 'ยืนยันไม่อนุมัติ'}</Button></> : <><Button variant="danger" disabled={pending || !dialog.review} onClick={() => { setRejecting(true); dialog.setError('') }}>ไม่อนุมัติ</Button><Button variant="primary" disabled={pending || !dialog.review || !confirmed} onClick={approve}>{pending ? 'กำลังอนุมัติ…' : 'ยืนยันอนุมัติวงเงิน'}</Button></>}</div>
      </div>
    </Modal>
  </>
}
