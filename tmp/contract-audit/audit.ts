import { prisma } from '../../lib/prisma'
import { saveContract, signContract } from '../../app/dashboard/contracts/actions'
import { GET } from '../../app/api/contracts/[id]/document/route'
import { randomUUID } from 'node:crypto'
import { writeFile } from 'node:fs/promises'
import sharp from 'sharp'
async function main(){
const draft = {borrowerId:1,lenderId:1,requestKey:randomUUID(),documentChoice:'CREATE',signingMethod:'E_SIGNATURE',documentPackage:'LOAN',witnessCount:0,interestMethod:'INTEREST_UPFRONT',rateCode:'CUSTOM',customRate:'20',principal:'5000',scheduledDisbursementDate:'2026-10-23',repaymentDueDate:'2026-11-23'} as const
const saved=await saveContract(draft); console.log('SAVE',saved)
if(!saved.id) throw Error('save failed')
const png=await sharp({create:{width:100,height:30,channels:4,background:'#123456'}}).png().toBuffer()
const signatureData='data:image/png;base64,'+png.toString('base64')
for(const signer of ['BORROWER','LENDER'] as const) console.log('SIGN',signer,await signContract({contractId:saved.id,signer,signatureData,accepted:true}))
const pdf=async(id:number,file:string)=>{const r=await GET(new Request('http://localhost/document'),{params:Promise.resolve({id:String(id)})}); console.log('PDF',file,r.status); if(r.status===200) await writeFile('tmp/contract-audit/'+file,Buffer.from(await r.arrayBuffer()))}
await pdf(saved.id,'before.pdf')
const before=await prisma.loanContract.findUniqueOrThrow({where:{id:saved.id}})
await prisma.lender.update({where:{id:1},data:{address:'ที่อยู่ผู้ให้กู้เปลี่ยนหลังเซ็น'}})
await pdf(saved.id,'after.pdf')
const after=await prisma.loanContract.findUniqueOrThrow({where:{id:saved.id}})
console.log('HASH_UNCHANGED',before.signatureTermsHash===after.signatureTermsHash,'STATUS',after.status,'PAID_AT',after.paidAt)
const bad=await saveContract({...draft,requestKey:randomUUID()})
if(bad.id){for(const signer of ['BORROWER','LENDER'] as const) console.log('BAD_PNG',await signContract({contractId:bad.id,signer,signatureData:'data:image/png;base64,iVBORw0KGgo=',accepted:true})); await pdf(bad.id,'bad.pdf')}
const pkg=await saveContract({...draft,requestKey:randomUUID(),signingMethod:'PRINT',documentPackage:'LOAN_GUARANTEE_COLLATERAL'})
if(pkg.id) await pdf(pkg.id,'package.pdf')
await prisma.$disconnect()

}
main().catch(console.error)
