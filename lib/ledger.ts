export const ledgerKinds = { GENERAL: 'รับ–จ่ายทั่วไป', DISBURSEMENT: 'จ่ายเงินกู้', REPAYMENT: 'รับชำระคืน' } as const
export type LedgerInput = {
  requestKey: string; kind: keyof typeof ledgerKinds; contractId: number | null;
  direction: string; categoryCode: string; amount: string; occurredOn: string;
  channelCode: string; reference: string; note: string;
}
export function ledgerAmount(value: string) {
  if (typeof value !== 'string' || !/^\d+(?:\.\d{1,2})?$/.test(value)) throw new Error('ระบุจำนวนเงินให้ถูกต้อง ไม่เกิน 2 ตำแหน่งทศนิยม')
  const amount = Math.round(Number(value) * 100)
  if (!Number.isSafeInteger(amount) || amount <= 0 || amount > 200_000_000_000) throw new Error('จำนวนเงินต้องมากกว่า 0 และไม่เกิน 2,000,000,000 บาท')
  return amount
}
export function validLedgerDate(value: string) {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value && value <= bangkokToday()
}
export function bangkokToday() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Bangkok', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date())
}
export function contractLedgerBalance(contract: { repaymentSatang: number; status: string; paidAt: unknown }, entries: { kind: string; amountSatang: number; occurredOn: string }[]) {
  const disbursement = entries.find(e => e.kind === 'DISBURSEMENT')
  const received = entries.filter(e => e.kind === 'REPAYMENT').reduce((sum, e) => sum + e.amountSatang, 0)
  return { disbursed: Boolean(disbursement || contract.paidAt || ['PAID', 'CLOSED'].includes(contract.status)), received, remaining: Math.max(0, contract.repaymentSatang - received), disbursementOn: disbursement?.occurredOn ?? null }
}
