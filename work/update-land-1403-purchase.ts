import { prisma } from '../lib/prisma'
import { getAssetWorkspace, saveAssetWorkspace } from '../app/thing/_shared/actions'
import { assetCosts } from '../app/thing/_shared/model'
async function main() {
 const current=await getAssetWorkspace()
 if(!current.canWrite)throw new Error('ไม่มีสิทธิ์บันทึก')
 const land=current.data.homes.find(row=>row.assetCode==='LAND-001'&&row.landDetails?.deedNumber==='1403')
 if(!land?.landDetails)throw new Error('ไม่พบที่ดินโฉนด 1403')
 const notes='ผู้ใช้ยืนยัน: ราคาตกลงซื้อจริง 250,000 บาท; ราคาในสัญญาซื้อขาย 400,000 บาท; ค่าโอนผู้ซื้อและผู้ขายรับผิดชอบคนละครึ่ง ยังไม่ระบุยอดค่าโอนจริง'
 const next={...land,purchasePrice:250000,landDetails:{...land.landDetails,purchaseContractPrice:400000,transferBuyerShare:50,purchaseNotes:notes}}
 if(JSON.stringify(next)===JSON.stringify(land)){console.log('ข้อมูลตรงแล้ว ไม่บันทึกซ้ำ');return}
 const result=await saveAssetWorkspace({...current.data,homes:current.data.homes.map(row=>row.id===land.id?next:row)},'ยืนยันราคาซื้อจริงที่ดิน 1403 จำนวน 250,000 บาท แยกราคาในสัญญา 400,000 บาท ค่าโอนคนละครึ่ง ไม่สร้างรายการจ่ายหรือเพิ่มต้นทุนจากราคาเอกสาร')
 if(!result.data)throw new Error(result.error||'บันทึกไม่สำเร็จ')
 const saved=(await getAssetWorkspace()).data.homes.find(row=>row.id===land.id)!
 if(saved.purchasePrice!==250000||saved.landDetails?.purchaseContractPrice!==400000||saved.landDetails.transferBuyerShare!==50)throw new Error('ผลบันทึกไม่ตรง')
 console.log(JSON.stringify({verified:true,purchase:saved.purchasePrice,contract:saved.landDetails.purchaseContractPrice,transferBuyerShare:saved.landDetails.transferBuyerShare,totalAssetCost:assetCosts(saved).total,revision:result.data.revision}))
}
main().catch(e=>{console.error(e.message);process.exitCode=1}).finally(()=>prisma.$disconnect())
