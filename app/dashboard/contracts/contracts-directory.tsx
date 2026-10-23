'use client'

import { useEffect, useState, type FormEvent } from 'react'
import { FileSignature, Plus, Search } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { CreateContractModal } from './create-contract-modal'
import { listContracts } from './actions'
import { contractCode } from '@/lib/contracts'
import { Modal } from '@/components/ui/modal'

const fieldClass = 'w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none'

export function ContractsDirectory() {
  const [rows, setRows] = useState<Awaited<ReturnType<typeof listContracts>>>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [notice, setNotice] = useState('')
  const [page, setPage] = useState(1)
  const [viewing, setViewing] = useState<Awaited<ReturnType<typeof listContracts>>[number] | null>(null)
  useEffect(() => {
    let cancelled = false
    listContracts().then(values => { if (!cancelled) setRows(values) })
      .catch(() => { if (!cancelled) setLoadError('โหลดรายการสัญญาไม่สำเร็จ') })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [])
  async function saved(code: string) {
    setCreating(false)
    setNotice(`บันทึกสัญญา ${code} สำเร็จ · รอจ่ายเงิน`)
    setQuery(''); setAppliedQuery(''); setStatus(''); setPage(1)
    try { setRows(await listContracts()); setLoadError('') }
    catch { setLoadError('บันทึกแล้ว แต่โหลดรายการไม่สำเร็จ กรุณารีเฟรชหน้าเว็บ') }
  }
  const money = (value: number) => new Intl.NumberFormat('th-TH', { minimumFractionDigits: 2 }).format(value / 100)
  const date = (value: string) => new Intl.DateTimeFormat('th-TH', { timeZone: 'Asia/Bangkok', dateStyle: 'short' }).format(new Date(value))
  const [creating, setCreating] = useState(false)
  const [query, setQuery] = useState('')
  const [appliedQuery, setAppliedQuery] = useState('')
  const [status, setStatus] = useState('')
  const filtered = Boolean(appliedQuery || status)

  const matches = rows.filter(row => (!status || row.status === status) && (!appliedQuery || [contractCode(row.id), row.borrowerCode, row.borrowerName, row.lenderName].some(value => value.toLowerCase().includes(appliedQuery.toLowerCase()))))
  const pages = Math.max(1, Math.ceil(matches.length / 25))
  const currentPage = Math.min(page, pages)
  const visibleRows = matches.slice((currentPage - 1) * 25, currentPage * 25)

  function search(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setAppliedQuery(query.trim()); setPage(1)
  }

  return <div className="borrower-workspace space-y-6">
    {creating && <CreateContractModal onClose={() => setCreating(false)} onSaved={saved} />}
    {notice && <p role="status" className="text-sm text-emerald-800">{notice}</p>}
    {loadError && <p role="alert" className="text-sm text-red-700">{loadError}</p>}
    {loading && <p role="status" className="text-sm text-slate-500">กำลังโหลดสัญญา…</p>}
    <div className="borrower-metrics">
      {[
        ['สัญญาทั้งหมด', 'สัญญาที่บันทึกในระบบ', rows.length],
        ['รอจ่ายเงิน', 'สร้างสัญญาแล้ว รอเบิกจ่ายเงิน', rows.filter(row => row.status === 'WAITING_PAYMENT').length],
        ['จ่ายเงินแล้ว', 'สัญญาที่เบิกจ่ายเงินเรียบร้อยแล้ว', rows.filter(row => row.status === 'PAID').length],
      ].map(([title, description, count]) => <Card key={String(title)} className="borrower-metric">
        <div className="borrower-metric-top"><span>{title}</span><FileSignature size={20} aria-hidden="true" /></div>
        <div className="borrower-metric-value">{count}<span>สัญญา</span></div>
        <p className="mt-2 text-xs text-slate-400">{description}</p>
      </Card>)}
    </div>
    <Card className="overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-4 p-5">
        <div className="borrower-directory-heading"><h2>ทะเบียนสัญญา</h2><span className="borrower-count">{rows.length} สัญญา</span></div>
        <Button variant="primary" onClick={() => setCreating(true)}><Plus size={16} aria-hidden="true" />เพิ่มสัญญา</Button>
      </div>
      <div className="borrower-toolbar flex flex-wrap gap-3 p-4">
        <form onSubmit={search} className="flex min-w-0 flex-1 basis-72 gap-2">
          <label className="relative min-w-0 flex-1"><span className="sr-only">ค้นหาสัญญา</span><Search size={16} aria-hidden="true" className="absolute left-3 top-3.5" />
            <input className={`${fieldClass} !pl-10`} value={query} maxLength={100} onChange={event => setQuery(event.target.value)} placeholder="ค้นหาเลขสัญญา รหัสผู้กู้ หรือชื่อผู้กู้" />
          </label>
          <Button type="submit">ค้นหา</Button>
        </form>
        <label><span className="sr-only">กรองสถานะสัญญา</span><select className={fieldClass} value={status} onChange={event => { setStatus(event.target.value); setPage(1) }}>
          <option value="">ทุกสถานะ</option><option value="WAITING_PAYMENT">รอจ่ายเงิน</option><option value="PAID">จ่ายเงินแล้ว</option>
        </select></label>
      </div>
      <div className="borrower-table-scroll overflow-x-auto">
        <table className="w-full whitespace-nowrap text-left text-xs">
          <caption className="sr-only">รายการสัญญาสินเชื่อ</caption>
          <thead><tr>{['จัดการ', 'เลขสัญญา', 'วันที่ทำสัญญา', 'รหัสผู้กู้', 'ชื่อผู้กู้', 'ผู้ให้กู้', 'วงเงินสัญญา', 'สถานะ', 'วันที่จ่ายเงิน'].map(label => <th scope="col" key={label} className="px-4 py-4 font-medium">{label}</th>)}</tr></thead>
          <tbody>{visibleRows.map(row => <tr key={row.id}>
            <td className="border-b px-4 py-3"><Button onClick={() => setViewing(row)}>ดูสัญญา</Button></td>
            {[contractCode(row.id), date(row.createdAt), row.borrowerCode, row.borrowerName, row.lenderName, money(row.principalSatang), row.status === 'WAITING_PAYMENT' ? 'รอจ่ายเงิน' : 'จ่ายเงินแล้ว', row.paidAt ? date(row.paidAt) : '—'].map((value, index) => <td key={index} className="border-b px-4 py-4">{value}</td>)}
          </tr>)}{!matches.length && !loading && !loadError && <tr><td colSpan={9} className="!p-0">
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
        ['ผู้กู้', viewing.borrowerName], ['ผู้ให้กู้', viewing.lenderName],
        ['สถานะ', viewing.status === 'WAITING_PAYMENT' ? 'รอจ่ายเงิน' : 'จ่ายเงินแล้ว'],
        ['เอกสาร', viewing.documentChoice === 'CREATE' ? 'ทำสัญญา' : 'ไม่ทำสัญญา'],
        ['วิธีลงนาม', viewing.signingMethod === 'PRINT' ? 'พิมพ์เซ็น' : viewing.signingMethod === 'E_SIGNATURE' ? 'e-signature' : '—'],
        ['ชุดเอกสาร', ({ LOAN: 'สัญญาเงินกู้', LOAN_GUARANTEE: 'สัญญาเงินกู้ & สัญญาค้ำเงินกู้', LOAN_GUARANTEE_COLLATERAL: 'สัญญาเงินกู้ & สัญญาค้ำเงินกู้ & สัญญาแบบมีหลักประกัน' } as Record<string, string>)[viewing.documentPackage ?? ''] || '—'],
        ['วิธีชำระดอกเบี้ย', viewing.interestMethod === 'INTEREST_UPFRONT' ? 'ชำระดอกเบี้ยล่วงหน้า' : 'ชำระต้นพร้อมดอกเบี้ย'],
        ['เงินต้น', money(viewing.principalSatang) + ' บาท'], ['ดอกร้อยละ', viewing.interestPercent + '%'],
        ['ดอกเบี้ย', money(viewing.interestSatang) + ' บาท'], ['ยอดรับเงินจริง', money(viewing.netSatang) + ' บาท'], ['ยอดชำระเงินกู้', money(viewing.repaymentSatang) + ' บาท'],
      ].map(([label, value]) => <div key={label}><dt className="text-xs text-slate-500">{label}</dt><dd className="ml-0 mt-1">{value}</dd></div>)}</dl>}
    </Modal>
  </div>
}
