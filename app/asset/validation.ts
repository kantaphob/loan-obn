import { balance, roundMoney, today, type AssetData } from './model'

export function validateAssetData(data: AssetData) {
  const fail = (message: string): never => { throw new Error(message) }
  const text = (value: unknown) => typeof value === 'string' && value.length <= 3000 || fail('ข้อความไม่ถูกต้องหรือยาวเกินไป')
  const amount = (value: unknown, positive = false) => typeof value === 'number' && Number.isFinite(value) && value >= (positive ? .000001 : 0) && value <= 1e12 || fail('จำนวนเงินหรือจำนวนรายการไม่ถูกต้อง')
  const date = (value: string, optional = false) => optional && value === '' || /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value || fail('กรุณาระบุวันที่ให้ถูกต้อง')
  const ids = new Set<string>()
  const id = (value: string) => { text(value); if (!/^[a-zA-Z0-9-]{1,80}$/.test(value) || ids.has(value)) fail('รหัสรายการซ้ำหรือไม่ถูกต้อง'); ids.add(value) }
  if (!data || data.version !== 2 || !Number.isSafeInteger(data.revision) || data.revision < 0 || !Array.isArray(data.homes) || data.homes.length < 1 || data.homes.length > 100) fail('ข้อมูลสินทรัพย์ไม่ถูกต้อง')
  for (const home of data.homes) {
    id(home.id); text(home.name); text(home.address); text(home.categoryCode)
    if (!home.name.trim()) fail('กรุณาระบุชื่อบ้าน')
    if (!['house', 'vehicle', 'other'].includes(home.kind) || !['cash', 'loan'].includes(home.financing)) fail('ประเภทสินทรัพย์หรือการชำระไม่ถูกต้อง')
    amount(home.purchasePrice); date(home.purchasedOn, true)
    if (!['manual', 'boq'].includes(home.costSource) || home.costSource === 'boq' && home.kind !== 'house') fail('แหล่งต้นทุนไม่ถูกต้อง')
    if (home.kind !== 'house' && home.landValue !== 0) fail('มูลค่าที่ดินใช้เฉพาะอสังหาริมทรัพย์')
    amount(home.landValue); amount(home.buildingValue)
    for (const key of ['rooms', 'items', 'boq'] as const) if (!Array.isArray(home[key]) || home[key].length > 10000) fail('รายการมากเกินไป')
    home.rooms.forEach(r => { text(r); if (!r.trim()) fail('ชื่อห้องว่าง') })
    if (new Set(home.rooms).size !== home.rooms.length) fail('ชื่อห้องซ้ำ')
    for (const item of home.items) {
      id(item.id); [item.room, item.name, item.size, item.shop, item.notes].forEach(text)
      if (!item.name.trim() || !home.rooms.includes(item.room)) fail('กรุณาระบุชื่อสินค้าและห้อง')
      amount(item.quantity, true); amount(item.price); date(item.purchasedOn, true); date(item.warrantyUntil, true)
      date(item.warrantyStart, true); amount(item.warrantyMonths)
      if (!Number.isInteger(item.warrantyMonths) || item.warrantyMonths > 1200) fail('ระยะประกันไม่ถูกต้อง')
      if (item.warrantyStart && item.warrantyUntil && item.warrantyUntil < item.warrantyStart) fail('วันสิ้นสุดประกันต้องไม่ก่อนวันเริ่มประกัน')
      if (item.purchasedOn && item.warrantyUntil && item.warrantyUntil < item.purchasedOn) fail('วันหมดประกันต้องไม่ก่อนวันซื้อ')
    }
    for (const item of home.boq) {
      id(item.id); [item.category, item.name, item.spec, item.unit, item.vendor, item.reference].forEach(text)
      if (!item.name.trim()) fail('กรุณาระบุชื่อรายการ BOQ')
      amount(item.quantity, true); [item.price, item.labor, item.paid].forEach(n => amount(n))
      if (item.ledgerEntryId !== undefined && (!Number.isSafeInteger(item.ledgerEntryId) || item.ledgerEntryId < 1)) fail('เลขรายการบัญชีไม่ถูกต้อง')
    }
  }
  if (!Array.isArray(data.loans) || data.loans.length > 1000) fail('รายการเงินกู้ไม่ถูกต้อง')
  for (const home of data.loans) {
    id(home.id); text(home.bank); text(home.name); text(home.accountNumber)
    if (!home.bank.trim() || !home.name.trim()) fail('กรุณาระบุธนาคารและชื่อเงินกู้')
    if (home.assetId !== null && !data.homes.some(asset => asset.id === home.assetId)) fail('ไม่พบสินทรัพย์ที่เชื่อมกับเงินกู้')
    if (!Array.isArray(home.rounds) || !Array.isArray(home.payments) || home.rounds.length > 1000 || home.payments.length > 10000) fail('รายการสัญญาหรือชำระไม่ถูกต้อง')
    for (let index = 0; index < home.rounds.length; index++) {
      const r = home.rounds[index]; id(r.id); text(r.name); text(r.notes); date(r.effectiveOn, index === 0)
      if (!r.name.trim()) fail('กรุณาระบุชื่อรอบสัญญา')
      amount(r.opening, true); amount(r.mrr); amount(r.fee); amount(r.referenceInterest)
      if (r.mrr > 100 || !Number.isInteger(r.months) || r.months < 1 || r.months > 600 || !Array.isArray(r.periods) || !r.periods.length || r.periods.length > 600) fail('ระยะเวลาหรือดอกเบี้ยไม่ถูกต้อง')
      let next = 1
      for (const p of r.periods) {
        if (!Number.isInteger(p.from) || !Number.isInteger(p.to) || p.from !== next || p.to < p.from || p.to > r.months) fail('ช่วงดอกเบี้ยต้องต่อเนื่อง เริ่มเดือน 1 และไม่ซ้อนกัน')
        amount(p.rate); amount(p.discount); amount(p.installment, true)
        if (p.rate > 100 || p.discount > 100 || typeof p.floating !== 'boolean') fail('อัตราดอกเบี้ยไม่ถูกต้อง')
        next = p.to + 1
      }
      if (next !== r.months + 1) fail('ช่วงดอกเบี้ยต้องครอบคลุมระยะเวลาคงเหลือทั้งหมด')
      if (index > 0) {
        const previous = home.rounds[index - 1]
        if (!previous.effectiveOn || r.effectiveOn <= previous.effectiveOn) fail('วันที่รีเทนชันต้องหลังรอบเดิม')
        if (Math.abs(r.opening - balance(home, previous)) > .01) fail('ยอดยกมารีเทนชันต้องตรงกับเงินต้นคงเหลือรอบก่อน')
      }
    }
    const duplicates = new Set<string>()
    for (const p of home.payments) {
      id(p.id); text(p.reference); date(p.date); amount(p.amount, true); amount(p.interest); amount(p.principal)
      if (Math.abs(roundMoney(p.amount - p.interest) - p.principal) > .01) fail('ยอดชำระต้องเท่ากับเงินต้นบวกดอกเบี้ย')
      if (p.date > today()) fail('รายการชำระจริงต้องไม่เป็นวันที่ในอนาคต')
      if (p.ledgerEntryId !== undefined && (!Number.isSafeInteger(p.ledgerEntryId) || p.ledgerEntryId < 1)) fail('เลขรายการบัญชีไม่ถูกต้อง')
      const ri = home.rounds.findIndex(r => r.id === p.roundId); const r = home.rounds[ri]; const nextRound = home.rounds[ri + 1]
      if (!r || !r.effectiveOn || p.date < r.effectiveOn || nextRound && p.date >= nextRound.effectiveOn) fail('วันชำระต้องอยู่ในช่วงรอบสัญญาที่เลือก')
      const key = `${p.roundId}|${p.date}|${p.amount}|${p.interest}|${p.reference}`
      if (duplicates.has(key)) fail('พบรายการชำระซ้ำ'); duplicates.add(key)
    }
    for (const r of home.rounds) if (balance(home, r) < 0) fail('ยอดตัดเงินต้นเกินหนี้คงเหลือ')
  }
}
