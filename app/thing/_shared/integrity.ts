import type { AssetData, LedgerOption } from './model'
import { roundMoney } from './model'

export function validateHistory(next: AssetData, previous: AssetData) {
  for (const loan of previous.loans) {
    const updated = next.loans.find(row => row.id === loan.id)
    if (!updated) throw new Error('ไม่สามารถลบเงินกู้เดิมได้ กรุณาเก็บประวัติไว้')
    for (const round of loan.rounds) {
      if (!loan.payments.some(p => p.roundId === round.id) && round.id === loan.rounds.at(-1)?.id) continue
      const replacement = updated.rounds.find(r => r.id === round.id)
      if (JSON.stringify(replacement) !== JSON.stringify(round)) throw new Error('สัญญาที่มีประวัติชำระหรือรีเทนชันแล้วแก้เงื่อนไขเดิมไม่ได้ กรุณาเพิ่มรอบใหม่')
    }
  }
}

export function validateLedgerLinks(data: AssetData, entries: LedgerOption[]) {
  const used = new Set<number>()
  const check = (id: number | undefined, amount: number, date?: string, direction: 'IN' | 'OUT' = 'OUT') => {
    if (!id) return
    const entry = entries.find(e => e.id === id)
    if (!entry) throw new Error('ไม่พบรายการจ่ายที่เชื่อม หรือรายการถูกยกเลิกแล้ว')
    if (entry.direction && entry.direction !== direction) throw new Error('ประเภทรายการรับ–จ่ายไม่ตรงกับที่เชื่อมไว้')
    if (used.has(id)) throw new Error('รายการรับ–จ่ายนี้ถูกใช้แล้ว ไม่สามารถเชื่อมซ้ำได้')
    if (Math.abs(roundMoney(entry.amountSatang / 100) - roundMoney(amount)) > .009) throw new Error('ยอดสินทรัพย์หรือยอดชำระไม่ตรงกับรายการรับ–จ่ายที่เลือก')
    if (date && date !== entry.occurredOn) throw new Error('วันที่ชำระต้องตรงกับรายการรับ–จ่ายที่เลือก')
    used.add(id)
  }
  for (const home of data.homes) for (const row of home.boq) check(row.ledgerEntryId, row.paid)
  for (const loan of data.loans) for (const p of loan.payments) check(p.ledgerEntryId, p.amount, p.date)
  for (const home of data.homes) for (const work of home.landDevelopments ?? []) for (const payment of work.payments) check(payment.ledgerEntryId, payment.amount, payment.date, payment.direction ?? 'OUT')
}
