'use client'

import { useState, type FormEvent } from 'react'
import { Button } from '@/components/ui/button'
import { Modal } from '@/components/ui/modal'
import { contractPrice, money, roundMoney, today, type BankLoan, type ContractVariation, type ContractorContract } from '@/app/thing/_shared/model'

const field = 'mt-1 min-h-11 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm focus:outline-blue-400'
const kindLabel = { add: 'งานเพิ่ม', deduct: 'งานลด' }
const statusLabel = { draft: 'ร่าง', approved: 'ตกลงแล้ว', cancelled: 'ยกเลิก' }
export function VariationOrders({ loan, canWrite, busy, onSave, onContracts }: { loan: BankLoan; canWrite: boolean; busy: boolean; onSave: (contractId: string, variation: ContractVariation) => Promise<boolean>; onContracts: () => void }) {
  const contracts = (loan.contractorContracts ?? []).filter(c => c.kind !== 'land_purchase')
  const [selectedId, setSelectedId] = useState(contracts[0]?.id ?? '')
  const contract = contracts.find(c => c.id === selectedId) ?? contracts[0]
  const [editing, setEditing] = useState<ContractVariation | null>(null)
  function create() {
    let n = 1
    const codes = (loan.contractorContracts ?? []).flatMap(c => (c.variations ?? []).map(v => v.code))
    while (codes.includes(`VO-${String(n).padStart(3, '0')}`)) n++
    setEditing({ id: crypto.randomUUID(), code: `VO-${String(n).padStart(3, '0')}`, kind: 'add', name: '', quantity: 1, unit: 'งาน', unitPrice: 0, amount: 0, date: today(), status: 'draft', reference: '', notes: '' })
  }
  if (!contract) return <div className="space-y-3 py-5 text-sm text-slate-500"><p>เพิ่มสัญญาจ้างเหมาก่อนบันทึกงานที่ต่างจาก BOQ หรือข้อตกลงเดิม</p><Button onClick={onContracts}>ไปสัญญาจ้างเหมา</Button></div>
  const price = contractPrice(contract)
  return <div className="space-y-5"><div className="flex flex-wrap items-end justify-between gap-3"><label className="min-w-60 flex-1 text-xs font-medium">สัญญาที่ปรับงาน<select className={field} value={contract.id} onChange={e => setSelectedId(e.target.value)}>{contracts.map(c => <option key={c.id} value={c.id}>{c.code} · {c.name} · {c.contractor}</option>)}</select></label>{canWrite ? <Button variant="primary" disabled={busy} onClick={create}>เพิ่มรายการงานเพิ่ม–งานลด</Button> : null}</div>
    <p className="text-xs leading-6 text-slate-500">เก็บราคาเดิมไว้ ใช้เฉพาะรายการสถานะ “ตกลงแล้ว” มาปรับราคาสัญญา งานเพิ่มแยกเป็นงวดใหม่ได้ ส่วนงานลดให้ระบุงวดเดิมที่ปรับลด</p>
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{[['ราคาสัญญาเดิม', price.original], ['งานเพิ่มที่ตกลงแล้ว', price.additions], ['งานลดที่ตกลงแล้ว', price.deductions], ['ราคาสุทธิหลังปรับ', price.net]].map(([label, value]) => <div key={String(label)} className="rounded-xl border border-slate-200 bg-slate-50 p-4"><p className="text-xs text-slate-500">{label}</p><strong className="mt-2 block tabular-nums">{money(Number(value))} บาท</strong></div>)}</div>
    <div className="overflow-x-auto rounded-xl border border-slate-200"><table className="w-full whitespace-nowrap text-left text-xs"><thead className="bg-slate-50"><tr>{['รหัส / วันที่', 'ประเภท / รายการ', 'งวดที่ปรับ', 'ราคาเพิ่ม–ลด', 'สถานะ', ''].map((h, i) => <th key={i} className="px-3 py-3">{h}</th>)}</tr></thead><tbody>{contract.variations?.map(row => <tr key={row.id} className="border-t border-slate-100"><td className="px-3 py-3 font-medium">{row.code}<p className="mt-1 font-normal text-slate-500">{row.date}</p></td><td className="px-3 py-3">{kindLabel[row.kind]} · {row.name}<p className="mt-1 text-slate-500">{row.quantity} {row.unit} × {money(row.unitPrice)}</p>{row.reference ? <p className="mt-1 text-slate-500">อ้างอิง {row.reference}</p> : null}</td><td className="px-3 py-3">{row.stageId ? `งวด ${contract.stages.find(s => s.id === row.stageId)?.number ?? '—'}` : 'แยกเป็นงวดงานเพิ่ม'}</td><td className={`px-3 py-3 font-semibold tabular-nums ${row.kind === 'add' ? 'text-orange-700' : 'text-emerald-700'}`}>{row.kind === 'add' ? '+' : '−'}{money(row.amount)}</td><td className="px-3 py-3">{statusLabel[row.status]}</td><td className="px-3 py-3">{canWrite ? <Button onClick={() => setEditing(structuredClone(row))} disabled={busy}>แก้ไข</Button> : null}</td></tr>)}</tbody></table></div>
    {!contract.variations?.length ? <p className="py-6 text-center text-sm text-slate-500">ยังไม่มีงานเพิ่ม–งานลดของสัญญานี้</p> : null}
    <p className="text-xs leading-6 text-slate-500">การบันทึกข้อตกลงงานเพิ่ม–งานลดไม่สร้างรายการเงินใน ledger เมื่อตกลงแล้วจึงเลือกงวดที่ปรับหรือ VO ในหน้า “รับจ่าย” เพื่อจ่ายเงินจริง ระบบตรวจไม่ให้ลดงวดเหลือต่ำกว่ายอดที่จ่ายไปแล้ว</p>
    <Modal open={!!editing} title="งานเพิ่ม–งานลดจาก BOQ / สัญญา" onClose={() => { if (!busy) setEditing(null) }}>{editing ? <VariationForm key={`${contract.id}-${editing.id}`} initial={editing} contract={contract} busy={busy} onSave={async row => { if (await onSave(contract.id, row)) setEditing(null) }} /> : null}</Modal>
  </div>
}

function VariationForm({ initial, contract, busy, onSave }: { initial: ContractVariation; contract: ContractorContract; busy: boolean; onSave: (variation: ContractVariation) => Promise<void> }) {
  const [kind, setKind] = useState(initial.kind)
  const [target, setTarget] = useState(initial.stageId ?? '')
  const [quantity, setQuantity] = useState(initial.quantity)
  const [unitPrice, setUnitPrice] = useState(initial.unitPrice)
  const amount = roundMoney(quantity * unitPrice)
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const f = new FormData(event.currentTarget)
    const next: ContractVariation = { ...initial, code: String(f.get('code') ?? '').trim(), name: String(f.get('name') ?? '').trim(), date: String(f.get('date')), kind, status: String(f.get('status')) as ContractVariation['status'], quantity, unit: String(f.get('unit') ?? '').trim(), unitPrice, amount, reference: String(f.get('reference') ?? '').trim(), notes: String(f.get('notes') ?? '').trim() }
    if (target) next.stageId = target; else delete next.stageId
    await onSave(next)
  }
  return <form onSubmit={submit}><fieldset disabled={busy} className="space-y-4 border-0 p-0"><p className="text-xs text-slate-500">{contract.code} · {contract.name} · {contract.contractor}</p><div className="grid gap-4 sm:grid-cols-2"><label className="text-xs font-medium">รหัสงานเพิ่ม–งานลด<input className={field} name="code" defaultValue={initial.code} maxLength={80} required /></label><label className="text-xs font-medium">วันที่ข้อตกลง<input className={field} name="date" type="date" defaultValue={initial.date} required /></label><label className="text-xs font-medium">ประเภท<select className={field} value={kind} onChange={e => setKind(e.target.value as typeof kind)}><option value="add">งานเพิ่ม (+)</option><option value="deduct">งานลด (−)</option></select></label><label className="text-xs font-medium">สถานะ<select className={field} name="status" defaultValue={initial.status}><option value="draft">ร่าง · ยังไม่ปรับราคา</option><option value="approved">ตกลงแล้ว · ปรับราคาสัญญา</option><option value="cancelled">ยกเลิก · เก็บประวัติ</option></select></label></div>
    <label className="block text-xs font-medium">รายการงานที่เปลี่ยนจาก BOQ เดิม<input className={field} name="name" defaultValue={initial.name} maxLength={3000} required /></label><label className="block text-xs font-medium">งวดงานที่ปรับ<select className={field} value={target} onChange={e => setTarget(e.target.value)} required={kind === 'deduct'}><option value="">{kind === 'add' ? 'แยกเป็นงวดงานเพิ่มใหม่' : 'เลือกงวดเดิมที่ลดงาน'}</option>{contract.stages.map(stage => <option key={stage.id} value={stage.id}>งวด {stage.number} · {stage.name}</option>)}</select></label>
    <div className="grid gap-3 sm:grid-cols-3"><label className="text-xs font-medium">จำนวน<input className={field} type="number" min="0.000001" max={1e12} step="any" value={quantity} onChange={e => setQuantity(Number(e.target.value))} required /></label><label className="text-xs font-medium">หน่วย<input className={field} name="unit" defaultValue={initial.unit} maxLength={100} required /></label><label className="text-xs font-medium">ราคาต่อหน่วย (บาท)<input className={field} type="number" min="0.01" max={1e12} step="0.01" value={unitPrice || ''} onChange={e => setUnitPrice(Number(e.target.value))} required /></label></div><p className="rounded-xl bg-slate-50 p-4 text-sm font-semibold">ส่วนต่าง{kind === 'add' ? 'เพิ่ม' : 'ลด'} {money(amount)} บาท</p>
    <label className="block text-xs font-medium">อ้างอิง BOQ / ใบเสนอราคา<input className={field} name="reference" defaultValue={initial.reference} maxLength={3000} /></label><label className="block text-xs font-medium">เหตุผล / หมายเหตุ<textarea className={field} name="notes" defaultValue={initial.notes} maxLength={3000} rows={3} /></label><Button type="submit" variant="primary" disabled={busy || amount <= 0}>{busy ? 'กำลังบันทึก…' : 'บันทึกงานเพิ่ม–งานลด'}</Button></fieldset></form>
}
