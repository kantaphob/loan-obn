import assert from 'node:assert/strict'
import test from 'node:test'
import { examSummary, validateExamScore } from '../lib/personal-exams'
import source from '../lib/personal-study-source.json'
test('exam percentages are weighted by question count', () => {
  const summary = examSummary([{ subject: 'ภาษาไทย', correct: 1, total: 2 }, { subject: 'ภาษาไทย', correct: 8, total: 8 }])
  assert.equal(summary.find(s => s.subject === 'ภาษาไทย')?.percent, 90)
  assert.equal(summary.find(s => s.subject === 'กฎหมาย')?.count, 0)
})
test('scores enforce the subject and score range', () => {
  validateExamScore({ subject: 'ภาษาไทย', correct: 0, total: 10 })
  for (const input of [{ subject: 'ไม่มี', correct: 2, total: 10 }, { subject: 'ภาษาไทย', correct: 11, total: 10 }, { subject: 'ภาษาไทย', correct: -1, total: 10 }, { subject: 'ภาษาไทย', correct: 0, total: 0 }, { subject: 'ภาษาไทย', correct: 0.5, total: 10 }]) assert.throws(() => validateExamScore(input))
})
test('study import preserves the supplied dashboard totals without assigning completed episode identities', () => {
  assert.equal(source.length, 11)
  assert.equal(source.reduce((sum, r) => sum + r.total, 0), 279)
  assert.equal(source.reduce((sum, r) => sum + r.initialCompleted, 0), 102)
  assert.equal(source.reduce((sum, r) => sum + r.total - r.initialCompleted, 0), 177)
})
