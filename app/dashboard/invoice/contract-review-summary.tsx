import type { PendingContractReview } from '@/lib/pending-contract-review'
import { contractCode, formatContractDate as date, formatContractMoney as money } from '@/lib/contracts'

export function ContractReviewSummary({ review: r }: { review: PendingContractReview }) {
  return <div className="ap-review-summary whitespace-normal">
    <div className="ap-review-parties"><div><small>ผู้กู้ / สัญญา</small><strong>{r.borrowerName}</strong><span>{r.borrowerCode} · {contractCode(r.id)}</span></div><div><small>ผู้ให้กู้</small><strong>{r.lenderName}</strong><span>{r.documentChoice === 'NONE' ? 'รายการจอง / ไม่มีเอกสาร' : r.signingMethod === 'E_SIGNATURE' ? r.signaturesReady ? 'ลงนามครบแล้ว' : 'รอลงนามให้ครบ' : 'ตรวจเอกสารกระดาษก่อนจ่าย'}</span></div></div>
    <dl className="ap-review-grid">{[
      ['วงเงินอนุมัติของผู้กู้', r.approvedLimitSatang], ['เงินต้นคงค้างเดิม', r.principalOutstandingSatang],
      ['ยอดค้างรวมตามสัญญาเดิม', r.outstandingSatang], ['ค่าปรับค้าง (รวมในยอดค้าง)', r.penaltyOutstandingSatang],
      ['จองรอจ่ายรายการอื่น', r.reservedOtherSatang], ['วงเงินเหลือก่อนรายการนี้', r.availableBeforeSatang],
    ].map(([label, amount]) => <div key={String(label)}><dt>{label}</dt><dd>{money(Number(amount))}<small> บาท</small></dd></div>)}</dl>
    <section className="ap-review-debts" aria-label="รายการคงค้างเดิม"><h3>รายการคงค้างเดิม <span>{r.outstandingContracts.length} สัญญา</span></h3>{r.outstandingContracts.length ? <div className="overflow-x-auto"><table className="w-full text-left text-xs"><thead><tr><th scope="col">สัญญา</th><th scope="col">ครบกำหนดคืน / สถานะ</th><th scope="col" className="text-right">ยอดค้างรวม (บาท)</th></tr></thead><tbody>{r.outstandingContracts.map(c => <tr key={c.id}><td>{contractCode(c.id)}</td><td>{date(c.dueDate)}<span className="block text-[10px] text-slate-500">{c.overdueDays > 0 ? `เกินกำหนด ${c.overdueDays} วัน` : 'ยังไม่เกินกำหนด'}</span></td><td className="text-right tabular-nums">{money(c.remainingSatang)}</td></tr>)}</tbody></table></div> : <p>ไม่มีสัญญาเดิมที่มียอดค้าง</p>}</section>
    <section className="ap-review-current" aria-label="ยอดรายการที่จะจ่าย"><h3>รายการนี้</h3><dl>{[
      ['เงินต้น / วงเงินรายการ', money(r.principalSatang) + ' บาท'],
      [r.interestMethod === 'INTEREST_UPFRONT' ? 'หักดอกก่อนจ่าย' : 'ดอกเบี้ยชำระพร้อมเงินต้น', money(r.interestSatang) + ' บาท'],
      ['วันนัดจ่ายตามสัญญา', date(r.scheduledDisbursementDate)], ['วันครบกำหนดคืน', date(r.repaymentDueDate)],
      ['ยอดที่ต้องรับคืนตามสัญญา', money(r.repaymentSatang) + ' บาท'],
    ].map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl><div className="ap-review-net"><span>ยอดจ่ายสุทธิ</span><strong>{money(r.netSatang)} <small>บาท</small></strong></div></section>
    <p className={r.availableAfterSatang < 0 ? 'ap-review-warning' : 'ap-review-available'}>{r.availableAfterSatang < 0 ? `หลังจองรายการนี้จะเกินวงเงิน ${money(-r.availableAfterSatang)} บาท` : `วงเงินคงเหลือหลังจองรายการนี้ ${money(r.availableAfterSatang)} บาท`}</p>
  </div>
}
