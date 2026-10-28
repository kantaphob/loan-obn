'use client'

import { DataLoading } from '@/components/ui/data-loading'
import { useState, useTransition, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Modal } from '@/components/ui/modal'
import { useToast } from '@/components/ui/toast'
import { contractCode, contractAmounts, formatContractMoney as money } from '@/lib/contracts'
import type { PendingContractReview } from '@/lib/pending-contract-review'
import { editPendingContract } from './review-actions'
import { useContractReview } from './use-contract-review'

const field = 'mt-1 block w-full rounded-xl border border-slate-300 bg-white p-3 text-sm'
export function EditPendingContractButton({ contractId }: { contractId: number }) {
  const dialog = useContractReview(contractId)
  return <><Button variant="edit" onClick={() => { void dialog.show() }}>แก้ไขสัญญาก่อนจ่าย</Button><Modal open={dialog.open} className="invoice-review-modal" title="แก้ไขสัญญาก่อนจ่ายเงินจริง" description={contractCode(contractId)} onClose={dialog.close}>
    {dialog.loading && <DataLoading compact label="กำลังโหลดข้อมูลสัญญา…" />}
    {dialog.error && <p role="alert" className="text-sm text-red-700">{dialog.error}</p>}
    {dialog.review && <EditForm key={dialog.review.reviewToken} review={dialog.review} close={dialog.close} />}
  </Modal></>
}
function EditForm({ review: r, close }: { review: PendingContractReview; close: () => void }) {
  const [principal, setPrincipal] = useState((r.principalSatang / 100).toFixed(2))
  const [error, setError] = useState(''), [pending, startTransition] = useTransition()
  const router = useRouter(), { toast } = useToast()
  let preview = r.netSatang
  try { if (Number(principal) * 100 !== r.principalSatang) preview = contractAmounts(principal, r.internalInterestPercent ?? r.interestPercent, r.interestMethod).netSatang } catch { /* Validation is displayed on submit. */ }
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    setError('')
    startTransition(async () => {
      try {
        const result = await editPendingContract({ id: r.id, reviewToken: r.reviewToken, principal, scheduledDisbursementDate: String(form.get('scheduled')), repaymentDueDate: String(form.get('due')), collateralDescription: String(form.get('collateral')), reason: String(form.get('reason')), confirmResetSignatures: form.get('resetSignatures') === 'on' })
        if (!result.success) { setError(result.error); return }
        toast({ title: 'แก้ไขสัญญาเรียบร้อยแล้ว', description: result.needsApproval ? 'ยอดใหม่ต้องได้รับอนุมัติวงเงินอีกครั้งก่อนจ่าย' : result.signaturesReset ? 'กรุณาจัดทำเอกสารฉบับแก้ไขและลงนามใหม่ก่อนจ่าย' : 'ตรวจข้อมูลล่าสุดก่อนบันทึกจ่ายเงินจริง', variant: 'success' })
        close(); router.refresh()
      } catch { setError('แก้ไขไม่สำเร็จ กรุณาลองใหม่') }
    })
  }
  return <form onSubmit={submit} className="space-y-4 whitespace-normal text-sm"><fieldset disabled={pending} className="space-y-4"><p className="rounded-xl bg-slate-50 p-3">{r.borrowerName} · ผู้ให้กู้ {r.lenderName}<span className="mt-1 block text-xs text-slate-500">เปลี่ยนผู้กู้ ผู้ให้กู้ หรือประเภทเอกสาร ให้จัดทำสัญญาใหม่</span></p>
    <div className="grid gap-4 sm:grid-cols-2"><label>เงินต้น (บาท)<input className={field} type="number" min="0.01" max="2000000000" step="0.01" required value={principal} onChange={e => setPrincipal(e.target.value)} /></label><div className="rounded-xl bg-blue-50 p-3 text-blue-900">ยอดจ่ายสุทธิหลังแก้ไข<strong className="mt-1 block text-xl">{money(preview)} บาท</strong></div><label>วันนัดจ่ายตามสัญญา<input className={field} type="date" name="scheduled" defaultValue={r.scheduledDisbursementDate ?? ''} required /></label><label>วันครบกำหนดคืน<input className={field} type="date" name="due" defaultValue={r.repaymentDueDate ?? ''} required /></label></div>
    <p className="text-xs leading-6 text-slate-500">วันคืนเงินจะคงเดิมหากไม่ได้แก้ไขช่องวันครบกำหนดคืน ยอดหักและยอดคืนคำนวณด้วยวิธีและอัตราเดิมของรายการ หากมีเอกสารกระดาษลงนามแล้ว ให้จัดทำฉบับแก้ไขก่อนจ่าย</p>
    <label className="block">รายละเอียดหลักประกัน<textarea className={field} name="collateral" maxLength={2000} rows={2} defaultValue={r.collateralDescription ?? ''} /></label>
    <label className="block">เหตุผลแก้ไข <span className="text-red-700">*</span><textarea className={field} name="reason" maxLength={500} rows={2} required /></label>
    {r.hasSignatures && <label className="flex items-start gap-2 rounded-xl bg-amber-50 p-3 text-amber-900"><input className="mt-1" type="checkbox" name="resetSignatures" required /><span>ยืนยันเก็บฉบับเดิมในประวัติ และเริ่มลงนามใหม่สำหรับฉบับแก้ไข ต้องตรวจและลงนามใหม่ก่อนจ่ายเงินจริง</span></label>}
    {error && <p role="alert" className="text-red-700">{error}</p>}
    <div className="flex justify-end gap-2"><Button onClick={close}>ยกเลิก</Button><Button variant="primary" type="submit">{pending ? 'กำลังบันทึก…' : 'บันทึกสัญญาฉบับแก้ไข'}</Button></div>
    {r.revisions.length > 0 && <details className="border-t border-slate-200 pt-3"><summary className="cursor-pointer text-xs text-slate-500">ประวัติการอนุมัติ / แก้ไขล่าสุด</summary><ul className="mt-2 space-y-2 text-xs text-slate-500">{r.revisions.map(item => <li key={item.id}>{new Date(item.createdAt).toLocaleString('th-TH', { timeZone: 'Asia/Bangkok' })} · {item.reason}</li>)}</ul></details>}
  </fieldset></form>
}
