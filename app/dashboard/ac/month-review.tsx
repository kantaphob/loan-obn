'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { lockAccountingMonth, saveRepaymentAllocation, type getMonthReview } from './month-actions'
const money = (n: number) => (n / 100).toLocaleString('th-TH', { minimumFractionDigits: 2 })
const field = 'mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm'
type Review = Awaited<ReturnType<typeof getMonthReview>>
export function MonthReview({ review, canWrite, locked, completed }: { review: Review; canWrite: boolean; locked: boolean; completed: boolean }) {
  const router = useRouter()
  const { snapshot: s } = review
  const [note, setNote] = useState('')
  const [confirmed, setConfirmed] = useState(false)
  const [pending, setPending] = useState(false)
  const [message, setMessage] = useState('')
  const [requestKey, setRequestKey] = useState('')
  return <div className="space-y-4">
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{[
      ['รับเงินจริง', s.incomingSatang], ['จ่ายเงินจริง', s.outgoingSatang],
      ['กระแสเงินสดสุทธิ', s.incomingSatang - s.outgoingSatang], ['ยอดคงค้างตามสัญญาสิ้นเดือน', s.outstandingSatang],
    ].map(([label, amount]) => <div key={label} className="rounded-xl border border-slate-200 p-4"><p className="text-xs text-slate-600">{label}</p><p className="mt-2 text-xl font-semibold">{money(Number(amount))}</p></div>)}</div>
    <p className="text-sm text-slate-600">ยอดคงค้างรวมดอกเบี้ยตามสัญญาและค่าปรับ ณ {s.endOn} ยกยอดไปเดือนถัดไปโดยไม่ปิดสัญญา กระแสเงินสดสุทธิไม่ใช่กำไรสุทธิ และไม่ใช่ยอดเงินคงเหลือในธนาคาร</p>
    <div className="rounded-xl bg-slate-50 p-4 text-sm"><p>รับคืนเงินต้นที่ตรวจแล้ว {money(s.principalReceivedSatang)} · ดอกเบี้ยรับชำระ {money(s.interestReceivedSatang)} · ค่าปรับรับชำระ {money(s.penaltyReceivedSatang)} บาท</p><p className="mt-2">รอแยกยอด {s.unallocatedCount} รายการ · พบยอดสัญญาไม่สอดคล้อง {s.invalidCount} สัญญา</p><p className="mt-2 text-xs text-slate-500">ยอดข้างต้นเฉพาะรายการรับชำระ ไม่รวมการหักดอกเบี้ยล่วงหน้าจากเงินจ่ายกู้ และไม่ใช่รายได้ตามเกณฑ์คงค้าง</p></div>
    {s.legacyCount > 0 && <p className="rounded-xl bg-amber-50 p-4 text-sm text-amber-900">มีสัญญายกมา {s.legacyCount} สัญญา ยอดรับชำระยกมาไม่ได้ถูกแยกเงินต้น–ดอกเบี้ยย้อนหลังอัตโนมัติ กรุณาเทียบกับบัญชีเดิมประกอบการตรวจยอด</p>}
    <h3 className="font-semibold">ตรวจการแยกยอดรับชำระ · {s.receipts.length} รายการ</h3>
    {!s.receipts.length && <p className="text-sm text-slate-500">ไม่มีรายการรับชำระในเดือนนี้</p>}
    {s.receipts.map(receipt => <AllocationRow key={`${receipt.id}:${receipt._count.revisions}`} receipt={receipt} editable={canWrite && !locked} />)}
    {!completed && !locked && <p className="text-sm text-amber-800">เดือนนี้ยังไม่สิ้นสุด สามารถตรวจและแยกยอดได้ แต่ยังล็อกเดือนไม่ได้</p>}
    {locked ? <p role="status" className="rounded-xl bg-emerald-50 p-4 text-sm text-emerald-800">เดือนนี้ล็อกแล้ว แสดงข้อมูลตามที่บันทึก ณ วันล็อกเดือน</p> : canWrite && <form onSubmit={async e => {
      e.preventDefault(); if (pending || !confirmed) return
      setPending(true); setMessage('')
      try {
        const key = requestKey || crypto.randomUUID(); setRequestKey(key)
        const result = await lockAccountingMonth({ requestKey: key, month: s.month, note, reviewToken: review.reviewToken })
        setMessage(result.message)
        if (result.ok) router.refresh()
      } catch { setMessage('เชื่อมต่อไม่สำเร็จ กรุณาลองอีกครั้ง') }
      finally { setPending(false) }
    }} className="space-y-4"><fieldset disabled={pending} className="space-y-4">
      <label className="block text-sm">หมายเหตุตรวจยอด<textarea required maxLength={1000} className={field} value={note} onChange={e => { setNote(e.target.value); setConfirmed(false); setRequestKey('') }} placeholder="ตรวจเทียบยอดกับรายการเดินบัญชีและเงินสดแล้ว…" /></label>
      <label className="flex items-start gap-3 text-sm"><input required type="checkbox" checked={confirmed} onChange={e => setConfirmed(e.target.checked)} className="mt-1" />ตรวจเทียบรายการรับ–จ่าย การแยกยอด และยอดยกมาแล้ว ยืนยันล็อกทุกรายการถึง {s.endOn} เมื่อบันทึกจะเพิ่ม แก้ไข หรือยกเลิกรายการย้อนหลังไม่ได้ และไม่มีการโอนกำไรหรือปิดสัญญากู้</label>
      <button disabled={pending || !confirmed || !completed || s.unallocatedCount > 0 || s.invalidCount > 0} className="rounded-xl bg-slate-900 px-4 py-3 text-sm text-white disabled:opacity-40">{pending ? 'กำลังบันทึก…' : 'ยืนยันตรวจยอดและล็อกเดือน'}</button>
    </fieldset>{message && <p role="status" className="text-sm">{message}</p>}</form>}
  </div>
}
function AllocationRow({ receipt: e, editable }: { receipt: Review['snapshot']['receipts'][number]; editable: boolean }) {
  const router = useRouter()
  const [principal, setPrincipal] = useState(e.principalReceivedSatang === null ? '' : String(e.principalReceivedSatang / 100))
  const [interest, setInterest] = useState(e.interestReceivedSatang === null ? '' : String(e.interestReceivedSatang / 100))
  const [reason, setReason] = useState('')
  const [pending, setPending] = useState(false)
  const [message, setMessage] = useState('')
  return <details className="rounded-xl border border-slate-200 p-4"><summary className="cursor-pointer text-sm font-medium">TX-{e.id} · {e.borrowerName} · {e.occurredOn} · {money(e.amountSatang)} บาท · {e.allocated ? 'ตรวจการแยกยอดแล้ว' : 'รอแยกยอด'}</summary>
    <form className="mt-4 space-y-3" onSubmit={async event => {
      event.preventDefault(); if (pending) return
      setPending(true); setMessage('')
      try {
        const result = await saveRepaymentAllocation({ id: e.id, expectedRevision: e._count.revisions, principal, interest, reason })
        setMessage(result.message)
        if (result.ok) router.refresh()
      } catch { setMessage('บันทึกไม่สำเร็จ กรุณาลองอีกครั้ง') }
      finally { setPending(false) }
    }}><fieldset disabled={!editable || pending} className="space-y-3"><div className="grid gap-3 sm:grid-cols-2"><label className="text-sm">ส่วนเงินต้น (บาท)<input required inputMode="decimal" className={field} value={principal} onChange={ev => setPrincipal(ev.target.value)} /></label><label className="text-sm">ส่วนดอกเบี้ย (บาท)<input required inputMode="decimal" className={field} value={interest} onChange={ev => setInterest(ev.target.value)} /></label></div>
      <p className="text-sm">ค่าปรับตามรายการ {money(e.expectedPenaltySatang)} บาท · เงินต้น + ดอกเบี้ย ต้องเท่ากับ {money(e.amountSatang - e.expectedPenaltySatang)} บาท</p>
      {editable && <><label className="block text-sm">หลักฐานหรือเหตุผลตรวจยอด<input required maxLength={500} className={field} value={reason} onChange={ev => setReason(ev.target.value)} /></label><button className="rounded-xl border border-slate-300 px-4 py-2 text-sm">{pending ? 'กำลังบันทึก…' : 'บันทึกการแยกยอด'}</button></>}
    </fieldset>{message && <p role="status" className="text-sm">{message}</p>}</form>
  </details>
}
