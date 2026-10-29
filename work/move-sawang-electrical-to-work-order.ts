import { prisma } from '../lib/prisma'
import { getAssetWorkspace, saveAssetWorkspace } from '../app/thing/_shared/actions'
import { assetCosts, type BuildingChangeOrder } from '../app/thing/_shared/model'
async function main(){
 const current=await getAssetWorkspace();if(!current.canWrite)throw new Error('ไม่มีสิทธิ์บันทึก')
 const home=current.data.homes.find(row=>row.assetCode==='BLD-002' && row.name==='บ้านสว่างไซงาม');if(!home)throw new Error('ไม่พบบ้าน')
 const title='งานระบบไฟฟ้า สวิตช์ ปลั๊ก และแสงสว่าง · รอตรวจสัญญาช่าง'
 const existing=(home.buildingChangeOrders??[]).find(order=>order.title===title)
 if(existing){console.log('ย้ายรายการชุดนี้แล้ว ไม่สร้างใบงานซ้ำ');return}
 const items=home.items.filter(item=>!item.workOrderId && item.purchaseStatus==='planned' && /สวิตช์|ปลั๊ก|SONOFF|ไฟกลางห้อง|โคมไฟ|จุดจ่ายไฟและสายดิน/.test(item.name))
 if(!items.length)throw new Error('ไม่พบรายการที่ต้องย้าย')
 const order:BuildingChangeOrder={id:crypto.randomUUID(),number:Math.max(0,...(home.buildingChangeOrders??[]).map(order=>order.number))+1,baseVersion:home.boqVersion??1,title,date:'2026-10-29',status:'draft',reference:'ย้ายจากแผนจัดซื้อ 29/10/2569',notes:'รายการตรวจสอบขอบเขตงาน ยังไม่ใช่งานเพิ่มที่อนุมัติ; ตรวจ BOQ/สัญญาช่างก่อน เลือกเพิ่มหรือลดและกรอกราคาเฉพาะส่วนต่างจริง; รายการเดิมอ้างอิงงบไว้ ไม่สร้างการซื้อ รับมอบ หรือจ่ายเงิน',lines:items.map(item=>({id:crypto.randomUUID(),kind:'add',amount:0,pricingStatus:'pending',sourceItemId:item.id,description:`${item.room} · ${item.name} · จำนวน ${item.quantity}${item.size?` · ${item.size}`:''}${item.referencePrice!==undefined?` · งบอ้างอิงรวม ${(item.referencePrice*item.quantity).toFixed(2)} บาท`: ' · ยังไม่มีราคาอ้างอิง'}`}))}
 const ids=new Set(items.map(item=>item.id));const nextHome={...home,items:home.items.map(item=>ids.has(item.id)?{...item,workOrderId:order.id,fixedInstallation:true}:item),buildingChangeOrders:[...(home.buildingChangeOrders??[]),order]}
 if(assetCosts(nextHome).total!==assetCosts(home).total)throw new Error('ต้นทุนเปลี่ยนโดยไม่ควร')
 const before=await prisma.ledgerEntry.count()
 const result=await saveAssetWorkspace({...current.data,homes:current.data.homes.map(row=>row.id===home.id?nextHome:row)},'ย้ายแผนสวิตช์ ปลั๊ก ไฟ และโมดูลควบคุม ไปใบงานเพิ่ม–ลดฉบับร่าง ไม่อนุมัติราคา ไม่ลงต้นทุนหรือรายจ่าย')
 if(!result.data)throw new Error(result.error||'บันทึกไม่สำเร็จ')
 console.log(JSON.stringify({orderNumber:order.number,baseVersion:order.baseVersion,moved:items.length,remainingPurchasePlans:nextHome.items.filter(item=>!item.workOrderId).length,referenceBudget:items.reduce((sum,item)=>sum+(item.referencePrice??0)*item.quantity,0),status:order.status,allPricesPending:order.lines.every(line=>line.pricingStatus==='pending'),cost:assetCosts(nextHome).total,ledgerEntriesCreated:await prisma.ledgerEntry.count()-before,revision:result.data.revision}))
}
main().catch(e=>{console.error(e.message);process.exitCode=1}).finally(()=>prisma.$disconnect())
