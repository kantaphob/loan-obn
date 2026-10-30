'use server'

import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/prisma'
import { saveLedger } from '@/app/dashboard/ledger/actions'
import { getAssetWorkspace } from '../_shared/actions'

export type PropertyCashInput = { propertyId: string; requestKey: string; direction: 'IN' | 'OUT'; description: string; amount: string; occurredOn: string; categoryCode: string; channelCode: string; reference: string; note: string }

export async function createPropertyCashEntry(input: PropertyCashInput) {
 try {
  const workspace = await getAssetWorkspace()
  if (!workspace.canWrite) throw new Error('ไม่มีสิทธิ์บันทึกรายการ')
  const property = workspace.data.properties?.find(row => row.id === input.propertyId)
  if (!property) throw new Error('ไม่พบ Property ที่ต้องการบันทึก')
  if (!['IN','OUT'].includes(input.direction) || typeof input.description !== 'string' || !input.description.trim() || input.description.length > 300 || typeof input.note !== 'string' || input.note.length > 500) throw new Error('ระบุรายละเอียดรับ–จ่ายให้ครบถ้วน')
  if (!workspace.financialCategories.some(row => row.code === input.categoryCode && row.direction === input.direction)) throw new Error('เลือกหมวดรับ–จ่ายให้ตรงกับประเภทเงิน')
  const result = await saveLedger({ requestKey: input.requestKey, kind: 'GENERAL', contractId: null, accountScope: 'GENERAL', direction: input.direction, categoryCode: input.categoryCode, amount: input.amount, occurredOn: input.occurredOn, channelCode: input.channelCode, reference: input.reference, note: `${property.code} · ${input.description.trim()}${input.note.trim() ? ` · ${input.note.trim()}` : ''}` })
  if (!result.success) throw new Error(result.error || 'บันทึกรับ–จ่ายไม่สำเร็จ')
  const saved = await prisma.ledgerEntry.findUniqueOrThrow({ where: { requestKey: input.requestKey }, select: { id: true } })
  revalidatePath('/thing/property'); revalidatePath('/thing/asset')
  const latest = await getAssetWorkspace()
  return { data: latest.data, ledger: latest.ledger, entryId: saved.id }
 } catch (caught) { return { error: caught instanceof Error ? caught.message : 'บันทึกไม่สำเร็จ กรุณาลองใหม่' } }
}
