'use server'

import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { getCurrentUser } from '@/lib/auth/current-user'
import { prisma } from '@/lib/prisma'
import { syncLandRegister } from '@/lib/land-register'
import { syncPropertyRegister } from '@/lib/property-register'
import { assignAssetCodes, validateCategories, validatePropertyCategories } from '../property/categories'
import { initialData, migrateAssetData, type AssetData } from './model'
import { validateAssetData } from './validation'
import { validateHistory, validateLedgerLinks } from './integrity'
import { assertAccountingDateOpen } from '@/lib/monthly-accounting'
import { assertUniqueLedgerProof } from '@/lib/ledger-proof'
import { ledgerAmount, validLedgerDate } from '@/lib/ledger'
import { revalidatePath } from 'next/cache'
import { readRepaymentSlip } from '@/lib/repayment-slip'
import { slipDigest } from '@/lib/ledger-proof'
import { syncGoogleLedger } from '@/lib/google-sync'

async function operator(write = false) {
  const user = await getCurrentUser()
  if (!user || user.status !== 'ACTIVE' || write && user.role === 'REVIEWER') throw new Error('ไม่มีสิทธิ์ทำรายการนี้')
  return user
}
async function load(operatorId: string): Promise<AssetData> {
  const saved = await prisma.assetWorkspaceState.findUnique({ where: { operatorId } })
  if (saved) {
    const data = migrateAssetData(JSON.parse(saved.payload)); validateAssetData(data); return data
  }
  let data: AssetData
  try {
    const directory = process.env.ASSET_DATA_DIRECTORY || path.join(process.cwd(), 'private', 'assets')
    data = migrateAssetData(JSON.parse(await readFile(path.join(directory, `${operatorId}.json`), 'utf8')))
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error
    data = initialData()
  }
  validateAssetData(data)
  const payload = JSON.stringify(data)
  try {
    await prisma.$transaction(async tx => {
      await tx.assetWorkspaceState.create({ data: { operatorId, revision: data.revision, payload } })
      await tx.assetWorkspaceRevision.create({ data: { operatorId, revision: data.revision, payload, reason: 'เริ่มต้น / ย้ายข้อมูลจากไฟล์เดิม' } })
    })
    return data
  } catch (error) {
    if ((error as { code?: string }).code === 'P2002') return load(operatorId)
    throw error
  }
}
async function getCategories() {
  return prisma.assetCategory.findMany({ orderBy: [{ sortOrder: 'asc' }, { code: 'asc' }], select: { code: true, nameTh: true, parentCode: true, isActive: true } })
}
const ledgerSelect = { id: true, occurredOn: true, amountSatang: true, reference: true, note: true, categoryName: true, direction: true } as const
export async function getAssetWorkspace() {
  const user = await operator()
  const [data, categories, ledger, history, financialCategories, channels] = await Promise.all([
    load(user.id), getCategories(),
    prisma.ledgerEntry.findMany({ where: { direction: 'OUT', voidedAt: null }, orderBy: [{ occurredOn: 'desc' }, { id: 'desc' }], take: 1000, select: ledgerSelect }),
    prisma.assetWorkspaceRevision.findMany({ where: { operatorId: user.id }, orderBy: { revision: 'desc' }, take: 30, select: { id: true, revision: true, reason: true, createdAt: true } }),
    prisma.financialCategory.findMany({ where: { isActive: true, OR: [{ direction: 'OUT', group: { not: 'LOAN' } }, { direction: 'IN', group: 'INCOME' }], NOT: { code: { in: ['INTEREST_RECEIVED', 'TRADE_PAYABLE'] } } }, orderBy: { sortOrder: 'asc' }, select: { code: true, nameTh: true, direction: true } }),
    prisma.paymentChannel.findMany({ where: { isActive: true }, orderBy: { code: 'asc' }, select: { code: true, nameTh: true } }),
  ])
  return { data, categories, ledger, history: history.map(row => ({ ...row, createdAt: row.createdAt.toISOString() })), financialCategories, channels, canWrite: user.role !== 'REVIEWER' }
}

export type LandDevelopmentPaymentInput = {
  requestKey: string; landId: string; developmentId: string; paymentId: string
  direction: 'IN' | 'OUT'; categoryCode: string; amount: string; occurredOn: string; channelCode: string
  reference: string; note: string; paymentType: 'deposit' | 'progress' | 'final' | 'maintenance' | 'refund'
}

/** Create a cash entry and its property/work link in one database transaction. */
export async function createLandDevelopmentPayment(input: LandDevelopmentPaymentInput, file?: File | null) {
  try {
    const user = await operator(true)
    if (!input || !/^[a-f0-9-]{36}$/i.test(input.requestKey) || !/^[a-f0-9-]{36}$/i.test(input.paymentId) || typeof input.landId !== 'string' || typeof input.developmentId !== 'string') throw new Error('ข้อมูลรายการไม่ถูกต้อง')
    const amountSatang = ledgerAmount(input.amount)
    if (!validLedgerDate(input.occurredOn)) throw new Error('วันที่รับหรือจ่ายไม่ถูกต้อง หรือเป็นวันที่ในอนาคต')
    if (!['IN', 'OUT'].includes(input.direction) || !['deposit', 'progress', 'final', 'maintenance', 'refund'].includes(input.paymentType)) throw new Error('เลือกประเภทการรับ–จ่ายให้ถูกต้อง')
    if (typeof input.reference !== 'string' || input.reference.length > 150 || typeof input.note !== 'string' || input.note.length > 1000) throw new Error('เลขอ้างอิงหรือหมายเหตุยาวเกินกำหนด')
    const slip = await readRepaymentSlip(file)
    const result = await prisma.$transaction(async tx => {
      const state = await tx.assetWorkspaceState.findUniqueOrThrow({ where: { operatorId: user.id } })
      const current = migrateAssetData(JSON.parse(state.payload))
      const land = current.homes.find(home => home.id === input.landId)
      const work = land?.landDevelopments?.find(row => row.id === input.developmentId)
      if (!land || !work || land.archivedOn) throw new Error('ไม่พบที่ดินหรืองานพัฒนานี้ กรุณาโหลดหน้าใหม่')
      if (input.direction === 'IN') {
        const paidOut = work.payments.filter(payment => (payment.direction ?? 'OUT') === 'OUT').reduce((sum, payment) => sum + payment.amount, 0)
        const returned = work.payments.filter(payment => (payment.direction ?? 'OUT') === 'IN').reduce((sum, payment) => sum + payment.amount, 0)
        if (amountSatang / 100 > Math.round((paidOut - returned + Number.EPSILON) * 100) / 100) throw new Error('ยอดรับคืนเกินยอดที่เคยจ่ายให้ผู้รับเหมาสำหรับงานนี้')
      }
      const category = await tx.financialCategory.findUnique({ where: { code: input.categoryCode } })
      if (!category?.isActive || category.direction !== input.direction || category.direction === 'OUT' && category.group === 'LOAN' || input.direction === 'IN' && category.group !== 'INCOME' || ['INTEREST_RECEIVED', 'TRADE_PAYABLE'].includes(category.code)) throw new Error('เลือกหมวดรับ–จ่ายที่ตรงกับประเภทและใช้งานได้')
      const channel = await tx.paymentChannel.findUnique({ where: { code: input.channelCode } })
      if (!channel?.isActive) throw new Error('เลือกช่องทางจ่ายเงินที่ใช้งานได้')
      await assertAccountingDateOpen(tx, input.occurredOn)
      await assertUniqueLedgerProof(tx, { reference: input.reference, channelCode: channel.code, slipHash: slip ? slipDigest(slip.fileData) : null })
      const categories = await tx.assetCategory.findMany({ select: { code: true, nameTh: true, parentCode: true, isActive: true } })
      const homes = assignAssetCodes(current.homes, current.homes, categories)
      const persistedLand = homes.find(home => home.id === input.landId)!
      const assetLabel = `${persistedLand.assetCode ?? 'ASSET'} · ${persistedLand.name}`
      const paymentNote = [`${assetLabel} / ${work.name} / ${input.direction === 'IN' ? 'รับเงินคืนจากผู้รับเหมา' : 'จ่ายค่าพัฒนาที่ดิน'}`, input.note.trim()].filter(Boolean).join(' · ')
      const entry = await tx.ledgerEntry.create({ data: { requestKey: input.requestKey, slipHash: slip ? slipDigest(slip.fileData) : null, kind: 'GENERAL', contractId: null, direction: input.direction, categoryCode: category.code, categoryName: category.nameTh, amountSatang, occurredOn: input.occurredOn, channelCode: channel.code, channelName: channel.nameTh, reference: input.reference.trim(), note: paymentNote, createdBy: user.id, ...(slip ? { slip: { create: slip } } : {}) } })
      const payment = { id: input.paymentId, ledgerEntryId: entry.id, date: input.occurredOn, amount: amountSatang / 100, direction: input.direction, type: input.paymentType, reference: input.reference.trim(), note: input.note.trim() } as const
      const updatedLand = { ...persistedLand, landDevelopments: (persistedLand.landDevelopments ?? []).map(row => row.id === input.developmentId ? { ...row, payments: [...row.payments, payment] } : row) }
      const nextInput: AssetData = { ...current, homes: homes.map(home => home.id === input.landId ? updatedLand : home) }
      validateAssetData(nextInput)
      validateHistory(nextInput, current)
      const linkedIds = [...nextInput.homes.flatMap(home => [...home.boq.map(row => row.ledgerEntryId), ...(home.landDevelopments ?? []).flatMap(row => row.payments.map(item => item.ledgerEntryId))]), ...nextInput.loans.flatMap(loan => loan.payments.map(row => row.ledgerEntryId))].filter((id): id is number => Boolean(id))
      const linkedEntries = await tx.ledgerEntry.findMany({ where: { id: { in: linkedIds }, voidedAt: null }, select: ledgerSelect })
      validateLedgerLinks(nextInput, linkedEntries)
      const next: AssetData = { ...nextInput, revision: current.revision + 1 }
      validateCategories(next.homes, current.homes, categories)
      validatePropertyCategories(next, categories)
      await syncLandRegister(tx, user.id, next, categories)
      await syncPropertyRegister(tx, user.id, next)
      const payload = JSON.stringify(next)
      const saved = await tx.assetWorkspaceState.updateMany({ where: { operatorId: user.id, revision: current.revision }, data: { revision: next.revision, payload } })
      if (saved.count !== 1) throw new Error('ข้อมูลถูกแก้ไขจากอีกหน้าต่าง กรุณาโหลดใหม่')
      await tx.assetWorkspaceRevision.create({ data: { operatorId: user.id, revision: next.revision, payload, reason: `${input.direction === 'IN' ? 'รับคืน' : 'จ่าย'}งานที่ดิน: ${work.name}` } })
      return { entryId: entry.id, data: next }
    }, { timeout: 30000 })
    await syncGoogleLedger(result.entryId)
    revalidatePath('/dashboard/ledger'); revalidatePath('/thing/asset'); revalidatePath('/thing/property')
    return { success: true as const, ...result }
  } catch (error) {
    return { error: error instanceof Error && 'code' in error && error.code === 'P2002' ? 'เลขอ้างอิงหรือสลิปซ้ำกับรายการที่บันทึกแล้ว' : error instanceof Error && !error.name.startsWith('Prisma') ? error.message : 'บันทึกรายการรับ–จ่ายไม่สำเร็จ กรุณาลองอีกครั้ง' }
  }
}
export async function saveAssetWorkspace(input: AssetData, reason = 'บันทึกรายการ'): Promise<{ data?: AssetData; error?: string }> {
  try {
    const user = await operator(true)
    if (JSON.stringify(input).length > 4_000_000) throw new Error('ข้อมูลมีขนาดใหญ่เกินไป')
    if (typeof reason !== 'string' || !reason.trim() || reason.length > 500) throw new Error('กรุณาระบุเหตุผลการแก้ไขไม่เกิน 500 ตัวอักษร')
    validateAssetData(input)
    const data = await prisma.$transaction(async tx => {
      const state = await tx.assetWorkspaceState.findUniqueOrThrow({ where: { operatorId: user.id } })
      if (state.revision !== input.revision) throw new Error('ข้อมูลเปลี่ยนจากอีกหน้าต่าง กรุณาสำรองแบบร่างและโหลดหน้าใหม่')
      const current = migrateAssetData(JSON.parse(state.payload))
      validateHistory(input, current)
      const categories = await tx.assetCategory.findMany({ select: { code: true, nameTh: true, parentCode: true, isActive: true } })
      validateCategories(input.homes, current.homes, categories)
      validatePropertyCategories(input, categories)
      const ids = [...input.homes.flatMap(h => [...h.boq.map(b => b.ledgerEntryId), ...(h.landDevelopments ?? []).flatMap(work => work.payments.map(payment => payment.ledgerEntryId))]), ...input.loans.flatMap(l => l.payments.map(p => p.ledgerEntryId))].filter((id): id is number => Boolean(id))
      const entries = ids.length ? await tx.ledgerEntry.findMany({ where: { id: { in: ids }, voidedAt: null }, select: ledgerSelect }) : []
      validateLedgerLinks(input, entries)
      const next: AssetData = { ...input, homes: assignAssetCodes(input.homes, current.homes, categories), revision: input.revision + 1 }
      await syncLandRegister(tx, user.id, next, categories)
      await syncPropertyRegister(tx, user.id, next)
      const payload = JSON.stringify(next)
      const result = await tx.assetWorkspaceState.updateMany({ where: { operatorId: user.id, revision: input.revision }, data: { revision: next.revision, payload } })
      if (result.count !== 1) throw new Error('ข้อมูลถูกแก้ไขจากอีกหน้าต่าง กรุณาโหลดใหม่')
      await tx.assetWorkspaceRevision.create({ data: { operatorId: user.id, revision: next.revision, payload, reason: reason.trim() } })
      return next
    }, { timeout: 30000 })
    return { data }
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'บันทึกไม่สำเร็จ' }
  }
}
export async function getAssetRevision(revision: number) {
  const user = await operator()
  if (!Number.isSafeInteger(revision) || revision < 0) throw new Error('รุ่นข้อมูลไม่ถูกต้อง')
  const row = await prisma.assetWorkspaceRevision.findUniqueOrThrow({ where: { operatorId_revision: { operatorId: user.id, revision } } })
  return row.payload
}

export async function getAssetHistory() {
  const user = await operator()
  const rows = await prisma.assetWorkspaceRevision.findMany({ where: { operatorId: user.id }, orderBy: { revision: 'desc' }, take: 30, select: { revision: true, reason: true, createdAt: true } })
  return rows.map(row => ({ ...row, createdAt: row.createdAt.toISOString() }))
}
