import { prisma } from '../lib/prisma'
import { getAssetWorkspace, saveAssetWorkspace } from '../app/thing/_shared/actions'
import { assetCosts } from '../app/thing/_shared/model'

async function main() {
 const current=await getAssetWorkspace()
 if(!current.canWrite) throw new Error('ไม่มีสิทธิ์แก้ไข')
 const home=current.data.homes.find(row=>row.assetCode==='BLD-002' && row.name==='บ้านสว่างไซงาม')
 if(!home) throw new Error('ไม่พบบ้านเป้าหมาย')
 const kitchen=home.items.filter(row=>row.room==='ห้องครัว')
 const stove=kitchen.find(row=>row.name==='เตาทำอาหาร' || row.name==='เตาไฟฟ้า')
 const hood=kitchen.find(row=>row.name==='เครื่องดูดควัน')
 if(!stove || !hood) throw new Error('ไม่พบรายการเตาและเครื่องดูดควันเดิม')
 const note='ผู้ใช้ระบุ 29/10/2569: ใช้เตาไฟฟ้าคู่กับเครื่องดูดควัน; รอเลือกรุ่น จำนวนหัวเตา และตรวจแบบ/กำลังไฟ/ทางระบายควันกับช่าง; ยังไม่ยืนยันราคาและการซื้อ'
 const nextHome={...home,items:home.items.map(row=>row.id===stove.id?{...row,name:'เตาไฟฟ้า',size:'เตาไฟฟ้า · รอเลือกรุ่นและจำนวนหัว',notes:row.notes.includes(note)?row.notes:`${row.notes}\n${note}`} : row.id===hood.id?{...row,size:'เครื่องดูดควันสำหรับใช้คู่เตาไฟฟ้า · รอเลือกรุ่น',notes:row.notes.includes(note)?row.notes:`${row.notes}\n${note}`} :row)}
 if(assetCosts(nextHome).total!==assetCosts(home).total) throw new Error('ต้นทุนไม่ควรเปลี่ยน')
 const before=await prisma.ledgerEntry.count()
 if(JSON.stringify(nextHome)===JSON.stringify(home)){console.log('ข้อมูลชุดครัวตรงกับที่ระบุแล้ว ไม่เพิ่มซ้ำ');return}
 const result=await saveAssetWorkspace({...current.data,homes:current.data.homes.map(row=>row.id===home.id?nextHome:row)},'ปรับแผนห้องครัว: เตาไฟฟ้าคู่เครื่องดูดควัน; เคาน์เตอร์ ตู้ครัว และซิงก์ยังรอตรวจสัญญาช่าง')
 if(!result.data) throw new Error(result.error||'บันทึกไม่สำเร็จ')
 console.log(JSON.stringify({revision:result.data.revision,kitchen:result.data.homes.find(row=>row.id===home.id)!.items.filter(row=>row.room==='ห้องครัว').map(row=>({name:row.name,size:row.size,status:row.purchaseStatus})),ledgerEntriesCreated:await prisma.ledgerEntry.count()-before}))
}
main().catch(e=>{console.error(e.message);process.exitCode=1}).finally(()=>prisma.$disconnect())
