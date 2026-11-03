import { prisma } from '../lib/prisma'

// Explicit import of the six supplied PEA receipts. Re-running preserves edited records.
const rows = [
  ['2026-05', 3433, 3664, 95373, 'YZMA02641978571'],
  ['2026-06', 3664, 3872, 84584, 'YZMA02655354941'],
  ['2026-07', 3872, 4070, 79894, 'YZMA02662010492'],
  ['2026-08', 4070, 4283, 86929, 'YZMA02663057358'],
  ['2026-09', 4283, 4451, 59480, 'YZMA02676045318'],
  ['2026-10', 4451, 4643, 67600, 'YZMA02676953965'],
] as const
async function main() {
  const user = await prisma.user.findFirst({ orderBy: [{ level: 'asc' }, { createdAt: 'asc' }] })
  if (!user || user.status !== 'ACTIVE' || user.role === 'REVIEWER') throw new Error('ไม่มีผู้ใช้งานสำหรับนำเข้ารายการ')
  const original = await prisma.utilityBill.findFirst({ where: { operatorId: user.id, invoice: { in: rows.map(r => r[4]) } }, select: { home: true } })
  const home = original?.home ?? await prisma.utilityHome.upsert({
    where: { operatorId_name: { operatorId: user.id, name: '144 ม.9 ต.ดอนศรีชุม อ.ดอกคำใต้ จ.พะเยา' } },
    update: {}, create: { electricityMeter: '22351875', operatorId: user.id, name: '144 ม.9 ต.ดอนศรีชุม อ.ดอกคำใต้ จ.พะเยา', address: '144 ม.9 ต.ดอนศรีชุม อ.ดอกคำใต้ จ.พะเยา' },
  })
  await prisma.$transaction(rows.map(([period, previousReading, currentReading, amountSatang, invoice]) => prisma.utilityBill.upsert({
    where: { operatorId_homeId_kind_meter_period: { operatorId: user.id, homeId: home.id, kind: 'ELECTRICITY', meter: '22351875', period } },
    update: {},
    create: { operatorId: user.id, homeId: home.id, kind: 'ELECTRICITY', meter: '22351875', location: '144 ม.9 ต.ดอนศรีชุม อ.ดอกคำใต้ จ.พะเยา', period, previousReading, currentReading, amountSatang, invoice, note: 'นำเข้าจากใบเสร็จ PEA · รหัสลูกค้า 020005561272 · ยอดรวมภาษีตามเอกสาร' },
  })))
  const result = await prisma.utilityBill.aggregate({ where: { operatorId: user.id, invoice: { in: rows.map(r => r[4]) } }, _count: true, _sum: { amountSatang: true } })
  console.log(JSON.stringify(result))
}
main().finally(() => prisma.$disconnect())
