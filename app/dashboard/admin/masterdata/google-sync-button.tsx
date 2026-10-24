'use client'

import { useEffect, useState } from 'react'

type Status = { configured: boolean; pending: number; failed: number; synced: number; lastSyncedAt: string | null }
export function GoogleSyncButton() {
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [status, setStatus] = useState<Status | null>(null)
  useEffect(() => {
    let active = true
    const refresh = async () => {
      try { const response = await fetch('/api/admin/google-sync'); if (response.ok && active) setStatus(await response.json()) } catch { /* Keep the last known state while offline. */ }
    }
    void refresh()
    const timer = setInterval(() => { void refresh() }, 30_000)
    return () => { active = false; clearInterval(timer) }
  }, [])
  async function sync(retry = false) {
    if (busy) return
    setBusy(true); setMessage('')
    try {
      const response = await fetch(`/api/admin/google-sync${retry ? '?retry=1' : ''}`, { method: 'POST' })
      const result = await response.json()
      if (!response.ok) throw new Error(result.message || 'ซิงก์ข้อมูลไม่สำเร็จ')
      setStatus(result)
      setMessage(result.pending || result.failed ? 'รับเข้าคิวแล้ว ระบบจะลองซิงก์ต่ออัตโนมัติขณะเปิดแอป' : 'ซิงก์ข้อมูลสำเร็จแล้ว')
    } catch (error) { setMessage(error instanceof Error ? error.message : 'ซิงก์ข้อมูลไม่สำเร็จ') }
    finally { setBusy(false) }
  }
  const button = 'rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm disabled:opacity-60'
  return <div className="space-y-3"><div className="flex flex-wrap items-center gap-3">
    <button type="button" onClick={() => sync()} disabled={busy} className={button}>{busy ? 'กำลังเตรียมคิว…' : 'ซิงก์ข้อมูลไป Google Sheets'}</button>
    {Boolean(status?.failed) && <button type="button" onClick={() => sync(true)} disabled={busy} className={button}>ลองรายการที่ล้มเหลวอีกครั้ง</button>}
    <span role="status" className="text-sm text-slate-600">{message}</span>
  </div>{status && <p className="text-xs leading-6 text-slate-600">{status.configured ? `ซิงก์สำเร็จ ${status.synced} · รอซิงก์ ${status.pending} · ล้มเหลว ${status.failed}${status.lastSyncedAt ? ` · สำเร็จล่าสุด ${new Date(status.lastSyncedAt).toLocaleString('th-TH', { timeZone: 'Asia/Bangkok' })}` : ''}` : 'ยังไม่ได้เชื่อมต่อ Google · ข้อมูลที่รอซิงก์เก็บอยู่ในเครื่อง'}</p>}</div>
}
