'use client'

import { useState, type FormEvent } from 'react'
import { Button } from '@/components/ui/button'
import { Modal } from '@/components/ui/modal'
import type { Home, HouseRoom } from '../../_shared/model'
import { houseRooms, roomKinds, roomPatch, roomSubtree } from '../house-rooms'

const input = 'mt-1 w-full rounded-xl border border-slate-300 bg-white p-2 text-sm'
export function HouseRoomDirectory({ home, canWrite, busy, selected, onSelect, onSave }: { home: Home; canWrite: boolean; busy: boolean; selected: string; onSelect: (id: string) => void; onSave: (patch: Partial<Home>, reason: string) => Promise<void> }) {
 const rooms = houseRooms(home)
 const [draft, setDraft] = useState<HouseRoom | null>(null)
 const [error, setError] = useState('')
 async function save(event: FormEvent) {
  event.preventDefault(); if (!draft || busy) return
  try {
   const row = { ...draft, name: draft.name.trim(), code: draft.code.trim() }
   await onSave(roomPatch(home, [...rooms.filter(room => room.id !== row.id), row]), `จัดการห้อง: ${row.code} ${row.name}`)
   setDraft(null)
  } catch (caught) { setError(caught instanceof Error ? caught.message : 'บันทึกห้องไม่สำเร็จ') }
 }
 async function remove() {
  if (!draft || busy || !window.confirm(`ลบห้อง “${draft.name}” ที่ไม่มีรายการใช้งานใช่ไหม?`)) return
  try {
   if (rooms.some(room => room.parentId === draft.id)) throw new Error('ย้ายห้องย่อยออกก่อนลบห้องหลัก')
   await onSave(roomPatch(home, rooms.filter(room => room.id !== draft.id)), `ลบห้องว่าง: ${draft.name}`)
   if (selected === draft.id) onSelect('')
   setDraft(null)
  } catch (caught) { setError(caught instanceof Error ? caught.message : 'ลบห้องไม่สำเร็จ') }
 }
 function card(room: HouseRoom, level = 0) {
  const names = new Set(roomSubtree(rooms, room.id).map(row => row.name))
  const count = home.items.filter(item => !item.workOrderId && names.has(item.room)).length
  return <div key={room.id} className={level ? 'ml-4 border-l-2 border-blue-100 pl-3' : ''}><div className={`mb-2 flex items-center gap-2 rounded-xl border p-3 ${selected === room.id ? 'border-blue-500 bg-blue-50' : 'border-slate-200 bg-white'}`}><button type="button" className="min-w-0 flex-1 text-left" onClick={() => onSelect(selected === room.id ? '' : room.id)} aria-pressed={selected === room.id}><small className="block text-xs text-slate-500">{room.code || 'รอรหัส'} · {roomKinds[room.kind]}</small><strong className="text-sm text-slate-800">{room.name}</strong><span className="ml-2 text-xs text-blue-700">{count} รายการ{rooms.some(row => row.parentId === room.id) ? ' รวมพื้นที่ย่อย' : ''} →</span></button>{canWrite && <Button disabled={busy} aria-label={`จัดการห้อง ${room.name}`} onClick={() => { setDraft({ ...room, code: room.code || `BLD-G${rooms.indexOf(room) + 1}` }); setError('') }}>จัดการ</Button>}</div>{rooms.filter(child => child.parentId === room.id).map(child => card(child, level + 1))}</div>
 }
 return <section className="mb-4 rounded-2xl border border-slate-200 bg-slate-50 p-4"><div className="flex flex-wrap items-center justify-between gap-2"><div><h4 className="m-0 text-sm font-semibold">BLD-B · แผนผังห้องและพื้นที่</h4><p className="my-1 text-xs text-slate-600">ห้องจริง {rooms.filter(room => room.kind === 'room').length} ห้อง · พื้นที่ {rooms.filter(room => room.kind === 'area' || room.kind === 'zone').length} · ระบบ {rooms.filter(room => room.kind === 'system').length} · กลุ่มรอจัด {rooms.filter(room => room.kind === 'group').length}</p></div><div className="flex gap-2"><Button onClick={() => onSelect('')}>ดูทุกห้อง</Button>{canWrite && <Button disabled={busy} onClick={() => { setDraft({ id: crypto.randomUUID(), code: '', name: '', kind: 'room' }); setError('') }}>+ เพิ่มห้อง / พื้นที่</Button>}</div></div><p className="text-xs text-slate-500">เลือกห้องหลักเพื่อดูสินค้ารวมพื้นที่ย่อย · สินค้าแต่ละรายการเก็บเพียงครั้งเดียว · กลุ่มห้องเดิมไม่นับเป็นจำนวนห้องจริง</p><div className="grid items-start gap-x-3 md:grid-cols-2">{rooms.filter(room => !room.parentId).map(room => card(room))}</div><Modal open={Boolean(draft)} title="จัดการห้อง / พื้นที่" onClose={() => setDraft(null)}>{draft && <form className="space-y-3" onSubmit={save}><label className="block text-sm">รหัส<input className={input} required value={draft.code} onChange={event => setDraft({ ...draft, code: event.target.value })} placeholder="เช่น BLD-BA01" /></label><label className="block text-sm">ชื่อ<input className={input} required value={draft.name} onChange={event => setDraft({ ...draft, name: event.target.value })} /></label><label className="block text-sm">ประเภท<select className={input} value={draft.kind} onChange={event => setDraft({ ...draft, kind: event.target.value as HouseRoom['kind'] })}>{Object.entries(roomKinds).map(([key, name]) => <option key={key} value={key}>{name}</option>)}</select></label><label className="block text-sm">อยู่ภายใต้<select className={input} value={draft.parentId ?? ''} onChange={event => setDraft({ ...draft, parentId: event.target.value || undefined })}><option value="">บ้าน / ส่วนกลาง</option>{rooms.filter(room => !roomSubtree(rooms, draft.id).some(child => child.id === room.id)).map(room => <option key={room.id} value={room.id}>{room.code} · {room.name}</option>)}</select></label>{error && <p role="alert" className="text-sm text-rose-700">{error}</p>}<div className="flex gap-2">{rooms.some(room => room.id === draft.id) && <Button type="button" disabled={busy} onClick={remove}>ลบห้องว่าง</Button>}<Button type="submit" variant="primary" disabled={busy}>บันทึกห้อง</Button></div></form>}</Modal></section>
}
