import assert from 'node:assert/strict'
import { test } from 'node:test'
import { spawnSync } from 'node:child_process'
import { calculateWorkpaper, validateAdjustment, type TrialAccount } from '../lib/accounting-workpaper-math'
import { validateChecklist } from '../lib/closing-preparation'
import { emptyChecklist } from '../lib/closing-preparation-types'
import { closingZip } from '../lib/closing-zip'
const accounts: TrialAccount[] = [
  { code: '1100', name: 'Cash', type: 'ASSET', debit: '150', credit: '0' },
  { code: '1500', name: 'Accumulated depreciation', type: 'ASSET', debit: '0', credit: '0' },
  { code: '3100', name: 'Capital', type: 'EQUITY', debit: '0', credit: '100' },
  { code: '4100', name: 'Interest', type: 'REVENUE', debit: '0', credit: '80' },
  { code: '5100', name: 'Expense', type: 'EXPENSE', debit: '20', credit: '0' },
  { code: '3300', name: 'Dividend', type: 'DIVIDEND', debit: '10', credit: '0' },
]
test('adjusted trial balance, income, position and owner movement reconcile independently', () => {
  const report = calculateWorkpaper(accounts, [[{ code: '5100', debit: '5', credit: '0' }, { code: '1500', debit: '0', credit: '5' }]], { opening: '100', contributions: '0', withdrawals: '0', target: 'RETAINED_EARNINGS' })
  assert.equal(report.balanced, true)
  assert.equal(report.profit, 5500)
  assert.equal(report.assets, 14500)
  assert.equal(report.closingEquity, 14500)
  assert.equal(report.equityMovementClosing, 14500)
  assert.equal(report.positionDifference, 0)
  assert.equal(report.equityDifference, 0)
  for (const step of [1, 2, 3, 4]) assert.equal(report.lines.filter(line => line.step === step).reduce((sum, line) => sum + line.debit - line.credit, 0), 0)
  assert.equal(report.lines.filter(line => line.code === 'INCOME_SUMMARY').reduce((sum, line) => sum + line.debit - line.credit, 0), 0)
  assert.equal(calculateWorkpaper(accounts, [], { opening: '90', contributions: '0', withdrawals: '0', target: 'RETAINED_EARNINGS' }).equityDifference, -1000)
})
test('reject unbalanced adjustments, unknown codes, duplicate trial accounts and two-sided balances', () => {
  assert.throws(() => validateAdjustment([{ code: '5100', debit: '5', credit: '0' }, { code: '1500', debit: '0', credit: '4' }], accounts))
  assert.throws(() => validateAdjustment([{ code: 'NOPE', debit: '5', credit: '0' }, { code: '1500', debit: '0', credit: '5' }], accounts))
  assert.throws(() => calculateWorkpaper([...accounts, accounts[0]], [], { opening: '100', contributions: '0', withdrawals: '0', target: 'RETAINED_EARNINGS' }))
  assert.throws(() => calculateWorkpaper([{ ...accounts[0], credit: '1' }], [], { opening: '100', contributions: '0', withdrawals: '0', target: 'RETAINED_EARNINGS' }))
})
test('negative opening equity and debit revenue balances remain valid accounting balances', () => {
  const report = calculateWorkpaper([
    { code: '1100', name: 'Cash', type: 'ASSET', debit: '10', credit: '0' },
    { code: '3100', name: 'Accumulated loss', type: 'EQUITY', debit: '5', credit: '0' },
    { code: '4100', name: 'Income', type: 'REVENUE', debit: '0', credit: '20' },
    { code: '4200', name: 'Income reversal', type: 'REVENUE', debit: '5', credit: '0' },
  ], [], { opening: '-5', contributions: '0', withdrawals: '0', target: 'CAPITAL' })
  assert.equal(report.balanced, true)
  assert.equal(report.profit, 1500)
  assert.equal(report.closingEquity, 1000)
  assert.equal(report.equityDifference, 0)
  assert.equal(report.lines.reduce((sum, line) => sum + line.debit - line.credit, 0), 0)
})
test('N/A items require explanations and incomplete checklists cannot close', () => {
  const checklist = emptyChecklist()
  assert.throws(() => validateChecklist(checklist, true))
  checklist.inventory.status = 'NA'
  assert.throws(() => validateChecklist(checklist))
  checklist.inventory.note = 'No inventory in lending business'
  for (const row of Object.values(checklist)) if (row.status !== 'NA') row.status = 'DONE'
  assert.equal(validateChecklist(checklist, true).inventory.status, 'NA')
})
test('downloaded ZIP is readable by the independent standard ZIP reader and preserves UTF-8 evidence', () => {
  const archive = closingZip([{ name: '2025-01-สรุป.json', data: Buffer.from('{"checked":true}') }, { name: 'statement.pdf', data: Buffer.from('%PDF-1.4\nfixture') }])
  const result = spawnSync('python3', ['-c', 'import io,sys,zipfile; z=zipfile.ZipFile(io.BytesIO(sys.stdin.buffer.read())); assert z.testzip() is None; assert z.read("2025-01-สรุป.json")==b\'{"checked":true}\'; assert z.read("statement.pdf").startswith(b"%PDF-"); print(len(z.namelist()))'], { input: archive, encoding: 'utf8' })
  assert.equal(result.status, 0, result.stderr)
  assert.equal(result.stdout.trim(), '2')
})
