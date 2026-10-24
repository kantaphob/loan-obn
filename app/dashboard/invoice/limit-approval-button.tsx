'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { useToast } from '@/components/ui/toast'
import { Button } from '@/components/ui/button'
import { Modal } from '@/components/ui/modal'
import { contractCode } from '@/lib/contracts'
import { approveContractLimit } from '@/app/dashboard/contracts/actions'
import { ContractReviewSummary } from './contract-review-summary'
import { useContractReview } from './use-contract-review'

export function LimitApprovalButton({ contractId }: { contractId: number }) {
  const dialog = useContractReview(contractId)
  const [confirmed, setConfirmed] = useState(false), [pending, startTransition] = useTransition()
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
  return <><Button variant="primary" onClick={() => { setConfirmed(false); void dialog.show() }}>ตรวจสอบและอนุมัติ</Button>
    <Modal open={dialog.open} className="invoice-review-modal" title="ตรวจสอบก่อนอนุมัติวงเงิน" description={contractCode(contractId)} onClose={() => { if (!pending) dialog.close() }}>
      <div className="space-y-4 whitespace-normal text-sm">
        {dialog.loading && <p role="status">กำลังโหลดวงเงินและรายการค้างล่าสุด…</p>}
        {dialog.review && <><ContractReviewSummary review={dialog.review} /><label className="flex items-start gap-2 rounded-xl bg-amber-50 p-3 text-amber-900"><input type="checkbox" className="mt-1" checked={confirmed} onChange={e => setConfirmed(e.target.checked)} /><span>ตรวจสอบวงเงิน รายการค้าง และยอดจ่ายแล้ว ยืนยันอนุมัติรายการนี้ การอนุมัติยังไม่มีเงินออก</span></label></>}
        {dialog.error && <p role="alert" className="text-red-700">{dialog.error}</p>}
        <div className="flex justify-end gap-2"><Button disabled={pending} onClick={dialog.close}>ยกเลิก</Button><Button variant="primary" disabled={pending || !dialog.review || !confirmed} onClick={approve}>{pending ? 'กำลังอนุมัติ…' : 'ยืนยันอนุมัติวงเงิน'}</Button></div>
      </div>
    </Modal>
  </>
}
