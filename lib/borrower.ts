export const borrowerFields = [
  ['nickname', 'ชื่อเล่น'], ['firstName', 'ชื่อ'], ['lastName', 'สกุล'],
  ['phone', 'เบอร์โทร'], ['nationalId', 'เลขบัตร'], ['workplace', 'ที่ทำงาน'],
  ['bankAccount', 'เลขบัญชีธนาคาร'], ['bankAccountName', 'ชื่อบัญชีธนาคาร'], ['facebook', 'FB'], ['instagram', 'IG'], ['line', 'Line'], ['referrer', 'คนแนะนำ'],
] as const
export const promptPayTypes: Record<string, string> = { PHONE: 'เบอร์โทรศัพท์', NATIONAL_ID: 'เลขบัตรประชาชน' }
export const borrowerStatuses: Record<string, string> = { ACTIVE: 'ใช้งาน', INACTIVE: 'ไม่ใช้งาน', BLACKLIST: 'บัญชีดำ', WAITING_RETURN: 'รอส่งคืน', UNDER_REVIEW: 'พิจารณา', SETTLED: 'ปิดยอด', WAITING_PAYMENT: 'รอรับยอด' }
export type BorrowerRow = {
  cardData: string | null; cardReadAt: string | null;
  borrowerId: string | null;
  provinceId: number | null;
  id: number; nickname: string; firstName: string; lastName: string; phone: string; nationalId: string | null;
  bankCode: string; bankAccountName: string; promptPayType: string; promptPayNumber: string;
  workplace: string; status: string; bankAccount: string; paymentChannelCode: string; registeredAt: string;
  durationMonths: number; facebook: string; instagram: string; line: string; riskRatingCode: string;
  approvedLimit: number; usedLimit: number; referrer: string;
}
export type BorrowerOption = { code: string; nameTh: string }

export function availableBorrowerLimit(approved: number, used: number) {
  return Math.max(0, approved - used)
}

export function borrowerTenure(registeredAt: string, today: string) {
  const start = new Date(registeredAt.slice(0, 10) + 'T00:00:00Z')
  const end = new Date(today + 'T00:00:00Z')
  if (!Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime()) || end < start) return '0 ปี 0 เดือน 0 วัน'
  let months = (end.getUTCFullYear() - start.getUTCFullYear()) * 12 + end.getUTCMonth() - start.getUTCMonth()
  const anchor = (offset: number) => {
    const month = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + offset, 1))
    const lastDay = new Date(Date.UTC(month.getUTCFullYear(), month.getUTCMonth() + 1, 0)).getUTCDate()
    return new Date(Date.UTC(month.getUTCFullYear(), month.getUTCMonth(), Math.min(start.getUTCDate(), lastDay)))
  }
  if (anchor(months) > end) months--
  const days = Math.floor((end.getTime() - anchor(months).getTime()) / 86400000)
  return `${Math.floor(months / 12)} ปี ${months % 12} เดือน ${days} วัน`
}
