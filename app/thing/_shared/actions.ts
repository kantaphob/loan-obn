'use server'

import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { getCurrentUser } from '@/lib/auth/current-user'
import { prisma } from '@/lib/prisma'
import { syncLandRegister } from '@/lib/land-register'
import { assignAssetCodes, validateCategories, validatePropertyCategories } from '../property/categories'
import { initialData, migrateAssetData, type AssetData } from './model'
import { validateAssetData } from './validation'
import { validateHistory, validateLedgerLinks } from './integrity'

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
const ledgerSelect = { id: true, occurredOn: true, amountSatang: true, reference: true, note: true, categoryName: true } as const
export async function getAssetWorkspace() {
  const user = await operator()
  const [data, categories, ledger, history] = await Promise.all([
    load(user.id), getCategories(),
    prisma.ledgerEntry.findMany({ where: { direction: 'OUT', voidedAt: null }, orderBy: [{ occurredOn: 'desc' }, { id: 'desc' }], take: 1000, select: ledgerSelect }),
    prisma.assetWorkspaceRevision.findMany({ where: { operatorId: user.id }, orderBy: { revision: 'desc' }, take: 30, select: { id: true, revision: true, reason: true, createdAt: true } }),
  ])
  return { data, categories, ledger, history: history.map(row => ({ ...row, createdAt: row.createdAt.toISOString() })), canWrite: user.role !== 'REVIEWER' }
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
      const ids = [...input.homes.flatMap(h => h.boq.map(b => b.ledgerEntryId)), ...input.loans.flatMap(l => l.payments.map(p => p.ledgerEntryId))].filter((id): id is number => Boolean(id))
      const entries = ids.length ? await tx.ledgerEntry.findMany({ where: { id: { in: ids }, direction: 'OUT', voidedAt: null }, select: ledgerSelect }) : []
      validateLedgerLinks(input, entries)
      const next: AssetData = { ...input, homes: assignAssetCodes(input.homes, current.homes, categories), revision: input.revision + 1 }
      await syncLandRegister(tx, user.id, next, categories)
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
