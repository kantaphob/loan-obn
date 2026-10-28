'use client'

import { useState, type FormEvent } from 'react'
import { Button } from '@/components/ui/button'
import type { BankLoan, Home } from '@/app/thing/_shared/model'
import { loanAssetIds } from '@/app/thing/_shared/model'

export type BankLoanFields = Pick<BankLoan, 'name' | 'bank' | 'accountNumber' | 'assetId' | 'assetIds'>

export function BankLoanForm({ initial, initialAssetIds = [], properties, busy, error, onCancel, onSave }: {
  initial: BankLoan | null
  initialAssetIds?: string[]
  properties: Home[]
  busy: boolean
  error: string
  onCancel: () => void
  onSave: (fields: BankLoanFields) => Promise<void>
}) {
  const [name, setName] = useState(initial?.name ?? '')
  const [bank, setBank] = useState(initial?.bank ?? '')
  const [accountNumber, setAccountNumber] = useState(initial?.accountNumber ?? '')
  const [assetIds, setAssetIds] = useState<string[]>(initial ? loanAssetIds(initial) : initialAssetIds)

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (busy || !name.trim() || !bank.trim()) return
    await onSave({ name: name.trim(), bank: bank.trim(), accountNumber: accountNumber.trim(), assetId: assetIds[0] ?? null, assetIds })
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
      <fieldset className="min-w-0 border-0 p-0">
        <legend className="text-xs font-medium">สินทรัพย์ที่เกี่ยวข้อง (เลือกได้หลายรายการ)</legend>
        <p className="mt-1 text-[11px] leading-6 text-slate-500">เช่น ที่ดินและบ้านที่อยู่ในสัญญาเงินกู้เดียวกัน</p>
        <div className="mt-2 max-h-60 space-y-1 overflow-y-auto rounded-xl border border-slate-200 bg-white p-2">
          {properties.filter(p => !p.archivedOn || (initial && loanAssetIds(initial).includes(p.id))).map(p => <label key={p.id} className="flex min-h-11 cursor-pointer items-center gap-3 rounded-lg px-3 py-2 text-sm hover:bg-slate-50"><input type="checkbox" name="assetIds" value={p.id} checked={assetIds.includes(p.id)} onChange={e => setAssetIds(ids => e.target.checked ? [...ids, p.id] : ids.filter(id => id !== p.id))} className="h-4 w-4 shrink-0 accent-blue-600" /><span>{p.assetCode ? `${p.assetCode} · ` : ''}{p.name}{p.archivedOn ? ' (รายการที่ลบ)' : ''}</span></label>)}
          {!properties.some(p => !p.archivedOn || (initial && loanAssetIds(initial).includes(p.id))) ? <p className="p-3 text-xs text-slate-500">ยังไม่มีสินทรัพย์ให้เลือก</p> : null}
        </div>
        <p className="mt-2 text-xs text-slate-500" role="status">{assetIds.length ? `เลือกแล้ว ${assetIds.length} รายการ` : 'ไม่ผูกกับสินทรัพย์'}</p>
      </fieldset>
    </fieldset>
    <p className="m-0 text-[11px] leading-6 text-slate-500">หนึ่งสัญญาเชื่อมกับหลายสินทรัพย์ได้ ยอดกู้และยอดชำระเก็บครั้งเดียวที่สัญญา แยกจากราคาสินทรัพย์</p>
    {error ? <p role="alert" className="text-xs text-rose-600">{error}</p> : null}
    <div className="flex justify-end gap-2"><Button disabled={busy} onClick={onCancel}>ยกเลิก</Button><Button variant="primary" type="submit" disabled={busy || !name.trim() || !bank.trim()}>{busy ? 'กำลังบันทึก…' : 'บันทึก'}</Button></div>
  </form>
}
