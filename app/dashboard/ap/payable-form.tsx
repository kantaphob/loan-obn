'use client'

import { useFeedbackToast } from '@/components/ui/use-feedback-toast'
import { Button } from '@/components/ui/button'
import { useActionState } from 'react'
import Link from 'next/link'
import { CheckCircle2 } from 'lucide-react'
import { savePayable, payPayable } from './actions'

export function PayableForm({ today, requestKey, payment }: { today: string; requestKey?: string; payment?: { id: number; invoiceDate: string; channels: { code: string; nameTh: string }[] } }) {
  const [state, action, pending] = useActionState(payment ? payPayable : savePayable, { message: '' })
  useFeedbackToast({ error: state.success ? '' : state.message, success: state.success ? state.message || 'บันทึกข้อมูลเรียบร้อยแล้ว' : '' })
  if (state.success && !payment) return <div className="ap-save-success" role="status"><CheckCircle2 size={36} aria-hidden="true" /><h2>เพิ่มบิลเจ้าหนี้เรียบร้อยแล้ว</h2><p>บิลนี้พร้อมให้ติดตามวันครบกำหนดและบันทึกจ่ายในหน้ารายการเจ้าหนี้</p><Link className="invoice-primary" href="/dashboard/ap/trade">กลับไปรายการเจ้าหนี้</Link></div>
  return <form action={action} className="ap-form">
    {payment ? <><input type="hidden" name="id" value={payment.id} /><label>วันที่จ่าย<input name="occurredOn" type="date" min={payment.invoiceDate} max={today} defaultValue={today} required /></label><label>ช่องทางชำระ<select name="channelCode" required defaultValue=""><option value="" disabled>เลือกช่องทาง</option>{payment.channels.map(c => <option key={c.code} value={c.code}>{c.nameTh}</option>)}</select></label><label>เลขอ้างอิงการจ่าย<input name="reference" maxLength={150} required placeholder="เลขสลิป / ใบสำคัญจ่าย" /></label></> : <><input type="hidden" name="requestKey" value={requestKey} /><label>ผู้ขาย / ซัพพลายเออร์<input name="supplier" maxLength={200} required placeholder="ชื่อบริษัทหรือผู้ขาย" /></label><label>เลขใบแจ้งหนี้<input name="invoiceNumber" maxLength={200} required placeholder="เช่น INV-2026-001" /></label><label>รายการสินค้า / บริการ<input name="description" maxLength={1000} required placeholder="รายละเอียดค่าใช้จ่าย" /></label><label>ยอดเงิน (บาท)<input name="amount" type="number" min="0.01" max="2000000000" step="0.01" required /></label><label>วันที่ใบแจ้งหนี้<input name="invoiceDate" type="date" max={today} defaultValue={today} required /></label><label>วันครบกำหนด<input name="dueDate" type="date" required /></label></>}
    <Button type="submit" variant="primary" disabled={pending || state.success}>{pending ? 'กำลังบันทึก…' : state.success ? 'บันทึกแล้ว' : payment ? 'ยืนยันจ่ายเต็มยอด' : 'บันทึกเจ้าหนี้'}</Button>
    {state.message && <p role={state.success ? 'status' : 'alert'} className="ap-message">{state.message}</p>}
  </form>
}
