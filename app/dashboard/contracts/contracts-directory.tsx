'use client'

import { DataLoading } from '@/components/ui/data-loading'
import { useEffect, useState, type FormEvent } from 'react'
import Link from 'next/link'
import { ClipboardCopy, FileSignature, Plus, Search } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { CreateContractModal } from './create-contract-modal'
import { createLoanDocumentForExistingContract, listContracts, markPrintedContractSigned } from './actions'
import { contractCode, contractSignaturesComplete, formatContractDate } from '@/lib/contracts'
import { lenderCode } from '@/lib/lender'
import { bangkokToday } from '@/lib/ledger'
import { Modal } from '@/components/ui/modal'
import { LoanAgreementTemplate } from './loan-agreement-template'
import { ContractSignatureModal } from './contract-signature-modal'
import { GuaranteeAgreementTemplate } from './guarantee-agreement-template'
import { CollateralAgreementTemplate } from './collateral-agreement-template'
import { LegacyLoanImportModal } from './legacy-loan-import-modal'
import { ContractExportButton } from './contract-export-button'
import { useToast } from '@/components/ui/toast'

const fieldClass = 'w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none'

export function ContractsDirectory() {
  const [rows, setRows] = useState<Awaited<ReturnType<typeof listContracts>>>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [notice, setNotice] = useState('')
  const { toast } = useToast()
  const [page, setPage] = useState(1)
  const [viewing, setViewing] = useState<Awaited<ReturnType<typeof listContracts>>[number] | null>(null)
  const [signing, setSigning] = useState<Awaited<ReturnType<typeof listContracts>>[number] | null>(null)
  const [documentDraft, setDocumentDraft] = useState<Awaited<ReturnType<typeof listContracts>>[number] | null>(null)
  const [documentDraftUrl, setDocumentDraftUrl] = useState('')
  const [documentPreviewLoading, setDocumentPreviewLoading] = useState(false)
  const [documentActionPending, setDocumentActionPending] = useState(false)
  const [documentActionError, setDocumentActionError] = useState('')
  const [printedSigning, setPrintedSigning] = useState<Awaited<ReturnType<typeof listContracts>>[number] | null>(null)
  const [legacyImporting, setLegacyImporting] = useState(false)
  useEffect(() => {
    let cancelled = false
    listContracts().then(values => { if (!cancelled) setRows(values) })
      .catch(() => { if (!cancelled) setLoadError('โหลดรายการสัญญาไม่สำเร็จ') })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [])
  useEffect(() => () => { if (documentDraftUrl) URL.revokeObjectURL(documentDraftUrl) }, [documentDraftUrl])
  async function saved(code: string, contractId: number, signingMethod: string | null, limitApprovalRequired: boolean, pdfSaved: boolean | null) {
    setCreating(false)
    const pdfNotice = pdfSaved === null ? '' : pdfSaved ? ' · บันทึก PDF ใน DOC แล้ว' : ' · บันทึกสัญญาแล้ว แต่บันทึก PDF ไม่สำเร็จ'
    setNotice(`บันทึกสัญญา ${code} สำเร็จ · ${limitApprovalRequired ? 'รออนุมัติวงเงินก่อนจ่ายเงินจริง' : 'รอจ่ายเงิน'}${pdfNotice}`)
    setQuery(''); setAppliedQuery(''); setStatus(''); setPage(1)
    try {
      const values = await listContracts()
      setRows(values)
      setLoadError('')
      toast({ title: 'บันทึกสัญญาเรียบร้อยแล้ว', description: `สัญญา ${code} · ${limitApprovalRequired ? 'รออนุมัติวงเงินก่อนจ่ายเงินจริง' : 'รอจ่ายเงินจริง'}${pdfNotice}`, variant: pdfSaved === false ? 'warning' : 'success' })
      if (signingMethod === 'E_SIGNATURE') setSigning(values.find(row => row.id === contractId) ?? null)
    }
    catch {
      setLoadError('บันทึกแล้ว แต่โหลดรายการไม่สำเร็จ กรุณารีเฟรชหน้าเว็บ')
      toast({ title: 'บันทึกสัญญาเรียบร้อยแล้ว', description: `สัญญา ${code} ${limitApprovalRequired ? 'รออนุมัติวงเงินก่อนจ่ายเงินจริง' : 'รอจ่ายเงินจริง'} แต่โหลดรายการกลับมาไม่สำเร็จ${pdfNotice}`, variant: pdfSaved === false ? 'warning' : 'success' })
    }
  }
  async function importedLegacy(count: number) {
    setLegacyImporting(false)
    setNotice(`นำเข้ารายการเก่า/จอง ${count} รายการสำเร็จ · รายการจองรอจ่ายเงินจริงและยังไม่มีรายการจ่ายในบัญชี`)
    setQuery(''); setAppliedQuery(''); setStatus(''); setPage(1)
    try {
      setRows(await listContracts()); setLoadError('')
      toast({ title: 'นำเข้ารายการเรียบร้อยแล้ว', description: `${count} รายการ · รายการจองยังรอจ่ายเงินจริง`, variant: 'success' })
    }
    catch {
      setLoadError('นำเข้าแล้ว แต่โหลดรายการไม่สำเร็จ กรุณารีเฟรชหน้าเว็บ')
      toast({ title: 'นำเข้ารายการเรียบร้อยแล้ว', description: `${count} รายการ แต่โหลดรายการกลับมาไม่สำเร็จ`, variant: 'success' })
    }
  }
  const money = (value: number) => new Intl.NumberFormat('th-TH', { minimumFractionDigits: 2 }).format(value / 100)
  const copyAmount = (value: number) => (value / 100).toFixed(2).replace(/\.00$/, '').replace(/(\.\d)0$/, '$1')
  const date = (value: string) => new Intl.DateTimeFormat('th-TH', { timeZone: 'Asia/Bangkok', dateStyle: 'short' }).format(new Date(value))
  const copyInterestRate = (row: Awaited<ReturnType<typeof listContracts>>[number]) => {
    const rate = row.internalInterestPercent ?? (row.principalSatang > 0 && row.interestSatang > 0 ? row.interestSatang / row.principalSatang * 100 : null)
    return rate === null ? '—' : `${Number(rate.toFixed(2))}%`
  }
  async function copyContractMessage(row: Awaited<ReturnType<typeof listContracts>>[number]) {
    const message = [
      contractCode(row.id),
      money(row.principalSatang),
      copyInterestRate(row),
      copyAmount(row.interestSatang),
      row.paidAt ? date(row.paidAt) : row.scheduledDisbursementDate ? date(row.scheduledDisbursementDate) : '—',
      row.repaymentDueDate ? date(row.repaymentDueDate) : '—',
      copyAmount(row.netSatang),
    ].join(' ')
    try {
      await navigator.clipboard.writeText(message)
      toast({ title: 'คัดลอกข้อความสัญญาแล้ว', description: `${contractCode(row.id)} · พร้อมนำไปส่งข้อความ`, variant: 'success' })
    } catch {
      toast({ title: 'คัดลอกไม่สำเร็จ', description: 'เบราว์เซอร์ไม่อนุญาตให้เข้าถึงคลิปบอร์ด', variant: 'error' })
    }
  }
  const legacyStatus = (row: Awaited<ReturnType<typeof listContracts>>[number]) => {
    try { return (JSON.parse(row.legacyDetails ?? '{}') as { sourceStatus?: string }).sourceStatus ?? '' } catch { return '' }
  }
  const legacyBorrowerName = (row: Awaited<ReturnType<typeof listContracts>>[number]) => {
    try { return (JSON.parse(row.legacyDetails ?? '{}') as { sourceBorrowerName?: string }).sourceBorrowerName ?? '' } catch { return '' }
  }
  const legacyStatusLabel = (row: Awaited<ReturnType<typeof listContracts>>[number]) => {
    const sourceStatus = legacyStatus(row)
    if (sourceStatus === 'จองสัญญา' && row.status === 'WAITING_PAYMENT') return 'รอจ่ายเงินจริง'
    if (['เกินกำหนด', 'เกินกำหนดชำระ'].includes(sourceStatus)) return 'เกินกำหนดชำระ'
    if (['รอส่งคืน', 'รอชำระคืน', 'รอรับชำระคืน'].includes(sourceStatus)) return 'รอรับชำระคืน'
    if (sourceStatus === 'ปิดยอด') return 'ปิดยอดแล้ว'
    return sourceStatus || 'รายการย้อนหลัง'
  }
  const contractStatus = (row: Awaited<ReturnType<typeof listContracts>>[number]) => {
    if (row.status === 'REJECTED') return { label: 'ไม่อนุมัติ', tone: 'rose', style: 'border-rose-200 bg-rose-50 text-rose-800' }
    if (row.limitApprovalRequired) return { label: 'รออนุมัติวงเงิน', tone: 'violet', style: 'border-violet-200 bg-violet-50 text-violet-800' }
    if (row.status === 'WAITING_PAYMENT') return { label: row.legacySourceCode && legacyStatus(row) === 'จองสัญญา' ? 'จองสัญญา · รอจ่ายเงินจริง' : 'รอจ่ายเงิน', tone: 'amber', style: 'border-amber-200 bg-amber-50 text-amber-800' }
    if (row.status === 'CLOSED' || row.legacySourceCode && legacyStatus(row) === 'ปิดยอด') return { label: 'ปิดยอดแล้ว', tone: 'emerald', style: 'border-emerald-200 bg-emerald-50 text-emerald-800' }
    if (row.legacySourceCode && ['เกินกำหนด', 'เกินกำหนดชำระ'].includes(legacyStatus(row))) return { label: 'เกินกำหนดชำระ', tone: 'rose', style: 'border-rose-200 bg-rose-50 text-rose-800' }
    if (row.repaymentDueDate && row.repaymentDueDate < bangkokToday()) return { label: 'เกินกำหนดชำระ', tone: 'rose', style: 'border-rose-200 bg-rose-50 text-rose-800' }
    if (row.repaymentDueDate === bangkokToday()) return { label: 'ครบกำหนดวันนี้', tone: 'orange', style: 'border-orange-200 bg-orange-50 text-orange-800' }
    if (row.legacySourceCode && ['รอส่งคืน', 'รอชำระคืน', 'รอรับชำระคืน'].includes(legacyStatus(row))) return { label: 'รอรับชำระคืน', tone: 'sky', style: 'border-sky-200 bg-sky-50 text-sky-800' }
    return { label: row.legacySourceCode ? legacyStatusLabel(row) : 'รอรับชำระคืน', tone: 'sky', style: 'border-sky-200 bg-sky-50 text-sky-800' }
  }
  const signingLabel = (row: Awaited<ReturnType<typeof listContracts>>[number]) => {
    if (row.documentChoice !== 'CREATE') return row.legacySourceCode ? 'รายการย้อนหลัง · ไม่มีเอกสาร' : 'ไม่ทำสัญญา'
    if (row.signingMethod === 'PRINT') return row.printSignedAt ? `พิมพ์เซ็น · ลงนามแล้ว ${date(row.printSignedAt)}` : 'พิมพ์เซ็น · รอลงนาม'
    if (row.signingMethod !== 'E_SIGNATURE') return 'ทำสัญญ'
    return contractSignaturesComplete(row) ? 'ทำสัญญา · ลงนามครบ' : 'ทำสัญญา · รอลงนาม'
  }
  const signingCell = (row: Awaited<ReturnType<typeof listContracts>>[number]) => <div className="flex min-w-36 flex-col items-start gap-2">
    <span>{signingLabel(row)}</span>
    {row.documentChoice === 'CREATE' && (row.signingMethod !== 'E_SIGNATURE' || contractSignaturesComplete(row)) && <a href={`/api/contracts/${row.id}/document`} target="_blank" rel="noopener noreferrer" className="action-button action-button--secondary">ดู/พิมพ์</a>}
    {row.documentChoice === 'CREATE' && row.signingMethod === 'E_SIGNATURE' && !contractSignaturesComplete(row) && <Button onClick={() => setSigning(row)}>ลงนาม</Button>}
    {row.documentChoice === 'NONE' && !['CLOSED', 'REJECTED'].includes(row.status) && <Button onClick={() => void beginExistingDocument(row)}>สร้างสัญญา</Button>}
    {row.documentChoice === 'CREATE' && row.signingMethod === 'PRINT' && !row.printSignedAt && <Button onClick={() => { setPrintedSigning(row); setDocumentActionError('') }}>บันทึกว่าลงนามแล้ว</Button>}
  </div>
  const [creating, setCreating] = useState(false)
  const [query, setQuery] = useState('')
  const [appliedQuery, setAppliedQuery] = useState('')
  const [status, setStatus] = useState('')
  const filtered = Boolean(appliedQuery || status)

  const matches = rows.filter(row => (!status || row.status === status) && (!appliedQuery || [contractCode(row.id), row.legacySourceCode ?? '', row.borrowerCode, row.borrowerName, legacyBorrowerName(row), lenderCode(row.lenderId), row.lenderName].some(value => value.toLowerCase().includes(appliedQuery.toLowerCase()))))
  const pages = Math.max(1, Math.ceil(matches.length / 25))
  const currentPage = Math.min(page, pages)
  const visibleRows = matches.slice((currentPage - 1) * 25, currentPage * 25)

  function search(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setAppliedQuery(query.trim()); setPage(1)
  }

  async function beginExistingDocument(row: Awaited<ReturnType<typeof listContracts>>[number]) {
    setDocumentDraft(row); setDocumentDraftUrl(''); setDocumentActionError(''); setDocumentPreviewLoading(true)
    try {
      const response = await fetch(`/api/contracts/${row.id}/document?preview=1`)
      if (!response.ok) {
        const result = await response.json().catch(() => null) as { message?: string } | null
        throw new Error(result?.message || 'โหลดตัวอย่างเอกสารไม่สำเร็จ')
      }
      setDocumentDraftUrl(URL.createObjectURL(await response.blob()))
    } catch (error) {
      setDocumentActionError(error instanceof Error ? error.message : 'โหลดตัวอย่างเอกสารไม่สำเร็จ')
    } finally { setDocumentPreviewLoading(false) }
  }

  async function confirmExistingDocument() {
    if (!documentDraft || documentActionPending || !documentDraftUrl) return
    setDocumentActionPending(true); setDocumentActionError('')
    try {
      const result = await createLoanDocumentForExistingContract(documentDraft.id)
      if (result.error) throw new Error(result.error)
      setRows(await listContracts())
      toast({ title: 'สร้างเอกสารสัญญาแล้ว', description: `${contractCode(documentDraft.id)} · สถานะรอลงนาม${result.pdfSaved ? ' · บันทึก PDF ใน DOC แล้ว' : ' · สร้างเอกสารแล้ว แต่บันทึก PDF ไม่สำเร็จ'}`, variant: result.pdfSaved ? 'success' : 'warning' })
      setDocumentDraft(null); setDocumentDraftUrl('')
    } catch (error) {
      setDocumentActionError(error instanceof Error ? error.message : 'สร้างเอกสารไม่สำเร็จ')
    } finally { setDocumentActionPending(false) }
  }

  async function confirmPrintedSigning() {
    if (!printedSigning || documentActionPending) return
    setDocumentActionPending(true); setDocumentActionError('')
    try {
      const result = await markPrintedContractSigned(printedSigning.id)
      if (result.error) throw new Error(result.error)
      setRows(await listContracts())
      toast({ title: 'บันทึกการลงนามแล้ว', description: `${contractCode(printedSigning.id)} · บันทึกวันที่และผู้ดำเนินการแล้ว`, variant: 'success' })
      setPrintedSigning(null)
    } catch (error) {
      setDocumentActionError(error instanceof Error ? error.message : 'บันทึกการลงนามไม่สำเร็จ')
    } finally { setDocumentActionPending(false) }
  }

  return <div className="borrower-workspace space-y-6">
    {creating && <CreateContractModal onClose={() => setCreating(false)} onSaved={saved} />}
    {legacyImporting && <Modal open title="นำเข้ารายการกู้ย้อนหลัง (ไม่มีเอกสาร)" className="max-w-6xl" onClose={() => setLegacyImporting(false)}><LegacyLoanImportModal onClose={() => setLegacyImporting(false)} onImported={count => void importedLegacy(count)} /></Modal>}
    {signing && <ContractSignatureModal contract={signing} onClose={() => setSigning(null)} onSigned={async () => {
      const values = await listContracts()
      setRows(values)
      setSigning(values.find(row => row.id === signing.id) ?? null)
    }} />}
    <Modal open={Boolean(documentDraft)} title={documentDraft ? `ตรวจร่างสัญญา ${contractCode(documentDraft.id)}` : 'ตรวจร่างสัญญา'} description="ตรวจ PDF ก่อนเพิ่มเอกสารให้รายการเดิม · ยังไม่เปลี่ยนข้อมูลสัญญาจนกว่าจะยืนยัน" onClose={() => { if (!documentActionPending) { setDocumentDraft(null); setDocumentDraftUrl(''); setDocumentActionError('') } }} className="!h-[calc(100dvh-2rem)] !max-w-6xl">
      {documentDraft && <div className="flex h-[calc(100%-5rem)] min-h-0 flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm"><span className="font-medium text-amber-950">สร้างเฉพาะหนังสือสัญญาเงินกู้ 3.1 จากข้อมูลรายการนี้</span><span className="text-amber-900">ยังไม่มีลายมือชื่อ</span></div>
        {documentPreviewLoading ? <div className="min-h-0 flex-1 overflow-auto"><DataLoading variant="document" label="กำลังสร้าง PDF ตัวอย่าง…" /></div> : documentDraftUrl ? <iframe src={`${documentDraftUrl}#view=FitH`} title="ตัวอย่างสัญญาเงินกู้ก่อนเพิ่มเอกสาร" className="min-h-0 flex-1 rounded-xl border border-slate-200 bg-white" /> : <div role="alert" className="grid min-h-0 flex-1 place-items-center text-sm text-red-700">{documentActionError || 'ยังแสดงตัวอย่างไม่ได้'}</div>}
        {documentActionError && !documentPreviewLoading && documentDraftUrl && <p role="alert" className="mb-0 text-sm text-red-700">{documentActionError}</p>}
        <div className="flex flex-wrap justify-between gap-2"><div className="flex gap-2">{documentDraftUrl && <a href={documentDraftUrl} download={`${contractCode(documentDraft.id)}-ร่างตรวจทาน.pdf`} className="action-button action-button--secondary">ดาวน์โหลดร่างตรวจทาน</a>}</div><div className="flex gap-2"><Button onClick={() => { setDocumentDraft(null); setDocumentDraftUrl(''); setDocumentActionError('') }} disabled={documentActionPending}>ยกเลิก</Button><Button variant="primary" onClick={() => void confirmExistingDocument()} disabled={!documentDraftUrl || documentPreviewLoading || documentActionPending}>{documentActionPending ? 'กำลังบันทึก…' : 'ยืนยันสร้างเอกสาร'}</Button></div></div>
      </div>}
    </Modal>
    <Modal open={Boolean(printedSigning)} title="บันทึกการลงนามบนเอกสารกระดาษ" description={printedSigning ? `สัญญา ${contractCode(printedSigning.id)}` : undefined} onClose={() => { if (!documentActionPending) { setPrintedSigning(null); setDocumentActionError('') } }}>
      {printedSigning && <div className="space-y-4 text-sm"><p className="mb-0 rounded-xl border border-amber-200 bg-amber-50 p-3 text-amber-950">ยืนยันเมื่อคู่สัญญาลงนามบนเอกสารจริงแล้ว ระบบจะบันทึกวันที่และผู้บันทึก การทำรายการนี้ไม่ได้แนบไฟล์สแกนโดยอัตโนมัติ</p>{documentActionError && <p role="alert" className="mb-0 text-red-700">{documentActionError}</p>}<div className="flex justify-end gap-2"><Button onClick={() => { setPrintedSigning(null); setDocumentActionError('') }} disabled={documentActionPending}>กลับ</Button><Button variant="primary" onClick={() => void confirmPrintedSigning()} disabled={documentActionPending}>{documentActionPending ? 'กำลังบันทึก…' : 'ยืนยันว่าลงนามแล้ว'}</Button></div></div>}
    </Modal>
    {notice && <p role="status" className="text-sm text-emerald-800">{notice}</p>}
    {loadError && <p role="alert" className="text-sm text-red-700">{loadError}</p>}
    {loading && <DataLoading compact label="กำลังโหลดสัญญา…" />}
    <div className="borrower-metrics contracts-metrics">
      {[
        ['สัญญาทั้งหมด', 'สัญญาที่บันทึกในระบบ', rows.length],
        ['รอจ่ายเงิน', 'สร้างสัญญาแล้ว รอเบิกจ่ายเงิน', rows.filter(row => row.status === 'WAITING_PAYMENT').length],
        ['จ่ายเงินแล้ว', 'เบิกจ่ายแล้วและยังมียอดคงเหลือ', rows.filter(row => row.status === 'PAID').length],
        ['ปิดยอดแล้ว', 'ชำระครบหรือยอดคงเหลือเป็นศูนย์', rows.filter(row => row.status === 'CLOSED').length],
      ].map(([title, description, count]) => <Card key={String(title)} className="borrower-metric">
        <div className="borrower-metric-top"><span>{title}</span><FileSignature size={20} aria-hidden="true" /></div>
        <div className="borrower-metric-value">{count}<span>สัญญา</span></div>
        <p className="mt-2 text-xs text-slate-400">{description}</p>
      </Card>)}
    </div>
    <Card className="overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-4 p-5">
        <div className="borrower-directory-heading"><h2>ทะเบียนสัญญา</h2><span className="borrower-count">{rows.length} สัญญา</span></div>
        <div className="flex flex-wrap gap-2"><Link href="/dashboard/persuaders/shares" className="action-button action-button--secondary">ส่วนแบ่ง Persuader</Link><ContractExportButton rows={rows} /><Button onClick={() => setLegacyImporting(true)}>นำเข้ารายการเก่า</Button><Button variant="primary" onClick={() => setCreating(true)}><Plus size={16} aria-hidden="true" />เพิ่มสัญญา</Button></div>
      </div>
      <div className="borrower-toolbar flex flex-wrap gap-3 p-4">
        <form onSubmit={search} className="flex min-w-0 flex-1 basis-72 gap-2">
          <label className="relative min-w-0 flex-1"><span className="sr-only">ค้นหาสัญญา</span><Search size={16} aria-hidden="true" className="absolute left-3 top-3.5" />
            <input className={`${fieldClass} !pl-10`} value={query} maxLength={100} onChange={event => setQuery(event.target.value)} placeholder="ค้นหาเลขสัญญา รหัสผู้กู้ หรือรหัสผู้ให้กู้" />
          </label>
          <Button type="submit">ค้นหา</Button>
        </form>
        <label><span className="sr-only">กรองสถานะสัญญา</span><select className={fieldClass} value={status} onChange={event => { setStatus(event.target.value); setPage(1) }}>
          <option value="">ทุกสถานะ</option><option value="WAITING_PAYMENT">รอจ่ายเงิน</option><option value="PAID">จ่ายเงินแล้ว</option><option value="CLOSED">ปิดยอดแล้ว</option><option value="REJECTED">ไม่อนุมัติ</option>
        </select></label>
      </div>
      <div className="borrower-table-scroll overflow-x-auto">
        <table className="w-full whitespace-nowrap text-left text-xs">
          <caption className="sr-only">รายการสัญญาสินเชื่อ</caption>
          <thead><tr>{['จัดการ', 'เลขสัญญา', 'วันที่ทำสัญญา', 'รหัสผู้กู้', 'ชื่อผู้กู้', 'รหัสผู้ให้กู้', 'วงเงินสัญญา', 'สถานะ', 'สัญญาและการลงนาม', 'วันที่จ่ายเงิน', 'วันที่ปิดยอด'].map(label => <th scope="col" key={label} className="px-4 py-4 font-medium">{label}</th>)}</tr></thead>
          <tbody>{visibleRows.map(row => <tr key={row.id} data-contract-status={contractStatus(row).tone}>
            <td className="border-b px-4 py-3"><div className="flex flex-wrap items-center gap-2"><Button onClick={() => setViewing(row)}>ดูสัญญา</Button><Button aria-label={`คัดลอกข้อความสัญญา ${contractCode(row.id)}`} title="คัดลอกข้อความสัญญาเพื่อส่งต่อ" onClick={() => void copyContractMessage(row)}><ClipboardCopy size={17} aria-hidden="true" /></Button></div></td>
            {[<span key="code">{contractCode(row.id)}{row.legacySourceCode && <span className="mt-1 block text-[10px] text-slate-500">เลขเดิม {row.legacySourceCode}</span>}</span>, date(row.documentCreatedAt ?? (row.legacySourceCode && row.scheduledDisbursementDate ? row.scheduledDisbursementDate : row.createdAt)), row.borrowerCode, <span key="borrower">{row.borrowerName}{row.legacySourceCode && legacyBorrowerName(row) && <span className="mt-1 block text-[10px] text-slate-500">ชื่อเดิม {legacyBorrowerName(row)}</span>}</span>, lenderCode(row.lenderId), money(row.principalSatang), <span key="status" className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-semibold leading-5 ${contractStatus(row).style}`}>{contractStatus(row).label}</span>, signingCell(row), row.paidAt ? date(row.paidAt) : '—', row.closedDate ? date(row.closedDate) : '—'].map((value, index) => <td key={index} className="border-b px-4 py-4">{value}</td>)}
          </tr>)}{!matches.length && !loading && !loadError && <tr><td colSpan={11} className="!p-0">
            <div className="borrower-empty" role="status">
              <span className="borrower-empty-icon"><FileSignature size={30} aria-hidden="true" /></span>
              <h3>{filtered ? 'ไม่พบสัญญาที่ค้นหา' : 'ยังไม่มีสัญญาสินเชื่อ'}</h3>
              <p>{filtered ? 'ลองเปลี่ยนคำค้นหาหรือสถานะสัญญา' : 'เริ่มสร้างสัญญาโดยค้นหาผู้กู้ แล้วกรอกรายละเอียดสินเชื่อ'}</p>
              {filtered ? <Button onClick={() => { setQuery(''); setAppliedQuery(''); setStatus('') }}>ล้างตัวกรอง</Button> : <Button variant="primary" onClick={() => setCreating(true)}><Plus size={15} aria-hidden="true" />เพิ่มสัญญาแรก</Button>}
            </div>
          </td></tr>}</tbody>
        </table>
      </div>
      <div className="borrower-pagination flex flex-wrap items-center justify-between gap-3 border-t p-4 text-xs">
        <span>พบ {matches.length} รายการ · หน้า {currentPage} / {pages}</span><div className="flex gap-2"><Button disabled={currentPage <= 1} onClick={() => setPage(currentPage - 1)}>ก่อนหน้า</Button><Button disabled={currentPage >= pages} onClick={() => setPage(currentPage + 1)}>ถัดไป</Button></div>
      </div>
    </Card>
    <Modal open={Boolean(viewing)} title={viewing ? `สัญญา ${contractCode(viewing.id)}` : 'สัญญา'} onClose={() => setViewing(null)}>
      {viewing && <div className="mb-5 flex justify-end"><Button onClick={() => void copyContractMessage(viewing)}><ClipboardCopy size={15} aria-hidden="true" />คัดลอกข้อความส่งต่อ</Button></div>}
      {viewing && <dl className="grid gap-4 text-sm sm:grid-cols-2">{[
        ...(viewing.legacySourceCode ? [['เลขรายการเดิม', viewing.legacySourceCode], ['ชื่อผู้กู้ในรายการเดิม', legacyBorrowerName(viewing) || '—'], ['สถานะเดิม', legacyStatus(viewing) || '—'], ['ยอดชำระก่อนนำเข้า', `${money(viewing.legacyReceivedSatang)} บาท`], ['ยอดคงเหลือตามข้อมูลเดิม', `${money(Math.max(0, viewing.repaymentSatang - viewing.legacyReceivedSatang))} บาท`]] : []),
        ['ผู้กู้', viewing.borrowerName], ['ผู้ให้กู้', viewing.lenderName],
        ...(viewing.persuaderId && viewing.persuaderNameSnapshot ? [['Persuader (ข้อมูลภายใน)', viewing.persuaderNameSnapshot], ['ส่วนแบ่งตามเงื่อนไข', `${(viewing.persuaderShareBasisPoints ?? 0) / 100}% ของเงินต้น · ${money(viewing.persuaderShareSatang ?? 0)} บาท`], ['ฐานส่วนแบ่ง', viewing.persuaderShareBase === 'PRINCIPAL' ? 'เงินต้น' : '—']] : []),
        ['สถานะ', viewing.status === 'REJECTED' ? 'ไม่อนุมัติ' : viewing.limitApprovalRequired ? 'รออนุมัติวงเงิน' : viewing.status === 'WAITING_PAYMENT' ? 'รอจ่ายเงิน' : viewing.status === 'CLOSED' ? 'ปิดยอดแล้ว' : 'จ่ายเงินแล้ว'],
        ...(viewing.limitApprovedAt ? [['อนุมัติวงเงินโดย', `${viewing.limitApprovedBy ?? 'ผู้ดูแล'} · ${date(viewing.limitApprovedAt.toISOString())}`]] : []),
        ...(viewing.status === 'REJECTED' && viewing.revisions[0] ? [['เหตุผลไม่อนุมัติ', viewing.revisions[0].reason], ['ผู้บันทึกไม่อนุมัติ', viewing.revisions[0].createdBy], ['วันที่ไม่อนุมัติ', viewing.revisions[0].createdAt.toLocaleString('th-TH', { timeZone: 'Asia/Bangkok' })]] : []),
        ['ผู้ค้ำประกัน', viewing.guarantorName || '—'],
        ['ที่อยู่ผู้ค้ำประกัน', viewing.guarantorName ? [viewing.guarantorHouseNumber, viewing.guarantorSoi, viewing.guarantorRoad, viewing.guarantorSubdistrict, viewing.guarantorDistrict, viewing.guarantorProvince].filter(Boolean).join(' ') : '—'],
        ['ทรัพย์ที่มอบประกันในสัญญาค้ำ', viewing.guaranteeCollateralDescription || 'เว้นว่าง'],
        ['พยานสัญญาเงินกู้ 3.1', viewing.documentChoice === 'CREATE' ? viewing.witnessCount === 0 ? 'ไม่มีพยาน' : `${viewing.witnessCount} คน` : '—'],
        ...(viewing.documentPackage !== 'LOAN' ? [['พยานสัญญาค้ำประกัน 3.2', viewing.documentChoice === 'CREATE' ? viewing.guaranteeWitnessCount === 0 ? 'ไม่มีพยาน' : `${viewing.guaranteeWitnessCount} คน` : '—']] : []),
        ['เอกสาร', viewing.documentChoice === 'CREATE' ? 'ทำสัญญา' : 'ไม่ทำสัญญา'],
        ...(viewing.documentCreatedAt ? [['วันที่จัดทำเอกสาร', date(viewing.documentCreatedAt)], ['รหัสผู้จัดทำเอกสาร', viewing.documentCreatedBy || '—']] : []),
        ['วิธีลงนาม', viewing.signingMethod === 'PRINT' ? 'พิมพ์เซ็น' : viewing.signingMethod === 'E_SIGNATURE' ? 'e-signature' : '—'],
        ...(viewing.printSignedAt ? [['ลงนามบนเอกสารกระดาษเมื่อ', date(viewing.printSignedAt)], ['รหัสผู้บันทึกการลงนาม', viewing.printSignedBy || '—']] : []),
        ['ชุดเอกสาร', ({ LOAN: 'สัญญาเงินกู้', LOAN_GUARANTEE: 'สัญญาเงินกู้ & สัญญาค้ำเงินกู้', LOAN_GUARANTEE_COLLATERAL: 'สัญญาเงินกู้ & สัญญาค้ำเงินกู้ & ข้อตกลงหลักประกัน (จำนอง/จำนำ)' } as Record<string, string>)[viewing.documentPackage ?? ''] || '—'],
        ['วิธีจ่ายและคำนวณยอดในระบบ', viewing.interestMethod === 'INTEREST_UPFRONT' ? 'หักดอกเบี้ย 1 เดือนก่อนจ่าย · คืนเงินต้น' : 'รับเงินต้นเต็มจำนวน · คืนเงินต้นพร้อมดอกเบี้ย 1 เดือน'],
        ['กำหนดจ่ายเงิน', formatContractDate(viewing.scheduledDisbursementDate)], ['ครบกำหนดรับชำระ', formatContractDate(viewing.repaymentDueDate)],
        ['รายละเอียดหลักประกัน', viewing.collateralDescription || 'เว้นว่างตามแบบเดิม'],
        ['เงินต้น', money(viewing.principalSatang) + ' บาท'], ['ดอกเบี้ยในเอกสาร', 'เว้นว่าง'],
        ['อัตราอ้างอิงภายในต่อเดือน', viewing.internalInterestPercent === null ? 'ไม่ระบุ' : `${viewing.internalInterestPercent}% · ข้อมูลภายในเท่านั้น`],
        ['ดอกเบี้ยอ้างอิงต่อเดือน', money(viewing.interestSatang) + ' บาท'],
        ['ดอกเบี้ยที่หักก่อนจ่าย', money(viewing.interestMethod === 'INTEREST_UPFRONT' ? viewing.interestSatang : 0) + ' บาท'],
        ['ยอดรับเงินจริง', money(viewing.netSatang) + ' บาท'], ['ยอดชำระเงินกู้', money(viewing.repaymentSatang) + ' บาท'],
        ...(viewing.signingMethod === 'E_SIGNATURE' ? [['ผู้กู้ลงนามเมื่อ', viewing.borrowerSignedAt ? date(viewing.borrowerSignedAt) : 'ยังไม่ลงนาม'], ['ผู้ให้กู้ลงนามเมื่อ', viewing.lenderSignedAt ? date(viewing.lenderSignedAt) : 'ยังไม่ลงนาม']] : []),
      ].map(([label, value]) => <div key={label}><dt className="text-xs text-slate-500">{label}</dt><dd className="ml-0 mt-1">{value}</dd></div>)}</dl>}
      {viewing?.documentChoice === 'CREATE' && <LoanAgreementTemplate contractId={viewing.id} witnessCount={viewing.witnessCount} witnesses={viewing.witnesses} signingMethod={viewing.signingMethod} borrowerSignedAt={viewing.borrowerSignedAt} lenderSignedAt={viewing.lenderSignedAt} guarantorSignedAt={viewing.guarantorSignedAt} documentPackage={viewing.documentPackage} printSignedAt={viewing.printSignedAt} />}
      {viewing?.documentChoice === 'CREATE' && viewing.documentPackage !== 'LOAN' && <GuaranteeAgreementTemplate contractId={viewing.id} signingMethod={viewing.signingMethod} borrowerSignedAt={viewing.borrowerSignedAt} lenderSignedAt={viewing.lenderSignedAt} guarantorSignedAt={viewing.guarantorSignedAt} witnessCount={viewing.guaranteeWitnessCount} witnesses={viewing.witnesses} documentSignatures={viewing.documentSignatures} />}
      {viewing?.documentChoice === 'CREATE' && viewing.documentPackage === 'LOAN_GUARANTEE_COLLATERAL' && <CollateralAgreementTemplate contractId={viewing.id} signingMethod={viewing.signingMethod} signaturesComplete={contractSignaturesComplete(viewing)} />}
    </Modal>
  </div>
}
