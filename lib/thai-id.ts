export type ThaiIdCard = {
  nationalId: string; titleTh: string; firstName: string; lastName: string;
  fullNameTh: string; fullNameEn: string; birthDate: string; gender: string;
  issuer: string; issueDate: string; expiryDate: string; address: string; photo: string; reader: string;
}
export function cardDate(value: string) {
  if (!/^\d{8}$/.test(value)) return value || '—'
  return `${value.slice(6, 8)}/${value.slice(4, 6)}/${value.slice(0, 4)} (พ.ศ.)`
}
