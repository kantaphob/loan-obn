import type { AssetData, LedgerOption } from './model'
import { roundMoney } from './model'

export function validateHistory(next: AssetData, previous: AssetData, options: { allowContractEdits?: boolean } = {}) {
  for (const home of previous.homes) {
    const updatedHome = next.homes.find(row => row.id === home.id)
    if (!updatedHome) continue
    for (const payment of home.vehicleFinancing?.payments ?? []) if (JSON.stringify(updatedHome.vehicleFinancing?.payments?.find(row => row.id === payment.id)) !== JSON.stringify(payment)) throw new Error('รายการค่างวดรถที่ลงบัญชีแล้วแก้หรือลบไม่ได้')
    for (const payment of home.vehicleFinancing?.downPayments ?? []) if (JSON.stringify(updatedHome.vehicleFinancing?.downPayments?.find(row => row.id === payment.id)) !== JSON.stringify(payment)) throw new Error('รายการจ่ายเงินดาวน์รถที่ลงบัญชีแล้วแก้หรือลบไม่ได้')
    if (home.vehicleFinancing?.payments.length || home.vehicleFinancing?.downPayments.length) {
      const priorTerms = Object.fromEntries(Object.entries(home.vehicleFinancing).filter(([key]) => key !== 'payments' && key !== 'downPayments'))
      const nextTerms = Object.fromEntries(Object.entries(updatedHome.vehicleFinancing ?? {}).filter(([key]) => key !== 'payments' && key !== 'downPayments'))
      if (JSON.stringify(priorTerms) !== JSON.stringify(nextTerms)) throw new Error('สัญญาไฟแนนซ์รถที่มีประวัติรับจ่ายแล้วแก้เงื่อนไขเดิมไม่ได้')
    }
    if (home.sale) {
      const updatedSale = updatedHome.sale
      if (!updatedSale) throw new Error('เก็บใบขายและสถานะขายแล้วไว้ในประวัติ')
      const previousTerms = Object.fromEntries(Object.entries(home.sale).filter(([key]) => key !== 'payments'))
      const updatedTerms = Object.fromEntries(Object.entries(updatedSale).filter(([key]) => key !== 'payments'))
      if (JSON.stringify(updatedTerms) !== JSON.stringify(previousTerms) || updatedHome.disposedOn !== home.disposedOn) throw new Error('ใบขายที่บันทึกแล้วแก้เงื่อนไขไม่ได้ เพื่อรักษาประวัติการขาย')
      for (const payment of home.sale.payments) if (JSON.stringify(updatedSale.payments.find(row => row.id === payment.id)) !== JSON.stringify(payment)) throw new Error('รายการรับเงินขายบ้านที่ลงบัญชีแล้วแก้หรือลบไม่ได้')
    }
    for (const order of home.buildingChangeOrders ?? []) {
      const updated = updatedHome.buildingChangeOrders?.find(row => row.id === order.id)
      if (!updated) throw new Error('เก็บประวัติใบงานเพิ่ม-ลดไว้ กรุณายกเลิกอนุมัติแทนการลบ')
      if ((order.payments ?? []).length && JSON.stringify(updated) !== JSON.stringify(order)) throw new Error('ใบงานที่มีรับ–จ่ายแล้วแก้หรือลบไม่ได้ เพื่อรักษาประวัติบัญชี')
      for (const payment of order.payments ?? []) if (JSON.stringify(updated.payments?.find(row => row.id === payment.id)) !== JSON.stringify(payment)) throw new Error('รายการรับ–จ่ายใบงานที่ลงบัญชีแล้วแก้หรือลบไม่ได้')
    }
  }
  for (const loan of previous.loans) {
    const updated = next.loans.find(row => row.id === loan.id)
    if (!updated) throw new Error('ไม่สามารถลบเงินกู้เดิมได้ กรุณาเก็บประวัติไว้')
    for (const payment of loan.contractorPayments ?? []) if (JSON.stringify(updated.contractorPayments?.find(row => row.id === payment.id)) !== JSON.stringify(payment)) throw new Error('รายการจ่ายผู้รับเหมาที่ลง ledger แล้วแก้หรือลบแยกจากบัญชีไม่ได้')
    for (const contract of loan.contractorContracts ?? []) if (loan.contractorPayments?.some(p => p.contractId === contract.id) && (updated.contractorContracts?.find(c => c.id === contract.id)?.kind ?? 'construction') !== (contract.kind ?? 'construction')) throw new Error('สัญญาที่มีการจ่ายแล้วไม่สามารถเปลี่ยนประเภทที่ดิน/จ้างเหมาได้')
    for (const contract of loan.contractorContracts ?? []) for (const variation of contract.variations ?? []) if (!updated.contractorContracts?.find(c => c.id === contract.id)?.variations?.some(row => row.id === variation.id)) throw new Error('เก็บประวัติงานเพิ่ม–งานลดไว้ กรุณาเปลี่ยนสถานะเป็นยกเลิกแทนการลบ')
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
  for (const home of data.homes) for (const payment of home.vehicleFinancing?.payments ?? []) check(payment.ledgerEntryId, payment.amount, payment.date)
  for (const home of data.homes) for (const payment of home.vehicleFinancing?.downPayments ?? []) check(payment.ledgerEntryId, payment.amount, payment.date, 'OUT')
  for (const loan of data.loans) for (const p of loan.payments) check(p.ledgerEntryId, p.amount, p.date)
  for (const loan of data.loans) for (const draw of loan.disbursements ?? []) check(draw.ledgerEntryId, draw.amount, draw.date, 'IN')
  for (const loan of data.loans) for (const payment of loan.contractorPayments ?? []) check(payment.ledgerEntryId, payment.amount, payment.date, 'OUT')
  for (const home of data.homes) for (const work of home.landDevelopments ?? []) for (const payment of work.payments) check(payment.ledgerEntryId, payment.amount, payment.date, payment.direction ?? 'OUT')
  for (const home of data.homes) for (const project of home.buildingProjects ?? []) for (const payment of project.payments) check(payment.ledgerEntryId, payment.amount, payment.date, payment.direction)
  for (const home of data.homes) for (const order of home.buildingChangeOrders ?? []) for (const payment of order.payments ?? []) check(payment.ledgerEntryId, payment.amount, payment.date, payment.direction)
  for (const home of data.homes) for (const payment of home.sale?.payments ?? []) check(payment.ledgerEntryId, payment.amount, payment.date, 'IN')
}

export function assetLedgerIds(data: AssetData) {
  return [...data.homes.flatMap(home => [...home.boq.map(row => row.ledgerEntryId), ...(home.vehicleFinancing?.payments ?? []).map(payment => payment.ledgerEntryId), ...(home.vehicleFinancing?.downPayments ?? []).map(payment => payment.ledgerEntryId), ...(home.landDevelopments ?? []).flatMap(work => work.payments.map(row => row.ledgerEntryId)), ...(home.buildingProjects ?? []).flatMap(project => project.payments.map(row => row.ledgerEntryId)), ...(home.buildingChangeOrders ?? []).flatMap(order => (order.payments ?? []).map(row => row.ledgerEntryId)), ...(home.sale?.payments ?? []).map(payment => payment.ledgerEntryId)]), ...data.loans.flatMap(loan => [...loan.payments.map(row => row.ledgerEntryId), ...(loan.disbursements ?? []).map(row => row.ledgerEntryId), ...(loan.contractorPayments ?? []).map(row => row.ledgerEntryId)])].filter((id): id is number => Boolean(id))
}
