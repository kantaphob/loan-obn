import { contractCode } from './contracts'

export function slipFileName(entry: { contractId: number | null; legacySourceCode?: string | null; kind: string; occurredOn: string; id?: number }, mimeType: string) {
  const extension = mimeType === 'application/pdf' ? 'pdf' : mimeType === 'image/png' ? 'png' : 'jpg'
  const contract = entry.contractId ? contractCode(entry.contractId) : 'GENERAL'
  const legacy = entry.legacySourceCode?.replace(/[^a-zA-Z0-9-]/g, '')
  const kind = entry.kind === 'REPAYMENT' ? 'REPAYMENT' : entry.kind === 'DISBURSEMENT' ? 'DISBURSEMENT' : 'PAYMENT'
  return [contract, legacy, kind, entry.occurredOn, entry.id ? `TX-${String(entry.id).padStart(6, '0')}` : null].filter(Boolean).join('_') + `.${extension}`
}
