'use client'

import { useFeedbackToast } from '@/components/ui/use-feedback-toast'
import { useState, useTransition } from 'react'
import { importLegacyLoanRows, previewLegacyLoanImport } from './actions'
import { Button } from '@/components/ui/button'

type Preview = Awaited<ReturnType<typeof previewLegacyLoanImport>>
type Mapping = { borrowerId: number | null; confirmed: boolean }
const money = (satang: number) => new Intl.NumberFormat('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(satang / 100)
const date = (value: string) => new Intl.DateTimeFormat('th-TH', { timeZone: 'Asia/Bangkok', dateStyle: 'short' }).format(new Date(`${value}T00:00:00Z`))

export function LegacyLoanImportModal({ onClose, onImported }: { onClose: () => void; onImported: (count: number) => void }) {
  const [csvText, setCsvText] = useState('')
  const [fileName, setFileName] = useState('')
  const [preview, setPreview] = useState<Preview | null>(null)
  const [mappings, setMappings] = useState<Record<string, Mapping>>({})
  const [lenderId, setLenderId] = useState<number | null>(null)
  const [error, setError] = useState('')
  useFeedbackToast({ error })
  const [isPending, startTransition] = useTransition()
  const pendingRows = preview?.records.filter(row => !row.alreadyImported) ?? []
  const ready = Boolean(preview && lenderId && pendingRows.length && pendingRows.every(row => mappings[row.sourceCode]?.borrowerId && mappings[row.sourceCode]?.confirmed))

  async function chooseFile(file?: File) {
    if (!file) return
    setError(''); setPreview(null); setCsvText(''); setMappings({})
    if (!file.name.toLowerCase().endsWith('.csv') || file.size > 2_000_000) { setError('เลือกไฟล์ .csv ขนาดไม่เกิน 2 MB'); return }
    try {
      const text = await file.text()
      const result = await previewLegacyLoanImport(text)
      setCsvText(text); setFileName(file.name); setPreview(result)
      setLenderId(result.lenders.length === 1 ? result.lenders[0].id : null)
      setMappings(Object.fromEntries(result.records.map(row => [row.sourceCode, { borrowerId: row.suggestedBorrowerId, confirmed: false }])))
      if (result.records.some(row => row.alreadyImported)) setError('มีบางเลขรายการที่นำเข้าแล้ว ระบบจะข้ามรายการเดิมเพื่อป้องกันข้อมูลซ้ำ')
      if (result.records.some(row => row.matchingBorrowerCount !== 1)) setError('มีชื่อที่จับคู่ไม่ได้หรือพบมากกว่าหนึ่งราย กรุณาเลือกผู้กู้ให้ถูกต้องและตรวจชื่อเต็มก่อนยืนยัน')
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'อ่านไฟล์ไม่สำเร็จ') }
  }

  function updateMapping(sourceCode: string, borrowerId: number | null) {
    setMappings(current => ({ ...current, [sourceCode]: { borrowerId, confirmed: false } }))
  }

  function save() {
    if (!preview || !lenderId || !ready) return
    setError('')
    startTransition(async () => {
      const result = await importLegacyLoanRows({ csvText, lenderId, mappings: preview.records.map(row => ({ sourceCode: row.sourceCode, borrowerId: mappings[row.sourceCode]?.borrowerId ?? 0, confirmed: row.alreadyImported || mappings[row.sourceCode]?.confirmed === true })) })
      if ('error' in result) { setError(result.error ?? 'นำเข้าไม่สำเร็จ'); return }
      onImported(result.imported.length)
    })
  }

  return <div className="space-y-4">
    <div>
      <p className="m-0 text-sm text-slate-600">นำเข้ารายการเดิมโดยไม่สร้าง PDF หรือลายเซ็น รายการ “จองสัญญา” จะเป็นสถานะรอจ่ายเงินจริง และยังไม่ถือว่ามีการจ่ายเงินจนกว่าจะบันทึกรายการจ่ายในบัญชี รายการเก่าที่ปล่อยกู้แล้วจะบันทึกยอดชำระเป็นยอดยกมา โดยไม่สร้างรายการรับเงินย้อนหลัง</p>
      <p className="mb-0 mt-2 text-xs text-slate-500">ไฟล์ต้นฉบับไม่ถูกแก้ไข ระบบจับคู่ผู้กู้จากชื่อเรียกกับ Masterdata และจะแสดงชื่อเต็มให้ตรวจทีละรายการก่อนบันทึก</p>
    </div>
    <label className="block rounded-xl border border-dashed border-slate-300 bg-slate-50 p-4 text-sm font-medium">เลือก CSV รายการเก่า
      <input type="file" accept=".csv,text/csv" onChange={event => void chooseFile(event.currentTarget.files?.[0])} className="mt-2 block w-full text-sm" />
      {fileName && <span className="mt-1 block text-xs font-normal text-slate-500">{fileName}</span>}
    </label>
    {preview && <>
      {preview.lenders.length > 1 && <label className="block text-sm font-medium">ผู้ให้กู้ในรายการเก่า<select className="mt-1 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2" value={lenderId ?? ''} onChange={event => setLenderId(Number(event.target.value) || null)}><option value="">เลือกผู้ให้กู้</option>{preview.lenders.map(lender => <option key={lender.id} value={lender.id}>{lender.name}</option>)}</select></label>}
      {preview.lenders.length === 0 && <p role="alert" className="rounded-lg bg-amber-50 p-3 text-sm text-amber-900">ไม่พบผู้ให้กู้ที่ใช้งานอยู่ กรุณาเพิ่มหรือเปิดใช้งานผู้ให้กู้ก่อน</p>}
      <div className="flex flex-wrap gap-2 text-xs"><span className="rounded-full bg-slate-100 px-3 py-1">พบ {preview.records.length} รายการ</span><span className="rounded-full bg-emerald-50 px-3 py-1 text-emerald-800">ใหม่ {pendingRows.length}</span><span className="rounded-full bg-amber-50 px-3 py-1 text-amber-900">รอจ่ายจริง {pendingRows.filter(row => row.reservation).length}</span></div>
      {preview.skipped.length > 0 && <p className="m-0 rounded-lg bg-amber-50 p-3 text-xs text-amber-900">ข้าม {preview.skipped.map(row => `${row.sourceCode} (${row.reason})`).join(' · ')}</p>}
      <div className="max-h-[55vh] overflow-auto rounded-xl border border-slate-200">
        <table className="w-full min-w-[1050px] text-left text-xs">
          <thead className="sticky top-0 bg-slate-50"><tr>{['ยืนยัน', 'เลขเดิม', 'ชื่อในไฟล์ → ผู้กู้ในระบบ', 'วันจ่าย / ครบกำหนด', 'ต้น / ดอกเบี้ย', 'ชำระแล้ว / คงเหลือ', 'สถานะเดิม'].map(label => <th key={label} className="px-3 py-2 font-semibold">{label}</th>)}</tr></thead>
          <tbody>{preview.records.map(row => {
            const mapping = mappings[row.sourceCode] ?? { borrowerId: null, confirmed: false }
            const borrower = preview.borrowers.find(item => item.id === mapping.borrowerId)
            return <tr key={row.sourceCode} className="border-t border-slate-100 align-top">
              <td className="px-3 py-2">{row.alreadyImported ? <span className="text-slate-500">มีแล้ว · ข้าม</span> : <label className="flex items-center gap-2"><input type="checkbox" checked={mapping.confirmed} disabled={!mapping.borrowerId} onChange={event => { const confirmed = event.currentTarget.checked; setMappings(current => ({ ...current, [row.sourceCode]: { ...current[row.sourceCode], confirmed } })) }} /><span className="sr-only">ยืนยันผู้กู้รายการ {row.sourceCode}</span></label>}</td>
              <td className="px-3 py-2 font-medium">{row.sourceCode}<span className="block text-slate-500">CSV {row.sourceBorrowerId}</span>{row.reservation && <span className="mt-1 inline-block rounded-full bg-amber-50 px-2 py-0.5 text-amber-900">จอง · รอจ่าย</span>}</td>
              <td className="min-w-[320px] px-3 py-2"><span className="block">{row.borrowerName}</span><select aria-label={`ผู้กู้สำหรับ ${row.sourceCode}`} className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-2 py-1.5" value={mapping.borrowerId ?? ''} disabled={row.alreadyImported} onChange={event => updateMapping(row.sourceCode, Number(event.target.value) || null)}><option value="">เลือกผู้กู้ที่ตรงกัน</option>{preview.borrowers.map(item => <option key={item.id} value={item.id}>{item.code} · {item.nickname} · {item.name} · {item.status}</option>)}</select>{borrower && <span className="mt-1 block text-emerald-800">จับคู่: {borrower.name}</span>}{row.matchingBorrowerCount !== 1 && !row.alreadyImported && <span className="mt-1 block text-amber-800">ชื่อไม่ตรงแบบหนึ่งต่อหนึ่ง กรุณาตรวจรายการนี้</span>}</td>
              <td className="px-3 py-2">{date(row.loanDate)}<span className="block text-slate-500">ครบ {date(row.dueDate)}</span></td>
              <td className="px-3 py-2 tabular-nums">{money(row.principalSatang)}<span className="block text-slate-500">ดอก {money(row.interestSatang)} ({row.interestPercent}%)</span></td>
              <td className="px-3 py-2 tabular-nums">{money(row.receivedSatang)}<span className="block text-slate-500">คงเหลือ {money(row.remainingSatang)}</span></td>
              <td className="px-3 py-2">{row.sourceStatus}{row.overdueDays > 0 && <span className="block text-amber-800">เกิน {row.overdueDays} วัน</span>}</td>
            </tr>
          })}</tbody>
        </table>
      </div>
      <p className="m-0 rounded-lg bg-sky-50 p-3 text-xs leading-5 text-sky-900">ยอด “ชำระแล้ว” ของสัญญาที่จ่ายเงินจริงจะเป็นยอดยกมาใช้คำนวณหนี้คงเหลือ ส่วนรายการจองจะยังไม่ลงบัญชีจ่ายหรือรับเงิน เมื่อจ่ายจริงให้เปิดรายการรอจ่ายแล้วแนบหลักฐานกับรายการจ่ายในบัญชี วันครบกำหนดรับชำระเป็นวันเดียวตามสัญญาในขณะนี้</p>
    </>}
    {error && <p role="alert" className="m-0 rounded-lg bg-amber-50 p-3 text-sm text-amber-900">{error}</p>}
    <div className="flex justify-end gap-2"><Button onClick={onClose} disabled={isPending}>ยกเลิก</Button>{preview && <Button variant="primary" disabled={!ready || isPending || preview.lenders.length === 0} onClick={save}>{isPending ? 'กำลังบันทึก…' : `บันทึกรายการเก่า ${pendingRows.length} รายการ`}</Button>}</div>
  </div>
}
