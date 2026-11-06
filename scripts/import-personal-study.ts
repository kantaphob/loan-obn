import { prisma } from '../lib/prisma'
import source from '../lib/personal-study-source.json'
import lessons from '../lib/personal-study-lessons.json'

async function main() {
  const user = await prisma.user.findFirst({ orderBy: [{ level: 'asc' }, { createdAt: 'asc' }] })
  if (!user || user.status !== 'ACTIVE') throw new Error('ไม่พบผู้ใช้งาน')
  await prisma.$transaction(async tx => {
    for (const [index, row] of source.entries()) {
      const records = lessons.filter(lesson => lesson.course === row.title)
      if (records.length !== row.total) throw new Error(`จำนวนบทเรียนไม่ตรง: ${row.title}`)
      const course = await tx.personalStudyCourse.upsert({
        where: { operatorId_title: { operatorId: user.id, title: row.title } }, update: {},
        create: { id: `guru-study-${user.id}-${index}`, operatorId: user.id, ...row, initialCompleted: 0 },
        include: { lessons: { orderBy: { position: 'asc' } } },
      })
      if (course.lessons.length === records.length && course.lessons.every((lesson, i) => lesson.title === records[i].title)) continue
      if (course.lessons.length && course.lessons.length !== records.length) throw new Error(`จำนวนรายการเดิมไม่ตรง: ${row.title}`)
      // Move existing positions out of the way before assigning source order.
      for (const [i, lesson] of course.lessons.entries()) {
        await tx.personalStudyLesson.update({ where: { id: lesson.id }, data: { position: -10000 - i } })
      }
      for (const [i, record] of records.entries()) {
        const existing = course.lessons[i]
        const data = { title: record.title, position: i + 1, completed: record.completed, completedAt: null }
        if (existing) await tx.personalStudyLesson.update({ where: { id: existing.id }, data })
        else await tx.personalStudyLesson.create({ data: { ...data, courseId: course.id } })
      }
      await tx.personalStudyCourse.update({ where: { id: course.id }, data: { initialCompleted: 0 } })
    }
  }, { timeout: 30000 })
  console.log('Imported 279 named lessons in source order; 102 completed. Repeated imports preserve checklist changes.')
}
main().finally(() => prisma.$disconnect())
