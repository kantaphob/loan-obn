export const lenderRoles: Record<string, string> = { FUNDER: 'ผู้ปล่อยเงิน', REPRESENTATIVE: 'ผู้ทำสัญญาแทน', BOTH: 'ผู้ปล่อยเงินและผู้ทำสัญญาแทน' }
export const lenderStatuses: Record<string, string> = { ACTIVE: 'ใช้งาน', INACTIVE: 'ไม่ใช้งาน' }
export const lenderFields = [
  ['titleTh', 'คำนำหน้าภาษาไทย'],
  ['middleNameTh', 'ชื่อกลางภาษาไทย'],
  ['titleEn', 'คำนำหน้าภาษาอังกฤษ'],
  ['firstNameEn', 'ชื่อภาษาอังกฤษ'],
  ['middleNameEn', 'ชื่อกลางภาษาอังกฤษ'],
  ['lastNameEn', 'นามสกุลภาษาอังกฤษ'],
  ['birthDate', 'วันเกิด'],
  ['houseNumber', 'เลขที่บ้าน'],
  ['villageNumber', 'หมู่ที่'],
  ['cardIssueDate', 'วันออกบัตร'],
  ['cardExpiryDate', 'วันหมดอายุ'],
  ['instagram', 'Instagram'],
  ['referrer', 'ผู้แนะนำ'],
  ['promptPayNumber', 'หมายเลขพร้อมเพย์'],
  ['registeredAt', 'วันที่ลงทะเบียน'],

  ['nickname', 'ชื่อเล่น'], ['firstName', 'ชื่อ'], ['lastName', 'นามสกุล'],
  ['nationalId', 'เลขบัตรประชาชน'], ['phone', 'เบอร์โทร'], ['workplace', 'ที่ทำงาน'],
  ['address', 'ที่อยู่สำหรับทำสัญญา'], ['bankAccount', 'เลขบัญชีธนาคาร'],
  ['bankAccountName', 'ชื่อบัญชีธนาคาร'], ['line', 'Line'], ['facebook', 'Facebook'], ['notes', 'หมายเหตุ / รายละเอียดการทำสัญญาแทน'],
] as const
export type LenderRow = Record<typeof lenderFields[number][0], string> & { id: number; cardReadAt: string | null; provinceId: number | null; role: string; status: string; bankCode: string; promptPayType: string; paymentChannelCode: string; createdAt: string }
export const lenderCode = (id: number) => `LN-${String(id).padStart(4, '0')}`
