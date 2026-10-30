import type { Home, HouseRoom } from '../_shared/model'

export const roomKinds = { room: 'ห้องจริง', zone: 'พื้นที่ย่อย', area: 'พื้นที่ใช้งาน', system: 'ระบบ', group: 'กลุ่ม / รอจัดห้อง' } as const

export function houseRooms(home: Home): HouseRoom[] {
 const stored = home.roomDefinitions ?? []
 return home.rooms.map((name, index) => stored.find(room => room.name === name) ?? { id: `legacy:${name}`, code: `BLD-G${String(index + 1).padStart(3, '0')}`, name, kind: 'group' })
}

export function roomSubtree(rooms: HouseRoom[], id: string): HouseRoom[] {
 const result: HouseRoom[] = []; const seen = new Set<string>()
 function visit(key: string) {
  if (seen.has(key)) return
  seen.add(key)
  const room = rooms.find(row => row.id === key)
  if (!room) return
  result.push(room); rooms.filter(row => row.parentId === key).forEach(row => visit(row.id))
 }
 visit(id); return result
}

export function roomPatch(home: Home, rooms: HouseRoom[]): Partial<Home> {
 const previous = houseRooms(home)
 const rename = (name: string) => {
  const old = previous.find(room => room.name === name)
  return rooms.find(room => room.id === old?.id)?.name ?? name
 }
 const names = new Set(rooms.map(room => room.name))
 for (const old of previous.filter(room => !rooms.some(row => row.id === room.id))) {
  if (home.items.some(item => item.room === old.name) || home.boq.some(item => item.room === old.name) || home.buildingWorks?.some(work => work.roomNames.includes(old.name)) || home.buildingProjects?.some(project => project.roomNames.includes(old.name) || project.outcome?.roomName === old.name || project.outcome?.newRoomName === old.name)) throw new Error('ห้องนี้มีรายการเชื่อมอยู่ กรุณาย้ายรายการก่อนลบ')
 }
 if (names.size !== rooms.length) throw new Error('ชื่อห้องซ้ำ')
 return {
  rooms: rooms.map(room => room.name), roomDefinitions: rooms,
  items: home.items.map(item => ({ ...item, room: rename(item.room) })),
  boq: home.boq.map(item => item.room ? { ...item, room: rename(item.room) } : item),
  buildingWorks: home.buildingWorks?.map(work => ({ ...work, roomNames: work.roomNames.map(rename) })),
  buildingProjects: home.buildingProjects?.map(project => ({ ...project, roomNames: project.roomNames.map(rename), outcome: project.outcome ? { ...project.outcome, roomName: rename(project.outcome.roomName), newRoomName: rename(project.outcome.newRoomName) } : undefined })),
  buildingDetails: home.buildingDetails ? { ...home.buildingDetails, roomCounts: rooms.filter(room => room.kind === 'room').map(room => ({ name: room.name, count: 1 })) } : undefined,
 }
}
