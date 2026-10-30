import { prisma } from '../lib/prisma'
import { getAssetWorkspace, saveAssetWorkspace } from '../app/thing/_shared/actions'
import { assetCosts, type BoqItem } from '../app/thing/_shared/model'
async function main() {
 const current=await getAssetWorkspace()
 if(!current.canWrite) throw new Error('ไม่มีสิทธิ์บันทึก')
 const home=current.data.homes.find(row=>row.assetCode==='BLD-002' && row.name==='บ้านสว่างไซงาม')
 if(!home) throw new Error('ไม่พบบ้านเป้าหมาย')
 const pipes=home.items.filter(row=>['ท่อน้ำดี','ท่อน้ำทิ้ง'].includes(row.name) && row.room==='พื้นที่ซักล้าง')
 if(!pipes.length){console.log('ไม่มีท่อน้ำในแผนซื้อแยกแล้ว');return}
 if(pipes.some(row=>row.purchaseStatus!=='planned'||row.workOrderId||row.price!==0)) throw new Error('รายการมีการซื้อหรือผูกใบงาน ต้องตรวจสอบก่อน')
 const rows:BoqItem[]=pipes.map(item=>({id:item.id,scope:'construction',category:'หมวดงานระบบสุขาภิบาล',subcategory:item.name==='ท่อน้ำดี'?'5.1 ระบบประปา':'5.2 ระบบสุขาภิบาล',name:item.name,room:item.room,spec:item.size,quantity:item.quantity,unit:'รายการ',price:0,labor:0,paid:0,vendor:'',reference:'ผู้ใช้ยืนยันรวมใน BOQ 30/10/2569',note:`รวมในราคาสัญญาหลักแล้ว ไม่ใช่รายการจัดซื้อแยก; ยังไม่ทราบปริมาณท่อจริงและราคาย่อย หน่วยรายการเป็นจุดตรวจสอบขอบเขต ไม่ใช่ความยาวท่อ; ยังไม่ยืนยันรับมอบ\n${item.notes}`}))
 const ids=new Set(pipes.map(row=>row.id))
 const next={...home,items:home.items.filter(row=>!ids.has(row.id)),boq:[...home.boq,...rows]}
 if(assetCosts(home).total!==assetCosts(next).total) throw new Error('ต้นทุนเปลี่ยน')
 const result=await saveAssetWorkspace({...current.data,homes:current.data.homes.map(row=>row.id===home.id?next:row)},'จัดท่อน้ำดีและท่อน้ำทิ้งพื้นที่ซักล้างเข้าหมวด 5 BOQ เดิม ไม่ใช่งานเพิ่ม ไม่สร้างต้นทุนหรือรายการซื้อซ้ำ')
 if(!result.data) throw new Error(result.error||'บันทึกไม่สำเร็จ')
 const stored=(await getAssetWorkspace()).data.homes.find(row=>row.id===home.id)!
 if(stored.items.some(row=>ids.has(row.id))||!rows.every(row=>stored.boq.some(b=>b.id===row.id))) throw new Error('ตรวจสอบการย้ายไม่สำเร็จ')
 console.log(JSON.stringify({moved:rows.map(row=>row.name),cost:assetCosts(stored).total,verified:true}))
}
main().catch(e=>{console.error(e.message);process.exitCode=1}).finally(()=>prisma.$disconnect())
