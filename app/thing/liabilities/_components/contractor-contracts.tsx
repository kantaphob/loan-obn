'use client'

import { useState, type FormEvent } from 'react'
import { Button } from '@/components/ui/button'
import { Modal } from '@/components/ui/modal'
import { money, roundMoney, priceContractStages, type BankLoan, type ContractorContract, type ContractorStage } from '@/app/thing/_shared/model'

const field = 'mt-1 min-h-11 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm focus:outline-blue-400'
export function ContractorContracts({ loan, canWrite, busy, onSave, kind = 'construction' }: { kind?: 'construction' | 'land_purchase'; loan: BankLoan; canWrite: boolean; busy: boolean; onSave: (contract: ContractorContract) => Promise<boolean> }) {
  const land = kind === 'land_purchase'
  const title = land ? 'สัญญาซื้อที่ดิน' : 'สัญญาจ้างเหมา'
  const prefix = land ? 'LC' : 'CT'
  const contracts = (loan.contractorContracts ?? []).filter(c => (c.kind ?? 'construction') === kind)
  const [editing, setEditing] = useState<ContractorContract | null>(null)
  function create() {
    let sequence = 1
    while (loan.contractorContracts?.some(c => c.code === `${prefix}-${String(sequence).padStart(3, '0')}`)) sequence++
    setEditing({ id: crypto.randomUUID(), code: `${prefix}-${String(sequence).padStart(3, '0')}`, kind, name: '', contractor: '', amount: 0, signedOn: '', description: '', stages: [{ id: crypto.randomUUID(), number: 1, name: '', amount: 0, dueOn: '' }] })
  }
  return <div className="space-y-4">
    <div className="flex flex-wrap items-center justify-between gap-3"><p className="text-sm text-slate-500">{land ? 'ข้อตกลงซื้อที่ดิน ผู้ขาย ราคาซื้อ และงวดชำระ' : 'ข้อตกลงจ้างช่าง / ผู้รับเหมา และยอดจ่ายตามงวดงานก่อสร้าง'}</p>{canWrite ? <Button variant="primary" onClick={create} disabled={busy}>เพิ่ม{title}</Button> : null}</div>
    {!contracts.length ? <p className="py-8 text-center text-sm text-slate-500">ยังไม่มี{title} เพิ่มสัญญาและ{land ? 'งวดชำระก่อนบันทึกจ่ายให้ผู้ขาย' : 'งวดงานก่อนบันทึกจ่ายให้ช่าง'}</p> : null}
    {contracts.map(contract => {
      const payments = (loan.contractorPayments ?? []).filter(p => p.contractId === contract.id)
      const paid = payments.reduce((sum, p) => sum + p.amount, 0)
      return <section key={contract.id} className="space-y-3 rounded-2xl border border-slate-200 p-4"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-xs text-slate-500">{contract.code}</p><h3 className="mt-1 text-base font-semibold">{contract.name}</h3><p className="mt-1 text-xs text-slate-500">{land ? 'ผู้ขาย' : 'ผู้รับเหมา'}: {contract.contractor} · วันที่สัญญา {contract.signedOn || 'ยังไม่ระบุ'}</p></div>{canWrite ? <Button onClick={() => setEditing(structuredClone(contract))} disabled={busy}>แก้ไขสัญญา</Button> : null}</div><div className="grid gap-3 sm:grid-cols-3">{[['มูลค่าสัญญา', contract.amount], ['จ่ายแล้ว', paid], ['คงเหลือตามสัญญา', contract.amount - paid]].map(([label, value]) => <div key={String(label)} className="rounded-xl bg-slate-50 p-3"><p className="text-xs text-slate-500">{label}</p><strong className="mt-1 block text-sm tabular-nums">{money(Number(value))} บาท</strong></div>)}</div>
        {land && (contract.landReference || contract.location) ? <p className="text-xs leading-6 text-slate-500">โฉนด / เลขที่ดิน: {contract.landReference || 'ยังไม่ระบุ'} · ที่ตั้ง: {contract.location || 'ยังไม่ระบุ'}</p> : null}<div className="overflow-x-auto"><table className="w-full whitespace-nowrap text-left text-xs"><thead className="bg-slate-50"><tr>{['งวดที่', land ? 'งวดชำระ / เงื่อนไข' : 'งาน / เงื่อนไขจ่าย', 'กำหนดจ่าย', '% ของสัญญา', 'ยอดตามงวด', 'จ่ายแล้ว', 'คงเหลือ'].map(h => <th key={h} className="px-3 py-2">{h}</th>)}</tr></thead><tbody>{contract.stages.map(stage => { const stagePaid = payments.filter(p => p.stageId === stage.id).reduce((sum, p) => sum + p.amount, 0); return <tr key={stage.id} className="border-t border-slate-100"><td className="px-3 py-3">{stage.number}</td><td className="px-3 py-3">{stage.name}</td><td className="px-3 py-3">{stage.dueOn || '—'}</td><td className="px-3 py-3">{stage.percent !== undefined ? `${stage.percent}%` : '—'}</td><td className="px-3 py-3">{money(stage.amount)}</td><td className="px-3 py-3">{money(stagePaid)}</td><td className="px-3 py-3">{money(stage.amount - stagePaid)}</td></tr> })}</tbody></table></div>{contract.description ? <p className="whitespace-pre-wrap text-xs leading-6 text-slate-500">{contract.description}</p> : null}
      </section>
    })}
    <Modal open={!!editing} title={`${title} / ${land ? 'งวดชำระ' : 'งวดงาน'}`} onClose={() => { if (!busy) setEditing(null) }}>{editing ? <ContractorForm key={editing.id} initial={editing} busy={busy} onSave={async contract => { if (await onSave(contract)) setEditing(null) }} /> : null}</Modal>
  </div>
}

function ContractorForm({ initial, busy, onSave }: { initial: ContractorContract; busy: boolean; onSave: (contract: ContractorContract) => Promise<void> }) {
  const land = initial.kind === 'land_purchase'
  const [totalAmount, setTotalAmount] = useState(initial.amount)
  const [percentMode, setPercentMode] = useState(initial.amount === 0 || initial.stages.every(stage => stage.percent !== undefined))
  const [stages, setStages] = useState<ContractorStage[]>(() => initial.stages.map(stage => initial.amount === 0 ? { ...stage, percent: 0 } : stage))
  const priced = priceContractStages(totalAmount, stages)
  const percentage = roundMoney(stages.reduce((sum, stage) => sum + (stage.percent ?? 0), 0))
  const stageTotal = roundMoney(priced.reduce((sum, stage) => sum + stage.amount, 0))
  const invalidPercent = percentMode && Math.abs(percentage - 100) > .000001
  function update(id: string, patch: Partial<ContractorStage>) { setStages(rows => rows.map(row => row.id === id ? { ...row, ...patch } : row)) }
  function changeMode(usePercent: boolean) {
    setStages(priced.map(stage => {
      if (usePercent) return { ...stage, percent: stage.percent ?? (totalAmount > 0 ? roundMoney(stage.amount / totalAmount * 100) : 0) }
      const amountStage = { ...stage }; delete amountStage.percent
      return amountStage
    }))
    setPercentMode(usePercent)
  }
  function useProvidedSchedule() {
    const percentages = land ? [70, 30] : [20, 20, 15, 15, 15, 10, 5]
    setTotalAmount(land ? 400000 : 2600000)
    setPercentMode(true)
    setStages(percentages.map((percent, index) => ({ id: stages[index]?.id ?? crypto.randomUUID(), number: index + 1, name: stages[index]?.name || `${land ? 'งวดชำระ' : 'งวดงาน'}ที่ ${index + 1}`, amount: 0, dueOn: stages[index]?.dueOn ?? '', percent })))
  }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (busy || invalidPercent || stageTotal > totalAmount) return
    const f = new FormData(event.currentTarget)
    await onSave({ ...initial, code: String(f.get('code') ?? '').trim(), name: String(f.get('name') ?? '').trim(), contractor: String(f.get('contractor') ?? '').trim(), amount: totalAmount, signedOn: String(f.get('signedOn') ?? ''), description: String(f.get('description') ?? '').trim(), ...(land ? { landReference: String(f.get('landReference') ?? '').trim(), location: String(f.get('location') ?? '').trim() } : {}), stages: priced })
  }
  return <form onSubmit={submit}><fieldset disabled={busy} className="space-y-4 border-0 p-0">
    <div className="grid gap-4 sm:grid-cols-2"><label className="text-xs font-medium">{land ? 'รหัสสัญญาซื้อที่ดิน' : 'รหัสสัญญาจ้างเหมา'}<input className={field} name="code" defaultValue={initial.code} maxLength={80} required /></label><label className="text-xs font-medium">{land ? 'ชื่อสัญญา / ที่ดินที่ซื้อ' : 'ชื่อสัญญา / ชื่องาน'}<input className={field} name="name" defaultValue={initial.name} maxLength={3000} required /></label><label className="text-xs font-medium">{land ? 'ชื่อผู้ขายที่ดิน' : 'ชื่อช่าง / ผู้รับเหมา'}<input className={field} name="contractor" defaultValue={initial.contractor} maxLength={3000} required /></label><label className="text-xs font-medium">{land ? 'ราคาซื้อที่ดินตามสัญญา (บาท)' : 'มูลค่าสัญญา / ราคาบ้าน (บาท)'}<input className={field} name="amount" type="number" min="0.01" max="2000000000" step="0.01" value={totalAmount || ''} onChange={e => setTotalAmount(Number(e.target.value))} required /></label><label className="text-xs font-medium">วันที่สัญญา<input className={field} name="signedOn" type="date" defaultValue={initial.signedOn} /></label></div>
    {land ? <div className="grid gap-4 sm:grid-cols-2"><label className="text-xs font-medium">เลขโฉนด / เลขที่ดิน / อ้างอิงแปลง<input className={field} name="landReference" defaultValue={initial.landReference ?? ''} maxLength={3000} /></label><label className="text-xs font-medium">ที่ตั้งที่ดิน<input className={field} name="location" defaultValue={initial.location ?? ''} maxLength={3000} /></label></div> : null}
    <section className="space-y-3 rounded-xl border border-blue-100 bg-blue-50/50 p-3"><h3 className="text-sm font-semibold">กำหนดงวดตามเปอร์เซ็นต์ของราคาสัญญา</h3><Button onClick={useProvidedSchedule}>{land ? 'ใช้ข้อมูลที่ให้: ที่ดิน 400,000 บาท · 70% / 30%' : 'ใช้ข้อมูลที่ให้: บ้าน 2,600,000 บาท · 7 งวด'}</Button><p className="text-xs leading-6 text-slate-500">{land ? '2 งวด: 70% และ 30%' : '7 งวด: 20%, 20%, 15%, 15%, 15%, 10%, 5%'} กดเพื่อเติมข้อมูลให้ตรวจแก้ก่อนบันทึก การกำหนดงวดยังไม่ใช่การจ่ายเงินจริง</p></section>
    <label className="block text-xs font-medium">วิธีกำหนดจำนวนเงินแต่ละงวด<select className={field} value={percentMode ? 'percent' : 'amount'} onChange={e => changeMode(e.target.value === 'percent')}><option value="percent">เปอร์เซ็นต์ของราคาสัญญา</option><option value="amount">กรอกจำนวนเงินโดยตรง</option></select></label>
    <h3 className="text-sm font-semibold">{land ? 'งวดชำระตามสัญญาซื้อที่ดิน' : 'งวดงานและยอดจ่ายตามข้อตกลง'}</h3>
    {stages.map((stage, index) => <div key={stage.id} className="grid gap-3 rounded-xl border border-slate-200 p-3 sm:grid-cols-2"><label className="text-xs font-medium">งวดที่<input className={field} type="number" min="1" max="10000" step="1" value={stage.number} onChange={e => update(stage.id, { number: Number(e.target.value) })} required /></label><label className="text-xs font-medium">{land ? 'รายการ / เงื่อนไข เช่น มัดจำ วันโอน' : 'ชื่องาน / เงื่อนไขส่งมอบ'}<input className={field} value={stage.name} onChange={e => update(stage.id, { name: e.target.value })} maxLength={3000} required /></label>{percentMode ? <label className="text-xs font-medium">เปอร์เซ็นต์ของราคาสัญญา (%)<input aria-label={`เปอร์เซ็นต์งวดที่ ${stage.number}`} className={field} type="number" min="0.01" max="100" step="0.01" value={stage.percent ?? 0} onChange={e => update(stage.id, { percent: Number(e.target.value) })} required /></label> : null}<label className="text-xs font-medium">จำนวนเงิน (บาท){percentMode ? <input aria-label={`จำนวนเงินงวดที่ ${stage.number}`} className={`${field} bg-slate-50`} value={money(priced[index].amount)} readOnly /> : <input className={field} type="number" min="0.01" max="2000000000" step="0.01" value={stage.amount || ''} onChange={e => update(stage.id, { amount: Number(e.target.value) })} required />}</label><label className="text-xs font-medium">กำหนดจ่าย<input className={field} type="date" value={stage.dueOn} onChange={e => update(stage.id, { dueOn: e.target.value })} /></label><Button onClick={() => setStages(rows => rows.filter(row => row.id !== stage.id))} disabled={stages.length === 1}>ลบงวดนี้</Button></div>)}
    <Button onClick={() => setStages(rows => [...rows, { id: crypto.randomUUID(), number: Math.max(0, ...rows.map(row => row.number)) + 1, name: '', amount: 0, dueOn: '', ...(percentMode ? { percent: 0 } : {}) }])}>เพิ่ม{land ? 'งวดชำระ' : 'งวดงาน'}</Button>
    <div className="rounded-xl bg-slate-50 p-3 text-sm" role="status">{percentMode ? <p className={invalidPercent ? 'text-amber-800' : 'text-emerald-700'}>รวมเปอร์เซ็นต์ {percentage}% / 100%</p> : null}<p className="mt-1 font-semibold">รวมยอดงวด {money(stageTotal)} / {money(totalAmount)} บาท</p>{invalidPercent ? <p className="mt-1 text-xs text-amber-800">ปรับเปอร์เซ็นต์ทุกงวดให้รวมครบ 100% ก่อนบันทึก</p> : null}{stageTotal > totalAmount ? <p className="mt-1 text-xs text-red-700">ยอดงวดรวมเกินราคาสัญญา</p> : null}</div>
    <label className="block text-xs font-medium">{land ? 'เงื่อนไขการซื้อขาย / หมายเหตุ' : 'ขอบเขตงาน / หมายเหตุ'}<textarea className={field} name="description" rows={3} defaultValue={initial.description} maxLength={3000} /></label><Button type="submit" variant="primary" disabled={busy || invalidPercent || stageTotal > totalAmount}>{busy ? 'กำลังบันทึก…' : land ? 'บันทึกสัญญาซื้อที่ดิน' : 'บันทึกสัญญาจ้างเหมา'}</Button>
  </fieldset></form>
}
