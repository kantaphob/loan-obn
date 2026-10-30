import { prisma } from '../lib/prisma'
import { getAssetWorkspace, saveAssetWorkspace } from '../app/thing/_shared/actions'
import { assetCosts, type HouseRoom, type BoqItem } from '../app/thing/_shared/model'
async function main() {
 const current = await getAssetWorkspace()
 if (!current.canWrite) throw new Error('ไม่มีสิทธิ์บันทึก')
 const home = current.data.homes.find(row => row.assetCode === 'BLD-002' && row.name === 'บ้านสว่างไซงาม')
 if (!home) throw new Error('ไม่พบบ้านเป้าหมาย')
 if (home.roomDefinitions?.length) { console.log('บ้านมีโครงสร้างห้องแล้ว ไม่เขียนทับ'); return }
 const definitions: HouseRoom[] = []
 function add(code: string, name: string, kind: HouseRoom['kind'], parentId?: string) { definitions.push({ id:code,code,name,kind,...(parentId?{parentId}:{}) }) }
 for(let n=1;n<=3;n++) { add(`BLD-BR0${n}`,`ห้องนอน ${n}`,'room'); add(`BLD-BA0${n}`,`ห้องน้ำ ${n}`,'room',`BLD-BR0${n}`) }
 add('BLD-BA04','ห้องน้ำ 4','room')
 add('BLD-LV01','ห้องโถงใหญ่','room');add('BLD-KT01','ห้องครัว','room');add('BLD-ST01','ห้องเก็บของ','room')
 add('BLD-Z01','พื้นที่นอน · ห้องนอน 1','zone','BLD-BR01');add('BLD-Z02','พื้นที่นอน · ห้องนอน 2','zone','BLD-BR02');add('BLD-Z03','พื้นที่นอน · ห้องนอน 3','zone','BLD-BR03');add('BLD-Z04','โต๊ะคอม · ห้องนอน 2','zone','BLD-BR02')
 add('BLD-AR01','ประตูทางเข้าหลัก','area');add('BLD-AR02','พื้นที่ซักล้าง','area');add('BLD-AR03','ทางเดิน / ระเบียง / โรงจอดรถ','area');add('BLD-AR04','พื้นที่ส่วนกลาง','area')
 add('BLD-SY01','ระบบกล้องวงจรปิด','system');add('BLD-SY02','ระบบไฟฟ้า','system');add('BLD-SY03','เครือข่าย / IoT','system')
 add('BLD-G01','ห้องน้ำ 1–4','group')
 const inUse = new Set([...home.items.map(i=>i.room),...home.boq.map(i=>i.room),...(home.buildingWorks??[]).flatMap(w=>w.roomNames),...(home.buildingProjects??[]).flatMap(p=>p.roomNames)])
 for(const name of home.rooms) if (!definitions.some(row=>row.name===name) && inUse.has(name)) add(`BLD-G${String(definitions.filter(r=>r.kind==='group').length+1).padStart(2,'0')}`,name,'group')
 const locks=home.items.filter(item=>item.name==='กลอนห้องน้ำธรรมดา' && item.purchaseStatus==='planned' && !item.workOrderId)
 const ids=new Set(locks.map(item=>item.id))
 const lockBoq: BoqItem[]=locks.map(item=>({id:item.id,scope:'construction',category:'หมวดงานสถาปัตยกรรม',subcategory:'อุปกรณ์ประตู',name:item.name,spec:item.size,room:item.room,quantity:item.quantity,unit:'ชุด',price:0,labor:0,paid:0,vendor:'',reference:'ผู้ใช้ยืนยันกลอนธรรมดาอยู่ใน BOQ',contractScope:'included',note:`รวมในสัญญาเดิม ราคาย่อยยังไม่ระบุ; หากเปลี่ยนรุ่นให้จัดทำงานลดเดิมและงานเพิ่มใหม่เพื่ออนุมัติเฉพาะส่วนต่าง\n${item.notes}`}))
 const next={...home,rooms:definitions.map(room=>room.name),roomDefinitions:definitions,buildingDetails:home.buildingDetails?{...home.buildingDetails,roomCounts:definitions.filter(r=>r.kind==='room').map(r=>({name:r.name,count:1}))}:undefined,items:home.items.filter(item=>!ids.has(item.id)),boq:[...home.boq.map(row=>['ท่อน้ำดี','ท่อน้ำทิ้ง'].includes(row.name)?{...row,contractScope:'included' as const}:row),...lockBoq]}
 if(assetCosts(next).total!==assetCosts(home).total)throw new Error('ต้นทุนต้องไม่เปลี่ยน')
 const result=await saveAssetWorkspace({...current.data,homes:current.data.homes.map(row=>row.id===home.id?next:row)},'จัดบ้านเป็น A งานก่อสร้าง 10 หมวด และ B ทรัพย์สินตามห้องจริง มีรหัสและความสัมพันธ์ห้องน้ำกับห้องนอน; คงรายการห้องน้ำรวมรอจัดโดยไม่แยกของหรือยอดขึ้นเอง; กลอนธรรมดาอยู่ BOQ เดิม ไม่สร้างงานเพิ่มหรือจ่ายเงิน')
 if(!result.data)throw new Error(result.error||'บันทึกไม่สำเร็จ')
 const stored=(await getAssetWorkspace()).data.homes.find(row=>row.id===home.id)!
 if(stored.roomDefinitions?.filter(room=>room.kind==='room').length!==10||assetCosts(stored).total!==assetCosts(home).total)throw new Error('ผลบันทึกไม่ตรง')
 console.log(JSON.stringify({revision:result.data.revision,realRooms:10,bedrooms:3,bathrooms:4,unallocatedBathroomItems:stored.items.filter(i=>i.room==='ห้องน้ำ 1–4').length,locksInBoq:lockBoq.length,cost:assetCosts(stored).total,verified:true}))
}
main().catch(e=>{console.error(e.message);process.exitCode=1}).finally(()=>prisma.$disconnect())
