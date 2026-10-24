'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { useToast } from '@/components/ui/toast'
import { Button } from '@/components/ui/button'
import { Modal } from '@/components/ui/modal'
import { formatContractMoney, contractCode } from '@/lib/contracts'
import { approveContractLimit } from '@/app/dashboard/contracts/actions'

export function LimitApprovalButton({ contractId, principalSatang, borrowerName }: { contractId: number; principalSatang: number; borrowerName: string }) {
  const [open, setOpen] = useState(false)
  const [error, setError] = useState('')
  const [pending, startTransition] = useTransition()
  const router = useRouter()
  const { toast } = useToast()

  function approve() {
    setError('')
    startTransition(async () => {
      const result = await approveContractLimit(contractId)
      if (result.error) { setError(result.error); return }
      toast({ title: `อนุมัติรายการจอง ${contractCode(contractId)} แล้ว`, variant: 'success' })
      setOpen(false)
      router.refresh()
    })
  }

  return <>
    <Button variant="primary" onClick={() => { setError(''); setOpen(true) }}>อนุมัติวงเงิน</Button>
    <Modal open={open} title="อนุมัติรายการจองเกินวงเงิน" description={`${contractCode(contractId)} · ${borrowerName}`} onClose={() => { if (!pending) setOpen(false) }}>
      <div className="space-y-4 text-sm">
        <p className="m-0 rounded-xl bg-amber-50 p-3 text-amber-900">เงินต้นที่ขอจอง {formatContractMoney(principalSatang)} บาท รายการนี้เกินวงเงินคงเหลือ เมื่ออนุมัติแล้วจึงจะบันทึกจ่ายเงินจริงได้</p>
        {error && <p role="alert" className="m-0 text-red-700">{error}</p>}
        <div className="flex justify-end gap-2"><Button disabled={pending} onClick={() => setOpen(false)}>ยกเลิก</Button><Button variant="primary" disabled={pending} onClick={approve}>{pending ? 'กำลังอนุมัติ…' : 'ยืนยันอนุมัติ'}</Button></div>
      </div>
    </Modal>
  </>
}
