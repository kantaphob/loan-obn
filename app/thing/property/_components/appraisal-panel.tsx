'use client'

import { useRef, useState, type FormEvent } from 'react'
import { Button } from '@/components/ui/button'
import { Modal } from '@/components/ui/modal'
import { money, today, type Home } from '../../_shared/model'
import { appraisalHistory, appraisalComparison, propertyAppraisal } from '../financials'

const inputClass = 'mt-1 w-full rounded-lg border border-slate-300 bg-white p-2 text-sm'

export function AppraisalPanel({ home, land, canWrite, onSave }: { home: Home; land: boolean; canWrite: boolean; onSave: (patch: Partial<Home>, reason: string) => Promise<void> }) {
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const lock = useRef(false)
  const history = appraisalHistory(home, land)
  const latest = history[0]
  const comparison = latest ? appraisalComparison(home, latest.amount) : null
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (lock.current) return
    const fields = new FormData(event.currentTarget)
    const amount = Number(fields.get('amount'))
    const date = String(fields.get('date') ?? '')
    const source = String(fields.get('source') ?? '').trim()
    if (!Number.isFinite(amount) || amount < 0 || !date || date > today() || !source) { setError('กรุณาระบุราคา วันที่ไม่เกินวันนี้ และแหล่งประเมิน'); return }
    lock.current = true; setBusy(true); setError('')
    try {
      const type = String(fields.get('type'))
      await onSave({ valuations: [...(home.valuations ?? []), { id: crypto.randomUUID(), date, landValue: land ? amount : 0, buildingValue: land ? 0 : amount, source: `${type} · ${source}`, notes: String(fields.get('notes') ?? '').trim() }] }, `บันทึกราคาประเมิน${land ? 'ที่ดิน' : 'บ้าน'}: ${home.name}`)
      setOpen(false)
    } catch (caught) { setError(caught instanceof Error ? caught.message : 'บันทึกไม่สำเร็จ') }
    finally { lock.current = false; setBusy(false) }
  }
  return <section className="mt-4 rounded-xl border border-emerald-100 bg-emerald-50/40 p-4" aria-label={`ราคาประเมิน ${home.name}`}>
    <div className="flex flex-wrap items-center justify-between gap-2"><h3 className="m-0 text-sm font-semibold">ราคาประเมิน{land ? 'ที่ดิน' : 'บ้าน / อาคาร'}</h3>{canWrite && <Button onClick={() => { setError(''); setOpen(true) }}>เพิ่มราคาประเมิน</Button>}</div>
    {latest ? <><p className="mb-1 text-lg font-semibold">{money(latest.amount)} บาท</p><p className="m-0 text-xs text-slate-600">{latest.date} · {latest.source}</p>{comparison && <p className={`mb-0 text-sm font-semibold ${comparison.difference >= 0 ? 'text-emerald-800' : 'text-rose-700'}`}>ส่วนต่างจากต้นทุน {comparison.difference > 0 ? '+' : ''}{money(comparison.difference)} บาท · {comparison.percent === null ? 'ยังคำนวณ % ไม่ได้ เพราะต้นทุนไม่ครบหรือเป็นศูนย์' : `${comparison.percent > 0 ? '+' : ''}${comparison.percent.toFixed(2)}%`}</p>}</> : <p className="mb-0 text-sm text-slate-600">ยังไม่มีราคาประเมินเฉพาะสินทรัพย์นี้ที่ระบุวันที่และแหล่งที่มา</p>}
    {history.length > 0 && <details className="mt-3"><summary className="cursor-pointer text-sm">ประวัติราคาประเมิน · {history.length} รายการ</summary><div className="overflow-x-auto"><table className="mt-2 w-full text-left text-xs"><thead><tr><th className="p-2">วันที่ / แหล่งที่มา</th><th className="p-2">ราคา (บาท)</th><th className="p-2">เทียบครั้งก่อน</th></tr></thead><tbody>{history.map((row, index) => { const previous = history[index + 1]; const diff = previous ? row.amount - previous.amount : null; return <tr key={row.id} className="border-t border-emerald-100"><td className="p-2">{row.date}<br />{row.source}{row.notes && <p>{row.notes}</p>}</td><td className="p-2">{money(row.amount)}</td><td className="p-2">{diff === null ? 'ครั้งแรก' : `${diff > 0 ? '+' : ''}${money(diff)} บาท${previous!.amount > 0 ? ` (${(diff / previous!.amount * 100).toFixed(2)}%)` : ''}`}</td></tr> })}</tbody></table></div></details>}
    <p className="mb-0 mt-3 text-xs text-slate-500">ราคาประเมินแยกจากต้นทุนและรายรับจริง · ไม่ปรับราคาเพิ่มอัตโนมัติ</p>
    <Modal open={open} title={`เพิ่มราคาประเมิน · ${home.name}`} description={`บันทึกเฉพาะ${land ? 'ที่ดิน' : 'บ้าน / อาคาร'}นี้ ไม่รวมสินทรัพย์อื่น`} onClose={() => { if (!busy) setOpen(false) }}><form onSubmit={submit} className="space-y-3"><label className="block text-sm">ราคาประเมิน (บาท)<input className={inputClass} name="amount" type="number" min="0" step="0.01" required /></label><label className="block text-sm">วันที่ประเมิน<input className={inputClass} name="date" type="date" max={today()} defaultValue={today()} required /></label><label className="block text-sm">ประเภท<select className={inputClass} name="type"><option>ประเมินตลาด</option><option>ประเมินธนาคาร</option><option>ประเมินราชการ</option></select></label><label className="block text-sm">ผู้ประเมิน / แหล่งข้อมูล<input className={inputClass} name="source" maxLength={250} required /></label><label className="block text-sm">หมายเหตุ<textarea className={inputClass} name="notes" maxLength={1000} /></label>{error && <p role="alert" className="text-sm text-rose-700">{error}</p>}<div className="flex justify-end gap-2"><Button type="button" disabled={busy} onClick={() => setOpen(false)}>ยกเลิก</Button><Button type="submit" variant="primary" disabled={busy}>{busy ? 'กำลังบันทึก…' : 'บันทึกราคาประเมิน'}</Button></div></form></Modal>
  </section>
}

export function PropertyAppraisal({ members, landIds }: { members: Home[]; landIds: string[] }) {
  const result = propertyAppraisal(members, new Set(landIds))
  return <section className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50/50 p-4" aria-label="การเปลี่ยนแปลงราคาประเมิน Property"><h3 className="m-0 text-sm font-semibold">มูลค่าประเมินและการเปลี่ยนแปลงราคา</h3>{result.complete ? <><p className="mb-1 text-xl font-semibold text-emerald-900">{money(result.amount)} บาท</p><p className="mb-0 text-sm">เทียบต้นทุน {money(result.cost)} บาท · ส่วนต่าง {result.difference > 0 ? '+' : ''}{money(result.difference)} บาท · {result.percent === null ? 'ยังคำนวณ % ไม่ได้ เพราะต้นทุนไม่ครบหรือเป็นศูนย์' : `${result.percent > 0 ? '+' : ''}${result.percent.toFixed(2)}%`}</p></> : <p className="mb-0 text-sm">มีราคาประเมินเฉพาะสินทรัพย์ {result.covered} / {members.length} รายการ · รอข้อมูลครบก่อนแสดงมูลค่ารวมและ % ของ Property</p>}<p className="mb-0 mt-2 text-xs text-slate-600">ใช้ราคาประเมินล่าสุดแยกของแต่ละสินทรัพย์ วันที่อาจต่างกัน ดูที่มาในการ์ดด้านล่าง · ไม่รวมราคาประเมินบ้านพร้อมที่ดินซ้ำ · ส่วนต่างนี้ไม่ใช่กำไรจากการขาย</p></section>
}
