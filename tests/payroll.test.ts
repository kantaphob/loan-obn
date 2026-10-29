import test from 'node:test'
import assert from 'node:assert/strict'
import { prisma } from '../lib/prisma'
import { parsePayrollDetails, payrollTotals, validatePayroll } from '../lib/payroll'
import { getPayrollCandidates, receivePayroll, savePayroll } from '../app/dashboard/payroll/actions'
import { lendingCapitalCash } from '../lib/capital'

test('payroll totals retain exact satang and treat reimbursement as income', () => {
  const result = payrollTotals({ salary: '11000', attendance: '1000', ot: '481.25', commission: '3962.93', incentive: '957.50', reimbursement: '780.68', socialSecurity: '550', guarantee: '800', other: '403' })
  assert.equal(result.net, 1642936)
  assert.throws(() => validatePayroll({ month: '2026-13', employer: 'Test', note: '', values: { salary: '100' } }))
  assert.throws(() => validatePayroll({ month: '2026-10', employer: 'Test', note: '', values: { salary: '100', other: '101' } }))
  assert.throws(() => payrollTotals({ salary: '-1' }))
  assert.throws(() => payrollTotals({ salary: '1.001' }))
})

test('record, receive, matching and guards preserve general cash without duplicate receipts', async () => {
  await prisma.user.create({ data: { id: 'payroll-operator', acccode: 'payroll-test', password: 'test-only', role: 'ADMIN', level: 0 } })
  await prisma.paymentChannel.create({ data: { code: 'CASH', nameTh: 'เงินสด', nameEn: 'Cash' } })
  const input = { month: '2025-01', employer: 'Test employer', note: '', values: { salary: '22000', socialSecurity: '875', withholdingTax: '1100' } }
  assert.ok('success' in await savePayroll(input))
  assert.equal(await prisma.ledgerEntry.count(), 0, 'saving payroll must not create cash')
  assert.ok('error' in await savePayroll(input), 'same employer/month cannot be saved twice')
  const record = await prisma.payrollRecord.findFirstOrThrow()
  assert.equal(record.netSatang, 2002500)
  const receipt = { id: record.id, occurredOn: '2025-01-31', channelCode: 'CASH', reference: 'PAYROLL-TEST-ONE' }
  assert.ok('success' in await receivePayroll(receipt))
  assert.ok('error' in await receivePayroll(receipt), 'retry must not create another receipt')
  const entry = await prisma.ledgerEntry.findFirstOrThrow()
  assert.equal(entry.amountSatang, 2002500)
  assert.equal(entry.accountScope, 'GENERAL')
  assert.equal(lendingCapitalCash([entry]).balance, 0, 'salary must not enter lending capital')
  assert.ok('error' in await savePayroll({ ...input, id: record.id, values: { salary: '23000' } }), 'paid payroll cannot change net')
  await savePayroll({ ...input, month: '2025-02' })
  const second = await prisma.payrollRecord.findUniqueOrThrow({ where: { month_employer: { month: '2025-02', employer: input.employer } } })
  assert.ok('error' in await receivePayroll({ ...receipt, id: second.id, existingKey: `LEDGER:${entry.id}` }), 'one cash entry cannot belong to two months')
  await prisma.financialCategory.create({ data: { code: 'Y2025_SALARY_IN', nameTh: 'เงินเดือน', nameEn: 'Salary', group: 'INCOME', direction: 'IN' } })
  const old = await prisma.historicalCashEntry.create({ data: { requestKey: 'old-salary', accountCode: 'DAILY_2025', occurredOn: '2025-02-28', direction: 'IN', amountSatang: 2002500, categoryCode: 'Y2025_SALARY_IN', channelCode: 'CASH', sourceChannel: 'CASH', company: 'test', description: 'salary', sourceFile: 'fixture', sourceHash: 'fixture', sourceRow: 1, sourceJson: '{}', createdBy: 'payroll-operator' } })
  assert.equal((await getPayrollCandidates(second.id)).length, 1, 'only unlinked cash matching the exact net is loaded')
  assert.ok('success' in await receivePayroll({ ...receipt, id: second.id, existingKey: `HISTORICAL:${old.id}` }))
  assert.equal(await prisma.ledgerEntry.count(), 1, 'matching history creates no new cash')
  await savePayroll({ ...input, month: '2025-03' })
  const third = await prisma.payrollRecord.findUniqueOrThrow({ where: { month_employer: { month: '2025-03', employer: input.employer } } })
  const concurrent = await Promise.all([receivePayroll({ ...receipt, id: third.id, reference: 'PAYROLL-RACE' }), receivePayroll({ ...receipt, id: third.id, reference: 'PAYROLL-RACE' })])
  assert.equal(concurrent.filter(r => 'success' in r).length, 1)
  assert.equal(await prisma.ledgerEntry.count(), 2)
  await savePayroll({ ...input, month: '2025-04' })
  const fourth = await prisma.payrollRecord.findUniqueOrThrow({ where: { month_employer: { month: '2025-04', employer: input.employer } } })
  assert.ok('error' in await receivePayroll({ ...receipt, id: fourth.id, occurredOn: '2200-01-01' }))
  await prisma.accountingMonthLock.create({ data: { requestKey: 'lock-fixture', month: '2025-04', startOn: '2025-04-01', endOn: '2025-04-30', note: '', snapshotJson: '{}', createdBy: 'payroll-operator' } })
  assert.ok('error' in await receivePayroll({ ...receipt, id: fourth.id, occurredOn: '2025-04-30' }), 'closed months reject cash posting')
  const customItems = [{ id: 'bonus', label: 'โบนัส', type: 'INCOME' as const, amount: '100.25' }]
  assert.ok('success' in await savePayroll({ ...input, id: fourth.id, month: '2025-04', customItems, hiddenFields: ['socialSecurity'] }))
  const customSaved = await prisma.payrollRecord.findUniqueOrThrow({ where: { id: fourth.id } })
  assert.equal(customSaved.netSatang, 2100025)
  assert.deepEqual(parsePayrollDetails(customSaved.amountsJson).customItems, customItems)
  assert.deepEqual(parsePayrollDetails(customSaved.amountsJson).hiddenFields, ['socialSecurity'])
  await savePayroll({ ...input, month: '2025-06', values: { salary: '100.50' } })
  const nearPayroll = await prisma.payrollRecord.findUniqueOrThrow({ where: { month_employer: { month: '2025-06', employer: input.employer } } })
  const nearEntry = await prisma.ledgerEntry.create({ data: { requestKey: 'near-receipt', accountScope: 'GENERAL', kind: 'GENERAL', direction: 'IN', categoryCode: entry.categoryCode, categoryName: entry.categoryName, amountSatang: 10000, occurredOn: '2025-06-30', channelCode: 'CASH', channelName: 'Cash', createdBy: 'payroll-operator' } })
  const nearRequest = { ...receipt, id: nearPayroll.id, existingKey: 'LEDGER:' + nearEntry.id }
  assert.ok('error' in await receivePayroll(nearRequest), 'difference requires explicit confirmation')
  const cashCount = await prisma.ledgerEntry.count()
  assert.ok('success' in await receivePayroll({ ...nearRequest, acceptDifference: true }))
  assert.equal(await prisma.ledgerEntry.count(), cashCount, 'difference matching never creates cash')
  const nearSaved = await prisma.payrollRecord.findUniqueOrThrow({ where: { id: nearPayroll.id } })
  assert.equal(nearSaved.netSatang, 10050, 'keep original payroll net')
  assert.match(nearSaved.note, /-0.50/)
  assert.equal((await prisma.ledgerEntry.findUniqueOrThrow({ where: { id: nearEntry.id } })).amountSatang, 10000, 'keep actual receipt')
  await savePayroll({ ...input, month: '2025-07', values: { salary: '105' } })
  const farPayroll = await prisma.payrollRecord.findUniqueOrThrow({ where: { month_employer: { month: '2025-07', employer: input.employer } } })
  assert.ok('error' in await receivePayroll({ ...nearRequest, id: farPayroll.id, acceptDifference: true }), 'large differences cannot be accepted')
  await prisma.user.update({ where: { id: 'payroll-operator' }, data: { role: 'REVIEWER' } })
  assert.ok('error' in await savePayroll({ ...input, month: '2025-05' }), 'reviewers cannot write')
  await prisma.$disconnect()
})

test('custom income/deductions and removed standard headings affect net without dropping cents', () => {
  const customItems = [
    { id: 'bonus', label: 'โบนัสพิเศษ', type: 'INCOME' as const, amount: '1250.75' },
    { id: 'loan', label: 'เงินกู้พนักงาน', type: 'DEDUCTION' as const, amount: '200.25' },
  ]
  assert.equal(payrollTotals({ salary: '11000', phone: '1000' }, customItems, ['phone']).net, 1205050)
  assert.throws(() => validatePayroll({ month: '2026-10', employer: 'Test', note: '', values: { salary: '100' }, customItems: [{ id: 'empty', label: '', type: 'INCOME', amount: '1' }] }))
  assert.throws(() => payrollTotals({}, [customItems[0], customItems[0]]), 'duplicate custom IDs are invalid')
  assert.throws(() => payrollTotals({}, [], ['unsupported']), 'unknown standard headings cannot hide values')
})

test('receipt window includes month end and the preceding three days', async () => {
  const { payrollReceiptWindow } = await import('../lib/payroll')
  assert.deepEqual(payrollReceiptWindow('2025-01'), { startOn: '2025-01-28', endOn: '2025-01-31' })
  assert.deepEqual(payrollReceiptWindow('2024-02'), { startOn: '2024-02-26', endOn: '2024-02-29' })
  assert.deepEqual(payrollReceiptWindow('2025-12'), { startOn: '2025-12-28', endOn: '2025-12-31' })
})
