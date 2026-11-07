'use client'

import { useState, useSyncExternalStore } from 'react'
import { useDaysUntilStudyDeadline } from './exam-countdown'
import type { summarizeStudyProgress } from '@/lib/study-progress'

type Progress = ReturnType<typeof summarizeStudyProgress>
const hours = (seconds: number) => (seconds / 3600).toFixed(2)
const percent = (done: number, total: number) => total ? 100 * done / total : 0

const preferenceChange = 'obn-guru-academy-plan-change'
const dailyHoursKey = 'obn-guru-academy-daily-hours'
const studyDeadlineKey = 'obn-guru-academy-study-deadline'
const defaultDailyHours = '4'
const defaultStudyDeadline = '2026-11-27'
const sessionPreferences = new Map<string, string>()

function readPreference(key: string, fallback: string) {
  const sessionValue = sessionPreferences.get(key) ?? fallback
  try {
    return localStorage.getItem(key) ?? sessionValue
  } catch {
    return sessionValue
  }
}

function subscribePreferences(onChange: () => void) {
  window.addEventListener(preferenceChange, onChange)
  window.addEventListener('storage', onChange)
  return () => {
    window.removeEventListener(preferenceChange, onChange)
    window.removeEventListener('storage', onChange)
  }
}

function savePreference(key: string, value: string) {
  sessionPreferences.set(key, value)
  try {
    localStorage.setItem(key, value)
  } catch {
    // Keep the value available while this tab is open.
  }
  window.dispatchEvent(new Event(preferenceChange))
}

export function StudyProgress({ rows }: { rows: Progress }) {
  const [speed, setSpeed] = useState(1.5)
  const dailyHours = useSyncExternalStore(subscribePreferences, () => readPreference(dailyHoursKey, defaultDailyHours), () => defaultDailyHours)
  const studyDeadline = useSyncExternalStore(subscribePreferences, () => readPreference(studyDeadlineKey, defaultStudyDeadline), () => defaultStudyDeadline)
  const daysLeft = useDaysUntilStudyDeadline(studyDeadline)
  const total = rows.reduce((sum, row) => sum + row.total, 0)
  const done = rows.reduce((sum, row) => sum + row.completed, 0)
  const totalSeconds = rows.reduce((sum, row) => sum + row.totalSeconds, 0)
  const doneSeconds = rows.reduce((sum, row) => sum + row.completedSeconds, 0)
  const missingDurations = rows.reduce((sum, row) => sum + row.missingDurations, 0)
  const remainingSeconds = (totalSeconds - doneSeconds) / speed
  const remainingHours = remainingSeconds / 3600
  const hoursPerDay = dailyHours.trim() === '' ? NaN : Number(dailyHours)
  const availableHours = daysLeft === null || !Number.isFinite(hoursPerDay) || hoursPerDay < 0 || hoursPerDay > 24
    ? null
    : daysLeft * hoursPerDay
  const balance = availableHours === null ? null : availableHours - remainingHours
  const progress = percent(done, total)
  const workload = rows
    .filter(row => row.completed < row.total)
    .map(row => ({ ...row, remaining: (row.totalSeconds - row.completedSeconds) / speed }))
    .sort((a, b) => b.remaining - a.remaining)
  const highlights = [
    { label: 'ความคืบหน้ารวม', value: progress.toFixed(1) + '%', detail: `เรียนครบแล้ว ${rows.filter(row => row.total > 0 && row.completed === row.total).length} จาก ${rows.length} หมวด` },
    { label: 'เรียนจบแล้ว', value: `${done} / ${total} ตอน`, detail: `ยังเหลือ ${total - done} ตอน` },
    { label: 'เวลาเรียนที่เหลือ', value: hours(remainingSeconds) + ' ชม.', detail: `ที่ความเร็ว ${speed}×` },
    { label: 'เวลาเรียนที่มี', value: availableHours === null ? '—' : availableHours.toFixed(1) + ' ชม.', detail: daysLeft === null ? 'ตามวันที่เป้าหมายที่เลือก' : `เหลือ ${daysLeft} วันถึงเป้าหมาย` },
  ]

  return <section className="grid gap-4" aria-labelledby="study-planner-title">
    <div className="rounded-3xl border border-teal-100 bg-teal-50/70 p-4 sm:p-6">
      <div className="mb-5">
        <p className="text-xs font-semibold tracking-widest text-teal-700">STUDY PLANNER</p>
        <h2 id="study-planner-title" className="mt-1 text-xl font-bold text-teal-950 sm:text-2xl">เส้นทางสู่วันสอบ</h2>
      </div>
      <dl className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        {highlights.map(({ label, value, detail }, index) => <div key={label} className={`min-w-0 rounded-2xl border p-3 sm:p-4 ${index === 0 ? 'border-teal-800 bg-teal-800 text-white' : 'border-teal-100 bg-white text-teal-950'}`}>
          <dt className="text-xs font-medium sm:text-sm">{label}</dt>
          <dd className="my-2 text-xl font-bold tabular-nums sm:text-2xl">{value}</dd>
          <dd className={`text-xs ${index === 0 ? 'text-teal-100' : 'text-slate-600'}`}>{detail}</dd>
        </div>)}
      </dl>
    </div>
    <div className="grid gap-4 lg:grid-cols-2">
      <div className="rounded-2xl border border-slate-200 bg-white p-5">
        <h3 className="mb-4 font-semibold text-teal-950">วางแผนเรียนให้จบตามเป้าหมาย</h3>
        <div className="mb-4 grid gap-3 sm:grid-cols-2">
          <label className="grid gap-1 text-sm">ความเร็วเล่น
            <select className="rounded-lg border border-slate-300 bg-white p-2" value={speed} onChange={event => setSpeed(Number(event.target.value))}>
              {[1, 1.25, 1.5, 1.75, 2].map(value => <option key={value} value={value}>{value}×</option>)}
            </select>
          </label>
          <label className="grid gap-1 text-sm">ชั่วโมงที่จัดเวลาเรียนได้ต่อวัน
            <input className="rounded-lg border border-slate-300 p-2" type="number" min="0" max="24" step="any" placeholder="เช่น 4 ชม." value={dailyHours} onChange={event => savePreference(dailyHoursKey, event.target.value)} />
          </label>
          <label className="grid gap-1 text-sm sm:col-span-2">เป้าหมายเรียนจบ
            <input className="min-w-0 rounded-lg border border-slate-300 p-2" type="date" value={studyDeadline} onChange={event => savePreference(studyDeadlineKey, event.target.value)} />
          </label>
        </div>
        <div className="mb-3 rounded-lg bg-teal-50 px-3 py-2 text-sm text-teal-950">
          {!studyDeadline && <p>เลือกวันที่เป้าหมายเพื่อคำนวณเวลาเรียนที่มี</p>}
          {daysLeft !== null && <p className="mt-1">เวลาเรียนที่มี = ชั่วโมงต่อวัน × {daysLeft} วันที่เหลือถึงเป้าหมาย</p>}
          {daysLeft !== null && daysLeft > 0 && missingDurations === 0 && <p className="mt-1">เฉลี่ยดูวิดีโอวันละ {hours(remainingSeconds / daysLeft)} ชม. เพื่อเรียนให้ทัน</p>}
        </div>
        <dl className="divide-y divide-slate-100 text-sm">
          {[
            ['เวลาวิดีโอทั้งหมด (1×)', totalSeconds],
            ['เวลาวิดีโอที่เรียนจบ (1×)', doneSeconds],
            ['เวลาวิดีโอที่เหลือ (1×)', totalSeconds - doneSeconds],
          ].map(([label, seconds]) => <div className="flex justify-between gap-3 py-2" key={label}>
            <dt>{label}</dt><dd className="whitespace-nowrap font-semibold tabular-nums">{hours(Number(seconds))} ชม.</dd>
          </div>)}
        </dl>
        {balance !== null && missingDurations === 0 && <div className={`mt-4 rounded-xl p-4 ${balance >= 0 ? 'bg-emerald-50 text-emerald-950' : 'bg-amber-50 text-amber-950'}`} aria-live="polite">
          <p className="text-sm font-medium">{balance >= 0 ? 'มีเวลาพอสำหรับวิดีโอ' : 'เวลาไม่พอสำหรับวิดีโอ'}</p>
          <p className="mt-1 text-xl font-bold tabular-nums">{balance >= 0 ? 'เหลือเผื่อ' : 'ขาดอีก'} {Math.abs(balance).toFixed(2)} ชม.</p>
          {balance >= 0 && <p className="mt-1 text-xs">เวลาที่เหลือสำหรับพัก ทำโจทย์ และทบทวน</p>}
        </div>}
        {missingDurations > 0 && <p className="mt-3 text-sm text-slate-600">ยังไม่มีระยะเวลาวิดีโอ {missingDurations} ตอน ยอดเวลาแสดงเฉพาะตอนที่มีข้อมูล</p>}
      </div>
      <figure className="grid justify-items-center gap-4 rounded-xl border border-slate-200 bg-white p-5">
        <figcaption className="font-semibold">สัดส่วนตอนที่เรียนจบ</figcaption>
        <div className="grid size-44 place-items-center rounded-full sm:size-52" style={{ background: total ? `conic-gradient(#0f766e ${progress}%, #fed7aa 0)` : '#e2e8f0' }}>
          <div className="grid size-32 place-items-center rounded-full bg-white sm:size-40"><strong className="text-3xl text-teal-800 tabular-nums">{progress.toFixed(1)}%</strong></div>
        </div>
        <div className="flex flex-wrap justify-center gap-4 text-sm">
          <span><span className="mr-2 inline-block size-3 rounded-full bg-teal-700" aria-hidden="true" />เรียนจบแล้ว {done} ตอน</span>
          <span><span className="mr-2 inline-block size-3 rounded-full bg-orange-200" aria-hidden="true" />ยังไม่จบ {total - done} ตอน</span>
        </div>
      </figure>
    </div>
    {workload.length > 0 && <section className="rounded-2xl border border-slate-200 bg-white p-5" aria-labelledby="study-workload">
      <h3 id="study-workload" className="font-semibold text-teal-950">วิชาที่ใช้เวลาเรียนมากที่สุด</h3>
      <p className="mt-1 text-sm text-slate-600">3 หมวดที่เหลือวิดีโอนานที่สุด ที่ความเร็ว {speed}×</p>
      <ol className="mt-4 grid gap-3 lg:grid-cols-3">
        {workload.slice(0, 3).map((row, index) => <li key={row.title} className="rounded-xl border border-teal-100 bg-teal-50/50 p-4">
          <div className="flex items-center gap-2">
            <span className="grid size-6 shrink-0 place-items-center rounded-full bg-teal-800 text-xs font-semibold text-white">{index + 1}</span>
            <span className="text-sm font-semibold text-teal-950">{row.title}</span>
          </div>
          <p className="mt-3 text-lg font-bold tabular-nums text-teal-900">{hours(row.remaining)} ชม.</p>
          <p className="text-xs text-slate-600">เหลือ {row.total - row.completed} ตอน</p>
        </li>)}
      </ol>
    </section>}
    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
      <h3 className="px-5 py-4 font-semibold text-teal-950" id="study-progress-by-course">ความคืบหน้าแยกรายวิชา</h3>
      <div className="overflow-x-auto" tabIndex={0} role="region" aria-labelledby="study-progress-by-course">
        <table className="w-full min-w-[54rem] text-sm tabular-nums">
          <thead className="bg-teal-900 text-white"><tr>{['วิชา', 'ทั้งหมด', 'จบแล้ว', 'ยังเหลือ', 'จบ (%)', 'เวลาทั้งหมด 1× (ชม.)', 'เวลาที่จบ 1× (ชม.)', 'เหลือที่ ' + speed + '× (ชม.)', 'ความคืบหน้า'].map((label, index) => <th key={label} scope="col" className={`px-3 py-3 ${index === 0 ? 'text-left' : 'text-right'}`}>{label}</th>)}</tr></thead>
          <tbody>{rows.map(row => {
            const progress = percent(row.completed, row.total)
            return <tr key={row.title} className="border-t border-slate-100 even:bg-slate-50">
              <th scope="row" className="px-3 py-3 text-left font-medium">{row.title}</th>
              {[row.total, row.completed, row.total - row.completed, progress.toFixed(1) + '%', hours(row.totalSeconds), hours(row.completedSeconds), hours((row.totalSeconds - row.completedSeconds) / speed)].map((value, index) => <td key={index} className="px-3 py-3 text-right">{value}</td>)}
              <td className="px-3 py-3"><progress className="h-2 w-full min-w-16 accent-teal-700" value={row.completed} max={row.total || 1} aria-label={'ความคืบหน้า ' + row.title} /></td>
            </tr>
          })}</tbody>
          <tfoot className="border-t border-teal-200 bg-teal-50 font-semibold text-teal-950">
            <tr>
              <th scope="row" className="px-3 py-3 text-left">รวม</th>
              {[total, done, total - done, progress.toFixed(1) + '%', hours(totalSeconds), hours(doneSeconds), hours(remainingSeconds)].map((value, index) => <td key={index} className="px-3 py-3 text-right">{value}</td>)}
              <td className="px-3 py-3"><progress className="h-2 w-full min-w-16 accent-teal-700" value={done} max={total || 1} aria-label="ความคืบหน้ารวม" /></td>
            </tr>
          </tfoot>
        </table>
      </div>
    </section>
  </section>
}
