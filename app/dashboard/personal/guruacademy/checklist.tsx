'use client'
import { useState, useTransition } from 'react'
import { updateStudyLesson, type getStudyChecklist } from './actions'


type Data = Awaited<ReturnType<typeof getStudyChecklist>>

function Lesson({ lesson, canWrite }: { lesson: Data['courses'][number]['lessons'][number]; canWrite: boolean }) {
  const [pending, start] = useTransition()
  const [error, setError] = useState('')

  function save(completed: boolean) {
    start(async () => {
      try {
        const result = await updateStudyLesson(lesson.id, completed)
        setError(result.error)
      } catch { setError('บันทึกไม่สำเร็จ กรุณาลองใหม่') }
    })
  }

  return <li className="border-t border-slate-100 py-3">
    <label className="flex cursor-pointer items-center gap-3 text-sm">
      <input type="checkbox" checked={lesson.completed} disabled={pending || !canWrite} onChange={e => save(e.target.checked)} className="h-5 w-5 shrink-0 accent-blue-600" />
      <span className={lesson.completed ? 'text-slate-400 line-through' : ''}>{lesson.title}</span>
    </label>
    {error && <p role="alert" className="mt-1 text-xs text-red-700">{error}</p>}
  </li>
}

export function StudyChecklist({ data }: { data: Data }) {
  return <div className="grid gap-4">{data.courses.map((course, index) => {
    const done = course.lessons.filter(lesson => lesson.completed).length
    return <details key={course.id} open={index === 0} className="rounded-xl border border-slate-200 bg-white p-5">
      <summary className="cursor-pointer">
        <span className="font-semibold">{course.title}</span>
        <span className="float-right text-sm text-slate-500">{done}/{course.total}</span>
      </summary>
      <ul className="mt-3">{course.lessons.map(lesson => <Lesson key={lesson.id} lesson={lesson} canWrite={data.canWrite} />)}</ul>
    </details>
  })}</div>
}
