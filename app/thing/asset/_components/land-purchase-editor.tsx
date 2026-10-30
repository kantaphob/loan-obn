'use client'

import { useState, type FormEvent } from 'react'
import { Button } from '@/components/ui/button'
import { money, today, type Home } from '../../_shared/model'

const field = 'mt-1.5 w-full rounded-xl border border-slate-300 bg-white px-3 py-3 text-sm'
export function LandPurchaseEditor({ home, busy, error, onCancel, onSave }: { home: Home; busy: boolean; error: string; onCancel: () => void; onSave: (patch: Partial<Home>) => Promise<void> }) {
 const [purchase, setPurchase] = useState(String(home.purchasePrice))
 const [contract, setContract] = useState(home.landDetails?.purchaseContractPrice === undefined ? '' : String(home.landDetails.purchaseContractPrice))
 const [share, setShare] = useState(home.landDetails?.transferBuyerShare === undefined ? '' : String(home.landDetails.transferBuyerShare))
 const [notes, setNotes] = useState(home.landDetails?.purchaseNotes ?? '')
 async function submit(event: FormEvent<HTMLFormElement>) {
  event.preventDefault(); if (busy) return
  const data = new FormData(event.currentTarget)
  try {
   await onSave({ purchasePrice: Number(purchase), purchasedOn: String(data.get('purchasedOn') ?? ''), landDetails: { ...(home.landDetails ?? { deedNumber: '', areaSquareWa: 0, valuationOn: '', valuationSource: '' }), purchaseContractPrice: contract === '' ? undefined : Number(contract), transferBuyerShare: share === '' ? undefined : Number(share), purchaseNotes: notes.trim() } })
  } catch { /* The parent displays the save error and keeps this form open. */ }
 }
 return <form className="space-y-4" onSubmit={submit}><p className="rounded-xl bg-blue-50 p-3 text-sm leading-6 text-blue-900">แยกราคาที่ตกลงจ่ายจริงกับราคาในเอกสารสัญญา ต้นทุนที่ดินใช้ราคาซื้อจริงเพียงครั้งเดียว</p><div className="grid gap-4 sm:grid-cols-2"><label className="text-sm font-medium">ราคาซื้อจริงที่ตกลง (บาท)<input className={field} required type="number" min="0" step="0.01" value={purchase} onChange={event => setPurchase(event.target.value)} /></label><label className="text-sm font-medium">ราคาในสัญญาซื้อขาย (บาท)<input className={field} type="number" min="0" step="0.01" value={contract} onChange={event => setContract(event.target.value)} /></label><label className="text-sm font-medium">วันที่ซื้อ<input className={field} type="date" name="purchasedOn" max={today()} defaultValue={home.purchasedOn} /></label><label className="text-sm font-medium">ผู้ซื้อรับผิดชอบค่าโอน (%)<input className={field} type="number" min="0" max="100" step="0.01" value={share} onChange={event => setShare(event.target.value)} placeholder="เช่น 50 = คนละครึ่ง" /></label></div>{share !== '' && <p className="text-sm text-slate-600">ค่าโอน: ผู้ซื้อ {Number(share)}% · ผู้ขาย {100 - Number(share)}% · ยังไม่คำนวณยอดจ่ายจนกว่าจะระบุค่าโอนจริง</p>}<label className="block text-sm font-medium">รายละเอียดข้อตกลง<textarea className={field} rows={3} value={notes} onChange={event => setNotes(event.target.value)} /></label><p className="rounded-xl bg-slate-50 p-3 text-sm">ต้นทุนราคาซื้อที่ดิน {money(Number(purchase) || 0)} บาท · การบันทึกนี้ไม่สร้างรายการจ่ายเงิน</p>{error && <p role="alert" className="text-sm text-rose-700">{error}</p>}<div className="flex justify-end gap-2"><Button type="button" disabled={busy} onClick={onCancel}>ยกเลิก</Button><Button type="submit" variant="primary" disabled={busy}>{busy ? 'กำลังบันทึก…' : 'บันทึกราคาซื้อจริง'}</Button></div></form>
}
