'use client'

import { useState, type FormEvent } from 'react'
import { FileSignature, Plus, Search } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { CreateContractModal } from './create-contract-modal'

const fieldClass = 'w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none'

export function ContractsDirectory() {
  const [creating, setCreating] = useState(false)
  const [query, setQuery] = useState('')
  const [appliedQuery, setAppliedQuery] = useState('')
  const [status, setStatus] = useState('')
  const filtered = Boolean(appliedQuery || status)

  function search(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setAppliedQuery(query.trim())
  }

  return <div className="borrower-workspace space-y-6">
    {creating && <CreateContractModal onClose={() => setCreating(false)} />}
    <div className="borrower-metrics">
      {[
        ['สัญญาทั้งหมด', 'สัญญาที่บันทึกในระบบ'],
        ['รอจ่ายเงิน', 'สร้างสัญญาแล้ว รอเบิกจ่ายเงิน'],
        ['จ่ายเงินแล้ว', 'สัญญาที่เบิกจ่ายเงินเรียบร้อยแล้ว'],
      ].map(([title, description]) => <Card key={title} className="borrower-metric">
        <div className="borrower-metric-top"><span>{title}</span><FileSignature size={20} aria-hidden="true" /></div>
        <div className="borrower-metric-value">0<span>สัญญา</span></div>
        <p className="mt-2 text-xs text-slate-400">{description}</p>
      </Card>)}
    </div>
    <Card className="overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-4 p-5">
        <div className="borrower-directory-heading"><h2>ทะเบียนสัญญา</h2><span className="borrower-count">0 สัญญา</span></div>
        <Button variant="primary" onClick={() => setCreating(true)}><Plus size={16} aria-hidden="true" />เพิ่มสัญญา</Button>
      </div>
      <div className="borrower-toolbar flex flex-wrap gap-3 p-4">
        <form onSubmit={search} className="flex min-w-0 flex-1 basis-72 gap-2">
          <label className="relative min-w-0 flex-1"><span className="sr-only">ค้นหาสัญญา</span><Search size={16} aria-hidden="true" className="absolute left-3 top-3.5" />
            <input className={`${fieldClass} !pl-10`} value={query} maxLength={100} onChange={event => setQuery(event.target.value)} placeholder="ค้นหาเลขสัญญา รหัสผู้กู้ หรือชื่อผู้กู้" />
          </label>
          <Button type="submit">ค้นหา</Button>
        </form>
        <label><span className="sr-only">กรองสถานะสัญญา</span><select className={fieldClass} value={status} onChange={event => setStatus(event.target.value)}>
          <option value="">ทุกสถานะ</option><option value="WAITING_PAYMENT">รอจ่ายเงิน</option><option value="PAID">จ่ายเงินแล้ว</option>
        </select></label>
      </div>
      <div className="borrower-table-scroll overflow-x-auto">
        <table className="w-full whitespace-nowrap text-left text-xs">
          <caption className="sr-only">รายการสัญญาสินเชื่อ</caption>
          <thead><tr>{['จัดการ', 'เลขสัญญา', 'วันที่ทำสัญญา', 'รหัสผู้กู้', 'ชื่อผู้กู้', 'ผู้ให้กู้', 'วงเงินสัญญา', 'สถานะ', 'วันที่จ่ายเงิน'].map(label => <th scope="col" key={label} className="px-4 py-4 font-medium">{label}</th>)}</tr></thead>
          <tbody><tr><td colSpan={9} className="!p-0">
            <div className="borrower-empty" role="status">
              <span className="borrower-empty-icon"><FileSignature size={30} aria-hidden="true" /></span>
              <h3>{filtered ? 'ไม่พบสัญญาที่ค้นหา' : 'ยังไม่มีสัญญาสินเชื่อ'}</h3>
              <p>{filtered ? 'ลองเปลี่ยนคำค้นหาหรือสถานะสัญญา' : 'เริ่มสร้างสัญญาโดยค้นหาผู้กู้ แล้วกรอกรายละเอียดสินเชื่อ'}</p>
              {filtered ? <Button onClick={() => { setQuery(''); setAppliedQuery(''); setStatus('') }}>ล้างตัวกรอง</Button> : <Button variant="primary" onClick={() => setCreating(true)}><Plus size={15} aria-hidden="true" />เพิ่มสัญญาแรก</Button>}
            </div>
          </td></tr></tbody>
        </table>
      </div>
      <div className="borrower-pagination flex flex-wrap items-center justify-between gap-3 border-t p-4 text-xs">
        <span>พบ 0 รายการ · หน้า 1 / 1</span><div className="flex gap-2"><Button disabled>ก่อนหน้า</Button><Button disabled>ถัดไป</Button></div>
      </div>
    </Card>
  </div>
}
