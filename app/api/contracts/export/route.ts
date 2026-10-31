import ExcelJS from 'exceljs'
import { NextRequest } from 'next/server'
import { getCurrentUser } from '@/lib/auth/current-user'
import { prisma } from '@/lib/prisma'
import { contractCode } from '@/lib/contracts'
import { lenderCode } from '@/lib/lender'

function getPeriodParts(value: Date | string) {
  const date = new Date(value)
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Bangkok', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(date)
  return {
    year: Number(parts.find(part => part.type === 'year')?.value),
    month: Number(parts.find(part => part.type === 'month')?.value),
    day: Number(parts.find(part => part.type === 'day')?.value),
  }
}

function excelDate(value: Date | string | null | undefined) {
  if (!value) return null
  const { year, month, day } = getPeriodParts(value)
  return new Date(Date.UTC(year, month - 1, day))
}

function sourceStatus(details: string | null) {
  try { return (JSON.parse(details ?? '{}') as { sourceStatus?: string }).sourceStatus ?? '' } catch { return '' }
}

function signatureLabel(row: { legacySourceCode: string | null; documentChoice: string; signingMethod: string | null; witnessCount: number; borrowerSignedAt: Date | null; lenderSignedAt: Date | null }) {
  if (row.legacySourceCode) return 'รายการย้อนหลัง · ไม่มีเอกสาร'
  if (row.documentChoice !== 'CREATE') return 'ไม่ทำสัญญา'
  if (row.signingMethod !== 'E_SIGNATURE') return 'ทำสัญญา · พิมพ์เซ็น'
  return row.borrowerSignedAt && row.lenderSignedAt ? 'ทำสัญญา · ลงนามครบ' : 'ทำสัญญา · รอลงนาม'
}

export async function GET(request: NextRequest) {
  const user = await getCurrentUser()
  if (!user || user.status !== 'ACTIVE') return Response.json({ error: 'ไม่มีสิทธิ์ส่งออกรายการสัญญา' }, { status: 403 })

  const params = request.nextUrl.searchParams
  const period = params.get('period') ?? 'ALL'
  const year = Number(params.get('year'))
  const month = Number(params.get('month'))
  if (!['ALL', 'YEAR', 'MONTH'].includes(period)) return Response.json({ error: 'ช่วงเวลาส่งออกไม่ถูกต้อง' }, { status: 400 })
  if (period !== 'ALL' && (!Number.isInteger(year) || year < 1900 || year > 2200)) return Response.json({ error: 'กรุณาเลือกปีที่ถูกต้อง' }, { status: 400 })
  if (period === 'MONTH' && (!Number.isInteger(month) || month < 1 || month > 12)) return Response.json({ error: 'กรุณาเลือกเดือนที่ถูกต้อง' }, { status: 400 })

  const rows = await prisma.loanContract.findMany({
    select: {
      id: true, createdAt: true, legacySourceCode: true, legacyDetails: true,
      borrowerCode: true, borrowerName: true, lenderId: true, lenderName: true,
      principalSatang: true, internalInterestPercent: true, interestSatang: true,
      interestMethod: true, netSatang: true, repaymentSatang: true,
      scheduledDisbursementDate: true, repaymentDueDate: true, paidAt: true, status: true,
      limitApprovalRequired: true, limitApprovedAt: true, limitApprovedBy: true,
      documentChoice: true, signingMethod: true, documentPackage: true,
      witnessCount: true, guaranteeWitnessCount: true,
      borrowerSignedAt: true, lenderSignedAt: true,
      ledgerEntries: { where: { kind: 'REPAYMENT', voidedAt: null }, select: { occurredOn: true }, orderBy: { occurredOn: 'desc' }, take: 1 },
    },
    orderBy: { id: 'desc' },
  })
  const approverIds = [...new Set(rows.flatMap(row => row.limitApprovedBy ? [row.limitApprovedBy] : []))]
  const approvers = approverIds.length ? await prisma.user.findMany({
    where: { id: { in: approverIds } },
    select: { id: true, acccode: true, userprofile: { select: { firstName: true, lastName: true } } },
  }) : []
  const approverLabels = new Map(approvers.map(approver => [approver.id, [approver.userprofile?.firstName, approver.userprofile?.lastName].filter(Boolean).join(' ') || approver.acccode]))

  const filteredRows = rows.filter(row => {
    if (period === 'ALL') return true
    const contractDate = row.legacySourceCode && row.scheduledDisbursementDate ? row.scheduledDisbursementDate : row.createdAt
    const parts = getPeriodParts(contractDate)
    return parts.year === year && (period === 'YEAR' || parts.month === month)
  })
  const workbook = new ExcelJS.Workbook()
  workbook.creator = 'Loan OBN'
  workbook.created = new Date()
  const sheet = workbook.addWorksheet('รายการสัญญา', { views: [{ rightToLeft: false, state: 'frozen', ySplit: 6 }] })
  const title = 'รายการสัญญาสินเชื่อ'
  const monthTitle = period === 'MONTH' ? new Intl.DateTimeFormat('th-TH', { month: 'long', timeZone: 'Asia/Bangkok' }).format(new Date(Date.UTC(year, month - 1, 1))) : ''
  const periodTitle = period === 'ALL' ? 'ช่วงข้อมูล: ทั้งหมด' : period === 'YEAR' ? `ช่วงข้อมูล: ปี ${year + 543}` : `ช่วงข้อมูล: ${monthTitle} ${year + 543}`
  const headers = [
    'รหัสสัญญา', 'วันที่ทำสัญญา', 'รหัสรายการเดิม', 'รหัสผู้กู้', 'ชื่อผู้กู้', 'รหัสผู้ให้กู้', 'ชื่อผู้ให้กู้',
    'เงินต้น (บาท)', 'อัตราอ้างอิงภายในต่อเดือน (%)', 'ดอกเบี้ยระบบ (บาท)', 'วิธีจ่ายเงิน', 'หักดอกเบี้ยก่อนจ่าย (บาท)',
    'ยอดรับเงินจริง (บาท)', 'ยอดชำระคืน (บาท)', 'วันครบกำหนด', 'วันที่จ่ายเงินจริง', 'วันที่ปิดยอด', 'สถานะ',
    'เอกสาร', 'วิธีลงนาม', 'ชุดเอกสาร', 'พยานสัญญากู้', 'พยานสัญญาค้ำ', 'อนุมัติวงเงิน', 'ผู้อนุมัติ', 'วันที่อนุมัติ',
  ]
  sheet.mergeCells(1, 1, 1, headers.length)
  sheet.getCell(1, 1).value = title
  sheet.getCell(1, 1).font = { bold: true, size: 16, color: { argb: 'FF1E293B' } }
  sheet.mergeCells(2, 1, 2, headers.length)
  sheet.getCell(2, 1).value = periodTitle
  sheet.getCell(2, 1).font = { size: 11, color: { argb: 'FF64748B' } }
  sheet.getCell(4, 1).value = 'จำนวนสัญญา'
  sheet.getCell(4, 2).value = filteredRows.length
  sheet.getCell(4, 4).value = 'รวมเงินต้น (บาท)'
  sheet.getCell(4, 5).value = filteredRows.reduce((sum, row) => sum + row.principalSatang, 0) / 100
  sheet.getCell(4, 7).value = 'รวมดอกเบี้ยระบบ (บาท)'
  sheet.getCell(4, 8).value = filteredRows.reduce((sum, row) => sum + row.interestSatang, 0) / 100
  sheet.getCell(4, 10).value = 'รวมยอดรับเงินจริง (บาท)'
  sheet.getCell(4, 11).value = filteredRows.reduce((sum, row) => sum + row.netSatang, 0) / 100
  sheet.getCell(4, 13).value = 'รวมยอดชำระคืน (บาท)'
  sheet.getCell(4, 14).value = filteredRows.reduce((sum, row) => sum + row.repaymentSatang, 0) / 100
  for (const cell of [1, 4, 7, 10, 13]) sheet.getCell(4, cell).font = { bold: true, color: { argb: 'FF334155' } }
  sheet.getRow(6).values = headers
  sheet.getRow(6).height = 30
  sheet.getRow(6).font = { bold: true, color: { argb: 'FFFFFFFF' } }
  sheet.getRow(6).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF334155' } }
  sheet.getRow(6).alignment = { vertical: 'middle', wrapText: true }
  for (const row of filteredRows) {
    const contractDate = row.legacySourceCode && row.scheduledDisbursementDate ? row.scheduledDisbursementDate : row.createdAt
    const approvalStatus = row.limitApprovalRequired ? 'รออนุมัติ' : row.limitApprovedAt ? 'อนุมัติแล้ว' : 'ไม่ต้องอนุมัติ'
    const contractStatus = row.status === 'CANCELLED' ? 'ยกเลิกสัญญา' : row.status === 'REJECTED' ? 'ไม่อนุมัติ' : row.limitApprovalRequired ? 'รออนุมัติวงเงิน' : row.legacySourceCode ? sourceStatus(row.legacyDetails) || 'รายการย้อนหลัง' : row.status === 'WAITING_PAYMENT' ? 'รอจ่ายเงิน' : row.status === 'CLOSED' ? 'ปิดยอดแล้ว' : 'จ่ายเงินแล้ว'
    const documentPackage = ({ LOAN: 'สัญญาเงินกู้', LOAN_GUARANTEE: 'สัญญาเงินกู้และสัญญาค้ำ', LOAN_GUARANTEE_COLLATERAL: 'สัญญาเงินกู้ สัญญาค้ำ และหลักประกัน' } as Record<string, string>)[row.documentPackage ?? ''] ?? '—'
    sheet.addRow([
      contractCode(row.id), excelDate(contractDate), row.legacySourceCode ?? '', row.borrowerCode, row.borrowerName,
      lenderCode(row.lenderId), row.lenderName, row.principalSatang / 100, row.internalInterestPercent,
      row.interestSatang / 100, row.interestMethod === 'INTEREST_UPFRONT' ? 'หักดอกเบี้ยก่อนจ่าย' : 'ไม่หักดอกเบี้ยก่อนจ่าย',
      row.interestMethod === 'INTEREST_UPFRONT' ? row.interestSatang / 100 : 0, row.netSatang / 100,
      row.repaymentSatang / 100, row.repaymentDueDate ? excelDate(row.repaymentDueDate) : null,
      excelDate(row.paidAt), row.status === 'CLOSED' ? excelDate(row.ledgerEntries[0]?.occurredOn) : null,
      contractStatus, row.documentChoice === 'CREATE' ? 'ทำสัญญา' : 'ไม่ทำสัญญ',
      signatureLabel(row), documentPackage, row.documentChoice === 'CREATE' ? row.witnessCount : null,
      row.documentChoice === 'CREATE' && row.documentPackage !== 'LOAN' ? row.guaranteeWitnessCount : null,
      approvalStatus, row.limitApprovedBy ? approverLabels.get(row.limitApprovedBy) ?? 'ผู้ใช้งานเดิม' : '', excelDate(row.limitApprovedAt),
    ])
  }
  sheet.autoFilter = { from: { row: 6, column: 1 }, to: { row: Math.max(6, sheet.rowCount), column: headers.length } }
  for (const row of sheet.getRows(7, filteredRows.length) ?? []) {
    row.eachCell(cell => { cell.alignment = { vertical: 'middle' } })
    for (const column of [2, 15, 16, 17, 26]) row.getCell(column).numFmt = 'dd/mm/yyyy'
    for (const column of [8, 10, 12, 13, 14]) row.getCell(column).numFmt = '#,##0.00'
    row.getCell(9).numFmt = '0.00'
  }
  for (const column of [5, 7, 18, 20, 21, 24, 25]) sheet.getColumn(column).alignment = { vertical: 'middle', wrapText: true }
  const widths = [16, 14, 18, 14, 28, 14, 28, 16, 20, 18, 24, 22, 18, 18, 14, 16, 14, 24, 14, 24, 40, 16, 16, 18, 24, 14]
  widths.forEach((width, index) => { sheet.getColumn(index + 1).width = width })
  sheet.getCell(4, 5).numFmt = '#,##0.00'
  sheet.getCell(4, 8).numFmt = '#,##0.00'
  sheet.getCell(4, 11).numFmt = '#,##0.00'
  sheet.getCell(4, 14).numFmt = '#,##0.00'

  const buffer = await workbook.xlsx.writeBuffer()
  const filename = `contracts-${period === 'ALL' ? 'all' : period === 'YEAR' ? year : `${year}-${String(month).padStart(2, '0')}`}.xlsx`
  return new Response(new Uint8Array(buffer), {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'no-store',
    },
  })
}
