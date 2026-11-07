import catalog from './personal-study-lessons.json'

const durations = new Map(catalog.map(lesson => [JSON.stringify([lesson.course, lesson.title]), lesson.durationSeconds]))

export function summarizeStudyProgress(courses: { title: string; lessons: { title: string; completed: boolean }[] }[]) {
  return courses.map(course => {
    let completed = 0, totalSeconds = 0, completedSeconds = 0, missingDurations = 0
    for (const lesson of course.lessons) {
      const seconds = durations.get(JSON.stringify([course.title, lesson.title]))
      if (seconds === undefined) missingDurations++
      totalSeconds += seconds ?? 0
      if (lesson.completed) {
        completed++
        completedSeconds += seconds ?? 0
      }
    }
    return { title: course.title, total: course.lessons.length, completed, totalSeconds, completedSeconds, missingDurations }
  })
}
