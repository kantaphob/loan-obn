import {prisma} from '../lib/prisma'
import {getAssetWorkspace} from '../app/thing/_shared/actions'
async function main(){const {data}=await getAssetWorkspace();const h=data.homes.find(h=>h.assetCode==='BLD-002')!;console.log(JSON.stringify({name:h.name,rooms:h.rooms.map(name=>({name,items:h.items.filter(i=>i.room===name).length,boq:h.boq.filter(i=>i.room===name).length,works:h.buildingWorks?.filter(w=>w.roomNames.includes(name)).length,projects:h.buildingProjects?.filter(p=>p.roomNames.includes(name)).length})),details:h.buildingDetails?.roomCounts,items:h.items.filter(i=>i.room==='ห้องน้ำ 1–4').map(i=>({name:i.name,quantity:i.quantity})),costSource:h.costSource,fee:h.boqManagementFee,total:h.boqAgreedTotal}))}
main().finally(()=>prisma.$disconnect())
