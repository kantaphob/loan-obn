'use server'

import { readFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { getCurrentUser } from '@/lib/auth/current-user'
import { prisma } from '@/lib/prisma'
import { syncLandRegister } from '@/lib/land-register'
import { syncPropertyRegister } from '@/lib/property-register'
import { syncBuildingBoqRegister } from '@/lib/building-boq-register'
import { assignAssetCodes, validateCategories, validatePropertyCategories } from '../property/categories'
import { initialData, migrateAssetData, money, type AssetData, type VehicleDownPayment } from './model'
import { validateAssetData } from './validation'
import { assetLedgerIds, validateHistory, validateLedgerLinks } from './integrity'
import { configureInitialLoan, type InitialLoanSettings } from '../liabilities/initial-settings'

const requireFromProject = createRequire(path.join(process.cwd(), 'package.json'))
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
    prisma.ledgerEntry.findMany({ where: { direction: { in: ['IN', 'OUT'] }, voidedAt: null }, orderBy: [{ occurredOn: 'desc' }, { id: 'desc' }], take: 5000, select: ledgerSelect }),
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
      const linkedIds = assetLedgerIds(nextInput)
      const linkedEntries = await tx.ledgerEntry.findMany({ where: { id: { in: linkedIds }, voidedAt: null }, select: ledgerSelect })
      validateLedgerLinks(nextInput, linkedEntries)
      const next: AssetData = { ...nextInput, revision: current.revision + 1 }
      validateCategories(next.homes, current.homes, categories)
      validatePropertyCategories(next, categories)
      await syncLandRegister(tx, user.id, next, categories)
      await syncPropertyRegister(tx, user.id, next)
      await syncBuildingBoqRegister(tx, user.id, next)
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

export type BuildingProjectPaymentInput = {
  requestKey: string; buildingId: string; projectId?: string; changeOrderId?: string; paymentId: string
  direction: 'IN' | 'OUT'; categoryCode: string; amount: string; occurredOn: string; channelCode: string
  reference: string; note: string; paymentType: 'deposit' | 'progress' | 'final' | 'refund'
}

/** Create a ledger entry and link it to a house project in the same transaction. */
export async function createBuildingProjectPayment(input: BuildingProjectPaymentInput, file?: File | null) {
  try {
    const user = await operator(true)
    if (!input || !/^[a-f0-9-]{36}$/i.test(input.requestKey) || !/^[a-f0-9-]{36}$/i.test(input.paymentId) || typeof input.buildingId !== 'string' || Boolean(input.projectId) === Boolean(input.changeOrderId)) throw new Error('ข้อมูลรายการไม่ถูกต้อง')
    const amountSatang = ledgerAmount(input.amount)
    if (!validLedgerDate(input.occurredOn)) throw new Error('วันที่รับหรือจ่ายไม่ถูกต้อง หรือเป็นวันที่ในอนาคต')
    if (!['IN', 'OUT'].includes(input.direction) || !['deposit', 'progress', 'final', 'refund'].includes(input.paymentType) || input.direction === 'IN' && input.paymentType !== 'refund' || input.direction === 'OUT' && input.paymentType === 'refund') throw new Error('เลือกประเภทการรับ–จ่ายให้ถูกต้อง')
    if (typeof input.reference !== 'string' || input.reference.length > 150 || typeof input.note !== 'string' || input.note.length > 1000) throw new Error('เลขอ้างอิงหรือหมายเหตุยาวเกินกำหนด')
    const slip = await readRepaymentSlip(file)
    const result = await prisma.$transaction(async tx => {
      const state = await tx.assetWorkspaceState.findUniqueOrThrow({ where: { operatorId: user.id } })
      const current = migrateAssetData(JSON.parse(state.payload))
      const building = current.homes.find(home => home.id === input.buildingId)
      const project = input.projectId ? building?.buildingProjects?.find(row => row.id === input.projectId) : undefined
      const changeOrder = input.changeOrderId ? building?.buildingChangeOrders?.find(row => row.id === input.changeOrderId) : undefined
      const targetPayments = project?.payments ?? changeOrder?.payments ?? []
      if (!building || building.kind !== 'house' || (!project && !changeOrder) || building.archivedOn || changeOrder && changeOrder.status !== 'approved') throw new Error('ไม่พบบ้านหรือใบงานที่อนุมัติแล้ว กรุณาโหลดหน้าใหม่')
      if (input.direction === 'IN') {
        const paidOut = targetPayments.filter(payment => payment.direction === 'OUT').reduce((sum, payment) => sum + payment.amount, 0)
        const returned = targetPayments.filter(payment => payment.direction === 'IN').reduce((sum, payment) => sum + payment.amount, 0)
        if (amountSatang / 100 > Math.round((paidOut - returned + Number.EPSILON) * 100) / 100) throw new Error('ยอดรับคืนเกินยอดที่จ่ายให้ผู้รับเหมาสำหรับรายการนี้')
      }
      const category = await tx.financialCategory.findUnique({ where: { code: input.categoryCode } })
      if (!category?.isActive || category.direction !== input.direction || category.direction === 'OUT' && category.group === 'LOAN' || input.direction === 'IN' && category.group !== 'INCOME' || ['INTEREST_RECEIVED', 'TRADE_PAYABLE'].includes(category.code)) throw new Error('เลือกหมวดรับ–จ่ายที่ตรงกับประเภทและใช้งานได้')
      const channel = await tx.paymentChannel.findUnique({ where: { code: input.channelCode } })
      if (!channel?.isActive) throw new Error('เลือกช่องทางจ่ายเงินที่ใช้งานได้')
      await assertAccountingDateOpen(tx, input.occurredOn)
      await assertUniqueLedgerProof(tx, { reference: input.reference, channelCode: channel.code, slipHash: slip ? slipDigest(slip.fileData) : null })
      const categories = await tx.assetCategory.findMany({ select: { code: true, nameTh: true, parentCode: true, isActive: true } })
      const homes = assignAssetCodes(current.homes, current.homes, categories)
      const savedBuilding = homes.find(home => home.id === input.buildingId)!
      const label = `${savedBuilding.assetCode ?? 'BLD'} · ${savedBuilding.name}`
      const targetName = project?.name ?? `ใบงาน ${changeOrder!.number} · ${changeOrder!.title}`
      const paymentNote = [`${label} / ${targetName} / ${input.direction === 'IN' ? 'รับเงินคืนจากผู้รับเหมา' : project ? 'จ่ายค่าโครงการบ้าน' : 'จ่ายใบงานเพิ่ม-ลด'}`, input.note.trim()].filter(Boolean).join(' · ')
      const entry = await tx.ledgerEntry.create({ data: { requestKey: input.requestKey, slipHash: slip ? slipDigest(slip.fileData) : null, kind: 'GENERAL', contractId: null, direction: input.direction, categoryCode: category.code, categoryName: category.nameTh, amountSatang, occurredOn: input.occurredOn, channelCode: channel.code, channelName: channel.nameTh, reference: input.reference.trim(), note: paymentNote, createdBy: user.id, ...(slip ? { slip: { create: slip } } : {}) } })
      const payment = { id: input.paymentId, ledgerEntryId: entry.id, date: input.occurredOn, amount: amountSatang / 100, direction: input.direction, type: input.paymentType, reference: input.reference.trim(), note: input.note.trim() } as const
      const updated = project
        ? { ...savedBuilding, buildingProjects: (savedBuilding.buildingProjects ?? []).map(row => row.id === input.projectId ? { ...row, payments: [...row.payments, payment] } : row) }
        : { ...savedBuilding, buildingChangeOrders: (savedBuilding.buildingChangeOrders ?? []).map(row => row.id === input.changeOrderId ? { ...row, payments: [...(row.payments ?? []), payment] } : row) }
      const nextInput: AssetData = { ...current, homes: homes.map(home => home.id === input.buildingId ? updated : home) }
      validateAssetData(nextInput); validateHistory(nextInput, current)
      const linkedIds = assetLedgerIds(nextInput)
      const linkedEntries = await tx.ledgerEntry.findMany({ where: { id: { in: linkedIds }, voidedAt: null }, select: ledgerSelect })
      validateLedgerLinks(nextInput, linkedEntries)
      const next: AssetData = { ...nextInput, revision: current.revision + 1 }
      validateCategories(next.homes, current.homes, categories); validatePropertyCategories(next, categories)
      await syncLandRegister(tx, user.id, next, categories); await syncPropertyRegister(tx, user.id, next)
      await syncBuildingBoqRegister(tx, user.id, next)
      const payload = JSON.stringify(next)
      const saved = await tx.assetWorkspaceState.updateMany({ where: { operatorId: user.id, revision: current.revision }, data: { revision: next.revision, payload } })
      if (saved.count !== 1) throw new Error('ข้อมูลถูกแก้ไขจากอีกหน้าต่าง กรุณาโหลดใหม่')
      await tx.assetWorkspaceRevision.create({ data: { operatorId: user.id, revision: next.revision, payload, reason: `${input.direction === 'IN' ? 'รับคืน' : 'จ่าย'}${project ? `โครงการบ้าน: ${project.name}` : `ใบงาน: ${targetName}`}` } })
      return { entryId: entry.id, data: next }
    }, { timeout: 30000 })
    await syncGoogleLedger(result.entryId)
    revalidatePath('/dashboard/ledger'); revalidatePath('/thing/asset'); revalidatePath('/thing/property')
    return { success: true as const, ...result }
  } catch (error) {
    return { error: error instanceof Error && 'code' in error && error.code === 'P2002' ? 'เลขอ้างอิงหรือสลิปซ้ำกับรายการที่บันทึกแล้ว' : error instanceof Error && !error.name.startsWith('Prisma') ? error.message : 'บันทึกรายการรับ–จ่ายไม่สำเร็จ กรุณาลองอีกครั้ง' }
  }
}

export type VehicleDownPaymentInput = { requestKey: string; paymentId: string; vehicleId: string; amount: string; occurredOn: string; channelCode: string; reference: string; note: string }

/** Record an actual vehicle down-payment in the cash ledger and vehicle history atomically. */
export async function createVehicleDownPayment(input: VehicleDownPaymentInput, file?: File | null) {
  try {
    const user = await operator(true)
    if (!input || !/^[a-f0-9-]{36}$/i.test(input.requestKey) || !/^[a-f0-9-]{36}$/i.test(input.paymentId) || typeof input.vehicleId !== 'string') throw new Error('ข้อมูลรายการไม่ถูกต้อง')
    const amountSatang = ledgerAmount(input.amount)
    if (!validLedgerDate(input.occurredOn)) throw new Error('วันที่จ่ายเงินดาวน์ไม่ถูกต้อง หรือเป็นวันที่ในอนาคต')
    if (typeof input.reference !== 'string' || input.reference.length > 150 || typeof input.note !== 'string' || input.note.length > 1000) throw new Error('เลขอ้างอิงหรือหมายเหตุยาวเกินกำหนด')
    const slip = await readRepaymentSlip(file)
    const result = await prisma.$transaction(async tx => {
      const state = await tx.assetWorkspaceState.findUniqueOrThrow({ where: { operatorId: user.id } })
      const current = migrateAssetData(JSON.parse(state.payload))
      const vehicle = current.homes.find(row => row.id === input.vehicleId)
      const financing = vehicle?.vehicleFinancing
      if (!vehicle || vehicle.kind !== 'vehicle' || vehicle.archivedOn || vehicle.financing !== 'finance' || !financing) throw new Error('ไม่พบสัญญาไฟแนนซ์รถ กรุณาโหลดหน้าใหม่')
      const paidDownPayment = financing.downPayments.reduce((sum, row) => sum + row.amount, 0)
      if (amountSatang / 100 > financing.downPayment - paidDownPayment + .009) throw new Error('ยอดจ่ายเงินดาวน์เกินยอดที่ตกลงกับไฟแนนซ์')
      const channel = await tx.paymentChannel.findUnique({ where: { code: input.channelCode } })
      if (!channel?.isActive) throw new Error('เลือกช่องทางจ่ายเงินที่ใช้งานได้')
      const category = await tx.financialCategory.upsert({ where: { code: 'VEHICLE_DOWN_PAYMENT' }, update: {}, create: { code: 'VEHICLE_DOWN_PAYMENT', nameTh: 'จ่ายเงินดาวน์รถ', nameEn: 'Vehicle down payment', group: 'ASSET', direction: 'OUT', sortOrder: 361 } })
      if (!category.isActive || category.direction !== 'OUT' || category.group !== 'ASSET') throw new Error('หมวดจ่ายเงินดาวน์รถไม่เปิดใช้งาน')
      await assertAccountingDateOpen(tx, input.occurredOn)
      await assertUniqueLedgerProof(tx, { reference: input.reference, channelCode: channel.code, slipHash: slip ? slipDigest(slip.fileData) : null })
      const categories = await tx.assetCategory.findMany({ select: { code: true, nameTh: true, parentCode: true, isActive: true } })
      const homes = assignAssetCodes(current.homes, current.homes, categories)
      const savedVehicle = homes.find(row => row.id === input.vehicleId)!
      const label = `${savedVehicle.assetCode ?? 'VEH'} · ${savedVehicle.name}`
      const entry = await tx.ledgerEntry.create({ data: { requestKey: input.requestKey, slipHash: slip ? slipDigest(slip.fileData) : null, ...(slip ? { slip: { create: slip } } : {}), kind: 'GENERAL', contractId: null, direction: 'OUT', categoryCode: category.code, categoryName: category.nameTh, amountSatang, occurredOn: input.occurredOn, channelCode: channel.code, channelName: channel.nameTh, reference: input.reference.trim(), note: [`${label} · จ่ายเงินดาวน์รถ · ${financing.lender}`, input.note.trim()].filter(Boolean).join(' · '), createdBy: user.id } })
      const payment: VehicleDownPayment = { id: input.paymentId, date: input.occurredOn, amount: amountSatang / 100, ledgerEntryId: entry.id, reference: input.reference.trim(), note: input.note.trim() }
      const updatedVehicle = { ...savedVehicle, vehicleFinancing: { ...financing, downPayments: [...financing.downPayments, payment] } }
      const nextInput: AssetData = { ...current, homes: homes.map(row => row.id === vehicle.id ? updatedVehicle : row) }
      validateAssetData(nextInput); validateHistory(nextInput, current)
      const linkedIds = assetLedgerIds(nextInput)
      const linkedEntries = await tx.ledgerEntry.findMany({ where: { id: { in: linkedIds }, voidedAt: null }, select: ledgerSelect })
      validateLedgerLinks(nextInput, linkedEntries)
      const next: AssetData = { ...nextInput, revision: current.revision + 1 }
      validateCategories(next.homes, current.homes, categories); validatePropertyCategories(next, categories)
      await syncLandRegister(tx, user.id, next, categories); await syncPropertyRegister(tx, user.id, next); await syncBuildingBoqRegister(tx, user.id, next)
      const payload = JSON.stringify(next)
      const saved = await tx.assetWorkspaceState.updateMany({ where: { operatorId: user.id, revision: current.revision }, data: { revision: next.revision, payload } })
      if (saved.count !== 1) throw new Error('ข้อมูลถูกแก้ไขจากอีกหน้าต่าง กรุณาโหลดใหม่')
      await tx.assetWorkspaceRevision.create({ data: { operatorId: user.id, revision: next.revision, payload, reason: `จ่ายเงินดาวน์รถ ${label} / ${financing.lender} / TX-${String(entry.id).padStart(6, '0')}` } })
      return { entryId: entry.id, data: next }
    }, { timeout: 30000 })
    try { await syncGoogleLedger(result.entryId) } catch { /* Ledger entry is already committed; sync can retry later. */ }
    revalidatePath('/dashboard/ledger'); revalidatePath('/thing/asset'); revalidatePath('/thing/property')
    return { success: true as const, ...result }
  } catch (error) {
    return { error: error instanceof Error && 'code' in error && error.code === 'P2002' ? 'รายการหรือเลขอ้างอิงนี้บันทึกแล้ว กรุณาโหลดหน้าใหม่' : error instanceof Error && !error.name.startsWith('Prisma') ? error.message : 'บันทึกเงินดาวน์รถไม่สำเร็จ กรุณาลองใหม่' }
  }
}

export type VehicleInstallmentInput = { requestKey: string; paymentId: string; vehicleId: string; amount: string; principal: string; interest: string; occurredOn: string; channelCode: string; reference: string; note: string }

/** Record a vehicle finance installment in the cash ledger and vehicle history atomically. */
export async function createVehicleInstallment(input: VehicleInstallmentInput, file?: File | null) {
  try {
    const user = await operator(true)
    if (!input || !/^[a-f0-9-]{36}$/i.test(input.requestKey) || !/^[a-f0-9-]{36}$/i.test(input.paymentId) || typeof input.vehicleId !== 'string') throw new Error('ข้อมูลรายการไม่ถูกต้อง')
    const amountSatang = ledgerAmount(input.amount)
    const principalSatang = ledgerAmount(input.principal)
    const interestSatang = ledgerAmount(input.interest)
    if (principalSatang + interestSatang !== amountSatang) throw new Error('ยอดจ่ายต้องเท่ากับเงินต้นบวกดอกเบี้ย')
    if (!validLedgerDate(input.occurredOn)) throw new Error('วันที่ชำระไม่ถูกต้อง หรือเป็นวันที่ในอนาคต')
    if (typeof input.reference !== 'string' || input.reference.length > 150 || typeof input.note !== 'string' || input.note.length > 1000) throw new Error('เลขอ้างอิงหรือหมายเหตุยาวเกินกำหนด')
    const slip = await readRepaymentSlip(file)
    const result = await prisma.$transaction(async tx => {
      const state = await tx.assetWorkspaceState.findUniqueOrThrow({ where: { operatorId: user.id } })
      const current = migrateAssetData(JSON.parse(state.payload))
      const vehicle = current.homes.find(row => row.id === input.vehicleId)
      const financing = vehicle?.vehicleFinancing
      if (!vehicle || vehicle.kind !== 'vehicle' || vehicle.archivedOn || vehicle.financing !== 'finance' || !financing) throw new Error('ไม่พบข้อมูลไฟแนนซ์รถ กรุณาโหลดหน้าใหม่')
      const paidPrincipal = financing.payments.reduce((sum, row) => sum + row.principal, 0)
      if (principalSatang / 100 > financing.financedAmount - paidPrincipal + .009) throw new Error('ยอดเงินต้นที่ชำระเกินยอดหนี้คงเหลือ')
      const channel = await tx.paymentChannel.findUnique({ where: { code: input.channelCode } })
      if (!channel?.isActive) throw new Error('เลือกช่องทางจ่ายเงินที่ใช้งานได้')
      const category = await tx.financialCategory.upsert({ where: { code: 'VEHICLE_FINANCE_PAYMENT' }, update: {}, create: { code: 'VEHICLE_FINANCE_PAYMENT', nameTh: 'จ่ายค่างวดไฟแนนซ์รถ', nameEn: 'Vehicle finance installment', group: 'LIABILITY', direction: 'OUT', sortOrder: 341 } })
      if (!category.isActive || category.direction !== 'OUT' || category.group !== 'LIABILITY') throw new Error('หมวดจ่ายค่างวดไฟแนนซ์รถไม่เปิดใช้งาน')
      await assertAccountingDateOpen(tx, input.occurredOn)
      await assertUniqueLedgerProof(tx, { reference: input.reference, channelCode: channel.code, slipHash: slip ? slipDigest(slip.fileData) : null })
      const categories = await tx.assetCategory.findMany({ select: { code: true, nameTh: true, parentCode: true, isActive: true } })
      const homes = assignAssetCodes(current.homes, current.homes, categories)
      const savedVehicle = homes.find(row => row.id === input.vehicleId)!
      const label = `${savedVehicle.assetCode ?? 'VEH'} · ${savedVehicle.name}`
      const entry = await tx.ledgerEntry.create({ data: { requestKey: input.requestKey, slipHash: slip ? slipDigest(slip.fileData) : null, ...(slip ? { slip: { create: slip } } : {}), kind: 'GENERAL', contractId: null, direction: 'OUT', categoryCode: category.code, categoryName: category.nameTh, amountSatang, occurredOn: input.occurredOn, channelCode: channel.code, channelName: channel.nameTh, reference: input.reference.trim(), note: [`${label} · จ่ายค่างวดไฟแนนซ์รถ · ${financing.lender}`, `เงินต้น ${money(principalSatang / 100)} บาท`, `ดอกเบี้ย ${money(interestSatang / 100)} บาท`, input.note.trim()].filter(Boolean).join(' · '), createdBy: user.id } })
      const payment = { id: input.paymentId, date: input.occurredOn, amount: amountSatang / 100, principal: principalSatang / 100, interest: interestSatang / 100, ledgerEntryId: entry.id, reference: input.reference.trim(), note: input.note.trim() }
      const updatedVehicle = { ...savedVehicle, vehicleFinancing: { ...financing, payments: [...financing.payments, payment] } }
      const nextInput: AssetData = { ...current, homes: homes.map(row => row.id === vehicle.id ? updatedVehicle : row) }
      validateAssetData(nextInput); validateHistory(nextInput, current)
      const linkedIds = assetLedgerIds(nextInput)
      const linkedEntries = await tx.ledgerEntry.findMany({ where: { id: { in: linkedIds }, voidedAt: null }, select: ledgerSelect })
      validateLedgerLinks(nextInput, linkedEntries)
      const next: AssetData = { ...nextInput, revision: current.revision + 1 }
      validateCategories(next.homes, current.homes, categories); validatePropertyCategories(next, categories)
      await syncLandRegister(tx, user.id, next, categories); await syncPropertyRegister(tx, user.id, next); await syncBuildingBoqRegister(tx, user.id, next)
      const payload = JSON.stringify(next)
      const saved = await tx.assetWorkspaceState.updateMany({ where: { operatorId: user.id, revision: current.revision }, data: { revision: next.revision, payload } })
      if (saved.count !== 1) throw new Error('ข้อมูลถูกแก้ไขจากอีกหน้าต่าง กรุณาโหลดใหม่')
      await tx.assetWorkspaceRevision.create({ data: { operatorId: user.id, revision: next.revision, payload, reason: `จ่ายค่างวดไฟแนนซ์รถ ${label} / ${financing.lender} / TX-${String(entry.id).padStart(6, '0')}` } })
      return { entryId: entry.id, data: next }
    }, { timeout: 30000 })
    try { await syncGoogleLedger(result.entryId) } catch { /* Ledger entry is already committed; sync can retry later. */ }
    revalidatePath('/dashboard/ledger'); revalidatePath('/thing/asset'); revalidatePath('/thing/property')
    return { success: true as const, ...result }
  } catch (error) {
    return { error: error instanceof Error && 'code' in error && error.code === 'P2002' ? 'รายการหรือเลขอ้างอิงนี้บันทึกแล้ว กรุณาโหลดหน้าใหม่' : error instanceof Error && !error.name.startsWith('Prisma') ? error.message : 'บันทึกค่างวดไฟแนนซ์รถไม่สำเร็จ กรุณาลองใหม่' }
  }
}

export type HomeSaleReceiptInput = { requestKey: string; homeId: string; saleId: string; paymentId: string; categoryCode: string; amount: string; occurredOn: string; channelCode: string; reference: string; note: string }

/** Record actual sale proceeds as income and link the receipt to the sale record atomically. */
export async function createHomeSaleReceipt(input: HomeSaleReceiptInput, file?: File | null) {
  try {
    const user = await operator(true)
    if (!input || !/^[a-f0-9-]{36}$/i.test(input.requestKey) || !/^[a-f0-9-]{36}$/i.test(input.paymentId) || typeof input.homeId !== 'string' || typeof input.saleId !== 'string') throw new Error('ข้อมูลรายการรับเงินไม่ถูกต้อง')
    const amountSatang = ledgerAmount(input.amount)
    if (!validLedgerDate(input.occurredOn)) throw new Error('วันที่รับเงินไม่ถูกต้อง หรือเป็นวันที่ในอนาคต')
    if (typeof input.reference !== 'string' || input.reference.length > 150 || typeof input.note !== 'string' || input.note.length > 1000) throw new Error('เลขอ้างอิงหรือหมายเหตุยาวเกินกำหนด')
    const slip = await readRepaymentSlip(file)
    const result = await prisma.$transaction(async tx => {
      const state = await tx.assetWorkspaceState.findUniqueOrThrow({ where: { operatorId: user.id } })
      const current = migrateAssetData(JSON.parse(state.payload))
      const home = current.homes.find(row => row.id === input.homeId)
      const sale = home?.sale
      if (!home || home.kind !== 'house' || !sale || sale.id !== input.saleId || home.archivedOn) throw new Error('ไม่พบรายการขายบ้าน กรุณาโหลดหน้าใหม่')
      const alreadyReceived = sale.payments.reduce((sum, payment) => sum + payment.amount, 0)
      if (input.occurredOn < sale.date || alreadyReceived + amountSatang / 100 > sale.salePrice + .009) throw new Error('ยอดรับสะสมต้องไม่เกินราคาขาย และวันที่รับต้องไม่ก่อนวันขาย')
      const category = await tx.financialCategory.findUnique({ where: { code: input.categoryCode } })
      if (!category?.isActive || category.direction !== 'IN' || category.group !== 'INCOME' || ['INTEREST_RECEIVED', 'TRADE_PAYABLE'].includes(category.code)) throw new Error('เลือกหมวดรายรับจากการขายที่ใช้งานได้')
      const channel = await tx.paymentChannel.findUnique({ where: { code: input.channelCode } })
      if (!channel?.isActive) throw new Error('เลือกช่องทางรับเงินที่ใช้งานได้')
      await assertAccountingDateOpen(tx, input.occurredOn)
      await assertUniqueLedgerProof(tx, { reference: input.reference, channelCode: channel.code, slipHash: slip ? slipDigest(slip.fileData) : null })
      const categories = await tx.assetCategory.findMany({ select: { code: true, nameTh: true, parentCode: true, isActive: true } })
      const homes = assignAssetCodes(current.homes, current.homes, categories)
      const savedHome = homes.find(row => row.id === input.homeId)!
      const entry = await tx.ledgerEntry.create({ data: { requestKey: input.requestKey, slipHash: slip ? slipDigest(slip.fileData) : null, kind: 'GENERAL', contractId: null, direction: 'IN', categoryCode: category.code, categoryName: category.nameTh, amountSatang, occurredOn: input.occurredOn, channelCode: channel.code, channelName: channel.nameTh, reference: input.reference.trim(), note: [`${savedHome.assetCode ?? 'BLD'} · ${savedHome.name}`, `รับเงินจากการขายบ้าน${sale.buyer ? ` · ผู้ซื้อ ${sale.buyer}` : ''}`, input.note.trim()].filter(Boolean).join(' / '), createdBy: user.id, ...(slip ? { slip: { create: slip } } : {}) } })
      const updatedHome = { ...savedHome, sale: { ...sale, payments: [...sale.payments, { id: input.paymentId, ledgerEntryId: entry.id, date: input.occurredOn, amount: amountSatang / 100, reference: input.reference.trim(), note: input.note.trim() }] } }
      const nextInput: AssetData = { ...current, homes: homes.map(row => row.id === savedHome.id ? updatedHome : row) }
      validateAssetData(nextInput); validateHistory(nextInput, current)
      const linkedIds = assetLedgerIds(nextInput)
      const linkedEntries = await tx.ledgerEntry.findMany({ where: { id: { in: linkedIds }, voidedAt: null }, select: ledgerSelect })
      validateLedgerLinks(nextInput, linkedEntries)
      const next: AssetData = { ...nextInput, revision: current.revision + 1 }
      validateCategories(next.homes, current.homes, categories); validatePropertyCategories(next, categories)
      await syncLandRegister(tx, user.id, next, categories); await syncPropertyRegister(tx, user.id, next); await syncBuildingBoqRegister(tx, user.id, next)
      const payload = JSON.stringify(next)
      const saved = await tx.assetWorkspaceState.updateMany({ where: { operatorId: user.id, revision: current.revision }, data: { revision: next.revision, payload } })
      if (saved.count !== 1) throw new Error('ข้อมูลถูกแก้ไขจากอีกหน้าต่าง กรุณาโหลดใหม่')
      await tx.assetWorkspaceRevision.create({ data: { operatorId: user.id, revision: next.revision, payload, reason: `รับเงินจากการขายบ้าน ${savedHome.name}` } })
      return { entryId: entry.id, data: next }
    }, { timeout: 30000 })
    await syncGoogleLedger(result.entryId)
    revalidatePath('/dashboard/ledger'); revalidatePath('/thing/asset'); revalidatePath('/thing/property')
    return { success: true as const, ...result }
  } catch (error) {
    return { error: error instanceof Error && 'code' in error && error.code === 'P2002' ? 'เลขอ้างอิงหรือสลิปซ้ำกับรายการที่บันทึกแล้ว' : error instanceof Error && !error.name.startsWith('Prisma') ? error.message : 'บันทึกรับเงินจากการขายไม่สำเร็จ กรุณาลองอีกครั้ง' }
  }
}
export async function saveAssetWorkspace(input: AssetData, reason = 'บันทึกรายการ'): Promise<{ data?: AssetData; error?: string }> {
  return persistAssetWorkspace(input, reason)
}

export async function saveBankLoanContractSettings(loanId: string, revision: number, settings: InitialLoanSettings): Promise<{ data?: AssetData; error?: string }> {
  try {
    const user = await operator(true)
    const current = await load(user.id)
    if (current.revision !== revision) throw new Error('ข้อมูลเปลี่ยนจากอีกหน้าต่าง กรุณาโหลดหน้าใหม่')
    const loan = current.loans.find(row => row.id === loanId)
    if (!loan) throw new Error('ไม่พบสัญญาเงินกู้')
    const updated = configureInitialLoan(loan, settings)
    return await persistAssetWorkspace({ ...current, loans: current.loans.map(row => row.id === loanId ? updated : row) }, `แก้ไขข้อมูลสัญญาธนาคาร: ${loan.name}`, true)
  } catch (error) { return { error: error instanceof Error ? error.message : 'บันทึกสัญญาไม่สำเร็จ' } }
}

async function persistAssetWorkspace(input: AssetData, reason: string, allowContractEdits = false): Promise<{ data?: AssetData; error?: string }> {
  try {
    const user = await operator(true)
    if (JSON.stringify(input).length > 4_000_000) throw new Error('ข้อมูลมีขนาดใหญ่เกินไป')
    if (typeof reason !== 'string' || !reason.trim() || reason.length > 500) throw new Error('กรุณาระบุเหตุผลการแก้ไขไม่เกิน 500 ตัวอักษร')
    validateAssetData(input)
    const data = await prisma.$transaction(async tx => {
      const state = await tx.assetWorkspaceState.findUniqueOrThrow({ where: { operatorId: user.id } })
      if (state.revision !== input.revision) throw new Error('ข้อมูลเปลี่ยนจากอีกหน้าต่าง กรุณาสำรองแบบร่างและโหลดหน้าใหม่')
      const current = migrateAssetData(JSON.parse(state.payload))
      validateHistory(input, current, { allowContractEdits })
      const categories = await tx.assetCategory.findMany({ select: { code: true, nameTh: true, parentCode: true, isActive: true } })
      validateCategories(input.homes, current.homes, categories)
      validatePropertyCategories(input, categories)
      const ids = assetLedgerIds(input)
      const entries = ids.length ? await tx.ledgerEntry.findMany({ where: { id: { in: ids }, voidedAt: null }, select: ledgerSelect }) : []
      validateLedgerLinks(input, entries)
      const next: AssetData = { ...input, homes: assignAssetCodes(input.homes, current.homes, categories), revision: input.revision + 1 }
      await syncLandRegister(tx, user.id, next, categories)
      await syncPropertyRegister(tx, user.id, next)
      await syncBuildingBoqRegister(tx, user.id, next)
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

/** Extract selectable text from a BOQ PDF for local review before saving it as construction items. */
export async function extractBoqPdfText(formData: FormData) {
  await operator(true)
  const file = formData.get('file')
  if (!(file instanceof File) || file.size < 1 || file.size > 15 * 1024 * 1024 || file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) throw new Error('เลือกไฟล์ PDF ขนาดไม่เกิน 15 MB')
  const bytes = new Uint8Array(await file.arrayBuffer())
  if (new TextDecoder().decode(bytes.slice(0, 5)) !== '%PDF-') throw new Error('ไฟล์นี้ไม่ใช่ PDF ที่อ่านได้')
  const pdfjsEntry = pathToFileURL(requireFromProject.resolve('pdfjs-dist/legacy/build/pdf.mjs')).href
  const pdfjsWorker = pathToFileURL(requireFromProject.resolve('pdfjs-dist/legacy/build/pdf.worker.mjs')).href
  const pdfjs = await import(/* webpackIgnore: true */ pdfjsEntry) as typeof import('pdfjs-dist/legacy/build/pdf.mjs')
  pdfjs.GlobalWorkerOptions.workerSrc = pdfjsWorker
  const loadingTask = pdfjs.getDocument({ data: bytes, useSystemFonts: true, stopAtErrors: false })
  const document = await loadingTask.promise
  try {
    if (document.numPages > 100) throw new Error('PDF ต้องมีไม่เกิน 100 หน้า')
    const pages: string[][] = []
    let lineCount = 0
    for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber++) {
      const page = await document.getPage(pageNumber)
      const content = await page.getTextContent()
      const lines = new Map<number, { x: number; text: string }[]>()
      for (const item of content.items) {
        if (!('str' in item) || !item.str.trim()) continue
        const y = Math.round(item.transform[5] / 2) * 2
        const row = lines.get(y) ?? []
        row.push({ x: item.transform[4], text: item.str.trim() }); lines.set(y, row)
      }
      const pageLines = [...lines.entries()].sort(([a], [b]) => b - a).map(([, row]) => row.sort((a, b) => a.x - b.x).map(item => item.text).join(' ').replace(/\s+/g, ' ').trim()).filter(Boolean)
      lineCount += pageLines.length
      if (lineCount > 30000) throw new Error('PDF มีข้อความมากเกินไปสำหรับการนำเข้า')
      pages.push(pageLines)
      page.cleanup()
    }
    return { pages }
  } finally { await loadingTask.destroy() }
}
