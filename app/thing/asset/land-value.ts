import { roundMoney } from '../_shared/model'

/** User-specified compound annual growth; never writes a market valuation. */
export function projectLandValue(base: number, annualRate: number, years: number) {
  if (!Number.isFinite(base) || base < 0 || !Number.isFinite(annualRate) || annualRate < -100 || annualRate > 100 || !Number.isInteger(years) || years < 1 || years > 50) throw new Error('กรุณาระบุราคาฐาน อัตราเติบโต -100 ถึง 100% และระยะเวลา 1–50 ปี')
  return Array.from({ length: years }, (_, index) => {
    const year = index + 1
    const value = base * Math.pow(1 + annualRate / 100, year)
    if (!Number.isFinite(value) || value * 100 > Number.MAX_SAFE_INTEGER) throw new Error('ผลคำนวณสูงเกินช่วงที่รองรับ กรุณาลดอัตราหรือจำนวนปี')
    return { year, value: roundMoney(value) }
  })
}
