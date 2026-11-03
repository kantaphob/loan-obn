'use server'
import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/lib/auth/current-user'
import { revalidatePath } from 'next/cache'
import { ledgerAmount } from '@/lib/ledger'

export async function saveUtilityBill(form: FormData) {
  try {
    const user = await getCurrentUser()
    if (!user || user.status !== 'ACTIVE' || user.role === 'REVIEWER') throw new Error('ไม่มีสิทธิ์บันทึกข้อมูล')
    const value = (key: string) => String(form.get(key) ?? '').trim()
    const kind = value('kind'), location = value('location'), period = value('period')
    const homeId = Number(value('homeId'))
    if (!Number.isSafeInteger(homeId) || homeId <= 0) throw new Error('กรุณาเลือกบ้านก่อนบันทึก')
    const home = await prisma.utilityHome.findFirst({ where: { id: homeId, operatorId: user.id } })
    if (!home) throw new Error('ไม่พบบ้านที่เลือก')
    const id = Number(value('id'))
    if (value('id') && (!Number.isSafeInteger(id) || id <= 0)) throw new Error('รายการไม่ถูกต้อง')
    const old = id ? await prisma.utilityBill.findFirst({ where: { id, operatorId: user.id, homeId } }) : null
    if (id && !old) throw new Error('ไม่พบรายการ')
    const meter = old && old.kind === kind ? old.meter : kind === 'WATER' ? home.waterMeter : home.electricityMeter
    if (!meter) throw new Error('กรุณาบันทึกเลขมิเตอร์ในข้อมูลบ้านก่อนเพิ่มรายการ')
    const previousReading = Number(value('previousReading')), currentReading = Number(value('currentReading'))
    if (!['WATER', 'ELECTRICITY'].includes(kind) || !meter || meter.length > 100 || !location || location.length > 300 || !/^20\d{2}-(0[1-9]|1[0-2])$/.test(period)) throw new Error('กรุณาระบุประเภท มิเตอร์ สถานที่ และเดือนให้ถูกต้อง')
    if (!value('previousReading') || !value('currentReading') || !Number.isFinite(previousReading) || !Number.isFinite(currentReading) || previousReading < 0 || currentReading < previousReading || currentReading > 1e12) throw new Error('เลขมิเตอร์ครั้งหลังต้องไม่น้อยกว่าครั้งก่อน')
    const amountSatang = ledgerAmount(value('amount'))
    if (amountSatang > 2_147_483_647 || value('invoice').length > 150 || value('note').length > 1000) throw new Error('จำนวนเงินหรือข้อความยาวเกินกำหนด')
    const data = { homeId, kind, meter, location, period, previousReading, currentReading, amountSatang, invoice: value('invoice'), note: value('note') }
    if (id) {
      const result = await prisma.utilityBill.updateMany({ where: { id, operatorId: user.id }, data })
      if (!result.count) throw new Error('ไม่พบรายการ')
    } else await prisma.utilityBill.create({ data: { ...data, operatorId: user.id } })
    revalidatePath('/dashboard/utilities')
    return { success: true }
  } catch (error) {
    return { error: (error as { code?: string }).code === 'P2002' ? 'บ้านนี้มีรายการมิเตอร์ในเดือนที่เลือกแล้ว กรุณาแก้ไขรายการเดิม' : error instanceof Error && !error.name.startsWith('Prisma') ? error.message : 'บันทึกไม่สำเร็จ กรุณาลองใหม่' }
  }
}

export async function saveUtilityHome(form: FormData) {
  try {
    const user = await getCurrentUser()
    if (!user || user.status !== 'ACTIVE' || user.role === 'REVIEWER') throw new Error('ไม่มีสิทธิ์บันทึกข้อมูล')
    const name = String(form.get('name') ?? '').trim(), address = String(form.get('address') ?? '').trim()
    if (!name || name.length > 100 || address.length > 300) throw new Error('กรุณาระบุชื่อบ้านไม่เกิน 100 ตัวอักษร และที่อยู่ไม่เกิน 300 ตัวอักษร')
    const meters = {
      ...(form.has('electricityMeter') ? { electricityMeter: String(form.get('electricityMeter') ?? '').trim() } : {}),
      ...(form.has('waterMeter') ? { waterMeter: String(form.get('waterMeter') ?? '').trim() } : {}),
    }
    if (Object.values(meters).some(meter => meter.length > 100)) throw new Error('เลขมิเตอร์ต้องไม่เกิน 100 ตัวอักษร')
    const rawId = String(form.get('id') ?? ''), id = Number(rawId)
    if (rawId && (!Number.isSafeInteger(id) || id <= 0)) throw new Error('ข้อมูลบ้านไม่ถูกต้อง')
    let homeId: number
    if (id) {
      const result = await prisma.utilityHome.updateMany({ where: { id, operatorId: user.id }, data: { name, address, ...meters } })
      if (!result.count) throw new Error('ไม่พบบ้านที่เลือก')
      homeId = id
    } else {
      const home = await prisma.utilityHome.create({ data: { operatorId: user.id, name, address, ...meters } })
      homeId = home.id
    }
    revalidatePath('/dashboard/utilities')
    return { success: true, homeId }
  } catch (error) {
    return { error: (error as { code?: string }).code === 'P2002' ? 'มีชื่อบ้านนี้แล้ว กรุณาใช้ชื่อที่แยกแยะได้' : error instanceof Error && !error.name.startsWith('Prisma') ? error.message : 'บันทึกบ้านไม่สำเร็จ กรุณาลองใหม่' }
  }
}
