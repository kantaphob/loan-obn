'use server'

import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/lib/auth/current-user'
import { bangkokToday, contractLedgerBalance } from '@/lib/ledger'
import { contractCode } from '@/lib/contracts'
import { slipFileName } from '@/lib/slip-name'
import { googleSyncStatus, processGoogleSyncQueue } from '@/lib/google-sync'
import { isGoogleBridgeConfigured } from '@/lib/google-integration'
import { revalidatePath } from 'next/cache'

async function operator(write = false) {
  const user = await getCurrentUser()
  if (!user || user.status !== 'ACTIVE' || write && user.role === 'REVIEWER') throw new Error('ไม่มีสิทธิ์ทำรายการนี้')
  return user
}

export async function getReceivables(options: { q?: string; view?: string; page?: number } = {}) {
  const user = await operator()
  const today = bangkokToday()
  const [contracts, entries, categories, channels, receivedToday, sync] = await Promise.all([
    prisma.loanContract.findMany({ select: { id: true, borrowerName: true, lenderName: true, netSatang: true, repaymentSatang: true, principalSatang: true, interestSatang: true, interestMethod: true, status: true, paidAt: true, repaymentDueDate: true, legacyReceivedSatang: true, legacySourceCode: true, penaltyMaxDays: true } }),
    // Running balances need the payment timeline, but never notes, slips or revisions.
    prisma.ledgerEntry.findMany({ where: { voidedAt: null, kind: { in: ['DISBURSEMENT', 'REPAYMENT'] } }, select: { id: true, contractId: true, kind: true, occurredOn: true, amountSatang: true, penaltyAssessed: true, penaltyWaivedSatang: true, settlementWaivedSatang: true } }),
    prisma.financialCategory.findMany({ where: { isActive: true, code: 'CONTRACT_REPAYMENT' } }),
    prisma.paymentChannel.findMany({ where: { isActive: true }, orderBy: { code: 'asc' } }),
    prisma.ledgerEntry.aggregate({ where: { kind: 'REPAYMENT', voidedAt: null, occurredOn: today }, _sum: { amountSatang: true } }),
    syncState(),
  ])
  const byContract = new Map<number, typeof entries>()
  for (const entry of entries) {
    if (entry.contractId === null) continue
    const group = byContract.get(entry.contractId) ?? []
    group.push(entry); byContract.set(entry.contractId, group)
  }
  const balances = contracts.map(c => ({ ...c, paidAt: c.paidAt?.toISOString() ?? null, ...contractLedgerBalance(c, byContract.get(c.id) ?? [], today) })).filter(c => c.disbursed)
  const open = balances.filter(c => c.remaining > 0)
  const overdue = open.filter(c => c.overdueDays > 0)
  const summary = {
    remaining: open.reduce((sum, c) => sum + c.remaining, 0), openCount: open.length,
    overdue: overdue.reduce((sum, c) => sum + c.remaining, 0), overdueCount: overdue.length,
    todayCount: open.filter(c => c.repaymentDueDate === today).length,
    receivedToday: receivedToday._sum.amountSatang ?? 0,
    aging: [[1, 30], [31, 60], [61, 90], [91, Infinity]].map(([min, max]) => {
      const group = overdue.filter(c => c.overdueDays >= min && c.overdueDays <= max)
      return { label: max === Infinity ? 'เกิน 90 วัน' : `${min}–${max} วัน`, count: group.length, amount: group.reduce((sum, c) => sum + c.remaining, 0) }
    }),
  }
  const query = (options.q ?? '').trim().toLowerCase().slice(0, 100)
  const view = options.view ?? 'OPEN'
  const rows = balances.filter(c => `${contractCode(c.id)} ${c.legacySourceCode ?? ''} ${c.borrowerName} ${c.lenderName}`.toLowerCase().includes(query)
    && (view === 'ALL' || (view === 'CLOSED' ? c.remaining === 0 : c.remaining > 0 && (view === 'OVERDUE' ? c.overdueDays > 0 : view === 'TODAY' ? c.repaymentDueDate === today : view === 'UPCOMING' ? Boolean(c.repaymentDueDate && c.repaymentDueDate > today) : true))))
    .sort((a, b) => Number(b.remaining > 0) - Number(a.remaining > 0) || b.overdueDays - a.overdueDays || (a.repaymentDueDate ?? '9999').localeCompare(b.repaymentDueDate ?? '9999') || a.id - b.id)
  const pageCount = Math.max(1, Math.ceil(rows.length / 20))
  const requested = Number.isFinite(options.page) ? Math.floor(options.page!) : 1
  const page = Math.min(pageCount, Math.max(1, requested))
  const current = rows.slice((page - 1) * 20, page * 20)
  const ids = new Set(current.map(c => c.id))
  return { canWrite: user.role !== 'REVIEWER', canSync: ['ADMIN', 'SUPER_ADMIN'].includes(user.role), today, categories, channels, contracts: current, entries: entries.filter(e => e.contractId !== null && ids.has(e.contractId)), summary, sync, page, pageCount, total: rows.length }
}

export async function getRepaymentHistory(contractId: number) {
  await operator()
  if (!Number.isSafeInteger(contractId) || contractId < 1) throw new Error('สัญญาไม่ถูกต้อง')
  const contract = await prisma.loanContract.findUniqueOrThrow({ where: { id: contractId }, select: { legacySourceCode: true } })
  const entries = await prisma.ledgerEntry.findMany({ where: { contractId, kind: 'REPAYMENT' }, orderBy: [{ occurredOn: 'desc' }, { id: 'desc' }], include: { slip: { select: { originalName: true, mimeType: true } } } })
  return entries.map(e => ({ ...e, createdAt: e.createdAt.toISOString(), voidedAt: e.voidedAt?.toISOString() ?? null, slip: e.slip ? { ...e.slip, displayName: slipFileName({ ...e, legacySourceCode: contract.legacySourceCode }, e.slip.mimeType) } : null }))
}

export async function retryReceivablesSync() {
  const user = await operator(true)
  if (!['ADMIN', 'SUPER_ADMIN'].includes(user.role)) throw new Error('ไม่มีสิทธิ์ลองซิงก์ข้อมูล')
  if (!isGoogleBridgeConfigured()) throw new Error('ยังไม่ได้ตั้งค่าการเชื่อมต่อ Google')
  await prisma.googleSyncJob.updateMany({ where: { status: 'FAILED' }, data: { status: 'PENDING', nextAttemptAt: new Date() } })
  await processGoogleSyncQueue(3)
  const state = await syncState()
  revalidatePath('/dashboard/repayments')
  return state
}

async function syncState() {
  try {
    const status = await googleSyncStatus()
    return { configured: status.configured, pending: status.pending + status.failed, available: true }
  } catch {
    return { configured: isGoogleBridgeConfigured(), pending: 0, available: false }
  }
}
