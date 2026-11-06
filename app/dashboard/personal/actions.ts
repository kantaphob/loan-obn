'use server'
import { assertAccountingDateOpen } from '@/lib/monthly-accounting'
import { validLedgerDate } from '@/lib/ledger'
import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/lib/auth/current-user'
import { personalAmount, personalDate, personalCategories, personalStatuses } from '@/lib/personal'

async function operator(write = false) {
  const user = await getCurrentUser()
  if (!user || user.status !== 'ACTIVE' || (write && user.role === 'REVIEWER')) throw new Error('ไม่มีสิทธิ์ทำรายการนี้')
  return user
}
export async function getPersonalPlans() {
  const user = await operator()
  const plans = await prisma.personalPlan.findMany({ where: { operatorId: user.id }, include: { expenses: { orderBy: [{ occurredOn: 'desc' }, { createdAt: 'desc' }] } }, orderBy: { createdAt: 'desc' } })
  const [categories, channels] = await Promise.all([prisma.financialCategory.findMany({ where: { isActive: true, group: { not: 'LOAN' }, code: { notIn: ['INTEREST_RECEIVED', 'TRADE_RECEIVABLE_PAYMENT'] } }, orderBy: { sortOrder: 'asc' } }), prisma.paymentChannel.findMany({ where: { isActive: true } })])
  return { categories, channels, canWrite: user.role !== 'REVIEWER', plans: plans.map(p => ({ ...p, createdAt: p.createdAt.toISOString(), updatedAt: p.updatedAt.toISOString(), expenses: p.expenses.map(e => ({ ...e, createdAt: e.createdAt.toISOString(), voidedAt: e.voidedAt?.toISOString() ?? null })) })) }
}
export async function savePersonal(_previous: { message: string; ok: boolean }, form: FormData) {
  try {
    const user = await operator(true)
    const text = (name: string, max = 200) => {
      const value = form.get(name)
      if (typeof value !== 'string' || value.length > max) throw new Error('ข้อมูลไม่ถูกต้องหรือยาวเกินกำหนด')
      return value.trim()
    }
    const mode = text('mode'), id = text('id')
    if (mode === 'plan') {
      const title = text('title'), category = text('category'), status = text('status')
      if (!title || !Object.hasOwn(personalCategories, category) || !Object.hasOwn(personalStatuses, status)) throw new Error('กรุณาระบุชื่อ ประเภท และสถานะให้ครบ')
      const data = { title, category, status, targetDate: personalDate(text('targetDate')), destination: text('destination'), note: text('note', 3000), budgetSatang: personalAmount(text('budget')) }
      if (id) {
        const changed = await prisma.personalPlan.updateMany({ where: { id, operatorId: user.id }, data })
        if (!changed.count) throw new Error('ไม่พบรายการ')
      } else await prisma.personalPlan.create({ data: { ...data, operatorId: user.id } })
    } else if (mode === 'expense') {
      const label = text('label'), occurredOn = text('occurredOn'), amountSatang = personalAmount(text('amount'))
      const direction = text('direction'), categoryCode = text('categoryCode'), channelCode = text('channelCode'), requestKey = text('requestKey')
      if (!label || !validLedgerDate(occurredOn) || amountSatang <= 0 || !['IN', 'OUT'].includes(direction) || !/^[a-f0-9-]{36}$/i.test(requestKey)) throw new Error('กรุณาระบุชื่อ วันที่ไม่เกินวันนี้ และจำนวนเงินมากกว่า 0')
      await prisma.$transaction(async tx => {
        const plan = id ? await tx.personalPlan.findFirst({ where: { id, operatorId: user.id } }) : await tx.personalPlan.upsert({ where: { id: `personal-finance-${user.id}` }, create: { id: `personal-finance-${user.id}`, operatorId: user.id, title: 'รายรับ–รายจ่ายส่วนตัว', category: 'FINANCE' }, update: {} })
        if (!plan) throw new Error('ไม่พบรายการ')
        const previous = await tx.ledgerEntry.findUnique({ where: { requestKey } })
        if (previous) {
          if (previous.personalPlanId !== plan.id || previous.createdBy !== user.id || previous.direction !== direction || previous.amountSatang !== amountSatang || previous.note !== label || previous.occurredOn !== occurredOn || previous.categoryCode !== categoryCode || previous.channelCode !== channelCode || previous.voidedAt) throw new Error('รหัสคำขอซ้ำ กรุณาโหลดหน้าใหม่')
          return
        }
        await assertAccountingDateOpen(tx, occurredOn)
        const category = await tx.financialCategory.findUnique({ where: { code: categoryCode } })
        const channel = await tx.paymentChannel.findUnique({ where: { code: channelCode } })
        if (!category?.isActive || category.direction !== direction || category.group === 'LOAN' || ['INTEREST_RECEIVED', 'TRADE_RECEIVABLE_PAYMENT'].includes(category.code) || !channel?.isActive) throw new Error('กรุณาเลือกหมวดบัญชีให้ตรงกับรับ–จ่ายและช่องทางที่ใช้งานได้')
        await tx.ledgerEntry.create({ data: { personalPlanId: plan.id, requestKey, kind: 'GENERAL', accountScope: 'GENERAL', direction, categoryCode, categoryName: category.nameTh, amountSatang, occurredOn, channelCode, channelName: channel.nameTh, note: label, createdBy: user.id } })
      })
    } else throw new Error('คำสั่งไม่ถูกต้อง')
    for (const path of ['/dashboard/personal', '/dashboard/ledger', '/dashboard', '/dashboard/accounting', '/dashboard/ac']) revalidatePath(path)
    return { message: 'บันทึกเรียบร้อยแล้ว', ok: true }
  } catch (error) {
    return { message: error instanceof Error && !error.name.startsWith('Prisma') ? error.message : 'บันทึกไม่สำเร็จ กรุณาลองใหม่', ok: false }
  }
}
