'use client'

import { useState } from 'react'
import { getAssetRevision } from './actions'
import { migrateAssetData, type AssetData } from './model'

export type RevisionInfo = { revision: number; reason: string; createdAt: string }
function download(text: string, name: string) {
  const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }))
  const a = document.createElement('a'); a.href = url; a.download = name; a.click(); URL.revokeObjectURL(url)
}
export function AssetHistory({ rows, canWrite, revision, restore }: { rows: RevisionInfo[]; canWrite: boolean; revision: number; restore: (data: AssetData) => Promise<boolean> }) {
  const [error, setError] = useState('')
  const [candidate, setCandidate] = useState<AssetData | null>(null)
  return <section className="asset-panel"><h2>ประวัติและกู้คืนข้อมูล</h2><p className="asset-hint">ทุกครั้งที่บันทึกจะเก็บข้อมูลทั้งชุดย้อนหลัง การกู้คืนยังตรวจสอบสัญญาและรายการบัญชีตามเดิม</p>{error ? <p role="alert" className="asset-error">{error}</p> : null}
    <label className="asset-button secondary">เลือกไฟล์สำรอง JSON<input type="file" className="sr-only" accept=".json" disabled={!canWrite} onChange={async e => {
      const file = e.target.files?.[0]; if (!file) return
      try { if (file.size > 4_000_000) throw new Error('ไฟล์ใหญ่เกินไป'); const data = migrateAssetData(JSON.parse(await file.text())); setCandidate({ ...data, revision }); setError('') }
      catch { setError('ไฟล์สำรองไม่ถูกต้อง'); setCandidate(null) }
      e.target.value = ''
    }} /></label>
    {candidate ? <div className="asset-notice"><p>ไฟล์นี้มีสินทรัพย์ {candidate.homes.length} รายการ Property {candidate.properties?.length ?? 0} รายการ และเงินกู้ {candidate.loans.length} รายการ การยืนยันจะแทนที่ชุดปัจจุบันและเก็บประวัติชุดเดิมไว้</p><div className="asset-tools"><button className="asset-button secondary" onClick={() => setCandidate(null)}>ยกเลิก</button><button className="asset-button" disabled={!canWrite} onClick={async () => { if (await restore(candidate)) setCandidate(null) }}>ยืนยันกู้คืนข้อมูล</button></div></div> : null}
    {rows.map(row => <div className="asset-summary-row" key={row.revision}><span>รุ่น {row.revision} · {row.reason}<small>{new Date(row.createdAt).toLocaleString('th-TH', { timeZone: 'Asia/Bangkok' })}</small></span><button className="asset-button secondary" onClick={async () => { try { download(await getAssetRevision(row.revision), `assets-revision-${row.revision}.json`) } catch { setError('ดาวน์โหลดประวัติไม่สำเร็จ') } }}>ดาวน์โหลด</button></div>)}
  </section>
}
