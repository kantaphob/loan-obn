import assert from 'node:assert/strict'
import { after, test } from 'node:test'
import { randomUUID } from 'node:crypto'
import { prisma } from '../lib/prisma'
import { withPersistence } from '../lib/persisted-client'
import { borrowerPosition } from '../lib/borrower-position'
import { contractLedgerBalance } from '../lib/ledger'
import { saveLedger, editLedger, voidLedger } from '../app/dashboard/ledger/actions'
import { approveContractLimit, saveContract, searchContractBorrowers } from '../app/dashboard/contracts/actions'
import { enqueueGoogleSync, processGoogleSyncQueue, googleSyncStatus } from '../lib/google-sync'
if (!process.env.DATABASE_URL?.includes('loan-integrity-test-')) throw new Error('Isolated database required')
after(() => prisma.$disconnect())

test('balances exclude future disbursements and penalties before funding', () => {
  const contract = { repaymentSatang: 100000, principalSatang: 100000, interestSatang: 0, status: 'PAID', paidAt: new Date('2026-01-10T00:00:00+07:00'), repaymentDueDate: '2026-01-01' }
  const entries = [{ kind: 'DISBURSEMENT', amountSatang: 100000, occurredOn: '2026-01-10' }]
  assert.equal(contractLedgerBalance(contract, entries, '2026-01-05').disbursed, false)
  assert.equal(contractLedgerBalance(contract, entries, '2026-01-05').penaltyRemaining, 0)
  assert.equal(contractLedgerBalance(contract, entries, '2026-01-10').penaltyRemaining, 0)
  assert.equal(contractLedgerBalance(contract, entries, '2026-01-11').penaltyRemaining, 5000)
  assert.equal(borrowerPosition([{ ...contract, status: 'WAITING_PAYMENT', paidAt: null, ledgerEntries: [] }], 999).committedLimit, 1000)
})

test('post-commit effects cover standalone, callback and array transactions and exclude rollback', async () => {
  let calls = 0
  const observed = withPersistence(prisma, async () => {
    calls++
    assert.ok(await prisma.paymentChannel.findUnique({ where: { code: 'TEST_COMMIT' } }))
  })
  await observed.paymentChannel.create({ data: { code: 'TEST_COMMIT', nameTh: 'test' } })
  assert.equal(calls, 1)
  await observed.$transaction(async tx => {
    await tx.paymentChannel.update({ where: { code: 'TEST_COMMIT' }, data: { nameTh: 'committed' } })
    assert.equal(calls, 1)
  })
  assert.equal(calls, 2)
  await assert.rejects(observed.$transaction(async tx => {
    await tx.paymentChannel.update({ where: { code: 'TEST_COMMIT' }, data: { nameTh: 'rollback' } })
    throw new Error('rollback')
  }))
  assert.equal(calls, 2)
  assert.equal((await prisma.paymentChannel.findUniqueOrThrow({ where: { code: 'TEST_COMMIT' } })).nameTh, 'committed')
  await observed.$transaction([observed.paymentChannel.update({ where: { code: 'TEST_COMMIT' }, data: { nameTh: 'array' } })])
  assert.equal(calls, 3)
})

test('credit reservation, duplicate references and slip hashes, edits, void and retry', async () => {
  const user = await prisma.user.create({ data: { acccode: 'integrity-admin', password: 'test', role: 'ADMIN', level: 0 } })
  const borrower = await prisma.borrower.create({ data: { nickname: 'limit-test', firstName: 'Test', lastName: 'Borrower', phone: '', approvedLimit: 1500 } })
  const lender = await prisma.lender.create({ data: { nickname: 'funder' } })
  await prisma.paymentChannel.createMany({ data: [{ code: 'BANKING', nameTh: 'ธนาคาร' }, { code: 'PROMPTPAY', nameTh: 'พร้อมเพย์' }] })
  await prisma.financialCategory.createMany({ data: [{ code: 'LOAN_DISBURSEMENT', nameTh: 'จ่ายเงินกู้', group: 'LOAN', direction: 'OUT' }, { code: 'CONTRACT_REPAYMENT', nameTh: 'รับคืน', group: 'LOAN', direction: 'IN' }] })
  const draft = { requestKey: randomUUID(), borrowerId: borrower.id, lenderId: lender.id, documentChoice: 'NONE', signingMethod: '', documentPackage: '', interestMethod: 'INTEREST_WITH_PRINCIPAL', principal: '1000', rateCode: 'CUSTOM', customRate: '0', scheduledDisbursementDate: '2026-01-01', repaymentDueDate: '2026-02-01' }
  const result = await saveContract(draft)
  assert.ok(result.id, result.error)
  assert.equal((await searchContractBorrowers('limit-test'))[0].usedLimit, 1000)
  const second = await saveContract({ ...draft, requestKey: randomUUID(), principal: '500' })
  assert.ok(second.id)
  const overLimit = await saveContract({ ...draft, requestKey: randomUUID(), principal: '250' })
  assert.ok(overLimit.id, overLimit.error)
  const reservation = await prisma.loanContract.findUniqueOrThrow({ where: { id: overLimit.id! } })
  assert.equal(reservation.limitApprovalRequired, true)
  const reservedDisbursement = { requestKey: randomUUID(), contractId: overLimit.id!, kind: 'DISBURSEMENT' as const, direction: 'OUT', categoryCode: '', channelCode: 'BANKING', reference: 'ReservedLimit001', note: '', amount: '250', occurredOn: '2026-01-01' }
  assert.match((await saveLedger(reservedDisbursement)).error!, /อนุมัติก่อนจ่ายเงินจริง/)
  assert.ok((await approveContractLimit(overLimit.id!)).success)
  const approvedReservation = await prisma.loanContract.findUniqueOrThrow({ where: { id: overLimit.id! } })
  assert.equal(approvedReservation.limitApprovalRequired, false)
  assert.ok(approvedReservation.limitApprovedAt)
  assert.equal(approvedReservation.limitApprovedBy, user.id)
  assert.ok((await saveLedger(reservedDisbursement)).success)
  const input = { requestKey: randomUUID(), contractId: result.id!, kind: 'DISBURSEMENT' as const, direction: 'OUT', categoryCode: '', channelCode: 'BANKING', reference: 'Ref001', note: '', amount: '1000', occurredOn: '2026-01-01' }
  const proof = new File(['%PDF-1.4 unique proof'], 'proof.pdf', { type: 'application/pdf' })
  assert.ok((await saveLedger(input, proof)).success)
  assert.ok((await saveLedger(input, proof)).success, 'same request is idempotent')
  const next = { ...input, requestKey: randomUUID(), contractId: second.id!, amount: '500', reference: 'Ref002' }
  assert.match((await saveLedger(next, proof)).error!, /บันทึกแล้ว/)
  assert.match((await saveLedger({ ...next, reference: ' ref001 ', channelCode: 'PROMPTPAY' })).error!, /บันทึกแล้ว/)
  const fresh = new File(['%PDF-1.4 different proof'], 'other.pdf', { type: 'application/pdf' })
  assert.ok((await saveLedger(next, fresh)).success)
  const entry = await prisma.ledgerEntry.findUniqueOrThrow({ where: { requestKey: next.requestKey } })
  assert.match((await editLedger({ id: entry.id, expectedRevision: 0, amount: '500', occurredOn: entry.occurredOn, direction: entry.direction, categoryCode: entry.categoryCode, channelCode: entry.channelCode, reference: 'REF001', note: '', reason: 'test' })).error!, /บันทึกแล้ว/)
  assert.ok((await voidLedger(entry.id, 'wrong proof')).success)
  assert.ok((await saveLedger({ ...next, requestKey: randomUUID() }, fresh)).success, 'voided proofs can be rebooked')
  assert.equal(await prisma.googleSyncJob.count({ where: { entity: 'ledger' } }) >= 2, true)
  assert.equal((await prisma.user.findUniqueOrThrow({ where: { id: user.id } })).role, 'ADMIN')
})

test('Google sync failures persist, retry succeeds, and newer jobs are not overwritten', async () => {
  const savedFetch = globalThis.fetch
  const env = { disabled: process.env.LOAN_DISABLE_SIDE_EFFECTS, url: process.env.GOOGLE_APPS_SCRIPT_URL, token: process.env.GOOGLE_SYNC_TOKEN }
  process.env.GOOGLE_APPS_SCRIPT_URL = 'https://example.invalid/test-bridge'
  process.env.GOOGLE_SYNC_TOKEN = 'test-token'
  // Use the original client without real backup effects for this mocked network test.
  process.env.LOAN_DISABLE_SIDE_EFFECTS = '1'
  await enqueueGoogleSync('borrower', 999999)
  // A real row gives the worker something to send.
  const borrower = await prisma.borrower.findFirstOrThrow()
  await enqueueGoogleSync('borrower', borrower.id)
  try {
    process.env.LOAN_DISABLE_SIDE_EFFECTS = '1'
    globalThis.fetch = async () => { throw new Error('offline') }
    await processGoogleSyncQueue(100)
    const failed = await prisma.googleSyncJob.findUniqueOrThrow({ where: { id: `borrower:${borrower.id}` } })
    assert.equal(failed.status, 'FAILED')
    assert.ok(failed.nextAttemptAt > new Date())
    await prisma.googleSyncJob.update({ where: { id: failed.id }, data: { nextAttemptAt: new Date(0) } })
    globalThis.fetch = async () => new Response(JSON.stringify({ ok: true, result: { count: 1 } }), { headers: { 'content-type': 'application/json' } })
    await processGoogleSyncQueue(100)
    assert.equal((await prisma.googleSyncJob.findUniqueOrThrow({ where: { id: failed.id } })).status, 'SYNCED')
    await enqueueGoogleSync('borrower', borrower.id)
    let once = true
    globalThis.fetch = async () => {
      if (once) { once = false; await enqueueGoogleSync('borrower', borrower.id) }
      return new Response(JSON.stringify({ ok: true, result: { count: 1 } }))
    }
    await processGoogleSyncQueue(100)
    assert.equal((await prisma.googleSyncJob.findUniqueOrThrow({ where: { id: failed.id } })).status, 'PENDING')
    assert.ok((await googleSyncStatus()).pending > 0)
  } finally {
    globalThis.fetch = savedFetch
    process.env.LOAN_DISABLE_SIDE_EFFECTS = env.disabled
    process.env.GOOGLE_APPS_SCRIPT_URL = env.url
    process.env.GOOGLE_SYNC_TOKEN = env.token
  }
})
