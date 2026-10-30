import { prisma } from '../lib/prisma'
import { getAssetWorkspace, saveAssetWorkspace } from '../app/thing/_shared/actions'

async function main() {
  const current = await getAssetWorkspace()
  if (!current.canWrite) throw new Error('ไม่มีสิทธิ์แก้ไข')
  const home = current.data.homes.find(row => row.assetCode === 'BLD-002' && row.name === 'บ้านสว่างไซงาม')
  if (!home) throw new Error('ไม่พบบ้านเป้าหมาย')
  const room = 'ห้องเก็บของ'
  if (!home.rooms.includes(room)) {
    const result = await saveAssetWorkspace({
      ...current.data,
      homes: current.data.homes.map(row => row.id === home.id ? { ...row, rooms: [...row.rooms, room] } : row),
    }, 'เพิ่มห้องเก็บของในบ้านสว่างไซงามตามคำขอผู้ใช้')
    if (!result.data) throw new Error(result.error || 'บันทึกไม่สำเร็จ')
  }
  const saved = await getAssetWorkspace()
  const stored = saved.data.homes.find(row => row.id === home.id)
  if (!stored?.rooms.includes(room)) throw new Error('ตรวจสอบห้องที่บันทึกไม่สำเร็จ')
  console.log(JSON.stringify({ home: stored.name, room, verified: true, revision: saved.data.revision }))
}

main().catch(error => { console.error(error.message); process.exitCode = 1 }).finally(() => prisma.$disconnect())
