'use client'

import { useSyncExternalStore } from 'react'
import { Timer } from 'lucide-react'

const examDates = [
  { title: 'สายอำนวยการ / พิสูจน์หลักฐาน', date: '2026-11-29', label: '29 พ.ย. 2569' },
  { title: 'ปราบปราม', date: '2027-01-17', label: '17 ม.ค. 2570' },
]

const units = [
  { label: 'วัน', seconds: 86400 },
  { label: 'ชั่วโมง', seconds: 3600, cycle: 24 },
  { label: 'นาที', seconds: 60, cycle: 60 },
  { label: 'วินาที', seconds: 1, cycle: 60 },
]

function subscribe(onChange: () => void) {
  const timer = window.setInterval(onChange, 1000)
  return () => window.clearInterval(timer)
}

function currentSecond() {
  return Math.floor(Date.now() / 1000)
}

function serverSnapshot() {
  return null
}

function deadlineSecond(date: string) {
  return Date.parse(date + 'T00:00:00+07:00') / 1000
}

export function useDaysUntilStudyDeadline(date: string) {
  const deadline = deadlineSecond(date)
  return useSyncExternalStore(
    subscribe,
    () => Number.isFinite(deadline) ? Math.max(0, Math.ceil((deadline - currentSecond()) / 86400)) : null,
    serverSnapshot,
  )
}

export function ExamCountdown() {
  const now = useSyncExternalStore(subscribe, currentSecond, serverSnapshot)

  return <section className="mb-4" aria-label="นับถอยหลังถึงวันสอบ">
    <h2 className="mb-1 text-xl font-bold">นับถอยหลังถึงวันสอบ</h2>
    <p className="mb-4 text-sm text-slate-600">นับถึงเวลา 00:00 น. ของวันสอบตามเวลาไทย</p>
    <div className="grid gap-4 xl:grid-cols-2">
      {examDates.map(({ title, date, label }) => {
        const remaining = now === null ? null : Math.max(0, deadlineSecond(date) - now)
        return <article key={date} className="rounded-3xl border border-emerald-900 bg-[#092c29] bg-[radial-gradient(ellipse_at_top_right,#236153_0%,#092c29_65%)] p-5 text-white shadow-lg sm:p-6">
          <h3 className="flex items-center gap-2 text-lg font-bold">
            <Timer size={19} className="shrink-0 text-emerald-200" aria-hidden="true" />{title}
          </h3>
          <p className="mt-1 text-sm text-emerald-100">วันสอบ · <time dateTime={date}>{label}</time></p>
          {remaining === 0 ? <p className="mt-4 rounded-xl bg-white/10 p-4">ถึงกำหนดวันสอบแล้ว</p> :
            <dl role="timer" aria-label={`เวลาที่เหลือก่อนสอบ ${title}`} className="mt-4 grid grid-cols-4 gap-2 sm:gap-3">
              {units.map(({ label, seconds, cycle }) => {
                const count = Math.floor((remaining ?? 0) / seconds)
                const display = remaining === null ? '–' : String(cycle ? count % cycle : count).padStart(2, '0')
                const tone = cycle ? 'border-white/15 bg-white/10 text-white' : 'border-amber-200/30 bg-amber-100 text-emerald-950'
                return <div key={label} className={`flex min-w-0 flex-col-reverse items-center gap-2 rounded-2xl border px-1 py-3 sm:py-5 ${tone}`}>
                  <dt className="text-xs font-medium sm:text-sm">{label}</dt>
                  <dd className="text-3xl font-bold leading-none tracking-tight tabular-nums sm:text-5xl">{display}</dd>
                </div>
              })}
            </dl>}
        </article>
      })}
    </div>
  </section>
}
