export type ContractDraft = {
  borrowerId: number; lenderId: number; requestKey: string;
  documentChoice: string; signingMethod: string; documentPackage: string;
  interestMethod: string; rateCode: string; customRate: string; principal: string;
}
export const contractCode = (id: number) => `CT-${String(id).padStart(6, '0')}`
export function contractAmounts(principal: string, percent: number, method: string) {
  if (!/^\d+(?:\.\d{1,2})?$/.test(principal) || Number(principal) <= 0 || Number(principal) > 2_000_000_000) throw new Error('ยอดเงินต้นไม่ถูกต้อง')
  if (!Number.isFinite(percent) || percent < 0 || percent > 100) throw new Error('อัตราดอกเบี้ยไม่ถูกต้อง')
  if (!['INTEREST_UPFRONT', 'INTEREST_WITH_PRINCIPAL'].includes(method)) throw new Error('กรุณาเลือกวิธีชำระดอกเบี้ย')
  const principalSatang = Math.round(Number(principal) * 100)
  const interestSatang = Math.round(principalSatang * percent / 100)
  return { principalSatang, interestSatang, netSatang: principalSatang - (method === 'INTEREST_UPFRONT' ? interestSatang : 0), repaymentSatang: principalSatang + (method === 'INTEREST_UPFRONT' ? 0 : interestSatang) }
}
