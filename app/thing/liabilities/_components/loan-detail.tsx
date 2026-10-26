'use client'

import { useRef, useState, type FormEvent, type ReactNode } from 'react'
import { ArrowLeft, Landmark, Plus } from 'lucide-react'
import { Header } from '@/components/ui/header'
import { PageContainer } from '@/components/ui/page-container'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { useFeedbackToast } from '@/components/ui/use-feedback-toast'
import { Modal } from '@/components/ui/modal'
import type { BankLoanCashInput } from '@/app/thing/liabilities/actions'
import { type InitialLoanSettings } from '../initial-settings'
import { ContractSettingsForm } from './contract-settings-form'
import { BankCashForm } from './bank-cash-form'
import { ContractorContracts } from './contractor-contracts'
import { VariationOrders } from './variation-orders'
import { activeRound, balance, contractPaymentStages, money, outstanding, roundMoney, today, type BankLoan, type LoanDocument, type Payment } from '@/app/thing/_shared/model'

const inputClass = 'mt-1 min-h-11 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900'
const tabs = [['cashflow', 'รับจ่าย'], ['disbursements', 'งวดรับ'], ['contractors', 'สัญญาจ้างเหมา'], ['variations', 'งานเพิ่ม–งานลด'], ['land-contracts', 'สัญญาซื้อที่ดิน'], ['contract', 'สัญญาเงินกู้'], ['schedule', 'ตารางผ่อน'], ['payments', 'ชำระเงินจริง'], ['balance', 'ยอดหนี้คงเหลือ'], ['documents', 'เอกสาร / สลิป']] as const
type Tab = typeof tabs[number][0]
function Field({ label, children }: { label: string; children: ReactNode }) { return <label className="block text-xs font-medium text-slate-600">{label}{children}</label> }
function Summary({ label, value }: { label: string; value: string }) { return <Card className="p-4"><p className="mb-2 text-xs text-slate-500">{label}</p><strong className="text-lg tabular-nums">{value}</strong></Card> }
function Table({ headings, children }: { headings: string[]; children: ReactNode }) { return <div className="overflow-x-auto rounded-xl border border-slate-200"><table className="w-full whitespace-nowrap text-left text-xs"><thead className="bg-slate-100"><tr>{headings.map(h => <th key={h} className="px-4 py-3 font-medium">{h}</th>)}</tr></thead><tbody className="divide-y divide-slate-100">{children}</tbody></table></div> }
const cell = 'px-4 py-3 tabular-nums'

export function LoanDetail({ loan, canWrite, channels, onRecordCash, onBack, onSave, onSaveSettings }: { onSaveSettings: (settings: InitialLoanSettings) => Promise<void>; loan: BankLoan; canWrite: boolean; channels: { code: string; nameTh: string }[]; onRecordCash: (input: Omit<BankLoanCashInput, 'loanId' | 'revision'>) => Promise<void>; onBack: () => void; onSave: (loan: BankLoan, reason: string) => Promise<void> }) {
  const [tab, setTab] = useState<Tab>('cashflow')
  const [modal, setModal] = useState<Tab | null>(null)
  const [busy, setBusy] = useState(false)
  const saving = useRef(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  useFeedbackToast({ error, success: notice })
  const [requestKey, setRequestKey] = useState('')
  const [cashDirection, setCashDirection] = useState<'all' | 'IN' | 'OUT'>('all')
  const [cashSearch, setCashSearch] = useState('')
  const [receiptType, setReceiptType] = useState<'all' | 'land' | 'house' | 'unspecified'>('all')
  const total = (key: 'amount' | 'interest' | 'principal' | 'fee' | 'penalty' | 'extraPrincipal') => roundMoney(loan.payments.reduce((sum, p) => sum + (p[key] ?? 0), 0))

  async function commit(next: BankLoan, reason: string) {
    if (!canWrite || saving.current) return false
    saving.current = true; setBusy(true); setError(''); setNotice('')
    try { await onSave(next, reason); setModal(null); setNotice('บันทึกแล้ว'); return true }
    catch (e) { setError(e instanceof Error ? e.message : 'บันทึกไม่สำเร็จ'); return false }
    finally { saving.current = false; setBusy(false) }
  }
  function open(target: Tab) { setRequestKey(crypto.randomUUID()); setError(''); setModal(target) }
  async function saveSettings(settings: InitialLoanSettings) {
    if (!canWrite || saving.current) return
    saving.current = true; setBusy(true); setError(''); setNotice('')
    try { await onSaveSettings(settings); setNotice('บันทึกข้อมูลสัญญาลง database แล้ว') }
    catch (e) { setError(e instanceof Error ? e.message : 'บันทึกสัญญาไม่สำเร็จ') }
    finally { saving.current = false; setBusy(false) }
  }
  async function recordCash(input: Omit<BankLoanCashInput, 'loanId' | 'revision'>) {
    if (!canWrite || saving.current) return
    saving.current = true; setBusy(true); setError(''); setNotice('')
    try { await onRecordCash(input); setModal(null); setNotice('บันทึกรายการหนี้สินและ ledger แล้ว') }
    catch (e) { setError(e instanceof Error ? e.message : 'บันทึกไม่สำเร็จ') }
    finally { saving.current = false; setBusy(false) }
  }
  const contractorPaid = (loan.contractorPayments ?? []).reduce((sum, row) => sum + row.amount, 0)
  const received = (loan.disbursements ?? []).reduce((sum, row) => sum + row.amount, 0)
  const cashflow = [
    ...(loan.disbursements ?? []).map(row => ({ id: row.id, date: row.date, direction: 'IN' as const, amount: row.amount, type: `รับเงินกู้ธนาคาร${row.drawType === 'land' ? ' · ที่ดิน' : row.drawType === 'house' ? ' · บ้าน' : ''}${row.drawNumber ? ` · งวด ${row.drawNumber}` : ''}`, party: loan.bank, contractCode: loan.accountNumber || '—', code: `RCV-${row.ledgerEntryId ? String(row.ledgerEntryId).padStart(6, '0') : row.drawNumber ?? '—'}`, reference: row.reference, ledgerEntryId: row.ledgerEntryId, notes: row.notes ?? '' })),
    ...(loan.contractorPayments ?? []).map(row => {
      const contract = loan.contractorContracts?.find(c => c.id === row.contractId)
      const stage = contract && contractPaymentStages(contract).find(stage => stage.id === row.stageId)
      return { id: row.id, date: row.date, direction: 'OUT' as const, amount: row.amount, type: `จ่าย${contract?.kind === 'land_purchase' ? 'ค่าที่ดินงวด' : 'งวดงาน'} ${stage?.number ?? ''} · ${stage?.name ?? ''}`, party: contract?.contractor ?? '—', contractCode: contract?.code ?? '—', code: `PAY-${String(row.ledgerEntryId).padStart(6, '0')}`, reference: row.reference, ledgerEntryId: row.ledgerEntryId, notes: row.notes }
    }),
    ...loan.payments.map(row => ({ id: row.id, date: row.date, direction: 'OUT' as const, amount: row.amount, type: 'ชำระหนี้ธนาคาร (รายการเดิม)', party: loan.bank, contractCode: loan.accountNumber || '—', code: `BPM-${row.ledgerEntryId ? String(row.ledgerEntryId).padStart(6, '0') : '—'}`, reference: row.reference, ledgerEntryId: row.ledgerEntryId, notes: row.notes ?? '' })),
  ].sort((a, b) => b.date.localeCompare(a.date) || a.id.localeCompare(b.id))

  const visibleDraws = (loan.disbursements ?? []).filter(row => receiptType === 'all' || (row.drawType ?? 'unspecified') === receiptType).slice().sort((a, b) => (a.drawType === 'land' ? 0 : a.drawType === 'house' ? 1 : 2) - (b.drawType === 'land' ? 0 : b.drawType === 'house' ? 1 : 2) || (a.drawNumber ?? Infinity) - (b.drawNumber ?? Infinity) || a.date.localeCompare(b.date))
  const visibleCashflow = cashflow.filter(row => (cashDirection === 'all' || row.direction === cashDirection) && `${row.date} ${row.code} ${row.type} ${row.party} ${row.contractCode} ${row.reference} ${row.notes} TX-${String(row.ledgerEntryId ?? '').padStart(6, '0')}`.toLowerCase().includes(cashSearch.trim().toLowerCase()))

  async function submitSimple(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const value = (key: string) => String(form.get(key) ?? '').trim()
    if (modal === 'disbursements') {
      await recordCash({ requestKey, direction: 'IN', date: value('date'), amount: value('amount'), channelCode: value('channelCode'), reference: value('reference'), notes: value('notes') })
    }
    if (modal === 'documents') {
      try {
        const doc: LoanDocument = { id: crypto.randomUUID(), name: value('name'), kind: value('kind') as LoanDocument['kind'], reference: value('reference'), ...(value('paymentId') ? { paymentId: value('paymentId') } : {}) }
        const file = form.get('file') as File | null
        if (file?.size) {
          if (file.size > 1024 * 1024 || !['application/pdf', 'image/jpeg', 'image/png'].includes(file.type)) throw new Error('รองรับ PDF / JPEG / PNG ขนาดไม่เกิน 1 MB')
          doc.file = { mimeType: file.type as NonNullable<LoanDocument['file']>['mimeType'], dataUrl: await new Promise<string>((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result)); reader.onerror = () => reject(new Error('อ่านไฟล์ไม่สำเร็จ')); reader.readAsDataURL(file) }) }
        }
        await commit({ ...loan, documents: [...(loan.documents ?? []), doc] }, 'แนบเอกสารเงินกู้')
      } catch (e) { setError(e instanceof Error ? e.message : 'อ่านไฟล์ไม่สำเร็จ') }
    }
  }

  return <PageContainer>
    <Button className="mb-4" onClick={onBack} disabled={busy}><ArrowLeft size={14} aria-hidden="true" />กลับไปหนี้สิน</Button>
    <Header title={loan.name} description={`${loan.bank} · สัญญา ${loan.accountNumber || 'ยังไม่ระบุ'}`} icon={<Landmark size={21} aria-hidden="true" />} />
    <div className="mb-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4"><Summary label="เงินต้นหนี้ธนาคารคงเหลือ" value={`${money(outstanding(loan))} บาท`} /><Summary label="รับเงินจากธนาคารแล้ว" value={`${money(received)} บาท`} /><Summary label="จ่ายค่าที่ดิน / ผู้รับเหมาแล้ว" value={`${money(contractorPaid)} บาท`} /><Summary label="รับหักจ่ายตามสมุดเงินสด" value={`${money(received - contractorPaid - total('amount'))} บาท`} /></div>
    <nav aria-label="รายละเอียดเงินกู้" className="mb-5 flex flex-wrap gap-2">{tabs.filter(([key]) => key === 'cashflow' || key === 'disbursements' || key === 'contractors' || key === 'variations' || key === 'land-contracts' || key === 'contract').map(([key, label]) => <Button key={key} variant={tab === key ? 'primary' : 'secondary'} aria-current={tab === key ? 'page' : undefined} onClick={() => setTab(key)}>{label}</Button>)}</nav>
    <Card className="space-y-5 p-5">
      <div className="flex flex-wrap items-center justify-between gap-3"><h2 className="text-base font-semibold">{tab === 'cashflow' ? 'รายการรับ–จ่าย' : tabs.find(([key]) => key === tab)?.[1]}</h2>{(tab === 'cashflow' || tab === 'disbursements') && canWrite ? <Button variant="primary" disabled={busy} onClick={() => open(tab)}><Plus size={14} aria-hidden="true" />{tab === 'disbursements' ? 'เพิ่มงวดรับ' : 'เพิ่มรายการรับ–จ่าย'}</Button> : null}</div>
      {tab === 'cashflow' ? <>
        <p className="text-sm text-slate-500">สมุดรายรับ–รายจ่ายสำหรับเงินก่อสร้าง รับเงินจากธนาคาร จ่ายซื้อที่ดินและจ่ายให้ช่างตามสัญญา</p>
        <div className="grid gap-3 sm:grid-cols-2"><Summary label="รับเงินกู้สะสมที่บันทึก" value={`${money((loan.disbursements ?? []).reduce((sum, row) => sum + row.amount, 0))} บาท`} /><Summary label="จ่ายค่าที่ดินและงวดงาน" value={`${money(contractorPaid)} บาท`} /></div>
        <div className="flex flex-wrap items-end justify-between gap-3"><label className="text-xs font-medium text-slate-500">ประเภทรายการ<select className={inputClass} value={cashDirection} onChange={e => setCashDirection(e.target.value as typeof cashDirection)}><option value="all">รับและจ่ายทั้งหมด</option><option value="IN">รับเงินกู้</option><option value="OUT">รายจ่าย</option></select></label><label className="min-w-48 flex-1 text-xs font-medium text-slate-500">ค้นหารายการ<input className={inputClass} type="search" placeholder="วันที่ เลขอ้างอิง รายละเอียด หรือ TX" value={cashSearch} onChange={e => setCashSearch(e.target.value)} /></label><span className="pb-3 text-xs text-slate-500">{visibleCashflow.length} รายการ</span></div>
        <Table headings={['วันที่', 'รหัสรายการ', 'รายการ / ผู้รับ–ผู้จ่าย', 'รหัสสัญญา', 'รายรับ (บาท)', 'รายจ่าย (บาท)', 'อ้างอิง', 'Ledger']}>{visibleCashflow.map(row => <tr key={row.id}><td className={cell}>{row.date}</td><td className={`${cell} font-medium`}>{row.code}</td><td className={cell}><span>{row.type}</span><p className="mt-1 text-xs text-slate-500">{row.party}</p>{row.notes ? <p className="mt-1 max-w-60 whitespace-normal text-xs text-slate-500">{row.notes}</p> : null}</td><td className={cell}>{row.contractCode}</td><td className={`${cell} text-emerald-700`}>{row.direction === 'IN' ? money(row.amount) : '—'}</td><td className={`${cell} text-orange-800`}>{row.direction === 'OUT' ? money(row.amount) : '—'}</td><td className={cell}>{row.reference || '—'}</td><td className={cell}>{row.ledgerEntryId ? <a className="text-blue-700 underline" href={`/dashboard/ledger?q=TX-${String(row.ledgerEntryId).padStart(6, '0')}`}>TX-{String(row.ledgerEntryId).padStart(6, '0')}</a> : 'ยังไม่เชื่อม'}</td></tr>)}</Table>
        {!visibleCashflow.length ? <div className="py-8 text-center text-sm text-slate-500"><p>{cashflow.length ? 'ไม่พบรายการตามเงื่อนไขที่ค้นหา' : 'ยังไม่มีรายการรับ–จ่าย'}</p><p className="mt-2 text-xs">{cashflow.length ? 'ลองเปลี่ยนประเภทหรือคำค้นหา' : 'กดเพิ่มรายการเพื่อบันทึกรับเงินธนาคาร จ่ายซื้อที่ดิน หรือจ่ายผู้รับเหมา พร้อมลง ledger'}</p></div> : null}
      </> : null}
      {tab === 'variations' ? <VariationOrders loan={loan} canWrite={canWrite} busy={busy} onContracts={() => setTab('contractors')} onSave={(contractId, variation) => commit({ ...loan, contractorContracts: loan.contractorContracts?.map(contract => contract.id === contractId ? { ...contract, variations: contract.variations?.some(row => row.id === variation.id) ? contract.variations.map(row => row.id === variation.id ? variation : row) : [...(contract.variations ?? []), variation] } : contract) }, `บันทึกงานเพิ่ม–งานลด ${variation.code}`)} /> : null}
      {tab === 'contractors' ? <ContractorContracts loan={loan} canWrite={canWrite} busy={busy} onSave={contract => commit({ ...loan, contractorContracts: loan.contractorContracts?.some(c => c.id === contract.id) ? loan.contractorContracts.map(c => c.id === contract.id ? contract : c) : [...(loan.contractorContracts ?? []), contract] }, `บันทึกสัญญาจ้างเหมา ${contract.code}`)} /> : null}
      {tab === 'land-contracts' ? <ContractorContracts kind="land_purchase" loan={loan} canWrite={canWrite} busy={busy} onSave={contract => commit({ ...loan, contractorContracts: loan.contractorContracts?.some(c => c.id === contract.id) ? loan.contractorContracts.map(c => c.id === contract.id ? contract : c) : [...(loan.contractorContracts ?? []), contract] }, `บันทึกสัญญาซื้อที่ดิน ${contract.code}`)} /> : null}
      {tab === 'contract' ? <ContractSettingsForm key={JSON.stringify(loan.rounds[0] ?? null)} loan={loan} canWrite={canWrite} busy={busy} onSave={saveSettings} /> : null}
      {tab === 'disbursements' ? <>
        <p className="text-sm leading-6 text-slate-500">รับเงินกู้จากธนาคารเป็นรายงวด ระบุงวดที่ วันที่รับ และจำนวนเงิน แต่ละรายการบันทึกเป็นรายรับเงินกู้ใน ledger</p>
        <div className="grid gap-3 sm:grid-cols-2"><Summary label="งวดรับที่บันทึก" value={`${loan.disbursements?.length ?? 0} รายการ`} /><Summary label="รับเงินกู้สะสม" value={`${money((loan.disbursements ?? []).reduce((sum, row) => sum + row.amount, 0))} บาท`} /></div>
        <div className="grid gap-3 sm:grid-cols-2">{(['land', 'house'] as const).map(type => { const rows = (loan.disbursements ?? []).filter(row => row.drawType === type); return <Summary key={type} label={`${type === 'land' ? 'ที่ดิน' : 'บ้าน'} · รับแล้ว ${rows.length} งวด`} value={`${money(rows.reduce((sum, row) => sum + row.amount, 0))} บาท`} /> })}</div>
        <label className="block max-w-xs text-xs font-medium">ประเภทเงินรับ<select className={inputClass} value={receiptType} onChange={e => setReceiptType(e.target.value as typeof receiptType)}><option value="all">ทุกประเภท</option><option value="land">ที่ดิน</option><option value="house">บ้าน</option><option value="unspecified">รายการเดิมที่ยังไม่ระบุประเภท</option></select></label>
        <Table headings={['ประเภท', 'งวดที่', 'วันที่รับเงิน', 'จำนวนเงิน (บาท)', 'อ้างอิง / รายละเอียด', 'Ledger']}>{visibleDraws.map(row => <tr key={row.id}><td className={cell}>{row.drawType === 'land' ? 'ที่ดิน' : row.drawType === 'house' ? 'บ้าน' : 'ยังไม่ระบุ'}</td><td className={cell}>{row.drawNumber ?? '—'}</td><td className={cell}>{row.date}</td><td className={`${cell} font-medium text-emerald-700`}>{money(row.amount)}</td><td className={cell}>{row.reference || '—'}{row.notes ? <p className="mt-1 whitespace-normal text-xs text-slate-500">{row.notes}</p> : null}</td><td className={cell}>{row.ledgerEntryId ? <a className="text-blue-700 underline" href={`/dashboard/ledger?q=TX-${String(row.ledgerEntryId).padStart(6, '0')}`}>TX-{String(row.ledgerEntryId).padStart(6, '0')}</a> : 'ยังไม่เชื่อม'}</td></tr>)}</Table>
        {!visibleDraws.length ? <p className="py-8 text-center text-sm text-slate-500">ยังไม่มีงวดรับเงินในประเภทที่เลือก</p> : null}
      </> : null}
      {tab === 'schedule' ? <p className="py-8 text-center text-sm text-slate-500">ยังไม่มีตารางผ่อนชำระ</p> : null}
      {tab === 'payments' ? <>
        <p className="text-xs text-slate-500">บันทึกยอดตามสลิปธนาคาร ยอดโปะเป็นส่วนหนึ่งของเงินต้นรวม ค่าธรรมเนียมและค่าปรับไม่ลดเงินต้น</p>
        <Table headings={['วันชำระ', 'รอบสัญญา', 'ยอดจ่ายรวม', 'เงินต้นปกติ', 'ดอกเบี้ย', 'ค่าธรรมเนียม', 'ค่าปรับ', 'โปะเพิ่ม', 'อ้างอิง']}>{[...loan.payments].sort((a, b) => b.date.localeCompare(a.date)).map(p => <tr key={p.id}><td className={cell}>{p.date}</td><td className={cell}>{loan.rounds.find(r => r.id === p.roundId)?.name}</td><td className={cell}>{money(p.amount)}</td><td className={cell}>{money(p.principal - (p.extraPrincipal ?? 0))}</td><td className={cell}>{money(p.interest)}</td><td className={cell}>{money(p.fee ?? 0)}</td><td className={cell}>{money(p.penalty ?? 0)}</td><td className={cell}>{money(p.extraPrincipal ?? 0)}</td><td className={cell}>{p.reference || '—'}</td></tr>)}</Table>
        {!loan.payments.length ? <p className="text-sm text-slate-500">ยังไม่มีรายการชำระจริง</p> : null}
      </> : null}
      {tab === 'balance' ? <>
        <div className="grid gap-3 sm:grid-cols-2"><Summary label="เงินต้นชำระแล้วทุกรอบ (รวมโปะ)" value={`${money(total('principal'))} บาท`} /><Summary label="ค่าธรรมเนียม / ค่าปรับจ่ายจริง" value={`${money(total('fee') + total('penalty'))} บาท`} /></div>
        <Table headings={['รอบ', 'วงเงิน / ยอดยกมา', 'เงินต้นที่ชำระ', 'คงเหลือตามข้อมูล']} >{loan.rounds.map(r => <tr key={r.id}><td className={cell}>{r.name}</td><td className={cell}>{money(r === loan.rounds[0] && loan.disbursements !== undefined ? loan.disbursements.reduce((sum, d) => sum + d.amount, 0) : r.opening)}</td><td className={cell}>{money(loan.payments.filter(p => p.roundId === r.id).reduce((sum, p) => sum + p.principal, 0))}</td><td className={cell}>{money(balance(loan, r))}</td></tr>)}</Table>
        <p className="text-xs text-slate-500">ยอดปัจจุบันใช้รอบสัญญาที่มีผล ณ {today()} หักเฉพาะเงินต้นที่ชำระจริง ไม่หักจากตารางประมาณการ</p>
      </> : null}
      {tab === 'documents' ? <>
        <p className="text-xs text-slate-500">แนบไฟล์ PDF / JPEG / PNG ไม่เกิน 1 MB ต่อไฟล์ หรือบันทึกเลขที่เอกสาร / ที่จัดเก็บ และเชื่อมกับรายการชำระได้</p>
        <ul className="space-y-3">{loan.documents?.map(doc => <li key={doc.id} className="rounded-xl border border-slate-200 p-4"><strong className="text-sm">{doc.name}</strong><p className="my-1 text-xs text-slate-500">{doc.kind === 'contract' ? 'สัญญา' : doc.kind === 'slip' ? 'สลิป' : 'อื่น ๆ'} · {doc.reference || 'ไฟล์แนบ'}{doc.paymentId ? ` · ชำระ ${loan.payments.find(p => p.id === doc.paymentId)?.date}` : ''}</p>{doc.file ? <a className="text-xs text-blue-700 underline" download={doc.name} href={doc.file.dataUrl}>ดาวน์โหลดไฟล์</a> : null}</li>)}</ul>
        {!loan.documents?.length ? <p className="text-sm text-slate-500">ยังไม่มีเอกสารแนบ</p> : null}
      </> : null}
    </Card>
    <Modal open={modal !== null} title={modal === 'disbursements' ? 'เพิ่มงวดรับเงินจากธนาคาร' : modal === 'cashflow' ? 'เพิ่มรายการรับ–จ่าย' : modal === 'payments' ? 'จ่ายชำระค่างวดธนาคาร' : modal === 'documents' ? 'แนบเอกสาร / สลิป' : 'รับเงินกู้จากธนาคาร'} onClose={() => { if (!busy) setModal(null) }}>
      {error ? <p role="alert" className="mb-4 text-sm text-red-700">{error}</p> : null}
      {modal === 'cashflow' || modal === 'disbursements' ? <BankCashForm key={requestKey} initialDirection={modal === 'disbursements' ? 'IN' : 'OUT'} fixedDirection={modal === 'disbursements'} loan={loan} channels={channels} requestKey={requestKey} busy={busy} onSave={recordCash} onContract={() => { setModal(null); setTab('contract') }} onContractor={() => { setModal(null); setTab('contractors') }} onLand={() => { setModal(null); setTab('land-contracts') }} /> : null}
      {modal === 'payments' ? <PaymentForm loan={loan} channels={channels} busy={busy} onSave={(payment, channelCode) => recordCash({ requestKey, direction: 'OUT', date: payment.date, amount: payment.amount.toFixed(2), channelCode, reference: payment.reference, notes: '', payment: { roundId: payment.roundId, principal: payment.principal, interest: payment.interest, fee: payment.fee, penalty: payment.penalty, extraPrincipal: payment.extraPrincipal } })} /> : null}
      {modal === 'documents' ? <form onSubmit={submitSimple} className="space-y-4"><fieldset disabled={busy} className="space-y-4"><Field label="ชื่อเอกสาร"><input className={inputClass} name="name" maxLength={240} required /></Field><Field label="ประเภท"><select name="kind" className={inputClass}><option value="contract">สัญญาเงินกู้</option><option value="slip">สลิปชำระ</option><option value="other">อื่น ๆ</option></select></Field><Field label="เชื่อมรายการชำระ"><select name="paymentId" className={inputClass}><option value="">ไม่เชื่อม</option>{loan.payments.map(p => <option key={p.id} value={p.id}>{p.date} · {money(p.amount)}</option>)}</select></Field><Field label="ไฟล์แนบ"><input className={inputClass} name="file" type="file" accept="application/pdf,image/jpeg,image/png" /></Field><Field label="เลขอ้างอิง"><input className={inputClass} name="reference" maxLength={150} /></Field><Button type="submit" variant="primary">บันทึก</Button></fieldset></form> : null}
    </Modal>
  </PageContainer>
}

function PaymentForm({ loan, channels, busy, onSave }: { loan: BankLoan; channels: { code: string; nameTh: string }[]; busy: boolean; onSave: (payment: Payment, channelCode: string) => Promise<void> }) {
  const [parts, setParts] = useState({ principal: 0, interest: 0, fee: 0, penalty: 0, extraPrincipal: 0 })
  const amount = roundMoney(Object.values(parts).reduce((sum, value) => sum + value, 0))
  async function submit(event: FormEvent<HTMLFormElement>) { event.preventDefault(); const f = new FormData(event.currentTarget); await onSave({ id: crypto.randomUUID(), date: String(f.get('date')), roundId: String(f.get('roundId')), reference: String(f.get('reference') ?? '').trim(), ...parts, principal: roundMoney(parts.principal + parts.extraPrincipal), amount }, String(f.get('channelCode') ?? '')) }
  return <form onSubmit={submit}><fieldset disabled={busy} className="space-y-4"><ChannelField channels={channels} /><Field label="รอบสัญญา"><select className={inputClass} name="roundId" defaultValue={activeRound(loan)?.id}>{loan.rounds.filter(r => r.effectiveOn && r.effectiveOn <= today()).map(r => <option key={r.id} value={r.id}>{r.name}</option>)}</select></Field><Field label="วันที่ชำระจริง"><input className={inputClass} name="date" type="date" defaultValue={today()} max={today()} required /></Field><div className="grid gap-4 sm:grid-cols-2">{([['principal', 'เงินต้นปกติ'], ['interest', 'ดอกเบี้ยตามสลิป'], ['fee', 'ค่าธรรมเนียม'], ['penalty', 'ค่าปรับ'], ['extraPrincipal', 'โปะเงินต้นเพิ่มเติม']] as const).map(([key, label]) => <Field key={key} label={`${label} (บาท)`}><input className={inputClass} type="number" min="0" max={1e12} step="0.01" value={parts[key]} onChange={e => setParts(p => ({ ...p, [key]: Number(e.target.value) }))} required /></Field>)}</div><p className="text-sm font-semibold">ยอดจ่ายรวม {money(amount)} บาท</p><Field label="เลขอ้างอิงสลิป"><input className={inputClass} name="reference" maxLength={150} /></Field><p className="text-xs text-slate-500">บันทึกยอดจ่ายรวมลง ledger พร้อมเชื่อมกับรายการชำระหนี้สิน แนบสลิปในแท็บเอกสารหลังบันทึกได้</p><Button type="submit" variant="primary" disabled={amount <= 0}>{busy ? 'กำลังบันทึก…' : 'บันทึกชำระจริง'}</Button></fieldset></form>
}

function ChannelField({ channels }: { channels: { code: string; nameTh: string }[] }) {
  return <Field label="ช่องทางรับ–จ่าย"><select className={inputClass} name="channelCode" defaultValue={channels.some(row => row.code === 'BANKING') ? 'BANKING' : ''} required><option value="" disabled>เลือกช่องทาง</option>{channels.map(row => <option key={row.code} value={row.code}>{row.nameTh}</option>)}</select></Field>
}
