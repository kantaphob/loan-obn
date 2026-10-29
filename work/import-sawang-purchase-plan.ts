import { readFileSync, mkdirSync, writeFileSync } from 'node:fs'
import { prisma } from '../lib/prisma'
import { getAssetWorkspace, saveAssetWorkspace } from '../app/thing/_shared/actions'
import { assetCosts, propertyAssetIds, type HomeItem } from '../app/thing/_shared/model'

const marker = 'แผนจัดซื้อบ้านสว่างไซงาม 29/10/2569'
const rows: HomeItem[] = []
function add(room: string, name: string, quantity = 1, total?: number, detail = 'รอเลือก', size = '') {
 rows.push({ id: crypto.randomUUID(), room, name, size, quantity, price: 0, shop: '', purchasedOn: '', warrantyStart: '', warrantyMonths: 0, warrantyUntil: '', notes: `${marker} · ${detail} · ยังไม่ได้ซื้อ; ราคาจากเอกสารเดิม ไม่ใช่ใบเสนอราคาใหม่`, purchaseStatus: 'planned', status: 'active', ...(total === undefined ? {} : { referencePrice: total / quantity, referenceOn: '2026-10-29', referenceShop: 'ราคาอ้างอิงจากแผนจัดซื้อเดิม' }) })
}
function bedroom(room: string) {
 for (const [name,q,detail] of [['เตียงนอน',1,'รอเลือกขนาด'],['ที่นอน',1,'รอเลือก'],['หมอนหนุน',2,'รอเลือก'],['หมอนข้าง',1,'รอเลือก'],['ผ้าปูที่นอน',2,'รอเลือก'],['ปลอกหมอน',4,'รอเลือก'],['ผ้าห่ม / ผ้านวม',1,'จำนวนวางแผน 1–2 ผืน; ใช้ขั้นต่ำ 1 รอยืนยัน'],['ผ้ารองกันเปื้อนที่นอน',1,'รอเลือก'],['ตู้เสื้อผ้า',1,'รอเลือก'],['โต๊ะข้างเตียง',1,'จำนวนวางแผน 1–2 ตัว; ใช้ขั้นต่ำ 1 รอยืนยัน'],['โต๊ะเครื่องแป้ง / โต๊ะทำงาน',1,'รอเลือก'],['กระจก',1,'รอเลือก'],['ผ้าม่าน',1,'รอวัดตามจำนวนหน้าต่าง; 1 เป็นรายการเผื่อ ไม่ใช่จำนวนซื้อยืนยัน'],['เครื่องปรับอากาศ',1,'รอเลือก BTU และรุ่น'],['ถังขยะ',1,'รอเลือก']] as const) add(room,name,q,undefined,detail)
}
add('ห้องนอน 1','สวิตช์ 2 ทางธรรมดา',2,300,'งบรวม 300–600 บาท รวมอุปกรณ์ประกอบ; หน้าประตูและหัวเตียง; ไม่ใช้ IoT; ตรวจสัญญาช่าง')
add('ห้องนอน 1','ไฟกลางห้อง',1,undefined,'รอราคา; ตรวจสัญญาช่าง')
add('ห้องนอน 1','ปลั๊ก 3 รู มีสายดิน',4,400,'งบรวม 400–800 บาท; ตรวจสัญญาช่าง')
bedroom('ห้องนอน 1'); add('ห้องนอน 1','กลอนประตูธรรมดา')
for(const room of ['ห้องนอน 2','ห้องนอน 3']) {
 add(room,'SONOFF MINIR4',1,300,'1 โมดูลเบื้องต้น; รุ่นเสนอ รอยืนยันวงจร')
 add(room,'สวิตช์ควบคุมไฟ 2 ทาง IoT',2,undefined,'รอราคาสวิตช์; ตรวจสัญญาช่าง')
 add(room,'ปลั๊ก 3 รู มีสายดิน',6,600,'งบรวม 600–1,200 บาท; ตรวจสัญญาช่าง')
 bedroom(room)
 if(room==='ห้องนอน 2') add(room,'Digital Door Lock',1,7000,'เลือกแล้ว; ประตูบานเปิด; ต้องตรวจความเข้ากันได้และค่าติดตั้ง; Apple Home Key, ลายนิ้วมือ, รหัสผ่าน, Aqara Home', 'Aqara Smart Lock U300 สีดำ')
 else add(room,'กลอนประตูธรรมดา')
}
for(const [name,q,detail] of [['สวิตช์ไฟธรรมดา',4,'อย่างน้อย 4 จุด รอจำนวนวงจรจริง; ไม่ติด IoT'],['โถสุขภัณฑ์',4,'ตรวจสัญญาช่าง'],['สายฉีดชำระ',4,'ตรวจสัญญาช่าง'],['อ่างล้างหน้าและก๊อก',4,'ตรวจสัญญาช่าง'],['กระจก',4,'รอเลือก'],['ฝักบัว',1,'รอกำหนดจำนวนตามการใช้งาน; 1 เป็นรายการเผื่อ'],['เครื่องทำน้ำอุ่น',1,'รอกำหนดจำนวนและรุ่น; 1 เป็นรายการเผื่อ'],['ฉากกั้น / ม่านอาบน้ำ',1,'รอกำหนดตามการใช้งาน; 1 เป็นรายการเผื่อ'],['ชั้นวางของ',4,'รอเลือก'],['ราวแขวนผ้า',4,'จำนวน 4–8 จุด ใช้ขั้นต่ำ 4 รอยืนยัน'],['ที่ใส่กระดาษชำระ',4,'รอเลือก'],['ถังขยะ',4,'รอเลือก'],['กลอนห้องน้ำธรรมดา',4,'รอเลือก']] as const) add('ห้องน้ำ 1–4',name,q,undefined,detail)
add('ห้องโถงใหญ่','ทีวี',1,35990,'เลือกแล้ว','Samsung UA75M80HAKXXT 75 นิ้ว')
add('ห้องโถงใหญ่','โซฟา',1,14270,'สนใจ / ยังไม่ยืนยัน','IKEA FRIHETEN / KLAGSHAMN')
add('ห้องโถงใหญ่','SONOFF MINIR4',1,300,'1 โมดูลเบื้องต้น')
add('ห้องโถงใหญ่','ปลั๊ก 3 รู',2,200,'งบรวม 200–400 บาท; ตรวจสัญญาช่าง')
for(const name of ['โต๊ะกลาง','ชั้นวางทีวี / ขาแขวน','เครื่องปรับอากาศ','ชั้นเก็บของ']) add('ห้องโถงใหญ่',name)
add('ห้องโถงใหญ่','ผ้าม่าน',1,undefined,'รอวัดตามหน้าต่าง; 1 เป็นรายการเผื่อ')
add('ห้องโถงใหญ่','โต๊ะรับประทานอาหาร',1,undefined,'ถ้าต้องการ ยังไม่ยืนยัน')
add('ห้องครัว','ตู้เย็น',1,undefined,'เลือกสเปกแล้ว รอรุ่นและราคา','LG Door-in-Door 23.2 คิว / LG ThinQ')
add('ห้องครัว','หม้อหุงข้าว',1,1379,'รุ่นที่สนใจ','Philips HD4719 1.8 ลิตร Keep Warm')
add('ห้องครัว','ไมโครเวฟ',1,1494,'รุ่นแนะนำ','Toshiba MW2-MM24PC(BK) 24 ลิตร')
add('ห้องครัว','เครื่องล้างจานอัตโนมัติ',1,23800,'รุ่นแนะนำ; IoT Home Connect; ระบบช่วยอบแห้ง','Bosch SMS4EMB00P')
for(const name of ['หม้อทอดไร้น้ำมัน','เตาทำอาหาร','เครื่องดูดควัน','ชั้นเก็บจานและเครื่องครัว']) add('ห้องครัว',name)
add('ห้องครัว','ซิงก์ Waterfall',1,4000,'งบ 4,000–7,000 บาท; แทนซิงก์ธรรมดา ไม่ซื้อซ้ำ; ตรวจสัญญาช่างและของแถม ก๊อกดึงสาย น้ำตก ที่ล้างแก้ว ตะกร้า เขียง','Waterfall Kitchen Sink สแตนเลส 304 อ่างเดี่ยวใหญ่')
for(const name of ['เคาน์เตอร์ครัว','ตู้ครัวบน–ล่าง','ท่อน้ำดีและน้ำทิ้งเครื่องล้างจาน']) add('ห้องครัว',name,1,undefined,'ตรวจสัญญาช่างก่อนซื้อ ไม่คิดต้นทุนซ้ำ')
add('ห้องครัว','ถังขยะ',1,undefined,'จำนวน 1–2 ใบ ใช้ขั้นต่ำ 1 รอยืนยัน')
add('ห้องครัว','สวิตช์ไฟธรรมดา',1,undefined,'จำนวนตามแบบ รอกำหนด; 1 เป็นรายการเผื่อ')
add('ห้องครัว','ปลั๊ก 3 รูเดิม',2,200,'งบรวม 200–400 บาท; ตรวจสัญญาช่าง')
add('ห้องครัว','ปลั๊ก / วงจรเพิ่มเติมสำหรับเครื่องใช้',1,undefined,'ต้องออกแบบเพิ่ม รอกำหนดจำนวน; 1 เป็นรายการเผื่อ')
add('ประตูทางเข้าหลัก','Digital Door Lock',1,3630,'เลือกแล้ว; ประตูบานเลื่อน; แอป Tuya Smart / Smart Life; ต้องการคีย์การ์ดอย่างน้อย 2 ใบรอยืนยันในชุด; ให้ร้านตรวจกรอบอะลูมิเนียม ความหนาบาน กลอน อินเทอร์เน็ต และค่าติดตั้ง; ประตูอื่นใช้กลอนธรรมดา','Tuya DL-M07 สีดำ')
add('ทางเดิน / ระเบียง / โรงจอดรถ','SONOFF MINIR4',1,300,'1 โมดูลเบื้องต้น ควบคุมไฟพื้นที่นี้กลุ่มเดียวพร้อมกัน')
add('ทางเดิน / ระเบียง / โรงจอดรถ','สวิตช์กดติดผนังโรงจอดรถ',1)
add('ทางเดิน / ระเบียง / โรงจอดรถ','ปลั๊ก 3 รูโรงจอดรถ',1,100,'งบ 100–200 บาท มีไฟตลอดเวลา ไม่ต่อผ่านสวิตช์ไฟ')
add('ทางเดิน / ระเบียง / โรงจอดรถ','โคมไฟ',1,undefined,'จำนวนตามแบบ; 1 เป็นรายการเผื่อ; พักรายการเฟอร์นิเจอร์และของตกแต่งพื้นที่นี้')
add('พื้นที่ซักล้าง','เครื่องซัก–อบ',1,22800,'รุ่นแนะนำ ยังไม่ยืนยัน; ซัก 11 กก. อบ 7 กก. LG ThinQ','LG FV1411H3M')
for(const name of ['จุดจ่ายไฟและสายดิน','ท่อน้ำดี','ท่อน้ำทิ้ง']) add('พื้นที่ซักล้าง',name,1,undefined,'รอตรวจงานช่าง')
add('ระบบกล้องวงจรปิด','กล้องภายนอก',3,undefined,'รอเลือกรุ่น')
add('ระบบกล้องวงจรปิด','กล้องภายใน',2,undefined,'รอเลือก 2 จุดสุดท้าย; เคยพิจารณาห้องครัว ห้องโถง ห้องนอน 2')
add('ระบบกล้องวงจรปิด','สาย LAN / PoE หรือจุดจ่ายไฟ',1,undefined,'รอกำหนดตามระบบ; 1 เป็นรายการเผื่อ')
add('ระบบกล้องวงจรปิด','อุปกรณ์บันทึกภาพ / จัดเก็บข้อมูล',1,undefined,'รอเลือกตามระบบ; 1 เป็นรายการเผื่อ')

async function main() {
 const current = await getAssetWorkspace()
 if(!current.canWrite) throw new Error('ไม่มีสิทธิ์บันทึก')
 const property = current.data.properties?.find(p => propertyAssetIds(p).some(id => current.data.homes.some(h => h.id === id && h.assetCode === 'BLD-002' && h.name === 'บ้านสว่างไซงาม')))
 const home = current.data.homes.find(h => h.assetCode === 'BLD-002' && h.name === 'บ้านสว่างไซงาม')
 if(!property || !home) throw new Error('ไม่พบบ้านและ Property ที่ตรงกัน')
 if(home.items.some(i => i.notes.includes(marker))) { console.log('แผนชุดนี้บันทึกแล้ว ไม่เพิ่มซ้ำ'); return }
 if(home.items.length) throw new Error('พบรายการเดิม ต้องตรวจซ้ำก่อนนำเข้า')
 const total = rows.reduce((sum,r) => sum + (r.referencePrice ?? 0)*r.quantity,0)
 if(Math.abs(total-117963)>0.01) throw new Error(`งบอ้างอิงไม่ตรง: ${total}`)
 const beforeCost=assetCosts(home).total
 const nextHome={...home, rooms:[...new Set([...home.rooms,...rows.map(r=>r.room)])],items:rows}
 if(assetCosts(nextHome).total!==beforeCost) throw new Error('ต้นทุนเปลี่ยนจากแผนซื้อ')
 const beforeLedger=await prisma.ledgerEntry.count()
 mkdirSync('private/imports',{recursive:true})
 writeFileSync('private/imports/sawang-plan-2026-10-29-source.txt',readFileSync('/Users/ohmz/.codex/attachments/13cf9735-60de-49c0-9661-12e5ca4d2c45/ข้อความที่วาง.txt'))
 const result=await saveAssetWorkspace({...current.data,homes:current.data.homes.map(h=>h.id===home.id?nextHome:h)},`${marker}: นำเข้าแผนแยกห้อง งบอ้างอิง 117,963–123,363 บาท; ไม่มีการซื้อหรือจ่ายจริง; ไม่รวมต้นทุนซ้ำกับสัญญาช่าง`)
 if(!result.data) throw new Error(result.error||'บันทึกไม่สำเร็จ')
 const stored=await getAssetWorkspace();const saved=stored.data.homes.find(h=>h.id===home.id)!
 console.log(JSON.stringify({property:property.code,home:home.name,items:saved.items.length,rooms:[...new Set(rows.map(r=>r.room))],referenceBudgetMinimum:total,referenceBudgetMaximum:123363,assetCostBefore:beforeCost,assetCostAfter:assetCosts(saved).total,ledgerEntriesCreated:await prisma.ledgerEntry.count()-beforeLedger,revision:stored.data.revision}))
}
main().catch(e=>{console.error(e.message);process.exitCode=1}).finally(()=>prisma.$disconnect())
