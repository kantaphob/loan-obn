'use client'

import { useEffect, useState } from 'react'
import { AlertCircle, CheckCircle2, ChevronDown, ExternalLink, RefreshCw, Settings2 } from 'lucide-react'
import { Button } from '@/components/ui/button'

type Status = { configured: boolean; pending: number; failed: number; synced: number; lastSyncedAt: string | null }

export function GoogleSyncButton() {
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [status, setStatus] = useState<Status | null>(null)
  const [loadError, setLoadError] = useState('')
  const [reload, setReload] = useState(0)
  useEffect(() => {
    let active = true
    const refresh = async () => {
      try {
        const response = await fetch('/api/admin/google-sync', { cache: 'no-store' })
        if (!response.ok) throw new Error(response.status === 403 ? 'เฉพาะผู้ดูแลระบบที่ตรวจสอบและซิงก์ข้อมูลได้' : 'ตรวจสอบสถานะไม่ได้ กรุณาลองอีกครั้ง')
        const result = await response.json()
        if (active) { setStatus(result); setLoadError('') }
      } catch (error) {
        if (active) { setLoadError(error instanceof Error ? error.message : 'ตรวจสอบสถานะไม่ได้'); setStatus(null) }
      }
    }
    void refresh()
    const timer = setInterval(() => { void refresh() }, 30_000)
    return () => { active = false; clearInterval(timer) }
  }, [reload])

  async function sync(retry = false) {
    if (busy || !status?.configured) return
    setBusy(true); setMessage('')
    try {
      const response = await fetch(`/api/admin/google-sync${retry ? '?retry=1' : ''}`, { method: 'POST' })
      const result = await response.json()
      if (!response.ok) {
        if (response.status === 503) setStatus((current) => current ? { ...current, configured: false } : null)
        throw new Error(result.message || 'ซิงก์ข้อมูลไม่สำเร็จ')
      }
      setStatus(result)
      setMessage(result.pending || result.failed ? 'รับเข้าคิวแล้ว ระบบจะลองซิงก์ต่ออัตโนมัติขณะเปิดแอป' : 'ซิงก์ข้อมูลสำเร็จแล้ว')
    } catch (error) { setMessage(error instanceof Error ? error.message : 'ซิงก์ข้อมูลไม่สำเร็จ') }
    finally { setBusy(false) }
  }

  return <div className="w-full space-y-4">
    <div role="status" className={`flex items-start gap-3 rounded-xl border p-4 ${loadError ? 'border-rose-200 bg-rose-50 text-rose-800' : status?.configured ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-amber-200 bg-amber-50 text-amber-900'}`}>
      {status?.configured ? <CheckCircle2 size={19} aria-hidden="true" className="mt-0.5 shrink-0" /> : <AlertCircle size={19} aria-hidden="true" className="mt-0.5 shrink-0" />}
      <div>
        <p className="m-0 text-sm font-semibold">{loadError || (status ? status.configured ? 'ตั้งค่าตัวเชื่อมต่อแล้ว' : 'ยังไม่ได้ตั้งค่าตัวเชื่อมต่อ Google' : 'กำลังตรวจสอบการตั้งค่า…')}</p>
        {status && !status.configured && <p className="mb-0 mt-1 text-xs leading-6">แอปต้องตั้งค่า URL ของ Apps Script และโทเคนซิงก์ก่อน สิทธิ์แชร์ของชีตเพียงอย่างเดียวยังไม่เพียงพอ ข้อมูลในแอปยังอยู่ตามเดิม</p>}
        {status?.configured && <p className="mb-0 mt-1 text-xs leading-6">สำเร็จ {status.synced} · รอซิงก์ {status.pending} · ล้มเหลว {status.failed}{status.lastSyncedAt ? ` · สำเร็จล่าสุด ${new Date(status.lastSyncedAt).toLocaleString('th-TH', { timeZone: 'Asia/Bangkok' })}` : ' · ยังไม่มีรายการซิงก์สำเร็จ'}</p>}
      </div>
    </div>
    <div className="flex flex-wrap items-center gap-2">
      <Button variant="primary" onClick={() => void sync()} disabled={busy || !status?.configured} title={!status?.configured ? 'ตั้งค่าตัวเชื่อมต่อก่อนซิงก์ข้อมูล' : undefined}><RefreshCw size={15} aria-hidden="true" className={busy ? 'animate-spin' : ''} />{busy ? 'กำลังเตรียมคิว…' : 'ซิงก์ข้อมูลไป Google Sheets'}</Button>
      {status?.configured && Boolean(status.failed) && <Button onClick={() => void sync(true)} disabled={busy}>ลองรายการที่ล้มเหลวอีกครั้ง</Button>}
      <Button onClick={() => { setStatus(null); setLoadError(''); setReload((value) => value + 1) }} disabled={busy}>ตรวจสอบสถานะใหม่</Button>
      <a href="https://docs.google.com/spreadsheets/d/1RwIqd0sORf0SnUrL-EYSfuc70NbEh1ZoykiX3jKW4cw/edit" target="_blank" rel="noopener noreferrer" className="inline-flex min-h-10 items-center gap-1.5 rounded-lg px-3 text-xs font-medium text-slate-600 underline-offset-4 hover:underline">เปิด Google Sheets<ExternalLink size={14} aria-hidden="true" /></a>
    </div>
    {message && <p role="status" className="m-0 text-xs leading-6 text-slate-600">{message}</p>}
    {!status?.configured && !loadError && <details className="group rounded-xl border border-slate-200 bg-slate-50 p-4">
      <summary className="flex min-h-8 cursor-pointer list-none items-center gap-2 text-sm font-semibold text-slate-700 focus-visible:outline-2 focus-visible:outline-blue-500 [&::-webkit-details-marker]:hidden"><Settings2 size={16} aria-hidden="true" />วิธีตั้งค่าการเชื่อมต่อ<ChevronDown size={15} aria-hidden="true" className="ml-auto transition-transform group-open:rotate-180" /></summary>
      <ol className="mb-0 mt-3 list-decimal space-y-2 pl-5 text-xs leading-6 text-slate-600">
        <li>สร้างโปรเจกต์ใน <a href="https://script.google.com/" target="_blank" rel="noopener noreferrer" className="underline underline-offset-4">Google Apps Script</a> แล้วใช้สคริปต์ <code>integrations/google-apps-script/Code.gs</code> ของโปรเจกต์นี้</li>
        <li>ตั้งค่า Script Properties: <code>SPREADSHEET_ID</code>, <code>ROOT_FOLDER_ID</code>, <code>CONTRACTS_FOLDER_ID</code> และ <code>SYNC_TOKEN</code> ตามเอกสาร <code>docs/google-sheets-drive-sync.md</code></li>
        <li>Deploy เป็น Web app แล้วตั้งค่า <code>GOOGLE_APPS_SCRIPT_URL</code> และ <code>GOOGLE_SYNC_TOKEN</code> ในไฟล์ <code>.env</code> ของแอป โดยใช้โทเคนเดียวกับ Apps Script</li>
        <li>เริ่มแอปใหม่ แล้วกด “ตรวจสอบสถานะใหม่” ก่อนซิงก์ข้อมูล</li>
      </ol>
    </details>}
  </div>
}
