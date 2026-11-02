'use client'

import { useState, useSyncExternalStore, type CSSProperties } from 'react'
import dynamic from 'next/dynamic'
import { Activity, Check, ChevronRight, Code2, FileCheck2, LoaderCircle, Play, Radio, ScrollText, WifiOff, X } from 'lucide-react'
import { agentStates, type AgentState, type AgentStation } from '@/lib/agent-village/protocol'
import { useAgentStream } from './use-agent-stream'
import './agent-village.css'

const CoderCharacter = dynamic(() => import('./coder-character').then(m => m.CoderCharacter), { ssr: false, loading: () => <div className="village-loading">กำลังโหลด Rive…</div> })
const states: Record<AgentState, { label: string; pose: number }> = {
  idle: { label: 'พัก · ดื่มชา', pose: 0 }, thinking: { label: 'วางแผน', pose: 1 }, working: { label: 'ทำงาน', pose: 3 },
  tool_calling: { label: 'เรียกเครื่องมือ', pose: 4 }, handoff: { label: 'ส่งงาน', pose: 5 }, success: { label: 'สำเร็จ', pose: 6 }, error: { label: 'พบข้อผิดพลาด', pose: 7 },
}
const stations: Record<AgentStation, { x: number; label: string }> = { tea: { x: 36, label: 'ศาลาพัก' }, planning: { x: 45, label: 'โต๊ะวางแผน' }, desk: { x: 64, label: 'โต๊ะ Coder' }, tools: { x: 78, label: 'หอเครื่องมือ' }, review: { x: 50, label: 'จุดส่งรายงาน' } }
const formatTime = (at: string) => new Intl.DateTimeFormat('th-TH', { hour: '2-digit', minute: '2-digit', second: '2-digit', timeZone: 'Asia/Bangkok' }).format(new Date(at))
const subscribeMotion = (callback: () => void) => { const m = matchMedia('(prefers-reduced-motion: reduce)'); m.addEventListener('change', callback); return () => m.removeEventListener('change', callback) }
const readMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches

export function AgentVillage() {
  const { snapshot, connection } = useAgentStream()
  const [pending, setPending] = useState(false)
  const [consoleOpen, setConsoleOpen] = useState(false)
  const [requestError, setRequestError] = useState('')
  const [traveling, setTraveling] = useState(false)
  const [manualPause, setManualPause] = useState(false)
  const reduced = useSyncExternalStore(subscribeMotion, readMotion, () => true)
  const current = snapshot?.current
  const state = current?.state ?? 'idle'
  const station = current?.station ?? 'tea'
  const online = connection === 'online' && !!snapshot
  const active = snapshot?.active ?? false
  const paused = manualPause || reduced || !online
  const report = snapshot?.report
  const task = current?.task ?? 'กำลังรอสถานะจากเซิร์ฟเวอร์'

  async function startRun() {
    setPending(true)
    setRequestError('')
    try {
      const response = await fetch('/api/agent-village/run', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error ?? 'เริ่มภารกิจไม่สำเร็จ')
      // Character state only changes from server events, never from this button.
    } catch (error) { setRequestError(error instanceof Error ? error.message : 'เชื่อมต่อเซิร์ฟเวอร์ไม่สำเร็จ') }
    finally { setPending(false) }
  }

  return <section id="agent-village" className="village" aria-labelledby="village-title" data-connection={connection} data-agent-state={state}>
    <div className="village-heading"><div><span className="sect-smallLabel">ANIMATED AGENT VILLAGE · PILOT 01</span><h2 id="village-title">หอช่างคัมภีร์ <span>Coder</span></h2><p>ตัวละคร Rive เคลื่อนไหวตามงานบนเซิร์ฟเวอร์ · จุดเริ่มต้นของสำนัก AI ที่มีชีวิต</p></div><div className={`village-connection ${online ? 'is-online' : ''}`}>{online ? <Radio size={13} /> : <WifiOff size={13} />}{online ? 'เชื่อม WebSocket แล้ว' : connection === 'connecting' ? 'กำลังเชื่อมต่อ…' : 'ขาดการเชื่อมต่อ · กำลังลองใหม่'}</div></div>
    <div className="village-workspace"><div className="village-worldColumn">
      <div className={`village-stage ${paused ? 'is-paused' : ''}`} aria-label={`Coder: ${online ? states[state].label : 'แสดงข้อมูลล่าสุด'} · ${task}`}>
        <div className="village-scenery" aria-hidden="true" /><div className="village-stageTitle"><span>หอช่างเมฆา · สถานีทดลอง</span><small>RIVE 2D RIG / LIVE EVENTS</small></div><div className="village-lantern" aria-hidden="true"><i /><span /></div><div className="village-floor" aria-hidden="true" />
        {Object.entries(stations).map(([key, spot]) => <div key={key} className={`village-station village-${key} ${station === key ? 'is-current' : ''}`} style={{ left: `${spot.x}%` }} aria-hidden="true"><div className="village-stationArt">{key === 'tea' ? <><i className="village-teapot" /><i className="village-lowTable" /></> : key === 'desk' ? <><div className="village-monitor"><Code2 size={22} /></div><i className="village-workDesk" /><i className="village-chair" /></> : key === 'tools' ? <><div className="village-toolShelf"><span>工</span><i /><i /></div></> : key === 'review' ? <><div className="village-reportBox"><FileCheck2 size={22} /></div><i className="village-lowTable" /></> : <><div className="village-scroll"><ScrollText size={24} /></div><i className="village-lowTable" /></>}</div><span className="village-stationLabel">{spot.label}</span></div>)}
        <div className="village-actor" data-station={station} style={{ left: `${stations[station].x}%`, '--actor-state': state } as CSSProperties} onTransitionRun={e => {if(e.propertyName === 'left') setTraveling(true)}} onTransitionEnd={e => {if(e.propertyName === 'left') setTraveling(false)}} onTransitionCancel={e => {if(e.propertyName === 'left') setTraveling(false)}}>
          <div className={`village-taskBubble state-${state}`}><strong>云墨 · Coder <span>{online ? states[state].label : 'ข้อมูลล่าสุด'}</span></strong><p>{task}</p>{traveling && !paused && <small>กำลังเดินไป{stations[station].label}</small>}</div>
          <CoderCharacter pose={traveling && !paused ? 2 : states[state].pose} paused={paused} />
        </div>
        {!online && <div className="village-disconnected">{connection === 'connecting' ? 'กำลังรอข้อมูลจาก WebSocket…' : 'หยุดภาพเคลื่อนไหว · รอเชื่อมต่อใหม่'}</div>}
        <div className="village-stageFooter"><span>{online ? `EVENT #${snapshot.sequence} · ${current?.taskId ? current.taskId.slice(0,8) : 'รอภารกิจ'}` : 'ไม่มีการสุ่มเปลี่ยนสถานะ'}</span><label><input type="checkbox" checked={manualPause} onChange={e => {setManualPause(e.target.checked); setTraveling(false)}} /> ลดการเคลื่อนไหว</label></div>
      </div>
      <div className="village-stateLegend" aria-label="สถานะที่รองรับ">{agentStates.map(s => <span key={s} className={state === s && online ? 'is-current' : ''}><i />{s === 'tool_calling' ? 'Tool calling' : s.charAt(0).toUpperCase()+s.slice(1)}</span>)}</div>
    </div><aside className={`village-console ${consoleOpen ? 'is-open' : ''}`} aria-label="ภารกิจและบันทึกเหตุการณ์"><button className="guild-consoleClose" aria-label="ปิดรายการงาน" onClick={() => setConsoleOpen(false)}><X size={18} /></button><div className="village-consoleTitle"><ScrollText size={16} /><h3>ภารกิจ Coder</h3><span>อ่านอย่างเดียว</span></div><h4>ตรวจความพร้อมของโปรเจกต์</h4><p>อ่านไฟล์งาน 11 จุด เรียก TypeScript จริง แล้วส่งผลให้ตัวตรวจรายงาน</p><button className="village-run" onClick={startRun} disabled={!online || pending || active}>{pending || active ? <LoaderCircle size={15} className="village-spin" /> : <Play size={15} />}{pending ? 'กำลังส่งคำสั่ง…' : active ? 'Coder กำลังทำงาน' : 'ให้ Coder ตรวจโปรเจกต์'}<ChevronRight size={14} /></button>{requestError && <p className="village-requestError" role="alert">{requestError}</p>}<p className="village-scopeNote">งานระบบจริง · ยังไม่เชื่อม LLM และยังไม่เขียนโค้ดให้อัตโนมัติ</p>
      <div className="village-logTitle"><h4>เหตุการณ์จากเซิร์ฟเวอร์</h4><span>{snapshot?.history.length ?? 0} EVENTS</span></div><ol className="village-events" aria-label="บันทึกเหตุการณ์">{snapshot?.history.length ? [...snapshot.history].reverse().slice(0,12).map(event => <li key={`${event.sessionId}-${event.sequence}`}><span className={`village-eventDot state-${event.state}`} /><div><strong>coder.{event.state}</strong><p>{event.task}</p><small>#{event.sequence} · {formatTime(event.at)}</small></div></li>) : <li className="village-noEvents">ยังไม่มีภารกิจ · Coder รออยู่ที่ศาลาพัก</li>}</ol>
    {report && <details className="village-report" open><summary>{report.passed ? <Check size={16} /> : <FileCheck2 size={16} />}ผลตรวจจริง: {report.summary}<span>ดูรายละเอียด</span></summary><div className="village-reportBody"><p>งาน {report.taskId.slice(0,8)} · เสร็จเมื่อ {formatTime(report.finishedAt)} · บันทึกรายงานไว้ที่เซิร์ฟเวอร์</p><ul>{report.files.map(file => <li key={file.file}><span className={file.found ? 'is-found' : ''}>{file.found ? '✓' : '✕'}</span><code>{file.file}</code></li>)}</ul><p>TypeScript: {report.typeCheck.passed ? 'ผ่าน' : 'ไม่ผ่าน'}{report.typeCheck.timedOut ? ' · เกินเวลา 90 วินาที' : ''}</p>{report.typeCheck.diagnostics && <pre>{report.typeCheck.diagnostics}</pre>}</div></details>}
    </aside></div>
    <div className="guild-controls" aria-label="ควบคุมสำนัก"><button className="guild-start" onClick={startRun} disabled={!online || pending || active}>{active || pending ? <LoaderCircle size={14} className="village-spin" /> : <Play size={14} />}{active ? 'กำลังทำงาน' : 'ตรวจโปรเจกต์'}</button><button className={consoleOpen ? 'is-active' : ''} onClick={() => setConsoleOpen(v => !v)} aria-expanded={consoleOpen}><Activity size={14} />กิจกรรม{snapshot?.history.length ? <span>{snapshot.history.length}</span> : null}</button><button onClick={() => setConsoleOpen(true)}><FileCheck2 size={14} />รายงาน{report && <i />}</button><label><input type="checkbox" checked={manualPause} onChange={e => {setManualPause(e.target.checked); setTraveling(false)}} />ลดการเคลื่อนไหว</label></div>
    <div className="guild-livePlaque"><span className={online ? 'is-live' : ''}>{online ? 'LIVE' : 'OFFLINE'}</span><p>{online ? states[state].label : 'กำลังเชื่อมต่อ'}<small>{active ? 'Coder กำลังตรวจโปรเจกต์จริง' : report ? 'รายงานพร้อมตรวจ' : 'รอรับภารกิจ'}</small></p></div>
    <div className="village-announcement" role="status" aria-live="polite">{online ? `${states[state].label} · ${task}` : 'กำลังรอสถานะจากเซิร์ฟเวอร์'}</div>

  </section>
}
