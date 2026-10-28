import { prisma } from '@/lib/prisma'

export function summarizeOpenItems(rows: { id: number; dueDate: string; amountSatang: number; payments: { amountSatang: number }[] }[], today: string) {
  return rows.map(row => ({ id: row.id, dueDate: row.dueDate, remaining: Math.max(0, row.amountSatang - row.payments.reduce((n,p) => n+p.amountSatang,0)) }))
    .filter(row => row.remaining > 0).map(row => ({ ...row, overdue: Boolean(row.dueDate) && row.dueDate < today }))
    .sort((a,b) => a.dueDate.localeCompare(b.dueDate))
}
export async function getDashboardOperations(today: string) {
  const [receivables, payables, recent] = await Promise.all([
    prisma.tradeReceivable.findMany({ where: { occurredOn: { lte: today } }, select: { id:true, dueDate:true, amountSatang:true, payments:{where:{voidedAt:null,occurredOn:{lte:today}},select:{amountSatang:true}} } }),
    prisma.tradePayable.findMany({ where: { invoiceDate: { lte: today } }, select: { id:true, dueDate:true, amountSatang:true, payments:{where:{voidedAt:null,occurredOn:{lte:today}},select:{amountSatang:true}} } }),
    prisma.ledgerEntry.findMany({ where:{voidedAt:null,occurredOn:{lte:today}},orderBy:[{occurredOn:'desc'},{id:'desc'}],take:8,select:{id:true,occurredOn:true,direction:true,amountSatang:true,categoryName:true,contractId:true} }),
  ])
  return { receivables: summarizeOpenItems(receivables,today), payables:summarizeOpenItems(payables,today), recent }
}
