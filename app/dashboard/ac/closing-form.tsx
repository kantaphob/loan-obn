'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { closingJournal, type ClosingBalance, type EquityTarget, closingSteps } from '@/lib/account-closing'
import { closeAccounts } from './actions'

const field = 'mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm'
const money = (n: number) => (n / 100).toLocaleString('th-TH', { minimumFractionDigits: 2 })
export function ClosingForm({ nextStart, today }: { nextStart: string; today: string }) {
  const router = useRouter()
  const [startOn, setStart] = useState(nextStart)
  const [endOn, setEnd] = useState('')
  const [note, setNote] = useState('')
  const [equity, setEquity] = useState<EquityTarget>('RETAINED_EARNINGS')
  const [balances, setBalances] = useState<ClosingBalance[]>([{ code: '', name: '', type: 'REVENUE', amount: '' }])
  const [confirmed, setConfirmed] = useState(false)
  const [pending, setPending] = useState(false)
  const [message, setMessage] = useState('')
  const [requestKey, setRequestKey] = useState('')
  let journal: ReturnType<typeof closingJournal> | null = null
  try { journal = closingJournal(balances, equity) } catch { /* Incomplete input is validated on submit. */ }
  function update(index: number, key: keyof ClosingBalance, value: string) {
    setConfirmed(false); setRequestKey('')
    setBalances(rows => rows.map((row, i) => i === index ? { ...row, [key]: value } : row))
  }
  return <form className="space-y-5" onSubmit={async event => {
    event.preventDefault()
    if (pending || !confirmed) return
    setPending(true); setMessage('')
    const key = requestKey || crypto.randomUUID(); setRequestKey(key)
    try {
      const result = await closeAccounts({ requestKey: key, startOn, endOn, note, balances, equity })
      setMessage(result.message)
      if (result.ok) { setConfirmed(false); setBalances([{ code: '', name: '', type: 'REVENUE', amount: '' }]); setRequestKey(''); setEnd(''); setStart(new Date(Date.parse(endOn) + 86400000).toISOString().slice(0, 10)); router.refresh() }
    } catch { setMessage('เชื่อมต่อไม่สำเร็จ กรุณาลองอีกครั้งด้วยข้อมูลเดิม') }
    finally { setPending(false) }
  }}>
    <fieldset disabled={pending} className="space-y-5 disabled:opacity-60">
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="text-sm">วันเริ่มงวด<input required type="date" className={field} value={startOn} readOnly={Boolean(nextStart)} max={today} onChange={e => { setStart(e.target.value); setConfirmed(false); setRequestKey('') }} /></label>
        <label className="text-sm">วันสิ้นงวด<input required type="date" className={field} value={endOn} min={startOn} max={new Date(Date.parse(today) - 86400000).toISOString().slice(0, 10)} onChange={e => { setEnd(e.target.value); setConfirmed(false); setRequestKey('') }} /></label>
      </div>
      <label className="block text-sm">บัญชีปลายทาง<select className={field} value={equity} onChange={e => { setEquity(e.target.value as EquityTarget); setConfirmed(false); setRequestKey('') }}><option value="RETAINED_EARNINGS">บริษัท — กำไรสะสม / เงินปันผล</option><option value="CAPITAL">บุคคลธรรมดาหรือห้างหุ้นส่วน — ทุน / ถอนใช้ส่วนตัว</option></select></label>
      <ol className="list-decimal space-y-1 pl-5 text-sm text-slate-600">{closingSteps.map(step => <li key={step}>{step}</li>)}</ol>
      <p className="text-sm text-slate-600">กรอกยอดรายได้ (ยอดเครดิต) และค่าใช้จ่าย (ยอดเดบิต) จากบัญชีที่ตรวจสอบแล้ว รวมยอดถอนใช้ส่วนตัวหรือเงินปันผล (ยอดเดบิต) หากมี เฉพาะงวดนี้ ไม่รวมเงินต้นปล่อยกู้ เงินรับคืนทุน หรือเงินลงทุน</p>
      {balances.map((row, index) => <div key={index} className="grid gap-3 rounded-xl border border-slate-200 p-4 sm:grid-cols-2 lg:grid-cols-5">
        <label className="text-xs">รหัสบัญชี<input required maxLength={30} className={field} value={row.code} onChange={e => update(index, 'code', e.target.value)} /></label>
        <label className="text-xs">ชื่อบัญชี<input required maxLength={150} className={field} value={row.name} onChange={e => update(index, 'name', e.target.value)} /></label>
        <label className="text-xs">ประเภท<select className={field} value={row.type} onChange={e => update(index, 'type', e.target.value)}><option value="REVENUE">รายได้</option><option value="EXPENSE">ค่าใช้จ่าย</option><option value="DRAWING">ถอนใช้ส่วนตัว (ปิดเข้าทุน)</option><option value="DIVIDEND">เงินปันผล (ปิดเข้ากำไรสะสม)</option></select></label>
        <label className="text-xs">ยอดคงเหลือ (บาท)<input required inputMode="decimal" className={field} value={row.amount} onChange={e => update(index, 'amount', e.target.value)} /></label>
        <button type="button" disabled={balances.length === 1} className="self-end rounded-xl px-3 py-2 text-sm text-rose-700 disabled:opacity-40" onClick={() => { setBalances(rows => rows.filter((_, i) => i !== index)); setConfirmed(false); setRequestKey('') }}>ลบบัญชีแถว {index + 1}</button>
      </div>)}
      <button type="button" disabled={balances.length >= 100} className="rounded-xl border border-slate-300 px-4 py-2 text-sm" onClick={() => { setBalances(rows => [...rows, { code: '', name: '', type: 'EXPENSE', amount: '' }]); setConfirmed(false); setRequestKey('') }}>เพิ่มบัญชี</button>
      <label className="block text-sm">แหล่งที่มาของยอด / หมายเหตุ<textarea required maxLength={1000} className={field} value={note} onChange={e => { setNote(e.target.value); setConfirmed(false); setRequestKey('') }} placeholder="เช่น งบทดลองที่ตรวจสอบแล้ว เลขที่เอกสาร…" /></label>
      {journal && <div className="overflow-x-auto rounded-xl border border-slate-200"><table className="w-full text-left text-sm"><caption className="p-3 text-left font-semibold">ตัวอย่างรายการปิดบัญชี · ผลกำไร (ขาดทุน) {money(journal.profit)} บาท</caption><thead><tr><th className="p-3">ขั้นตอน</th><th className="p-3">บัญชี</th><th className="p-3 text-right">เดบิต</th><th className="p-3 text-right">เครดิต</th></tr></thead><tbody>{journal.lines.map((line, index) => <tr key={`${line.step}-${line.code}-${index}`} className="border-t border-slate-200"><td className="p-3">{line.step}</td><td className="p-3">{line.code} · {line.name}</td><td className="p-3 text-right">{money(line.debit)}</td><td className="p-3 text-right">{money(line.credit)}</td></tr>)}</tbody><tfoot><tr className="border-t font-semibold"><th colSpan={2} className="p-3">รวม</th><td className="p-3 text-right">{money(journal.lines.reduce((s, l) => s + l.debit, 0))}</td><td className="p-3 text-right">{money(journal.lines.reduce((s, l) => s + l.credit, 0))}</td></tr></tfoot></table></div>}
      {!journal && balances.some(row => row.code || row.name || row.amount) && <p role="status" className="text-sm text-amber-800">กรอกข้อมูลทุกบัญชีให้ครบ ใช้รหัสไม่ซ้ำ และเลือกถอนใช้ส่วนตัวหรือเงินปันผลให้ตรงกับบัญชีปลายทาง</p>}
      <label className="flex items-start gap-3 text-sm"><input type="checkbox" checked={confirmed} required onChange={e => setConfirmed(e.target.checked)} className="mt-1" />ยืนยันตรวจยอดบัญชีและรายการปิดบัญชีแล้ว เมื่อบันทึกจะล็อกการเพิ่ม แก้ไข และยกเลิกรายการรับ–จ่ายทุกวันที่ถึงวันสิ้นงวด รวมวันที่ก่อนวันเริ่มงวด และไม่สามารถเปิดงวดย้อนกลับจากหน้านี้ได้</label>
      <button disabled={!journal || !confirmed || pending} className="rounded-xl bg-slate-900 px-5 py-3 text-sm text-white disabled:opacity-40">{pending ? 'กำลังบันทึก…' : 'ยืนยันปิดงวดและบันทึกรายการ'}</button>
    </fieldset>
    {message && <p role="status" className="rounded-xl bg-slate-100 p-4 text-sm">{message}</p>}
  </form>
}
