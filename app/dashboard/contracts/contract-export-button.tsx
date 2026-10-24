'use client'

import { useMemo, useState } from 'react'
import { Download } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Modal } from '@/components/ui/modal'
import { useToast } from '@/components/ui/toast'
import type { listContracts } from './actions'

type Contract = Awaited<ReturnType<typeof listContracts>>[number]
type Period = 'ALL' | 'YEAR' | 'MONTH'

const monthNames = ['มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน', 'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม']

function periodParts(row: Contract) {
  const value = row.legacySourceCode && row.scheduledDisbursementDate ? row.scheduledDisbursementDate : row.createdAt
  const date = new Date(value)
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Bangkok', year: 'numeric', month: '2-digit' }).formatToParts(date)
  return { year: Number(parts.find(part => part.type === 'year')?.value), month: Number(parts.find(part => part.type === 'month')?.value) }
}

export function ContractExportButton({ rows }: { rows: Contract[] }) {
  const [open, setOpen] = useState(false)
  const [period, setPeriod] = useState<Period>('ALL')
  const currentParts = useMemo(() => periodParts({ createdAt: new Date().toISOString(), legacySourceCode: null, scheduledDisbursementDate: null } as Contract), [])
  const availableYears = useMemo(() => [...new Set([...rows.map(periodParts).map(part => part.year), currentParts.year])].filter(Number.isFinite).sort((a, b) => b - a), [rows, currentParts.year])
  const [year, setYear] = useState(currentParts.year)
  const [month, setMonth] = useState(currentParts.month)
  const [pending, setPending] = useState(false)
  const { toast } = useToast()

  async function download() {
    setPending(true)
    try {
      const params = new URLSearchParams({ period })
      if (period !== 'ALL') params.set('year', String(year))
      if (period === 'MONTH') params.set('month', String(month))
      const response = await fetch(`/api/contracts/export?${params}`)
      if (!response.ok) {
        const result = await response.json().catch(() => null) as { error?: string } | null
        throw new Error(result?.error || 'ส่งออก Excel ไม่สำเร็จ')
      }
      const blob = await response.blob()
      const objectUrl = URL.createObjectURL(blob)
      const anchor = document.createElement('a')
      anchor.href = objectUrl
      const periodLabel = period === 'ALL' ? 'ทั้งหมด' : period === 'YEAR' ? String(year + 543) : `${String(month).padStart(2, '0')}-${year + 543}`
      anchor.download = `สัญญา-${periodLabel}.xlsx`
      document.body.appendChild(anchor)
      anchor.click()
      anchor.remove()
      URL.revokeObjectURL(objectUrl)
      setOpen(false)
      toast({ title: 'ส่งออก Excel สำเร็จ', description: `ดาวน์โหลดรายการสัญญา${period === 'ALL' ? 'ทั้งหมด' : period === 'YEAR' ? `ปี ${year + 543}` : `${monthNames[month - 1]} ${year + 543}`} แล้ว`, variant: 'success' })
    } catch (error) {
      toast({ title: 'ส่งออก Excel ไม่สำเร็จ', description: error instanceof Error ? error.message : 'กรุณาลองอีกครั้ง', variant: 'error' })
    } finally {
      setPending(false)
    }
  }

  return <>
    <Button onClick={() => setOpen(true)}><Download size={15} aria-hidden="true" />ส่งออก Excel</Button>
    <Modal open={open} title="ส่งออกรายการสัญญา" description="เลือกช่วงวันที่ทำสัญญาที่ต้องการ แล้วดาวน์โหลดเป็นไฟล์ Excel (.xlsx)" onClose={() => { if (!pending) setOpen(false) }}>
      <div className="space-y-3">
        <label className="block text-sm font-medium">ช่วงข้อมูล
          <select className="mt-1.5 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm" value={period} disabled={pending} onChange={event => setPeriod(event.target.value as Period)}>
            <option value="ALL">สัญญาทั้งหมด</option>
            <option value="YEAR">เลือกตามปี</option>
            <option value="MONTH">เลือกตามเดือน</option>
          </select>
        </label>
        {period !== 'ALL' && <label className="block text-sm font-medium">ปี
          <select className="mt-1.5 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm" value={year} disabled={pending} onChange={event => setYear(Number(event.target.value))}>
            {availableYears.map(option => <option key={option} value={option}>{option + 543}</option>)}
          </select>
        </label>}
        {period === 'MONTH' && <label className="block text-sm font-medium">เดือน
          <select className="mt-1.5 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm" value={month} disabled={pending} onChange={event => setMonth(Number(event.target.value))}>
            {monthNames.map((name, index) => <option key={name} value={index + 1}>{name}</option>)}
          </select>
        </label>}
        <div className="flex justify-end gap-2 pt-2"><Button disabled={pending} onClick={() => setOpen(false)}>ยกเลิก</Button><Button variant="primary" disabled={pending} onClick={() => void download()}><Download size={15} aria-hidden="true" />{pending ? 'กำลังสร้างไฟล์…' : 'ดาวน์โหลด Excel'}</Button></div>
      </div>
    </Modal>
  </>
}
