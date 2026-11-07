'use client'
import { useActionState, useState } from 'react'
import { combinedExamSubject, combinedExamTotal, examScoreTotals, examSubjects, examSummary } from '@/lib/personal-exams'
import { bangkokToday } from '@/lib/ledger'
import { saveExamScore, type getExamScores } from './actions'
type Data = Awaited<ReturnType<typeof getExamScores>>
const input = 'w-full rounded-lg border border-slate-200 bg-white p-2 text-sm'
function ScoreForm({ score }: { score?: Data['scores'][number] }) {
  const [state, action, pending] = useActionState(saveExamScore, { message: '', ok: false })
  const [subject, setSubject] = useState(score?.subject ?? examSubjects[0])
  const isCombined = subject === combinedExamSubject

  return <form action={action} className="grid gap-3"><input type="hidden" name="id" value={score?.id ?? ''} /><fieldset disabled={pending} className="grid gap-3 sm:grid-cols-2"><label>วิชา<select className={input} name="subject" value={subject} onChange={event => setSubject(event.target.value)}>{[...examSubjects, combinedExamSubject].map(s => <option key={s}>{s}</option>)}</select></label><label>ชื่อชุดข้อสอบ<input className={input} name="examName" required maxLength={200} defaultValue={score?.examName} /></label><label>วันที่ทำข้อสอบ<input className={input} name="occurredOn" type="date" required max={bangkokToday()} defaultValue={score?.occurredOn ?? bangkokToday()} /></label><label>คะแนนที่ได้<input className={input} name="correct" type="number" min="0" max={isCombined ? combinedExamTotal : 10000} step="1" required defaultValue={score?.correct} /></label><label>คะแนนเต็ม{isCombined
    ? <input key="combined" className={input} name="total" type="number" value={combinedExamTotal} readOnly />
    : <input key="subject" className={input} name="total" type="number" min="1" max="10000" step="1" required defaultValue={score?.subject === combinedExamSubject ? undefined : score?.total} />}</label><label>จุดที่ต้องทบทวน<textarea className={input} name="note" maxLength={2000} defaultValue={score?.note} /></label><button className="rounded-lg bg-slate-900 p-2 text-white" type="submit">{pending ? 'กำลังบันทึก…' : 'บันทึกคะแนน'}</button></fieldset><p role="status" className={state.ok ? 'text-emerald-700' : 'text-red-700'}>{state.message}</p></form>
}
export function ScoreWorkspace({ data }: { data: Data }) {
  const [editing, setEditing] = useState<string | null>(null)
  const summary = examSummary(data.scores)
  const { correct, total } = examScoreTotals(data.scores)
  const combined = examScoreTotals(data.scores.filter(score => score.subject === combinedExamSubject))
  return <div className="grid gap-5"><div className="grid gap-3 sm:grid-cols-3">{[['ทำข้อสอบแล้ว', `${data.scores.length} ครั้ง`], ['คะแนนรวม', `${correct} / ${total}`], ['ความแม่นยำรวม', total ? `${(correct / total * 100).toFixed(1)}%` : 'ยังไม่มีคะแนน']].map(([l, v]) => <div key={l} className="rounded-xl border border-slate-200 bg-white p-5"><p className="text-sm text-slate-500">{l}</p><p className="mt-2 text-2xl font-semibold">{v}</p></div>)}</div>{combined.count > 0 && <section className="rounded-xl border border-slate-200 bg-white p-5">
    <h2 className="font-semibold">{combinedExamSubject}</h2>
    <p className="mt-2 text-sm">{combined.count} ครั้ง · คะแนนสะสม {combined.correct} / {combined.total} · ความแม่นยำ {combined.percent}%</p>
  </section>}<section className="grid gap-5 rounded-xl border border-slate-200 bg-white p-5"><h2 className="font-semibold">ความแม่นยำรายวิชา</h2>{summary.map(s => <div key={s.subject}><div className="mb-2 flex justify-between gap-3 text-sm"><span>{s.subject}</span><span>{s.count ? `${s.percent}% · ${s.count} ครั้ง` : 'ยังไม่มีคะแนน'}</span></div><progress className="h-3 w-full accent-blue-600" aria-label={`ความแม่นยำ ${s.subject}`} max={100} value={s.percent} /></div>)}<p className="text-xs text-slate-500">คำนวณจากคะแนนที่ได้รวม ÷ คะแนนเต็มรวมของประวัติที่บันทึก</p></section>{data.canWrite && <section className="rounded-xl border border-slate-200 bg-white p-5"><h2 className="mb-4 font-semibold">บันทึกคะแนนครั้งใหม่</h2><ScoreForm key={data.scores.length} /></section>}<section className="grid gap-3"><h2 className="font-semibold">ประวัติการทำข้อสอบ</h2>{!data.scores.length && <p className="text-sm text-slate-500">ยังไม่มีคะแนน เริ่มบันทึกชุดข้อสอบที่ทำแล้วได้เลย</p>}{data.scores.map(s => <article key={s.id} className="grid gap-3 rounded-xl border border-slate-200 bg-white p-4"><div className="flex flex-wrap justify-between gap-2"><h3 className="font-semibold">{s.examName}</h3><strong>{s.correct}/{s.total} · {(s.correct / s.total * 100).toFixed(1)}%</strong></div><p className="text-sm text-slate-500">{s.subject} · {s.occurredOn}</p><p className="whitespace-pre-wrap text-sm">{s.note}</p>{data.canWrite && <button className="justify-self-start text-sm text-blue-700" type="button" onClick={() => setEditing(editing === s.id ? null : s.id)}>แก้ไขคะแนน</button>}{editing === s.id && <ScoreForm score={s} />}</article>)}</section></div>
}
