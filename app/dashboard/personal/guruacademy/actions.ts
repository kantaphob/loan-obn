'use server'
import source from '@/lib/personal-study-source.json'
import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/lib/auth/current-user'
import { revalidatePath } from 'next/cache'
async function operator(write = false) {
  const user = await getCurrentUser()
  if (!user || user.status !== 'ACTIVE' || (write && user.role === 'REVIEWER')) throw new Error('ไม่มีสิทธิ์ทำรายการนี้')
  return user
}
export async function getStudyChecklist() {
  const user = await operator()
  const courses = await prisma.personalStudyCourse.findMany({ where: { operatorId: user.id }, include: { lessons: { orderBy: { position: 'asc' } } }, orderBy: { id: 'asc' } })
  return { canWrite: user.role !== 'REVIEWER', courses: courses.sort((a, b) => source.findIndex(r => r.title === a.title) - source.findIndex(r => r.title === b.title)).map(c => ({ ...c, lessons: c.lessons.map(l => ({ ...l, completedAt: l.completedAt?.toISOString() ?? null })) })) }
}
export async function updateStudyLesson(id: string, completed: boolean, title?: string) {
  try {
    const user = await operator(true)
    if (typeof id !== 'string' || id.length > 200 || typeof completed !== 'boolean' || (title !== undefined && (typeof title !== 'string' || !title.trim() || title.length > 200))) throw new Error('ข้อมูลบทเรียนไม่ถูกต้อง')
    const changed = await prisma.personalStudyLesson.updateMany({ where: { id, course: { operatorId: user.id } }, data: { completed, completedAt: completed ? new Date() : null, ...(title !== undefined ? { title: title.trim() } : {}) } })
    if (!changed.count) throw new Error('ไม่พบบทเรียน')
    revalidatePath('/dashboard/personal/guruacademy')
    revalidatePath('/dashboard/personal/guru-academy')
    return { ok: true, error: '' }
  } catch (e) { return { ok: false, error: e instanceof Error && !e.name.startsWith('Prisma') ? e.message : 'บันทึกไม่สำเร็จ กรุณาลองใหม่' } }
}
