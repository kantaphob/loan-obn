'use client'

import { useToast } from '@/components/ui/toast'
import { useFeedbackToast } from '@/components/ui/use-feedback-toast'
import { useState, useTransition, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import { Modal } from '@/components/ui/modal'
import { Button } from '@/components/ui/button'
import { bangkokToday } from '@/lib/ledger'
import { formatContractMoney as money, contractCode } from '@/lib/contracts'
import { editLedger, type getLedger } from './actions'

type Data = Awaited<ReturnType<typeof getLedger>>
const field = 'mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm focus:ring-2 focus:ring-blue-500'
const labels: Record<string, string> = { amountSatang: 'ยอดเงิน', occurredOn: 'วันที่', direction: 'ประเภท', categoryName: 'หมวดหมู่', channelName: 'ช่องทาง', reference: 'เลขอ้างอิง', note: 'หมายเหตุ' }
function display(key: string, value: unknown) {
  if (key === 'amountSatang') return `${money(Number(value))} บาท`
  if (key === 'direction') return value === 'IN' ? 'รับเงิน' : 'จ่ายเงิน'
  return String(value || '—')
}
export function EditTransactionModal({ entry, data, onClose }: { entry: Data['entries'][number]; data: Data; onClose: () => void }) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState('')
  useFeedbackToast({ error })
  const { toast } = useToast()
  const [draft, setDraft] = useState({ id: entry.id, expectedRevision: entry.revisions.length, amount: String(entry.amountSatang / 100), occurredOn: entry.occurredOn, direction: entry.direction, categoryCode: entry.categoryCode, channelCode: entry.channelCode, reference: entry.reference, note: entry.note, reason: '' })
  const linked = Boolean(entry.contractId || entry.payableId)
  function submit(event: FormEvent) {
    event.preventDefault(); setError('')
    startTransition(async () => {
      try {
        const result = await editLedger(draft)
        if (result.error) { setError(result.error); return }
        toast({ title: 'บันทึกการแก้ไขรายการแล้ว', variant: 'success' }); router.refresh(); onClose()
      } catch { setError('เชื่อมต่อไม่สำเร็จ กรุณาลองอีกครั้ง') }
    })
  }
  return <Modal open title={`แก้ไข TX-${String(entry.id).padStart(6, '0')}`} description={entry.voidedAt ? 'รายการยกเลิกแล้ว ดูประวัติได้เท่านั้น' : 'ระบุเหตุผลทุกครั้ง ระบบจะเก็บข้อมูลก่อนและหลังแก้ไข'} onClose={() => { if (!pending) onClose() }} className="max-h-[90vh] overflow-y-auto !bg-white max-w-xl">
    {entry.contractId && <p className="mb-4 text-sm text-blue-700">{contractCode(entry.contractId)} · {entry.contract?.borrowerName}</p>}
    <form onSubmit={submit}><fieldset disabled={pending || Boolean(entry.voidedAt) || !data.canWrite} className="space-y-4">
      <div className="grid grid-cols-2 gap-3"><label className="text-sm">ประเภท<select disabled={linked} className={field} value={draft.direction} onChange={e => setDraft({ ...draft, direction: e.target.value, categoryCode: '' })}><option value="IN">รับเงิน</option><option value="OUT">จ่ายเงิน</option></select></label><label className="text-sm">หมวดหมู่<select required disabled={linked} className={field} value={draft.categoryCode} onChange={e => setDraft({ ...draft, categoryCode: e.target.value })}><option value="">เลือกหมวดหมู่</option>{linked ? <option value={entry.categoryCode}>{entry.categoryName}</option> : data.categories.filter(c => c.direction === draft.direction && c.group !== 'LOAN' && c.code !== 'INTEREST_RECEIVED').map(c => <option key={c.code} value={c.code}>{c.nameTh}</option>)}</select></label></div>
      {linked && <p className="text-xs text-slate-500">ประเภท หมวด และสัญญา/บิลอ้างอิงคงตามรายการเดิม หากอ้างอิงผิดให้ยกเลิกแล้วบันทึกใหม่</p>}
      <div className="grid grid-cols-2 gap-3"><label className="text-sm">จำนวนเงิน (บาท)<input autoFocus required type="number" min="0.01" step="0.01" readOnly={entry.kind === 'DISBURSEMENT' || Boolean(entry.payableId)} className={field} value={draft.amount} onChange={e => setDraft({ ...draft, amount: e.target.value })} /></label><label className="text-sm">วันที่<input required type="date" max={bangkokToday()} className={field} value={draft.occurredOn} onChange={e => setDraft({ ...draft, occurredOn: e.target.value })} /></label></div>
      <label className="block text-sm">ช่องทาง<select required className={field} value={draft.channelCode} onChange={e => setDraft({ ...draft, channelCode: e.target.value })}>{!data.channels.some(c => c.code === draft.channelCode) && <option value={draft.channelCode}>ช่องทางเดิม (ปิดใช้งาน) — กรุณาเลือกใหม่</option>}{data.channels.map(c => <option key={c.code} value={c.code}>{c.nameTh}</option>)}</select></label>
      <label className="block text-sm">เลขอ้างอิง / เลขสลิป<input maxLength={150} className={field} value={draft.reference} onChange={e => setDraft({ ...draft, reference: e.target.value })} /></label>
      <label className="block text-sm">หมายเหตุ<textarea maxLength={1000} rows={2} className={field} value={draft.note} onChange={e => setDraft({ ...draft, note: e.target.value })} /></label>
      <label className="block text-sm">เหตุผลแก้ไข <span className="text-rose-600">*</span><textarea required maxLength={500} rows={2} className={field} value={draft.reason} onChange={e => setDraft({ ...draft, reason: e.target.value })} /></label>
      {error && <p role="alert" className="text-sm text-rose-700">{error}</p>}
      {!entry.voidedAt && data.canWrite && <div className="flex justify-end gap-2"><Button onClick={onClose}>ยกเลิก</Button><Button type="submit" variant="primary" disabled={!draft.reason.trim()}>{pending ? 'กำลังบันทึก…' : 'บันทึกการแก้ไข'}</Button></div>}
    </fieldset></form>
    <details className="mt-5 border-t border-slate-200 pt-4"><summary className="cursor-pointer text-sm">ประวัติการแก้ไข ({entry.revisions.length})</summary><div className="mt-3 space-y-4">{entry.revisions.map(r => {
      const before = JSON.parse(r.beforeJson) as Record<string, unknown>, after = JSON.parse(r.afterJson) as Record<string, unknown>
      return <div key={r.id} className="rounded-xl bg-slate-50 p-3 text-sm"><p className="font-medium">{r.reason}</p><p className="mt-1 text-xs text-slate-500">{new Date(r.createdAt).toLocaleString('th-TH', { timeZone: 'Asia/Bangkok' })} · ผู้บันทึก {r.createdBy}</p>{Object.entries(labels).filter(([key]) => before[key] !== after[key]).map(([key, label]) => <p key={key} className="mt-2 break-words">{label}: {display(key, before[key])} → {display(key, after[key])}</p>)}</div>
    })}{!entry.revisions.length && <p className="text-sm text-slate-500">ยังไม่มีการแก้ไข</p>}</div></details>
  </Modal>
}
