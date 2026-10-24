'use client'

import { useEffect, useState, type FormEvent } from 'react'
import { ClipboardCopy, FileSignature, Plus, Search } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { CreateContractModal } from './create-contract-modal'
import { listContracts } from './actions'
import { contractCode, contractSignaturesComplete, formatContractDate } from '@/lib/contracts'
import { lenderCode } from '@/lib/lender'
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
  const [legacyImporting, setLegacyImporting] = useState(false)
  useEffect(() => {
    let cancelled = false
    listContracts().then(values => { if (!cancelled) setRows(values) })
      .catch(() => { if (!cancelled) setLoadError('โหลดรายการสัญญาไม่สำเร็จ') })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [])
  async function saved(code: string, contractId: number, signingMethod: string | null, limitApprovalRequired: boolean) {
    setCreating(false)
    setNotice(`บันทึกสัญญา ${code} สำเร็จ · ${limitApprovalRequired ? 'รออนุมัติวงเงินก่อนจ่ายเงินจริง' : 'รอจ่ายเงิน'}`)
    setQuery(''); setAppliedQuery(''); setStatus(''); setPage(1)
    try {
      const values = await listContracts()
      setRows(values)
      setLoadError('')
      toast({ title: 'บันทึกสัญญาเรียบร้อยแล้ว', description: `สัญญา ${code} · ${limitApprovalRequired ? 'รออนุมัติวงเงินก่อนจ่ายเงินจริง' : 'รอจ่ายเงินจริง'}`, variant: 'success' })
      if (signingMethod === 'E_SIGNATURE') setSigning(values.find(row => row.id === contractId) ?? null)
    }
    catch {
      setLoadError('บันทึกแล้ว แต่โหลดรายการไม่สำเร็จ กรุณารีเฟรชหน้าเว็บ')
      toast({ title: 'บันทึกสัญญาเรียบร้อยแล้ว', description: `สัญญา ${code} ${limitApprovalRequired ? 'รออนุมัติวงเงินก่อนจ่ายเงินจริง' : 'รอจ่ายเงินจริง'} แต่โหลดรายการกลับมาไม่สำเร็จ`, variant: 'success' })
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
  const date = (value: string) => new Intl.DateTimeFormat('th-TH', { timeZone: 'Asia/Bangkok', dateStyle: 'short' }).format(new Date(value))
  async function copyContractHeaders() {
    const headers = 'เลขที่สัญญา | ยอดเงินต้น | ดอกเบี้ย | ยอดดอกเบี้ย | วันรับ | วันส่งคืน | ยอดจ่าย'
    try {
      await navigator.clipboard.writeText(headers)
      toast({ title: 'คัดลอกหัวคอลัมน์แล้ว', description: 'คัดลอกเฉพาะข้อความหัวคอลัมน์ตามที่ระบุ', variant: 'success' })
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
    if (sourceStatus === 'จองสัญญา' && row.status === 'WAITING_PAYMENT') return 'จองสัญญา · รอจ่ายเงินจริง'
    return sourceStatus ? `${sourceStatus} · ข้อมูลเดิม` : 'รายการย้อนหลัง'
  }
  const signingLabel = (row: Awaited<ReturnType<typeof listContracts>>[number]) => {
    if (row.legacySourceCode) return 'รายการย้อนหลัง · ไม่มีเอกสาร'
    if (row.documentChoice !== 'CREATE') return 'ไม่ทำสัญญา'
    if (row.signingMethod !== 'E_SIGNATURE') return 'ทำสัญญา · พิมพ์เซ็น'
    return contractSignaturesComplete(row) ? 'ทำสัญญา · ลงนามครบ' : 'ทำสัญญา · รอลงนาม'
  }
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

  return <div className="borrower-workspace space-y-6">
    {creating && <CreateContractModal onClose={() => setCreating(false)} onSaved={saved} />}
    {legacyImporting && <Modal open title="นำเข้ารายการกู้ย้อนหลัง (ไม่มีเอกสาร)" className="max-w-6xl" onClose={() => setLegacyImporting(false)}><LegacyLoanImportModal onClose={() => setLegacyImporting(false)} onImported={count => void importedLegacy(count)} /></Modal>}
    {signing && <ContractSignatureModal contract={signing} onClose={() => setSigning(null)} onSigned={async () => {
      const values = await listContracts()
      setRows(values)
      setSigning(values.find(row => row.id === signing.id) ?? null)
    }} />}
    {notice && <p role="status" className="text-sm text-emerald-800">{notice}</p>}
    {loadError && <p role="alert" className="text-sm text-red-700">{loadError}</p>}
    {loading && <p role="status" className="text-sm text-slate-500">กำลังโหลดสัญญา…</p>}
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
        <div className="flex flex-wrap gap-2"><Button onClick={() => void copyContractHeaders()}><ClipboardCopy size={15} aria-hidden="true" />คัดลอกหัวคอลัมน์</Button><ContractExportButton rows={rows} /><Button onClick={() => setLegacyImporting(true)}>นำเข้ารายการเก่า</Button><Button variant="primary" onClick={() => setCreating(true)}><Plus size={16} aria-hidden="true" />เพิ่มสัญญา</Button></div>
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
          <tbody>{visibleRows.map(row => <tr key={row.id}>
            <td className="border-b px-4 py-3"><div className="flex items-center gap-2"><Button onClick={() => setViewing(row)}>ดูสัญญา</Button>{row.documentChoice === 'CREATE' && (row.signingMethod !== 'E_SIGNATURE' || contractSignaturesComplete(row)) && <a href={`/api/contracts/${row.id}/document`} target="_blank" rel="noopener noreferrer" className="action-button action-button--secondary">พิมพ์สัญญา</a>}{row.documentChoice === 'CREATE' && row.signingMethod === 'E_SIGNATURE' && !contractSignaturesComplete(row) && <Button onClick={() => setSigning(row)}>ลงนาม</Button>}</div></td>
            {[<span key="code">{contractCode(row.id)}{row.legacySourceCode && <span className="mt-1 block text-[10px] text-slate-500">เลขเดิม {row.legacySourceCode}</span>}</span>, row.legacySourceCode && row.scheduledDisbursementDate ? date(row.scheduledDisbursementDate) : date(row.createdAt), row.borrowerCode, <span key="borrower">{row.borrowerName}{row.legacySourceCode && legacyBorrowerName(row) && <span className="mt-1 block text-[10px] text-slate-500">ชื่อเดิม {legacyBorrowerName(row)}</span>}</span>, lenderCode(row.lenderId), money(row.principalSatang), row.status === 'REJECTED' ? 'ไม่อนุมัติ' : row.limitApprovalRequired ? 'รออนุมัติวงเงิน' : row.legacySourceCode ? legacyStatusLabel(row) : row.status === 'WAITING_PAYMENT' ? 'รอจ่ายเงิน' : row.status === 'CLOSED' ? 'ปิดยอดแล้ว' : 'จ่ายเงินแล้ว', signingLabel(row), row.paidAt ? date(row.paidAt) : '—', row.closedDate ? date(row.closedDate) : '—'].map((value, index) => <td key={index} className="border-b px-4 py-4">{value}</td>)}
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
      {viewing && <dl className="grid gap-4 text-sm sm:grid-cols-2">{[
        ...(viewing.legacySourceCode ? [['เลขรายการเดิม', viewing.legacySourceCode], ['ชื่อผู้กู้ในรายการเดิม', legacyBorrowerName(viewing) || '—'], ['สถานะเดิม', legacyStatus(viewing) || '—'], ['ยอดชำระก่อนนำเข้า', `${money(viewing.legacyReceivedSatang)} บาท`], ['ยอดคงเหลือตามข้อมูลเดิม', `${money(Math.max(0, viewing.repaymentSatang - viewing.legacyReceivedSatang))} บาท`]] : []),
        ['ผู้กู้', viewing.borrowerName], ['ผู้ให้กู้', viewing.lenderName],
        ['สถานะ', viewing.status === 'REJECTED' ? 'ไม่อนุมัติ' : viewing.limitApprovalRequired ? 'รออนุมัติวงเงิน' : viewing.status === 'WAITING_PAYMENT' ? 'รอจ่ายเงิน' : viewing.status === 'CLOSED' ? 'ปิดยอดแล้ว' : 'จ่ายเงินแล้ว'],
        ...(viewing.limitApprovedAt ? [['อนุมัติวงเงินโดย', `${viewing.limitApprovedBy ?? 'ผู้ดูแล'} · ${date(viewing.limitApprovedAt.toISOString())}`]] : []),
        ...(viewing.status === 'REJECTED' && viewing.revisions[0] ? [['เหตุผลไม่อนุมัติ', viewing.revisions[0].reason], ['ผู้บันทึกไม่อนุมัติ', viewing.revisions[0].createdBy], ['วันที่ไม่อนุมัติ', viewing.revisions[0].createdAt.toLocaleString('th-TH', { timeZone: 'Asia/Bangkok' })]] : []),
        ['ผู้ค้ำประกัน', viewing.guarantorName || '—'],
        ['ที่อยู่ผู้ค้ำประกัน', viewing.guarantorName ? [viewing.guarantorHouseNumber, viewing.guarantorSoi, viewing.guarantorRoad, viewing.guarantorSubdistrict, viewing.guarantorDistrict, viewing.guarantorProvince].filter(Boolean).join(' ') : '—'],
        ['ทรัพย์ที่มอบประกันในสัญญาค้ำ', viewing.guaranteeCollateralDescription || 'เว้นว่าง'],
        ['พยานสัญญาเงินกู้ 3.1', viewing.documentChoice === 'CREATE' ? viewing.witnessCount === 0 ? 'ไม่มีพยาน' : `${viewing.witnessCount} คน` : '—'],
        ...(viewing.documentPackage !== 'LOAN' ? [['พยานสัญญาค้ำประกัน 3.2', viewing.documentChoice === 'CREATE' ? viewing.guaranteeWitnessCount === 0 ? 'ไม่มีพยาน' : `${viewing.guaranteeWitnessCount} คน` : '—']] : []),
        ['เอกสาร', viewing.documentChoice === 'CREATE' ? 'ทำสัญญา' : 'ไม่ทำสัญญา'],
        ['วิธีลงนาม', viewing.signingMethod === 'PRINT' ? 'พิมพ์เซ็น' : viewing.signingMethod === 'E_SIGNATURE' ? 'e-signature' : '—'],
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
      {viewing?.documentChoice === 'CREATE' && <LoanAgreementTemplate contractId={viewing.id} witnessCount={viewing.witnessCount} witnesses={viewing.witnesses} signingMethod={viewing.signingMethod} borrowerSignedAt={viewing.borrowerSignedAt} lenderSignedAt={viewing.lenderSignedAt} guarantorSignedAt={viewing.guarantorSignedAt} documentPackage={viewing.documentPackage} />}
      {viewing?.documentChoice === 'CREATE' && viewing.documentPackage !== 'LOAN' && <GuaranteeAgreementTemplate contractId={viewing.id} signingMethod={viewing.signingMethod} borrowerSignedAt={viewing.borrowerSignedAt} lenderSignedAt={viewing.lenderSignedAt} guarantorSignedAt={viewing.guarantorSignedAt} witnessCount={viewing.guaranteeWitnessCount} witnesses={viewing.witnesses} documentSignatures={viewing.documentSignatures} />}
      {viewing?.documentChoice === 'CREATE' && viewing.documentPackage === 'LOAN_GUARANTEE_COLLATERAL' && <CollateralAgreementTemplate contractId={viewing.id} signingMethod={viewing.signingMethod} signaturesComplete={contractSignaturesComplete(viewing)} />}
    </Modal>
  </div>
}
