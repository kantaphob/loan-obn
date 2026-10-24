export type LegacyLoanRow = {
  sourceCode: string
  sourceBorrowerId: string
  borrowerName: string
  principalSatang: number
  interestPercent: number
  interestSatang: number
  loanDate: string
  dueDate: string
  overdueDays: number
  overdueSatang: number
  overdueWaived: boolean
  totalSatang: number
  receivedSatang: number
  remainingSatang: number
  sourceStatus: string
  closedAt: string | null
  note: string
  sourceRow: number
  reservation: boolean
}

const requiredHeaders = ['เลขที่สัญญา', 'ID', 'ชื่อผู้กู้', 'ยอดเงินกู้ (บาท)', 'ร้อยละ%', 'ยอดดอกเบี้ย', 'วันที่กู้ยืม', 'วันครบกำหนด', 'ระยะเกินกำหนด', 'เกินกำหนด', 'ยกเว้นเกินกำหนด', 'ยอดที่ต้องชำระคืนรวม', 'ยอดที่ชำระมาแล้ว', 'ยอดหนี้คงเหลือ', 'สถานะการชำระ', 'ปิดยอดเมื่อ', 'หมายเหตุ']

function parseCsv(text: string) {
  const rows: string[][] = []
  let row: string[] = [], cell = '', quoted = false
  for (let index = 0; index < text.length; index++) {
    const char = text[index]
    if (quoted) {
      if (char === '"' && text[index + 1] === '"') { cell += '"'; index++ }
      else if (char === '"') quoted = false
      else cell += char
    } else if (char === '"' && cell.length === 0) quoted = true
    else if (char === ',') { row.push(cell); cell = '' }
    else if (char === '\n' || char === '\r') {
      if (char === '\r' && text[index + 1] === '\n') index++
      row.push(cell); rows.push(row); row = []; cell = ''
    } else cell += char
  }
  if (quoted) throw new Error('รูปแบบ CSV ไม่ถูกต้อง: มีเครื่องหมายอัญประกาศที่ไม่ปิด')
  if (cell.length || row.length) { row.push(cell); rows.push(row) }
  return rows
}

function date(value: string, label: string, sourceCode: string) {
  const trimmed = value.trim()
  const match = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(trimmed)
  const iso = /^\d{4}-\d{2}-\d{2}$/.test(trimmed) ? trimmed : match ? `${match[3]}-${match[2].padStart(2, '0')}-${match[1].padStart(2, '0')}` : ''
  if (!iso || !Number.isFinite(Date.parse(`${iso}T00:00:00Z`)) || new Date(`${iso}T00:00:00Z`).toISOString().slice(0, 10) !== iso) throw new Error(`${sourceCode}: วันที่ ${label} ไม่ถูกต้อง`)
  return iso
}

function money(value: string, label: string, sourceCode: string) {
  const cleaned = value.replace(/[฿,\s]/g, '')
  if (!/^\d+(?:\.\d{1,2})?$/.test(cleaned)) throw new Error(`${sourceCode}: จำนวน${label}ไม่ถูกต้อง`)
  const satang = Math.round(Number(cleaned) * 100)
  if (!Number.isSafeInteger(satang) || satang < 0 || satang > 200_000_000_000) throw new Error(`${sourceCode}: จำนวน${label}เกินขอบเขต`)
  return satang
}

export function parseLegacyLoanCsv(input: string) {
  if (typeof input !== 'string' || input.length > 2_000_000) throw new Error('ไฟล์ CSV มีขนาดเกินกำหนด')
  const rows = parseCsv(input.replace(/^\uFEFF/, ''))
  const headers = rows.shift()?.map(value => value.trim()) ?? []
  if (requiredHeaders.some(header => !headers.includes(header))) throw new Error('หัวตาราง CSV ไม่ครบหรือไม่ตรงกับรายการสัญญาเก่า')
  const index = new Map(headers.map((header, i) => [header, i]))
  const records: LegacyLoanRow[] = [], skipped: { sourceCode: string; reason: string; sourceRow: number }[] = []
  const seen = new Set<string>()
  for (let rowIndex = 0; rowIndex < rows.length; rowIndex++) {
    const cells = rows[rowIndex]
    const field = (header: string) => (cells[index.get(header)!] ?? '').trim()
    const sourceCode = field('เลขที่สัญญา')
    if (!sourceCode) continue
    if (seen.has(sourceCode)) throw new Error(`${sourceCode}: เลขรายการซ้ำในไฟล์`)
    seen.add(sourceCode)
    const sourceRow = rowIndex + 2
    const sourceStatus = field('สถานะการชำระ')
    const reservation = sourceStatus === 'จองสัญญา'
    const borrowerName = field('ชื่อผู้กู้')
    if (!borrowerName || !field('ID')) throw new Error(`${sourceCode}: ไม่มีชื่อหรือรหัสผู้กู้`)
    const principalSatang = money(field('ยอดเงินกู้ (บาท)'), 'เงินต้น', sourceCode)
    const interestSatang = money(field('ยอดดอกเบี้ย'), 'ดอกเบี้ย', sourceCode)
    const totalSatang = money(field('ยอดที่ต้องชำระคืนรวม'), 'ยอดรวม', sourceCode)
    const receivedSatang = money(field('ยอดที่ชำระมาแล้ว'), 'ยอดชำระแล้ว', sourceCode)
    const remainingSatang = money(field('ยอดหนี้คงเหลือ'), 'หนี้คงเหลือ', sourceCode)
    const interestPercent = Number(field('ร้อยละ%').replace('%', '').trim())
    const overdueDays = Number(field('ระยะเกินกำหนด'))
    if (!Number.isFinite(interestPercent) || interestPercent < 0 || interestPercent > 100) throw new Error(`${sourceCode}: อัตราดอกเบี้ยไม่ถูกต้อง`)
    if (!Number.isInteger(overdueDays) || overdueDays < 0) throw new Error(`${sourceCode}: จำนวนวันเกินกำหนดไม่ถูกต้อง`)
    if (principalSatang + interestSatang !== totalSatang || receivedSatang + remainingSatang !== totalSatang) throw new Error(`${sourceCode}: เงินต้น/ดอกเบี้ยหรือยอดชำระ/คงเหลือรวมกันไม่ตรงกับยอดรวม`)
    if (!sourceStatus) throw new Error(`${sourceCode}: ไม่มีสถานะการชำระ`)
    const loanDate = date(field('วันที่กู้ยืม'), 'กู้ยืม', sourceCode)
    const dueDate = date(field('วันครบกำหนด'), 'ครบกำหนด', sourceCode)
    if (dueDate < loanDate) throw new Error(`${sourceCode}: วันครบกำหนดก่อนวันกู้ยืม`)
    const closedAt = field('ปิดยอดเมื่อ') ? date(field('ปิดยอดเมื่อ'), 'ปิดยอด', sourceCode) : null
    if (!reservation && (sourceStatus === 'ปิดยอด') !== (remainingSatang === 0)) throw new Error(`${sourceCode}: สถานะปิดยอดไม่ตรงกับยอดหนี้คงเหลือ`)
    if (reservation && receivedSatang > 0) throw new Error(`${sourceCode}: รายการจองต้องไม่มีเงินรับชำระก่อนจ่ายเงินจริง`)
    records.push({ sourceCode, sourceBorrowerId: field('ID'), borrowerName, principalSatang, interestPercent, interestSatang, loanDate, dueDate, overdueDays, overdueSatang: money(field('เกินกำหนด'), 'ยอดเกินกำหนด', sourceCode), overdueWaived: ['TRUE', '1', 'YES'].includes(field('ยกเว้นเกินกำหนด').toUpperCase()), totalSatang, receivedSatang, remainingSatang, sourceStatus, closedAt, note: field('หมายเหตุ'), sourceRow, reservation })
  }
  if (!records.length) throw new Error('ไม่พบรายการกู้ที่นำเข้าได้ใน CSV')
  return { records, skipped }
}
