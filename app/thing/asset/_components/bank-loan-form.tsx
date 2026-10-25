'use client'

import { useState, type FormEvent } from 'react'
import { Button } from '@/components/ui/button'
import type { BankLoan, Home } from '@/app/thing/_shared/model'

export type BankLoanFields = Pick<BankLoan, 'name' | 'bank' | 'accountNumber' | 'assetId'>

export function BankLoanForm({ initial, properties, busy, error, onCancel, onSave }: {
  initial: BankLoan | null
  properties: Home[]
  busy: boolean
  error: string
  onCancel: () => void
  onSave: (fields: BankLoanFields) => Promise<void>
}) {
  const [name, setName] = useState(initial?.name ?? '')
  const [bank, setBank] = useState(initial?.bank ?? '')
  const [accountNumber, setAccountNumber] = useState(initial?.accountNumber ?? '')
  const [assetId, setAssetId] = useState(initial?.assetId ?? '')

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (busy || !name.trim() || !bank.trim()) return
    await onSave({ name: name.trim(), bank: bank.trim(), accountNumber: accountNumber.trim(), assetId: assetId || null })
  }

  return <form onSubmit={submit} className="space-y-4">
    <fieldset disabled={busy} className="space-y-4 border-0 p-0">
      <label className="block text-xs font-medium">ชื่อรายการเงินกู้ *
        <input autoFocus name="name" required maxLength={3000} value={name} onChange={e => setName(e.target.value)} placeholder="เช่น เงินกู้บ้าน GHB" className="mt-1.5 min-h-11 w-full rounded-xl border border-slate-300/30 px-3 text-sm focus:outline-blue-400" />
      </label>
      <label className="block text-xs font-medium">ธนาคาร / เจ้าหนี้ *
        <input name="bank" required maxLength={3000} value={bank} onChange={e => setBank(e.target.value)} placeholder="เช่น ธนาคารอาคารสงเคราะห์" className="mt-1.5 min-h-11 w-full rounded-xl border border-slate-300/30 px-3 text-sm focus:outline-blue-400" />
      </label>
      <label className="block text-xs font-medium">เลขที่สัญญา / บัญชีเงินกู้
        <input name="accountNumber" maxLength={3000} value={accountNumber} onChange={e => setAccountNumber(e.target.value)} className="mt-1.5 min-h-11 w-full rounded-xl border border-slate-300/30 px-3 text-sm focus:outline-blue-400" />
      </label>
      <label className="block text-xs font-medium">สินทรัพย์ที่เกี่ยวข้อง
        <select name="assetId" value={assetId} onChange={e => setAssetId(e.target.value)} className="mt-1.5 min-h-11 w-full rounded-xl border border-slate-300/30 bg-white px-3 text-sm focus:outline-blue-400">
          <option value="">ไม่ผูกกับสินทรัพย์</option>
          {properties.filter(p => !p.archivedOn || p.id === initial?.assetId).map(p => <option key={p.id} value={p.id}>{p.name}{p.archivedOn ? ' (รายการที่ลบ)' : ''}</option>)}
        </select>
      </label>
    </fieldset>
    <p className="m-0 text-[11px] leading-6 text-slate-500">ข้อมูลเงินกู้แยกจากราคาสินทรัพย์ การเลือกบ้านหรือรถเป็นการเชื่อมรายการเข้าด้วยกัน</p>
    {error ? <p role="alert" className="text-xs text-rose-600">{error}</p> : null}
    <div className="flex justify-end gap-2"><Button disabled={busy} onClick={onCancel}>ยกเลิก</Button><Button variant="primary" type="submit" disabled={busy || !name.trim() || !bank.trim()}>{busy ? 'กำลังบันทึก…' : 'บันทึก'}</Button></div>
  </form>
}
