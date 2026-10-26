'use client'

import { useState } from 'react'
import { Landmark, Pencil, Plus } from 'lucide-react'
import { Header } from '@/components/ui/header'
import { PageContainer } from '@/components/ui/page-container'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { useFeedbackToast } from '@/components/ui/use-feedback-toast'
import { Modal } from '@/components/ui/modal'
import { saveAssetWorkspace, saveBankLoanContractSettings } from '@/app/thing/_shared/actions'
import { money, outstanding, loanAssetIds, type AssetData, type BankLoan } from '@/app/thing/_shared/model'
import { BankLoanForm, type BankLoanFields } from './bank-loan-form'
import { LoanDetail } from '@/app/thing/liabilities/_components/loan-detail'
import type { InitialLoanSettings } from '@/app/thing/liabilities/initial-settings'
import { recordBankLoanCash, type BankLoanCashInput } from '@/app/thing/liabilities/actions'

export function BankLoanRegistry({ initial, canWrite, channels = [] }: { initial: AssetData; canWrite: boolean; channels?: { code: string; nameTh: string }[] }) {
  const [data, setData] = useState(initial)
  const [editing, setEditing] = useState<BankLoan | null>(null)
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  useFeedbackToast({ error, success: notice })
  const [selectedId, setSelectedId] = useState<string | null>(null)

  async function persistLoan(loan: BankLoan, reason: string) {
    const next = { ...data, loans: data.loans.map(row => row.id === loan.id ? loan : row) }
    const result = await saveAssetWorkspace(next, reason)
    if (!result.data) throw new Error(result.error || 'บันทึกไม่สำเร็จ')
    setData(result.data)
  }

  async function recordCash(input: Omit<BankLoanCashInput, 'loanId' | 'revision'>) {
    if (!selectedId) throw new Error('กรุณาเลือกสัญญา')
    const result = await recordBankLoanCash({ ...input, loanId: selectedId, revision: data.revision })
    if (!('data' in result)) throw new Error(result.error || 'บันทึกไม่สำเร็จ')
    setData(result.data)
  }

  async function persistSettings(settings: InitialLoanSettings) {
    if (!selectedId) throw new Error('กรุณาเลือกสัญญา')
    const result = await saveBankLoanContractSettings(selectedId, data.revision, settings)
    if (!result.data) throw new Error(result.error || 'บันทึกไม่สำเร็จ')
    setData(result.data)
  }

  function show(loan?: BankLoan) { setEditing(loan ?? null); setError(''); setOpen(true) }
  function close() { if (!busy) setOpen(false) }
  async function save(fields: BankLoanFields) {
    if (busy || !canWrite) return
    setBusy(true); setError(''); setNotice('')
    try {
      const loan: BankLoan = editing ? { ...editing, ...fields } : { id: crypto.randomUUID(), ...fields, rounds: [], payments: [], disbursements: [] }
      const next = { ...data, loans: editing ? data.loans.map(row => row.id === loan.id ? loan : row) : [...data.loans, loan] }
      const result = await saveAssetWorkspace(next, editing ? 'แก้ไขข้อมูลธนาคารและข้อมูลอ้างอิงเงินกู้' : 'เพิ่มรายการเงินกู้ธนาคาร')
      if (!result.data) throw new Error(result.error || 'บันทึกไม่สำเร็จ')
      setData(result.data); setOpen(false); setNotice('บันทึกข้อมูลเงินกู้แล้ว')
    } catch (error) { setError(error instanceof Error ? error.message : 'บันทึกไม่สำเร็จ') }
    finally { setBusy(false) }
  }

  const selected = data.loans.find(loan => loan.id === selectedId)
  if (selected) return <LoanDetail loan={selected} canWrite={canWrite} channels={channels} onRecordCash={recordCash} onBack={() => setSelectedId(null)} onSave={persistLoan} onSaveSettings={persistSettings} />

  return <PageContainer>
    <Header title="Liabilities" description="ข้อมูลหนี้สิน เงินกู้ธนาคารและสินทรัพย์ที่เกี่ยวข้อง" icon={<Landmark size={21} aria-hidden="true" />} actions={canWrite ? <Button variant="primary" disabled={busy} onClick={() => show()}><Plus size={15} aria-hidden="true" />เพิ่มเงินกู้ธนาคาร</Button> : undefined} />
    <p role="status" className="mb-4 text-xs text-slate-500">{`${data.loans.length} รายการ`}</p>
    {!data.loans.length ? <Card className="p-8 text-center text-sm text-slate-500">ยังไม่มีข้อมูลเงินกู้ธนาคาร</Card> : null}
    <div className="mb-5 grid gap-3 sm:grid-cols-2"><Card className="p-5"><p className="text-xs text-slate-500">เงินต้นคงเหลือปัจจุบัน</p><strong className="text-2xl">{money(data.loans.reduce((sum, loan) => sum + outstanding(loan), 0))} บาท</strong></Card><Card className="p-5"><p className="text-xs text-slate-500">สัญญาเงินกู้ทั้งหมด</p><strong className="text-2xl">{data.loans.length} สัญญา</strong></Card></div>
    <div className="space-y-3">{data.loans.map(loan => {
      const properties = data.homes.filter(row => loanAssetIds(loan).includes(row.id))
      return <Card key={loan.id} className="p-5"><div className="flex flex-wrap items-start justify-between gap-3"><div className="min-w-0 flex-1"><h2 className="m-0 text-base font-semibold">{loan.name}</h2><p className="mb-0 mt-2 text-xs leading-6 text-slate-500">{loan.bank} · เลขที่สัญญา {loan.accountNumber || 'ยังไม่ระบุ'}</p><p className="mb-0 mt-1 text-xs leading-6 text-slate-500">สินทรัพย์: {properties.length ? properties.map(property => `${property.name}${property.archivedOn ? ' (รายการที่ลบ)' : ''}`).join(' · ') : 'ไม่ผูกกับสินทรัพย์'}</p><p className="mb-0 mt-2 text-xs font-medium text-slate-700">{loan.rounds.length ? `เงินต้นคงเหลือตามข้อมูลที่บันทึก ${money(outstanding(loan))} บาท` : 'ยังไม่ได้ตั้งค่าสัญญาและวงเงินกู้'}</p></div><div className="flex flex-wrap gap-2"><Button onClick={() => setSelectedId(loan.id)}>จัดการสัญญา</Button>{canWrite ? <Button disabled={busy} onClick={() => show(loan)} aria-label={`แก้ไขเงินกู้ ${loan.name}`}><Pencil size={14} aria-hidden="true" />แก้ไข</Button> : null}</div></div></Card>
    })}</div>
    <Modal open={open} title={editing ? 'แก้ไขเงินกู้ธนาคาร' : 'เพิ่มเงินกู้ธนาคาร'} onClose={close}>
      <BankLoanForm key={editing?.id ?? 'new'} initial={editing} properties={data.homes} busy={busy} error={error} onCancel={close} onSave={save} />
    </Modal>
  </PageContainer>
}
