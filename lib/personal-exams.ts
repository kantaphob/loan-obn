export const examSubjects = ['ความสามารถทั่วไป', 'ภาษาไทย', 'ภาษาอังกฤษ', 'คอมพิวเตอร์', 'งานสารบรรณ + ลักษณะที่ 54', 'กฎหมาย'] as const
export const combinedExamTotal = 150
export const combinedExamSubject = `ข้อสอบรวม ${combinedExamTotal} ข้อ`

export function validateExamScore(input: { subject: string; correct: number; total: number }) {
  if (input.subject === combinedExamSubject && input.total !== combinedExamTotal) throw new Error('ข้อสอบรวมต้องมีคะแนนเต็ม 150 คะแนน')
  if (![...examSubjects, combinedExamSubject].includes(input.subject) || !Number.isInteger(input.correct) || !Number.isInteger(input.total) || input.total < 1 || input.total > 10000 || input.correct < 0 || input.correct > input.total) throw new Error('คะแนนต้องเป็นจำนวนเต็มตั้งแต่ 0 ถึงคะแนนเต็ม (ไม่เกิน 10,000) และเลือกวิชาให้ถูกต้อง')
}
type ExamScore = { subject: string; correct: number; total: number }

export function examScoreTotals(scores: ExamScore[]) {
  const correct = scores.reduce((sum, score) => sum + score.correct, 0)
  const total = scores.reduce((sum, score) => sum + score.total, 0)
  return { count: scores.length, correct, total, percent: total ? Math.round(correct / total * 1000) / 10 : 0 }
}

export function examSummary(scores: ExamScore[]) {
  return examSubjects.map(subject => ({
    subject,
    ...examScoreTotals(scores.filter(score => score.subject === subject)),
  }))
}
