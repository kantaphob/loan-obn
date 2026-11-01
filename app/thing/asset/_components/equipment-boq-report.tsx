'use client'

import { useState } from 'react'
import { Trash2, Unlink } from 'lucide-react'
import { ChangeOrderLines } from './change-order-lines'
import { Button } from '@/components/ui/button'
import { buildingChangeOrderLineDelta, money, type Home, type BuildingChangeOrder } from '../../_shared/model'
import { equipmentBoqReport } from '../equipment-report'

export function EquipmentBoqReport({ home, canWrite, onCreateOrder, onEditOrder, onDeleteOrder, onUnlinkBoq }: { home: Home; canWrite: boolean; onCreateOrder: () => void; onEditOrder: (order: BuildingChangeOrder) => void; onDeleteOrder: (order: BuildingChangeOrder) => Promise<void>; onUnlinkBoq: (boqId: string) => Promise<void> }) {
 const rows = equipmentBoqReport(home)
 const [error, setError] = useState('')
 const [unlinking, setUnlinking] = useState('')
 const orders = home.buildingChangeOrders ?? []
 if (!rows.length && !orders.length) return null

 async function unlink(boqId: string, name: string) {
  if (!window.confirm(`นำอุปกรณ์ที่เชื่อมกับ “${name}” ออกจากรายการเทียบ BOQ ใช่ไหม? จะไม่ลบอุปกรณ์และไม่แก้ BOQ หลัก`)) return
  setError('')
  setUnlinking(boqId)
  try { await onUnlinkBoq(boqId) }
  catch (caught) { setError(caught instanceof Error ? caught.message : 'นำรายการออกจากการเทียบไม่สำเร็จ') }
  finally { setUnlinking('') }
 }

 return <details className="mb-4 rounded-xl border border-blue-200 bg-blue-50/40 p-4"><summary className="cursor-pointer text-sm font-semibold text-blue-900">เทียบอุปกรณ์กับ BOQ / ประวัติใบงาน · เวอร์ชัน {home.boqVersion ?? 1}</summary>
  <p className="text-xs leading-6 text-slate-600">รายการเทียบเป็นข้อมูลอ้างอิงจากอุปกรณ์ที่เชื่อมกับ BOQ ไม่ใช่ใบงานเพิ่ม–ลด หากไม่ต้องการเทียบ ให้กด “นำออกจากรายการเทียบ” ในแถวนั้น</p>
  {error ? <p role="alert" className="rounded-lg bg-rose-50 px-3 py-2 text-xs text-rose-800">{error}</p> : null}
  {rows.length ? <div className="overflow-x-auto"><table className="w-full min-w-[760px] text-left text-xs"><thead><tr>{['BOQ','วัสดุ BOQ','แรง BOQ','งบที่หาไว้','มูลค่าตรวจรับ','เทียบวัสดุ BOQ','จัดการ'].map(title => <th className="p-2" key={title}>{title}</th>)}</tr></thead><tbody>{rows.map(row => <tr key={row.id} className="border-t border-blue-100"><td className="p-2">{row.name}{row.cancelled ? ' · ยกเลิกแล้ว' : ''}<small className="block">รับ {row.receivedCount} · รอตรวจรับ {row.pendingCount} รายการ</small></td><td className="p-2">{money(row.materialBudget)}</td><td className="p-2">{money(row.labor)}</td><td className="p-2">{money(row.reference)}</td><td className="p-2">{row.receivedCount ? money(row.receivedValue) : 'ยังไม่ตรวจรับ'}</td><td className="p-2">{row.difference === null ? '—' : `${row.difference > 0 ? '+' : ''}${money(row.difference)}`}</td><td className="p-2">{canWrite ? <Button disabled={Boolean(unlinking)} variant="danger" className="whitespace-nowrap px-2 py-1" onClick={() => void unlink(row.id, row.name)}><Unlink size={13} />{unlinking === row.id ? 'กำลังนำออก…' : 'นำออกจากรายการเทียบ'}</Button> : '—'}</td></tr>)}</tbody></table></div> : <p className="text-sm text-slate-600">ยังไม่มีอุปกรณ์ที่เชื่อม BOQ</p>}
  <p className="text-xs text-slate-600">การนำออกจะยกเลิกเฉพาะการเชื่อมโยงในรายงาน อุปกรณ์และรายการ BOQ หลักยังอยู่ครบ · ส่วนต่างที่แสดงยังไม่ใช่ยอดงานเพิ่ม–ลดที่ตกลงแล้ว</p>
  {orders.length ? <><h4 className="text-sm font-semibold">ใบงานเพิ่ม–ลดทั้งหมด · {orders.length} ใบ</h4>{orders.map(order => <article key={order.id} className="mb-2 rounded-lg border border-slate-200 bg-white p-3 text-xs"><div className="flex flex-wrap items-start justify-between gap-2"><div><strong>#{order.number} · {order.title}</strong><p className="mb-0 mt-1 text-slate-500">เวอร์ชัน {order.baseVersion} · {order.date} · {order.status === 'approved' ? 'อนุมัติแล้ว' : 'รออนุมัติ'} · {order.lines.length} รายการ</p></div><div className="flex flex-wrap gap-2">{canWrite && order.status === 'draft' ? <Button onClick={() => onEditOrder(order)}>ตรวจรายการ / เสนอราคา</Button> : null}{canWrite ? <Button variant="danger" disabled={Boolean(unlinking)} onClick={() => void onDeleteOrder(order)}><Trash2 size={13} />ลบใบงานนี้</Button> : null}</div></div><ChangeOrderLines order={order} home={home} /><p className="mb-0 font-semibold">{order.lines.some(line => line.pricingStatus === 'pending') ? 'ยอดยังไม่ครบ · รอตรวจสัญญาและเสนอราคา · ยอดที่กรอกแล้ว ' : 'สุทธิ '}{money(order.lines.reduce((sum, line) => sum + buildingChangeOrderLineDelta(line), 0))} บาท</p></article>)}</> : null}
  <Button disabled={!canWrite} onClick={onCreateOrder}>สร้างใบงานเพิ่ม–ลดเพื่อเสนอราคา</Button>
 </details>
}
