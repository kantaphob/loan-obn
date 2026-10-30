import { prisma } from '../lib/prisma'
import { getAssetWorkspace } from '../app/thing/_shared/actions'
async function main() {
 const current=await getAssetWorkspace();const data=current.data
 const property=data.properties?.find(p=>p.code==='PROP-001')
 const homes=data.homes.filter(h=>h.assetCode==='BLD-002'||h.assetCode==='LAND-001')
 const matches:{asset:string;path:string;value:unknown}[]=[]
 function walk(value:unknown,path:string,asset:string){if(Array.isArray(value))value.forEach((v,i)=>walk(v,`${path}[${i}]`,asset));else if(value&&typeof value==='object') {const obj=value as Record<string,unknown>; if(Object.values(obj).some(v=>v===20000)) matches.push({asset,path,value:Object.fromEntries(Object.entries(obj).filter(([key])=>!['receipt','evidence','slip'].includes(key)))});Object.entries(obj).forEach(([k,v])=>{if(!['receipt','evidence','slip'].includes(k))walk(v,`${path}.${k}`,asset)})}}
 homes.forEach(h=>walk(h,'home',h.assetCode!))
 const ledger=await prisma.ledgerEntry.findMany({where:{amountSatang:2000000},select:{id:true,direction:true,kind:true,contractId:true,occurredOn:true,reference:true,note:true,categoryName:true,accountScope:true,voidedAt:true},orderBy:{id:'desc'},take:60})
 console.log(JSON.stringify({revision:data.revision,property,matches,ledger},null,2))
}
main().catch(e=>{console.error(e.message);process.exitCode=1}).finally(()=>prisma.$disconnect())
