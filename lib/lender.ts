export const lenderRoles: Record<string, string> = { FUNDER: 'ผู้ปล่อยเงิน', REPRESENTATIVE: 'ผู้ทำสัญญาแทน', BOTH: 'ผู้ปล่อยเงินและผู้ทำสัญญาแทน' }
export const lenderStatuses: Record<string, string> = { ACTIVE: 'ใช้งาน', INACTIVE: 'ไม่ใช้งาน' }
export const lenderFields = [
  ['nickname', 'ชื่อเล่น'], ['firstName', 'ชื่อ'], ['lastName', 'นามสกุล'],
  ['nationalId', 'เลขบัตรประชาชน'], ['phone', 'เบอร์โทร'], ['workplace', 'ที่ทำงาน'],
  ['address', 'ที่อยู่สำหรับทำสัญญา'], ['bankAccount', 'เลขบัญชีธนาคาร'],
  ['bankAccountName', 'ชื่อบัญชีธนาคาร'], ['line', 'Line'], ['facebook', 'Facebook'], ['notes', 'หมายเหตุ / รายละเอียดการทำสัญญาแทน'],
] as const
export type LenderRow = Record<typeof lenderFields[number][0], string> & { id: number; provinceId: number | null; role: string; status: string; bankCode: string; createdAt: string }
export const lenderCode = (id: number) => `LN-${String(id).padStart(5, '0')}`
