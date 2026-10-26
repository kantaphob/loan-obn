import type { AssetData, LedgerOption } from './model'
import { roundMoney } from './model'

export function validateHistory(next: AssetData, previous: AssetData, options: { allowContractEdits?: boolean } = {}) {
  for (const loan of previous.loans) {
    const updated = next.loans.find(row => row.id === loan.id)
    if (!updated) throw new Error('ไม่สามารถลบเงินกู้เดิมได้ กรุณาเก็บประวัติไว้')
    for (const payment of loan.contractorPayments ?? []) if (JSON.stringify(updated.contractorPayments?.find(row => row.id === payment.id)) !== JSON.stringify(payment)) throw new Error('รายการจ่ายผู้รับเหมาที่ลง ledger แล้วแก้หรือลบแยกจากบัญชีไม่ได้')
    for (const contract of loan.contractorContracts ?? []) if (loan.contractorPayments?.some(p => p.contractId === contract.id) && (updated.contractorContracts?.find(c => c.id === contract.id)?.kind ?? 'construction') !== (contract.kind ?? 'construction')) throw new Error('สัญญาที่มีการจ่ายแล้วไม่สามารถเปลี่ยนประเภทที่ดิน/จ้างเหมาได้')
    if (!options.allowContractEdits && (loan.payments.length || loan.disbursements?.length || loan.rounds.length > 1) && updated.openingBalance !== loan.openingBalance) throw new Error('มีรายการรับ–จ่ายแล้ว ไม่สามารถแก้ยอดหนี้ตั้งต้นได้')
    for (const payment of loan.payments.filter(row => row.ledgerEntryId)) if (JSON.stringify(updated.payments.find(row => row.id === payment.id)) !== JSON.stringify(payment)) throw new Error('รายการชำระที่ลง ledger แล้วไม่สามารถแก้หรือลบแยกจากบัญชีได้')
    for (const draw of (loan.disbursements ?? []).filter(row => row.ledgerEntryId)) if (JSON.stringify(updated.disbursements?.find(row => row.id === draw.id)) !== JSON.stringify(draw)) throw new Error('รายการรับเงินกู้ที่ลง ledger แล้วไม่สามารถแก้หรือลบแยกจากบัญชีได้')
    if (loan.rounds.length > 1 && JSON.stringify(updated.disbursements) !== JSON.stringify(loan.disbursements)) throw new Error('เงินกู้ที่มีรีเทนชันแล้วแก้ยอดเบิกเดิมไม่ได้')
    if (loan.disbursements === undefined && updated.disbursements !== undefined && loan.payments.length) throw new Error('เงินกู้เดิมที่มีการชำระแล้วต้องคงยอดยกมาเดิม')
    for (const round of loan.rounds) {
      if (options.allowContractEdits) continue
      if (!loan.payments.some(p => p.roundId === round.id) && !(round.id === loan.rounds[0]?.id && loan.disbursements?.length) && round.id === loan.rounds.at(-1)?.id) continue
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
  for (const loan of data.loans) for (const draw of loan.disbursements ?? []) check(draw.ledgerEntryId, draw.amount, draw.date, 'IN')
  for (const loan of data.loans) for (const payment of loan.contractorPayments ?? []) check(payment.ledgerEntryId, payment.amount, payment.date, 'OUT')
  for (const home of data.homes) for (const work of home.landDevelopments ?? []) for (const payment of work.payments) check(payment.ledgerEntryId, payment.amount, payment.date, payment.direction ?? 'OUT')
  for (const home of data.homes) for (const project of home.buildingProjects ?? []) for (const payment of project.payments) check(payment.ledgerEntryId, payment.amount, payment.date, payment.direction)
}

export function assetLedgerIds(data: AssetData) {
  return [...data.homes.flatMap(home => [...home.boq.map(row => row.ledgerEntryId), ...(home.landDevelopments ?? []).flatMap(work => work.payments.map(row => row.ledgerEntryId)), ...(home.buildingProjects ?? []).flatMap(project => project.payments.map(row => row.ledgerEntryId))]), ...data.loans.flatMap(loan => [...loan.payments.map(row => row.ledgerEntryId), ...(loan.disbursements ?? []).map(row => row.ledgerEntryId), ...(loan.contractorPayments ?? []).map(row => row.ledgerEntryId)])].filter((id): id is number => Boolean(id))
}
