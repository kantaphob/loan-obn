'use server'
import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/lib/auth/current-user'
import { validateExamScore } from '@/lib/personal-exams'
import { validLedgerDate } from '@/lib/ledger'
import { revalidatePath } from 'next/cache'
async function operator(write = false) {
  const user = await getCurrentUser()
  if (!user || user.status !== 'ACTIVE' || (write && user.role === 'REVIEWER')) throw new Error('ไม่มีสิทธิ์ทำรายการนี้')
  return user
}
export async function getExamScores() {
  const user = await operator()
  const scores = await prisma.personalExamScore.findMany({ where: { operatorId: user.id }, orderBy: [{ occurredOn: 'desc' }, { createdAt: 'desc' }] })
  return { canWrite: user.role !== 'REVIEWER', scores: scores.map(s => ({ ...s, createdAt: s.createdAt.toISOString(), updatedAt: s.updatedAt.toISOString() })) }
}
export async function saveExamScore(_prev: { message: string; ok: boolean }, form: FormData) {
  try {
    const user = await operator(true)
    const text = (name: string) => String(form.get(name) ?? '').trim()
    const id = text('id'), subject = text('subject'), examName = text('examName'), occurredOn = text('occurredOn'), note = text('note')
    const correct = Number(text('correct')), total = Number(text('total'))
    validateExamScore({ subject, correct, total })
    if (!text('correct') || !text('total') || !examName || examName.length > 200 || note.length > 2000 || !validLedgerDate(occurredOn)) throw new Error('ระบุชื่อชุดข้อสอบ วันที่ไม่เกินวันนี้ และคะแนนให้ครบ')
    const data = { subject, examName, occurredOn, correct, total, note }
    if (id) {
      const changed = await prisma.personalExamScore.updateMany({ where: { id, operatorId: user.id }, data })
      if (!changed.count) throw new Error('ไม่พบคะแนนนี้')
    } else await prisma.personalExamScore.create({ data: { ...data, operatorId: user.id } })
    revalidatePath('/dashboard/personal/examgurupolice')
    return { message: 'บันทึกคะแนนแล้ว', ok: true }
  } catch (e) { return { message: e instanceof Error && !e.name.startsWith('Prisma') ? e.message : 'บันทึกไม่สำเร็จ กรุณาลองใหม่', ok: false } }
}
