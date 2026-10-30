'use client'

import { useState, type FormEvent } from 'react'
import { Button } from '@/components/ui/button'
import { bangkokToday } from '@/lib/ledger'
import type { PropertyCashInput } from '../actions'
import type { Property } from '../../_shared/model'

const field = 'mt-1.5 w-full rounded-xl border border-slate-300 bg-white px-3 py-3 text-sm'
export function PropertyCashForm({ property, direction, categories, channels, busy, onCancel, onSave }: { property: Property; direction: 'IN' | 'OUT'; categories: { code: string; nameTh: string; direction: string }[]; channels: { code: string; nameTh: string }[]; busy: boolean; onCancel: () => void; onSave: (input: PropertyCashInput) => Promise<void> }) {
 const [requestKey] = useState(() => crypto.randomUUID())
 const [error, setError] = useState('')
 async function submit(event: FormEvent<HTMLFormElement>) {
  event.preventDefault(); if (busy) return
  const form = new FormData(event.currentTarget)
  const value = (name: string) => String(form.get(name) ?? '').trim()
  try { setError(''); await onSave({ propertyId: property.id, requestKey, direction, description: value('description'), amount: value('amount'), occurredOn: value('occurredOn'), categoryCode: value('categoryCode'), channelCode: value('channelCode'), reference: value('reference'), note: value('note') }) }
  catch (caught) { setError(caught instanceof Error ? caught.message : 'บันทึกไม่สำเร็จ') }
 }
 return <form onSubmit={submit} className="space-y-4"><p className="rounded-xl bg-blue-50 p-3 text-sm text-blue-900">{property.code} · {property.name}<span className="mt-1 block">บันทึกยอดเงินจริงที่เกิดขึ้น ระบบผูกกับ Property นี้ให้โดยอัตโนมัติ</span></p><label className="block text-sm font-medium">รายการ{direction === 'IN' ? 'รับเงิน' : 'จ่ายเงิน'} *<input className={field} name="description" required maxLength={300} placeholder={direction === 'IN' ? 'เช่น รับคืนเงินค่าสัญญา' : 'เช่น ค่าธรรมเนียมโอนที่ดิน'} /></label><div className="grid gap-4 sm:grid-cols-2"><label className="text-sm font-medium">จำนวนเงิน (บาท) *<input className={field} name="amount" required type="number" min="0.01" step="0.01" placeholder="0.00" /></label><label className="text-sm font-medium">วันที่{direction === 'IN' ? 'รับ' : 'จ่าย'}จริง *<input className={field} name="occurredOn" required type="date" defaultValue={bangkokToday()} max={bangkokToday()} /></label><label className="text-sm font-medium">หมวด{direction === 'IN' ? 'รายรับ' : 'รายจ่าย'} *<select className={field} name="categoryCode" required defaultValue=""><option value="">เลือกหมวด</option>{categories.filter(row => row.direction === direction).map(row => <option key={row.code} value={row.code}>{row.nameTh}</option>)}</select></label><label className="text-sm font-medium">ช่องทางรับ–จ่าย *<select className={field} name="channelCode" required defaultValue=""><option value="">เลือกช่องทาง</option>{channels.map(row => <option key={row.code} value={row.code}>{row.nameTh}</option>)}</select></label></div><label className="block text-sm font-medium">เลขอ้างอิง / เลขใบเสร็จ<input className={field} name="reference" maxLength={150} /></label><label className="block text-sm font-medium">หมายเหตุ<textarea className={field} name="note" rows={2} maxLength={500} placeholder="เช่น อ้างอิงรายการจ่ายเดิม TX-001496" /></label><p className="text-xs leading-6 text-slate-500">ใช้สำหรับรับ–จ่ายทั่วไปของ Property และไม่เพิ่มต้นทุนสินทรัพย์อัตโนมัติ · เงินเบิกกู้หรือเงินตามงวดสัญญาให้บันทึกผ่านสัญญาที่เกี่ยวข้อง เพื่อไม่ให้ซ้ำกับรายการเดิม</p>{error && <p role="alert" className="text-sm text-rose-700">{error}</p>}<div className="flex justify-end gap-2"><Button type="button" disabled={busy} onClick={onCancel}>ยกเลิก</Button><Button type="submit" variant="primary" disabled={busy}>{busy ? 'กำลังบันทึก…' : direction === 'IN' ? 'ยืนยันบันทึกรับเงิน' : 'ยืนยันบันทึกจ่ายเงิน'}</Button></div></form>
}
