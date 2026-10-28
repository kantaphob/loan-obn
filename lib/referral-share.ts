export const DEFAULT_REFERRAL_SHARE_PERCENT = '5'

/** Convert an entered percent into basis points without relying on float math. */
export function referralPercentBasisPoints(value: string) {
  if (!/^\d{1,3}(?:\.\d{1,2})?$/.test(value)) throw new Error('อัตราส่วนแบ่งต้องเป็นตัวเลขไม่เกิน 2 ตำแหน่ง')
  const [whole, fraction = ''] = value.split('.')
  const basisPoints = Number(whole) * 100 + Number(fraction.padEnd(2, '0'))
  if (!Number.isSafeInteger(basisPoints) || basisPoints < 0 || basisPoints > 10_000) throw new Error('อัตราส่วนแบ่งต้องอยู่ระหว่าง 0–100%')
  return basisPoints
}

/** Calculate a share from the principal in integer satang, rounded half-up. */
export function referralShareFromPrincipal(principalSatang: number, percent: string) {
  return referralShareFromPrincipalBasisPoints(principalSatang, referralPercentBasisPoints(percent))
}

export function referralShareFromPrincipalBasisPoints(principalSatang: number, basisPoints: number) {
  if (!Number.isSafeInteger(principalSatang) || principalSatang < 0) throw new Error('เงินต้นไม่ถูกต้อง')
  if (!Number.isSafeInteger(basisPoints) || basisPoints < 0 || basisPoints > 10_000) throw new Error('อัตราส่วนแบ่งต้องอยู่ระหว่าง 0–100%')
  return Number((BigInt(principalSatang) * BigInt(basisPoints) + BigInt(5_000)) / BigInt(10_000))
}

/** The user chose settlement-based entitlement; partial receipts do not accrue a share. */
export function referralEntitlementOnSettlement(contractualShareSatang: number, contractSettled: boolean) {
  if (!Number.isSafeInteger(contractualShareSatang) || contractualShareSatang < 0) throw new Error('ยอดส่วนแบ่งไม่ถูกต้อง')
  return contractSettled ? contractualShareSatang : 0
}
