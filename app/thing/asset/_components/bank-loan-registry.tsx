'use client'

import { useState } from 'react'
import { Landmark, Pencil, Plus } from 'lucide-react'
import { Header } from '@/components/ui/header'
import { PageContainer } from '@/components/ui/page-container'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Modal } from '@/components/ui/modal'
import { saveAssetWorkspace } from '@/app/thing/_shared/actions'
import { money, outstanding, type AssetData, type BankLoan } from '@/app/thing/_shared/model'
import { BankLoanForm, type BankLoanFields } from './bank-loan-form'

export function BankLoanRegistry({ initial, canWrite }: { initial: AssetData; canWrite: boolean }) {
  const [data, setData] = useState(initial)
  const [editing, setEditing] = useState<BankLoan | null>(null)
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  function show(loan?: BankLoan) { setEditing(loan ?? null); setError(''); setOpen(true) }
  function close() { if (!busy) setOpen(false) }
  async function save(fields: BankLoanFields) {
    if (busy || !canWrite) return
    setBusy(true); setError('')
    try {
      const loan: BankLoan = editing ? { ...editing, ...fields } : { id: crypto.randomUUID(), ...fields, rounds: [], payments: [] }
      const next = { ...data, loans: editing ? data.loans.map(row => row.id === loan.id ? loan : row) : [...data.loans, loan] }
      const result = await saveAssetWorkspace(next, editing ? 'แก้ไขข้อมูลธนาคารและข้อมูลอ้างอิงเงินกู้' : 'เพิ่มรายการเงินกู้ธนาคาร')
      if (!result.data) throw new Error(result.error || 'บันทึกไม่สำเร็จ')
      setData(result.data); setOpen(false); setNotice('บันทึกข้อมูลเงินกู้แล้ว')
    } catch (error) { setError(error instanceof Error ? error.message : 'บันทึกไม่สำเร็จ') }
    finally { setBusy(false) }
  }

  return <PageContainer>
    <Header title="Asset" description="ข้อมูลเงินกู้ธนาคารและสินทรัพย์ที่เกี่ยวข้อง" icon={<Landmark size={21} aria-hidden="true" />} actions={canWrite ? <Button variant="primary" disabled={busy} onClick={() => show()}><Plus size={15} aria-hidden="true" />เพิ่มเงินกู้ธนาคาร</Button> : undefined} />
    <p role="status" className="mb-4 text-xs text-slate-500">{notice || `${data.loans.length} รายการ`}</p>
    {!data.loans.length ? <Card className="p-8 text-center text-sm text-slate-500">ยังไม่มีข้อมูลเงินกู้ธนาคาร</Card> : null}
    <div className="space-y-3">{data.loans.map(loan => {
      const property = data.homes.find(row => row.id === loan.assetId)
      return <Card key={loan.id} className="p-5"><div className="flex flex-wrap items-start justify-between gap-3"><div className="min-w-0 flex-1"><h2 className="m-0 text-base font-semibold">{loan.name}</h2><p className="mb-0 mt-2 text-xs leading-6 text-slate-500">{loan.bank} · เลขที่สัญญา {loan.accountNumber || 'ยังไม่ระบุ'}</p><p className="mb-0 mt-1 text-xs leading-6 text-slate-500">สินทรัพย์: {property ? `${property.name}${property.archivedOn ? ' (รายการที่ลบ)' : ''}` : 'ไม่ผูกกับสินทรัพย์'}</p><p className="mb-0 mt-2 text-xs font-medium text-slate-700">{loan.rounds.length ? `เงินต้นคงเหลือตามข้อมูลที่บันทึก ${money(outstanding(loan))} บาท` : 'ยังไม่ได้ตั้งค่าสัญญาและวงเงินกู้'}</p></div>{canWrite ? <Button disabled={busy} onClick={() => show(loan)} aria-label={`แก้ไขเงินกู้ ${loan.name}`}><Pencil size={14} aria-hidden="true" />แก้ไข</Button> : null}</div></Card>
    })}</div>
    <Modal open={open} title={editing ? 'แก้ไขเงินกู้ธนาคาร' : 'เพิ่มเงินกู้ธนาคาร'} onClose={close}>
      <BankLoanForm key={editing?.id ?? 'new'} initial={editing} properties={data.homes} busy={busy} error={error} onCancel={close} onSave={save} />
    </Modal>
  </PageContainer>
}
