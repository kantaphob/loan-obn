import { createHash } from 'node:crypto'
import type { Prisma } from '@/generated/prisma/client'

export const slipDigest = (bytes: Uint8Array) => createHash('sha256').update(bytes).digest('hex')
export async function assertUniqueLedgerProof(tx: Prisma.TransactionClient, input: { reference: string; channelCode: string; slipHash?: string | null; excludeId?: number }) {
  const bankReference = ['BANKING', 'PROMPTPAY'].includes(input.channelCode) ? input.reference.trim().toLowerCase() : ''
  const candidates = await tx.ledgerEntry.findMany({
    where: { voidedAt: null, ...(input.excludeId ? { id: { not: input.excludeId } } : {}), OR: [
      ...(bankReference ? [{ channelCode: { in: ['BANKING', 'PROMPTPAY'] }, reference: { not: '' } }] : []),
      ...(input.slipHash ? [{ slipHash: input.slipHash }, { slipHash: null, slip: { isNot: null } }] : []),
    ] },
    select: { id: true, reference: true, channelCode: true, slipHash: true, slip: { select: { fileData: true } } },
  })
  for (const previous of candidates) {
    if (bankReference && ['BANKING', 'PROMPTPAY'].includes(previous.channelCode) && previous.reference.trim().toLowerCase() === bankReference || input.slipHash && (previous.slipHash ?? (previous.slip ? slipDigest(previous.slip.fileData) : null)) === input.slipHash) throw new Error(`หลักฐานหรือเลขอ้างอิงนี้บันทึกแล้วใน TX-${String(previous.id).padStart(6, '0')}`)
  }
}
