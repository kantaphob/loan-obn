import test from 'node:test'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { mkdir, writeFile } from 'node:fs/promises'
import { prisma } from '../lib/prisma'
import { createExpenseClaim, createReimbursementVoucher, getReimbursements, voidExpenseClaim, voidReimbursementVoucher, reimbursementCandidates } from '../app/dashboard/reimbursements/actions'
import { GET } from '../app/api/reimbursements/[kind]/[id]/route'
import { voidLedger } from '../app/dashboard/ledger/actions'
import { lendingCapitalCash } from '../lib/capital'
import { createReimbursementPdf, canceledReimbursementPdf } from '../lib/reimbursement-pdf'

test('advance claims, partial/group payments, reuse protection, cancellations and documents', async () => {
 await prisma.user.create({data:{id:'operator',acccode:'reim-test',password:'test',role:'ADMIN',level:0}})
 const payer=await prisma.lender.create({data:{nickname:'main',firstName:'ศุภกิจ'}}), claimant=await prisma.lender.create({data:{nickname:'other',firstName:'โอบนิธิ'}})
 await prisma.paymentChannel.create({data:{code:'CASH',nameTh:'เงินสด',nameEn:'Cash'}})
 await prisma.financialCategory.create({data:{code:'EXP',nameTh:'ค่าใช้จ่ายทั่วไป',nameEn:'Expense',direction:'OUT',group:'EXPENSE'}})
 const input={requestKey:randomUUID(),claimantId:claimant.id,payerId:payer.id,spentOn:'2026-10-01',title:'ค่าบริการรายเดือน',note:'ทดสอบ',lines:[{description:'บริการอินเทอร์เน็ต',categoryCode:'EXP',amount:'100',vendor:'ร้านค้า'}]}
 const c=await createExpenseClaim(input);assert.ok('success' in c,JSON.stringify(c)); if(!('id' in c))throw Error('no claim')
 assert.equal((await createExpenseClaim(input) as {id:number}).id,c.id)
 assert.equal(await prisma.ledgerEntry.count(),0)
 assert.ok('error' in await createExpenseClaim({...input,title:'changed'}))
 const pay={requestKey:randomUUID(),allocations:[{claimId:c.id,amount:'40'}],paidOn:'2026-10-02',channelCode:'CASH',reference:'partial',note:''}
 const v=await createReimbursementVoucher(pay);assert.ok('success' in v,JSON.stringify(v));if(!('id' in v))throw Error('no voucher')
 assert.equal((await createReimbursementVoucher(pay) as {id:number}).id,v.id)
 assert.equal(await prisma.ledgerEntry.count(),1)
 const cashEntry = await prisma.ledgerEntry.findFirstOrThrow()
 assert.ok('error' in await voidLedger(cashEntry.id, 'must use voucher page'))
 const response = await GET(new Request('http://localhost/api'), { params: Promise.resolve({ kind: 'claims', id: String(c.id) }) })
 assert.equal(response.status, 200); assert.equal(response.headers.get('Cache-Control'), 'private, no-store'); assert.ok((await response.arrayBuffer()).byteLength > 1000)
 const data=await getReimbursements();assert.equal(data.claims[0].remaining,6000);assert.equal(data.claims[0].status,'PARTIAL')
 assert.ok('error' in await voidExpenseClaim(c.id,'cannot void paid claim'))
 assert.ok('error' in await createReimbursementVoucher({...pay,requestKey:randomUUID(),allocations:[{claimId:c.id,amount:'61'}]}))
 assert.ok('error' in await createExpenseClaim({...input, requestKey:randomUUID()}, [new File(['bad'], 'fake.pdf', {type:'application/pdf'})]))
 const c2=await createExpenseClaim({...input,requestKey:randomUUID(),title:'ใบเบิกที่สอง'});if(!('id'in c2))throw Error(JSON.stringify(c2))
 const combined=await createReimbursementVoucher({...pay,requestKey:randomUUID(),reference:'combined',allocations:[{claimId:c.id,amount:'60'},{claimId:c2.id,amount:'100'}]});assert.ok('success'in combined,JSON.stringify(combined));if(!('id'in combined))throw Error('no combined')
 assert.equal((await getReimbursements()).claims.find(x=>x.id===c.id)?.remaining,0)
 assert.equal(lendingCapitalCash(await prisma.ledgerEntry.findMany()).balance,0)
 const saved=await prisma.expenseClaim.findUniqueOrThrow({where:{id:c.id}}), voucher=await prisma.reimbursementVoucher.findUniqueOrThrow({where:{id:v.id}})
 assert.ok(saved.pdfData.length>1000);assert.ok(voucher.pdfData.length>1000)
 await mkdir('tmp/reimbursements',{recursive:true});await writeFile('tmp/reimbursements/claim.pdf',saved.pdfData);await writeFile('tmp/reimbursements/voucher.pdf',voucher.pdfData)
 assert.ok('success'in await voidReimbursementVoucher(combined.id,'แก้ไขการโอน'))
 assert.equal((await getReimbursements()).claims.find(x=>x.id===c.id)?.remaining,6000)
 assert.equal(await prisma.ledgerEntry.count({where:{voidedAt:null}}),1)
 const existing=await prisma.ledgerEntry.create({data:{requestKey:'cash-existing',kind:'GENERAL',accountScope:'GENERAL',direction:'OUT',categoryCode:'EXP',categoryName:'ค่าใช้จ่าย',amountSatang:6000,occurredOn:'2026-10-03',channelCode:'CASH',channelName:'เงินสด',createdBy:'operator'}})
 assert.ok((await reimbursementCandidates('60')).some(x=>x.key===`LEDGER:${existing.id}`))
 const matched=await createReimbursementVoucher({...pay,requestKey:randomUUID(),existingKey:`LEDGER:${existing.id}`,allocations:[{claimId:c.id,amount:'60'}]});assert.ok('success'in matched,JSON.stringify(matched));if(!('id'in matched))throw Error('no match')
 assert.equal(await prisma.ledgerEntry.count(),3)
 assert.ok(!(await reimbursementCandidates('60')).some(x=>x.key===`LEDGER:${existing.id}`))
 assert.ok('success'in await voidReimbursementVoucher(matched.id,'ปลดจับคู่'))
 assert.equal((await prisma.ledgerEntry.findUniqueOrThrow({where:{id:existing.id}})).voidedAt,null)
 assert.ok('success'in await voidExpenseClaim(c2.id,'ไม่เบิกแล้ว'))
 assert.ok('error'in await createExpenseClaim({...input,requestKey:randomUUID(),claimantId:payer.id}))
 const evidence = new File([new Uint8Array(saved.pdfData)], 'receipt.pdf', { type:'application/pdf' })
 const withEvidence = await createExpenseClaim({...input, requestKey:randomUUID(), title:'with evidence'}, [evidence])
 assert.ok('success' in withEvidence, JSON.stringify(withEvidence))
 assert.ok('error' in await createExpenseClaim({...input, requestKey:randomUUID()}, [evidence]))
 const storedFile = await prisma.reimbursementFile.findFirstOrThrow()
 const attachment = await GET(new Request('http://localhost/api'), {params:Promise.resolve({kind:'files',id:String(storedFile.id)})})
 assert.equal(attachment.status,200);assert.equal(attachment.headers.get('Content-Type'),'application/pdf')
 const concurrentClaim=await createExpenseClaim({...input,requestKey:randomUUID(),title:'concurrent'})
 if (!('id' in concurrentClaim)) throw Error('concurrent fixture')
 const results=await Promise.all([1,2].map(()=>createReimbursementVoucher({...pay,requestKey:randomUUID(),reference:randomUUID(),allocations:[{claimId:concurrentClaim.id,amount:'100'}]})))
 assert.equal(results.filter(r=>'success' in r).length,1)
 assert.equal((await getReimbursements()).claims.find(c=>c.id===concurrentClaim.id)?.remaining,0)
 await prisma.user.update({where:{id:'operator'},data:{role:'REVIEWER'}})
 assert.ok('error'in await createExpenseClaim({...input,requestKey:randomUUID()}))
 const long=await createReimbursementPdf({kind:'CLAIM',code:'CLM-TEST',date:'2026-10-01',payer:'K.OHM',payee:'K.OB',title:'ทดสอบหลายหน้า',lines:Array.from({length:30},()=>({label:'ค่าใช้จ่ายสำหรับทดสอบเอกสารและการขึ้นบรรทัดใหม่ '.repeat(4),amountSatang:10000})),total:300000,note:'เอกสารตัวอย่าง'})
 await writeFile('tmp/reimbursements/multipage.pdf',long);await writeFile('tmp/reimbursements/canceled.pdf',await canceledReimbursementPdf(voucher.pdfData))
 await prisma.$disconnect()
})
