export type ThaiIdCard = {
  middleNameTh?: string; titleEn?: string; firstNameEn?: string; middleNameEn?: string; lastNameEn?: string;
  nationalId: string; titleTh: string; firstName: string; lastName: string;
  fullNameTh: string; fullNameEn: string; birthDate: string; gender: string;
  issuer: string; issueDate: string; expiryDate: string; address: string; photo: string; reader: string;
}
export function cardDate(value: string) {
  if (!/^\d{8}$/.test(value)) return value || '—'
  return `${value.slice(6, 8)}/${value.slice(4, 6)}/${value.slice(0, 4)} (พ.ศ.)`
}

export function cardDateInput(value: string) {
  if (!/^\d{8}$/.test(value)) return ''
  const year = Number(value.slice(0, 4)) - 543
  const date = `${year}-${value.slice(4, 6)}-${value.slice(6, 8)}`
  const parsed = new Date(date + 'T00:00:00Z')
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === date ? date : ''
}
