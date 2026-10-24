export function monthRange(month: string) {
  if (typeof month !== 'string' || !/^(19|[2-9]\d)\d{2}-(0[1-9]|1[0-2])$/.test(month)) throw new Error('กรุณาเลือกเดือนให้ถูกต้อง')
  const [year, value] = month.split('-').map(Number)
  return { startOn: `${month}-01`, endOn: new Date(Date.UTC(year, value, 0)).toISOString().slice(0, 10) }
}
export function nextMonth(month: string) {
  const { endOn } = monthRange(month)
  return new Date(Date.parse(endOn) + 86400000).toISOString().slice(0, 7)
}
export function allocationAmount(value: string) {
  if (typeof value !== 'string' || !/^\d+(\.\d{1,2})?$/.test(value)) throw new Error('ระบุยอดเงินตั้งแต่ 0 และทศนิยมไม่เกิน 2 ตำแหน่ง')
  const satang = Math.round(Number(value) * 100)
  if (!Number.isSafeInteger(satang) || satang > 200_000_000_000) throw new Error('ยอดเงินเกินกำหนด')
  return satang
}
