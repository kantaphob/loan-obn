import test from 'node:test'
import assert from 'node:assert/strict'
import { parseLegacyLoanCsv } from '../lib/legacy-loans'
import { contractLedgerBalance } from '../lib/ledger'

const headers = ['เลขที่สัญญา', 'ID', 'ชื่อผู้กู้', 'ยอดเงินกู้ (บาท)', 'ร้อยละ%', 'ยอดดอกเบี้ย', 'วันที่กู้ยืม', 'วันครบกำหนด', 'ระยะเกินกำหนด', 'เกินกำหนด', 'ยกเว้นเกินกำหนด', 'ยอดที่ต้องชำระคืนรวม', 'ยอดที่ชำระมาแล้ว', 'ยอดหนี้คงเหลือ', 'สถานะการชำระ', 'ปิดยอดเมื่อ', 'หมายเหตุ'].join(',')
const csv = `${headers}\r\nLM-001,CM001,แคท,"฿2,000.00",10%,฿200.00,17/09/2026,30/09/2026,0,฿0.00,FALSE,"฿2,200.00",฿700.00,"฿1,500.00",รอส่งคืน,,\r\nLM-002,CM003,ส้ม,"฿1,000.00",10%,฿100.00,17/09/2026,30/09/2026,0,฿0.00,FALSE,"฿1,100.00","฿1,100.00",฿0.00,ปิดยอด,30/09/2026,\r\nLM-003,CM002,นิคม,500,10%,50,01/11/2026,30/11/2026,0,0,FALSE,550,0,550,จองสัญญา,,จองสัญญา\r\n,,,,,,,,,,FALSE,,,,,,\r\n`

test('legacy loan CSV import keeps reservations as waiting-for-disbursement records and ignores formula-only rows', () => {
  const result = parseLegacyLoanCsv(csv)
  assert.equal(result.records.length, 3)
  assert.equal(result.skipped.length, 0)
  assert.equal(result.records[0].principalSatang, 200_000)
  assert.equal(result.records[0].receivedSatang, 70_000)
  assert.equal(result.records[0].remainingSatang, 150_000)
  assert.equal(result.records[0].loanDate, '2026-09-17')
  assert.equal(result.records[1].closedAt, '2026-09-30')
  assert.equal(result.records[2].sourceCode, 'LM-003')
  assert.equal(result.records[2].reservation, true)
  assert.equal(result.records[2].receivedSatang, 0)
})

test('legacy loan CSV rejects a reservation that already records received money', () => {
  const malformed = csv.replace(',550,0,550,จองสัญญา', ',550,10,540,จองสัญญา')
  assert.throws(() => parseLegacyLoanCsv(malformed), /LM-003: รายการจองต้องไม่มีเงินรับชำระก่อนจ่ายเงินจริง/)
})

test('legacy loan CSV import rejects mismatched historical balances', () => {
  const malformed = csv.replace('"฿2,200.00",฿700.00,"฿1,500.00"', '"฿2,200.00",฿800.00,"฿1,500.00"')
  assert.throws(() => parseLegacyLoanCsv(malformed), /LM-001: เงินต้น\/ดอกเบี้ยหรือยอดชำระ\/คงเหลือรวมกันไม่ตรง/)
})

test('ledger subtracts imported historic repayments without fake cash entries', () => {
  const balance = contractLedgerBalance({ repaymentSatang: 220_000, status: 'PAID', paidAt: new Date(), legacyReceivedSatang: 70_000 }, [])
  assert.equal(balance.disbursed, true)
  assert.equal(balance.legacyReceivedSatang, 70_000)
  assert.equal(balance.received, 70_000)
  assert.equal(balance.remaining, 150_000)
})
