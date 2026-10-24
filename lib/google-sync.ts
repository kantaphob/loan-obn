import 'server-only'

import { prisma } from '@/lib/prisma'
import { contractCode } from '@/lib/contracts'
import { contractLedgerBalance } from '@/lib/ledger'
import { archiveGoogleLedgerFile, isGoogleBridgeConfigured, reportGoogleSyncError, syncGoogleSheetRows, thaiYear, type GoogleSheetRow } from '@/lib/google-integration'

const baht = (satang: number) => Math.round(satang) / 100
const thaiDate = (value: Date | string | null | undefined) => {
  if (!value) return ''
  const date = value instanceof Date ? value : new Date(value)
  return Number.isFinite(date.getTime()) ? date.toLocaleDateString('th-TH', { timeZone: 'Asia/Bangkok' }) : String(value)
}
const borrowerCode = (id: number, code?: string | null) => code || `BR-${String(id).padStart(5, '0')}`
const transactionCode = (id: number) => `TX-${String(id).padStart(6, '0')}`
const contractStatus: Record<string, string> = {
  WAITING_PAYMENT: 'รอรับยอด', PAID: 'รอส่งคืน', CLOSED: 'ปิดยอด', OVERDUE: 'เกินกำหนดชำระ',
  RESERVED: 'จองสัญญา', REVIEW: 'พิจารณา', REJECTED: 'ไม่อนุมัติ',
}

function cleanCardData(value: string | null) {
  if (!value) return ''
  try {
    const parsed = JSON.parse(value) as Record<string, unknown>
    delete parsed.photo
    delete parsed.photoData
    return JSON.stringify(parsed)
  } catch { return '' }
}

export async function googleBorrowerRow(id: number): Promise<GoogleSheetRow | null> {
  const borrower = await prisma.borrower.findUnique({ where: { id } })
  if (!borrower) return null
  const [province, district, subdistrict, bank, risk, channel] = await Promise.all([
    borrower.provinceId ? prisma.province.findUnique({ where: { id: borrower.provinceId }, select: { nameTh: true } }) : null,
    borrower.districtId ? prisma.district.findUnique({ where: { id: borrower.districtId }, select: { nameTh: true } }) : null,
    borrower.subdistrictId ? prisma.subdistrict.findUnique({ where: { id: borrower.subdistrictId }, select: { nameTh: true, postcodeCode: true } }) : null,
    borrower.bankCode ? prisma.bank.findUnique({ where: { code: borrower.bankCode }, select: { nameTh: true } }) : null,
    borrower.riskRatingCode ? prisma.riskRating.findUnique({ where: { code: borrower.riskRatingCode }, select: { nameTh: true } }) : null,
    borrower.paymentChannelCode ? prisma.paymentChannel.findUnique({ where: { code: borrower.paymentChannelCode }, select: { nameTh: true } }) : null,
  ])
  const row: GoogleSheetRow = {
    sheetName: 'ผู้กู้', keyHeader: 'ID ระบบ', keyValue: String(id), values: {
      'ปีที่สมัคร (พ.ศ.)': thaiYear(borrower.registeredAt), 'รหัสผู้กู้': borrowerCode(id, borrower.borrowerId), 'ID ระบบ': id,
      'ชื่อเล่น': borrower.nickname, 'คำนำหน้าชื่อ (ไทย)': borrower.titleTh, 'ชื่อ (ไทย)': borrower.firstName,
      'ชื่อกลาง (ไทย)': borrower.middleNameTh, 'นามสกุล (ไทย)': borrower.lastName, 'คำนำหน้าชื่อ (อังกฤษ)': borrower.titleEn,
      'ชื่อ (อังกฤษ)': borrower.firstNameEn, 'ชื่อกลาง (อังกฤษ)': borrower.middleNameEn, 'นามสกุล (อังกฤษ)': borrower.lastNameEn,
      'วันเกิด': borrower.birthDate, 'เลขบัตรประชาชน': borrower.nationalId, 'ที่อยู่': borrower.address,
      'บ้านเลขที่': borrower.houseNumber, 'หมู่ที่': borrower.villageNumber, 'จังหวัด ID': borrower.provinceId,
      'อำเภอ ID': borrower.districtId, 'ตำบล ID': borrower.subdistrictId, 'วันที่ออกบัตร': borrower.cardIssueDate,
      'วันหมดอายุบัตร': borrower.cardExpiryDate, 'อ่านบัตรเมื่อ': thaiDate(borrower.cardReadAt), 'เบอร์โทร': borrower.phone,
      'ที่ทำงาน': borrower.workplace, 'สถานะ': borrower.status, 'รหัสธนาคาร': borrower.bankCode,
      'เลขบัญชี': borrower.bankAccount, 'ชื่อบัญชี': borrower.bankAccountName, 'ประเภทพร้อมเพย์': borrower.promptPayType,
      'หมายเลขพร้อมเพย์': borrower.promptPayNumber, 'ช่องทางชำระเงิน': borrower.paymentChannelCode,
      'วันที่สมัคร': thaiDate(borrower.registeredAt), 'ระยะเวลา (เดือน)': borrower.durationMonths,
      Facebook: borrower.facebook, Instagram: borrower.instagram, LINE: borrower.line,
      'ระดับความเสี่ยง': risk?.nameTh || borrower.riskRatingCode, 'วงเงินอนุมัติ': borrower.approvedLimit,
      'วงเงินใช้แล้ว': borrower.usedLimit, 'ผู้แนะนำ': borrower.referrer, 'สร้างเมื่อ': thaiDate(borrower.createdAt),
      'ปรับปรุงล่าสุด': thaiDate(borrower.updatedAt), 'ข้อมูลอ่านบัตร (JSON ไม่รวมภาพ)': cleanCardData(borrower.cardData),
    },
  }
  // Resolve names for operators while keeping the sheet's IDs as the primary values.
  Object.assign(row.values!, {
    'จังหวัด': province?.nameTh, 'อำเภอ': district?.nameTh, 'ตำบล': subdistrict?.nameTh,
    'รหัสไปรษณีย์': subdistrict?.postcodeCode, 'ธนาคาร': bank?.nameTh, 'ช่องทางชำระเงิน (ชื่อ)': channel?.nameTh,
  })
  return row
}

export async function googleContractRow(id: number): Promise<GoogleSheetRow | null> {
  const contract = await prisma.loanContract.findUnique({ where: { id }, include: { borrower: true, ledgerEntries: { where: { voidedAt: null } } } })
  if (!contract) return null
  const balance = contractLedgerBalance(contract, contract.ledgerEntries)
  const code = contractCode(id)
  return {
    sheetName: 'สัญญากู้', keyHeader: 'รหัสสัญญา', keyValue: code, values: {
      'ปีสัญญา (พ.ศ.)': thaiYear(contract.createdAt), 'รหัสสัญญา': code,
      'รหัสผู้กู้': borrowerCode(contract.borrowerId, contract.borrower.borrowerId), 'ชื่อผู้กู้': contract.borrowerName,
      'ผู้ให้กู้': contract.lenderName, 'วันที่ทำสัญญา': thaiDate(contract.createdAt),
      'เงินต้น': baht(contract.principalSatang), 'อัตราดอกเบี้ย': `${contract.interestPercent}%`,
      'ระยะเวลา': contract.borrower.durationMonths, 'วันครบกำหนด': contract.repaymentDueDate || '',
      'ยอดคงเหลือ': baht(balance.remaining), 'สถานะสัญญา': contractStatus[contract.status] || contract.status,
      'สร้างเมื่อ': thaiDate(contract.createdAt), 'ปรับปรุงล่าสุด': thaiDate(contract.paidAt || contract.createdAt),
    },
  }
}

export async function googleLedgerRows(id: number): Promise<GoogleSheetRow[]> {
  const entry = await prisma.ledgerEntry.findUnique({ where: { id }, include: { slip: true, contract: { include: { borrower: true } }, payable: true } })
  if (!entry) return []
  const user = await prisma.user.findUnique({ where: { id: entry.createdBy }, select: { acccode: true, userprofile: { select: { firstName: true, lastName: true } } } })
  const entryCode = transactionCode(entry.id)
  const name = [user?.userprofile?.firstName, user?.userprofile?.lastName].filter(Boolean).join(' ') || user?.acccode || entry.createdBy
  const contractId = entry.contractId ? contractCode(entry.contractId) : ''
  const borrower = entry.contract?.borrower
  let slipUrl = ''
  if (entry.slip) {
    {
      const archived = await archiveGoogleLedgerFile({
        entryCode, fileType: 'slip', originalName: entry.slip.originalName, mimeType: entry.slip.mimeType,
        createdAt: entry.createdAt, bytes: entry.slip.fileData,
      })
      slipUrl = archived?.fileUrl || ''
    }
  }
  const details = [entry.note, entry.reference && `อ้างอิง ${entry.reference}`, entry.voidReason && `ยกเลิก: ${entry.voidReason}`].filter(Boolean).join(' | ')
  const values = {
    'ปี (พ.ศ.)': thaiYear(entry.occurredOn), 'รหัสรายการ': entryCode, 'วันที่': entry.occurredOn,
    'ประเภท (รับ/จ่าย)': entry.direction === 'IN' ? 'รับ' : 'จ่าย', 'หมวดหมู่': entry.categoryName,
    'รายละเอียด': details, 'รหัสผู้กู้': borrower ? borrowerCode(borrower.id, borrower.borrowerId) : '',
    'รหัสสัญญา': contractId, 'ช่องทางชำระ': entry.channelName, 'จำนวนเงิน': baht(entry.amountSatang),
    'ลิงก์สลิป/เอกสาร': slipUrl, 'สถานะ': entry.voidedAt ? 'ยกเลิก' : entry.kind === 'REPAYMENT' ? 'รับชำระแล้ว' : 'บันทึกแล้ว',
    'บันทึกโดย': name, 'บันทึกเมื่อ': thaiDate(entry.createdAt),
  }
  const rows: GoogleSheetRow[] = [{ sheetName: 'รับ-จ่าย', keyHeader: 'รหัสรายการ', keyValue: entryCode, values }]
  if (entry.kind !== 'GENERAL') rows.push({
    sheetName: 'สลิปโอน', keyHeader: 'รหัสรายการ', keyValue: entryCode, values: {
      'ปี (พ.ศ.)': thaiYear(entry.occurredOn), 'รหัสผู้กู้': borrower ? borrowerCode(borrower.id, borrower.borrowerId) : '',
      'รหัสสัญญา': contractId, 'รหัสรายการ': entryCode, 'ชื่อผู้กู้': entry.contract?.borrowerName || '',
      'วันที่โอน': entry.occurredOn, 'ประเภทรายการ': entry.kind === 'DISBURSEMENT' ? 'ปล่อยกู้' : 'รับชำระ',
      'จำนวนเงิน': baht(entry.amountSatang), 'ธนาคาร/ช่องทาง': entry.channelName, 'เลขอ้างอิง': entry.reference,
      'ลิงก์ไฟล์สลิป': slipUrl, 'สถานะตรวจสอบ': entry.voidedAt ? 'ยกเลิก' : 'บันทึกแล้ว',
      'บันทึกโดย': name, 'บันทึกเมื่อ': thaiDate(entry.createdAt),
    },
  })
  return rows
}

export async function syncGoogleBorrower(id: number) { await enqueueGoogleSync('borrower', id) }
export async function syncGoogleContract(id: number) { await enqueueGoogleSync('contract', id) }
export async function syncGoogleLedger(id: number) { await enqueueGoogleSync('ledger', id) }

export async function allGoogleRows() {
  const [borrowers, contracts, ledgerIds] = await Promise.all([
    prisma.borrower.findMany({ select: { id: true }, orderBy: { id: 'asc' } }),
    prisma.loanContract.findMany({ select: { id: true }, orderBy: { id: 'asc' } }),
    prisma.ledgerEntry.findMany({ select: { id: true }, orderBy: { id: 'asc' } }),
  ])
  const rows: GoogleSheetRow[] = []
  for (const borrower of borrowers) { const row = await googleBorrowerRow(borrower.id); if (row) rows.push(row) }
  for (const contract of contracts) { const row = await googleContractRow(contract.id); if (row) rows.push(row) }
  for (const entry of ledgerIds) rows.push(...await googleLedgerRows(entry.id))
  return rows
}


type SyncEntity = 'borrower' | 'contract' | 'ledger'
const workerState = globalThis as unknown as { googleSyncRunning?: Promise<void>; googleSyncTimer?: ReturnType<typeof setInterval> }

export async function enqueueGoogleSync(entity: SyncEntity, entityId: number) {
  await prisma.googleSyncJob.upsert({
    where: { id: `${entity}:${entityId}` },
    create: { id: `${entity}:${entityId}`, entity, entityId },
    update: { version: { increment: 1 }, status: 'PENDING', attempts: 0, lastError: '', nextAttemptAt: new Date() },
  })
}

export async function processGoogleSyncQueue(limit = 10) {
  if (!isGoogleBridgeConfigured()) return
  if (workerState.googleSyncRunning) return workerState.googleSyncRunning
  workerState.googleSyncRunning = (async () => {
    const now = new Date(), expired = new Date(now.getTime() - 120_000)
    const jobs = await prisma.googleSyncJob.findMany({ where: { OR: [
      { status: { in: ['PENDING', 'FAILED'] }, nextAttemptAt: { lte: now } },
      { status: 'PROCESSING', lastAttemptAt: { lte: expired } },
    ] }, orderBy: { nextAttemptAt: 'asc' }, take: limit })
    for (const job of jobs) {
      const claimed = await prisma.googleSyncJob.updateMany({ where: { id: job.id, version: job.version, status: job.status, ...(job.status === 'PROCESSING' ? { lastAttemptAt: { lte: expired } } : {}) }, data: { status: 'PROCESSING', lastAttemptAt: new Date(), attempts: { increment: 1 } } })
      if (!claimed.count) continue
      try {
        const rows = job.entity === 'ledger' ? await googleLedgerRows(job.entityId) : [job.entity === 'contract' ? await googleContractRow(job.entityId) : await googleBorrowerRow(job.entityId)].filter((row): row is GoogleSheetRow => row !== null)
        if (rows.length && !(await syncGoogleSheetRows(rows)).length) throw new Error('Google bridge unavailable')
        await prisma.googleSyncJob.updateMany({ where: { id: job.id, version: job.version, status: 'PROCESSING' }, data: { status: 'SYNCED', syncedAt: new Date(), lastError: '' } })
      } catch (error) {
        reportGoogleSyncError(job.id, error)
        await prisma.googleSyncJob.updateMany({ where: { id: job.id, version: job.version, status: 'PROCESSING' }, data: { status: 'FAILED', lastError: 'ส่งข้อมูลไม่สำเร็จ กรุณาตรวจสอบการเชื่อมต่อ Google', nextAttemptAt: new Date(Date.now() + Math.min(900_000, 30_000 * 2 ** Math.min(job.attempts, 5))) } })
      }
    }
  })().finally(() => { workerState.googleSyncRunning = undefined })
  return workerState.googleSyncRunning
}

export function startGoogleSyncWorker() {
  if (workerState.googleSyncTimer || process.env.LOAN_DISABLE_SIDE_EFFECTS === '1') return
  const tick = () => { void processGoogleSyncQueue().catch(error => reportGoogleSyncError('worker', error)) }
  workerState.googleSyncTimer = setInterval(tick, 30_000)
  workerState.googleSyncTimer.unref()
  tick()
}

export async function googleSyncStatus() {
  const groups = await prisma.googleSyncJob.groupBy({ by: ['status'], _count: { _all: true } })
  const counts = Object.fromEntries(groups.map(group => [group.status, group._count._all]))
  const last = await prisma.googleSyncJob.findFirst({ where: { syncedAt: { not: null } }, orderBy: { syncedAt: 'desc' }, select: { syncedAt: true } })
  const failures = await prisma.googleSyncJob.findMany({ where: { status: 'FAILED' }, orderBy: { updatedAt: 'desc' }, take: 5, select: { id: true, lastError: true, attempts: true } })
  return { configured: isGoogleBridgeConfigured(), pending: (counts.PENDING ?? 0) + (counts.PROCESSING ?? 0), failed: counts.FAILED ?? 0, synced: counts.SYNCED ?? 0, lastSyncedAt: last?.syncedAt?.toISOString() ?? null, failures }
}

export async function enqueueAllGoogleSync() {
  const [borrowers, contracts, entries] = await Promise.all([
    prisma.borrower.findMany({ select: { id: true } }), prisma.loanContract.findMany({ select: { id: true } }), prisma.ledgerEntry.findMany({ select: { id: true } }),
  ])
  for (const b of borrowers) await syncGoogleBorrower(b.id)
  for (const c of contracts) await syncGoogleContract(c.id)
  for (const e of entries) await syncGoogleLedger(e.id)
  return borrowers.length + contracts.length + entries.length
}
