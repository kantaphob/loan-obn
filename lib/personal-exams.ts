export const examSubjects = ['ความสามารถทั่วไป', 'ภาษาไทย', 'ภาษาอังกฤษ', 'คอมพิวเตอร์', 'งานสารบรรณ + ลักษณะที่ 54', 'กฎหมาย'] as const
export function validateExamScore(input: { subject: string; correct: number; total: number }) {
  if (!(examSubjects as readonly string[]).includes(input.subject) || !Number.isInteger(input.correct) || !Number.isInteger(input.total) || input.total < 1 || input.total > 10000 || input.correct < 0 || input.correct > input.total) throw new Error('คะแนนต้องเป็นจำนวนเต็มตั้งแต่ 0 ถึงคะแนนเต็ม (ไม่เกิน 10,000) และเลือกวิชาให้ถูกต้อง')
}
export function examSummary(scores: { subject: string; correct: number; total: number }[]) {
  return examSubjects.map(subject => {
    const rows = scores.filter(s => s.subject === subject)
    const correct = rows.reduce((s, r) => s + r.correct, 0), total = rows.reduce((s, r) => s + r.total, 0)
    return { subject, count: rows.length, correct, total, percent: total ? Math.round(correct / total * 1000) / 10 : 0 }
  })
}
