import { createHash } from 'node:crypto'
import type { Prisma } from '@/generated/prisma/client'
import { monthRange } from './accounting-period'
import { contractCode, contractDocumentSignaturesComplete } from './contracts'
import { createLoanAgreementPdf } from './loan-agreement-pdf'

import { checklistLabels, type Checklist, type ChecklistKey, type ClosingDocumentInfo } from './closing-preparation-types'
export { checklistLabels, emptyChecklist, type Checklist, type ChecklistKey, type ClosingDocumentInfo } from './closing-preparation-types'
export function validateChecklist(value: Checklist, completed = false) {
  if (!value || typeof value !== 'object') throw new Error('ข้อมูลรายการตรวจสอบไม่ถูกต้อง')
  for (const key of Object.keys(checklistLabels) as ChecklistKey[]) {
    const row = value[key]
    if (!row || !['PENDING', 'DONE', 'NA'].includes(row.status) || typeof row.note !== 'string' || row.note.length > 1000) throw new Error('ข้อมูลรายการตรวจสอบไม่ถูกต้อง')
    if (row.status === 'NA' && !row.note.trim()) throw new Error('กรุณาระบุเหตุผลสำหรับรายการที่ไม่เกี่ยวข้อง')
    if (completed && row.status === 'PENDING') throw new Error('กรุณาตรวจรายการเตรียมเอกสารให้ครบก่อนปิดเดือน')
  }
  return Object.fromEntries((Object.keys(checklistLabels) as ChecklistKey[]).map(key => [key, { status: value[key].status, note: value[key].note.trim() }])) as Checklist
}

export async function closingDocuments(tx: Prisma.TransactionClient, month: string): Promise<ClosingDocumentInfo[]> {
  const range = monthRange(month)
  const archived = await tx.accountingDocument.findMany({ where: { month }, orderBy: { id: 'asc' }, select: { id: true, sourceKey: true, category: true, originalName: true, sha256: true, sizeBytes: true } })
  const uploaded = archived.map(d => ({ sourceKey: d.sourceKey, category: d.category, name: d.originalName, sha256: d.sha256, sizeBytes: d.sizeBytes, url: `/api/accounting/documents/${d.id}`, available: true, archived: true }))
  if (await tx.accountingMonthLock.findUnique({ where: { month }, select: { id: true } })) return uploaded
  const dateFilter = { gte: range.startOn, lte: range.endOn }
  const contracts = await tx.loanContract.findMany({
    where: { OR: [{ createdAt: { gte: new Date(`${range.startOn}T00:00:00+07:00`), lt: new Date(Date.parse(`${range.endOn}T00:00:00+07:00`) + 86400000) } }, { paidAt: { gte: new Date(`${range.startOn}T00:00:00+07:00`), lt: new Date(Date.parse(`${range.endOn}T00:00:00+07:00`) + 86400000) } }, { ledgerEntries: { some: { occurredOn: dateFilter } } }] },
    include: { borrower: { include: { province: true } }, lender: true, witnesses: true, documentSignatures: true, collateralAttachments: { select: { id: true, originalName: true, sha256: true, sizeBytes: true } } },
    orderBy: { id: 'asc' },
  })
  const slips = await tx.ledgerEntry.findMany({ where: { occurredOn: dateFilter, slip: { isNot: null } }, select: { id: true, voidedAt: true, slip: { select: { originalName: true, sizeBytes: true } } }, orderBy: { id: 'asc' } })
  const sources: ClosingDocumentInfo[] = slips.map(e => ({ sourceKey: `slip:${e.id}`, category: e.voidedAt ? 'VOIDED_SLIP' : 'SLIP', name: `TX-${e.id} · ${e.slip!.originalName}${e.voidedAt ? ' (ยกเลิกแล้ว)' : ''}`, url: `/api/repayments/${e.id}/slip`, sizeBytes: e.slip!.sizeBytes, available: true, archived: false }))
  for (const contract of contracts) {
    const available = contract.documentChoice === 'CREATE' && (contract.signingMethod !== 'E_SIGNATURE' || contractDocumentSignaturesComplete(contract, 'LOAN'))
    sources.push({ sourceKey: `contract:${contract.id}`, category: 'CONTRACT', name: `${contractCode(contract.id)} · ${available ? 'แบบสัญญากู้จากระบบ' : 'ข้อมูลสัญญา (ตรวจเอกสารต้นฉบับประกอบ)'}`, url: available ? `/api/contracts/${contract.id}/document` : '/dashboard/contracts', sha256: createHash('sha256').update(JSON.stringify(contract)).digest('hex'), available, archived: false })
    for (const file of contract.collateralAttachments) sources.push({ sourceKey: `attachment:${file.id}`, category: 'CONTRACT_ATTACHMENT', name: `${contractCode(contract.id)} · ${file.originalName}`, url: `/api/contracts/${contract.id}/collateral-attachments/${file.id}`, sha256: file.sha256, sizeBytes: file.sizeBytes, available: true, archived: false })
  }
  const byKey = new Map([...sources, ...uploaded].map(d => [d.sourceKey, d]))
  return [...byKey.values()].sort((a, b) => a.sourceKey.localeCompare(b.sourceKey))
}
export async function captureClosingDocuments(tx: Prisma.TransactionClient, month: string, userId: string) {
  const manifest = await closingDocuments(tx, month)
  let total = manifest.reduce((sum, doc) => sum + (doc.archived ? doc.sizeBytes ?? 0 : 0), 0)
  for (const doc of manifest) {
    if (doc.archived) continue
    const [kind, value] = doc.sourceKey.split(':')
    const id = Number(value)
    let bytes: Uint8Array, mimeType: string, originalName: string
    if (kind === 'slip') {
      const file = await tx.ledgerSlip.findUniqueOrThrow({ where: { entryId: id } })
      bytes = file.fileData; mimeType = file.mimeType; originalName = `TX-${id}-${file.originalName}`
    } else if (kind === 'attachment') {
      const file = await tx.contractCollateralAttachment.findUniqueOrThrow({ where: { id } })
      bytes = file.fileData; mimeType = file.mimeType; originalName = file.originalName
    } else {
      const contract = await tx.loanContract.findUniqueOrThrow({ where: { id }, include: { witnesses: true, documentSignatures: true, borrower: { include: { province: true } }, lender: true, ledgerEntries: { where: { kind: 'DISBURSEMENT', voidedAt: null }, select: { id: true } } } })
      if (!doc.available) {
        bytes = new TextEncoder().encode(JSON.stringify(contract, null, 2)); mimeType = 'application/json'; originalName = `${contractCode(id)}-ข้อมูลสัญญา.json`
      } else {
        const borrower = contract.borrower
        const district = borrower.districtId ? await tx.district.findUnique({ where: { id: borrower.districtId }, select: { nameTh: true } }) : null
        const subdistrict = borrower.subdistrictId ? await tx.subdistrict.findUnique({ where: { id: borrower.subdistrictId }, select: { nameTh: true } }) : null
        bytes = await createLoanAgreementPdf({ ...contract, code: contractCode(id), address: borrower.address, houseNumber: borrower.houseNumber, birthDate: borrower.birthDate, borrowerNationalId: borrower.nationalId, lenderNationalId: contract.lender.nationalId, lenderAddress: contract.lender.address, province: borrower.province?.nameTh ?? '', district: district?.nameTh ?? '', subdistrict: subdistrict?.nameTh ?? '', fundsReceived: contract.ledgerEntries.length > 0 })
        mimeType = 'application/pdf'; originalName = `${contractCode(id)}-สัญญากู้.pdf`
      }
    }
    total += bytes.length
    if (total > 100 * 1024 * 1024) throw new Error('ชุดเอกสารเดือนนี้เกิน 100 MB กรุณาตรวจไฟล์ก่อนปิดยอด')
    await tx.accountingDocument.create({ data: { requestKey: `snapshot:${month}:${doc.sourceKey}`, month, sourceKey: doc.sourceKey, category: doc.category, originalName: originalName.slice(0, 240), mimeType, sizeBytes: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex'), fileData: new Uint8Array(bytes), createdBy: userId } })
  }
  return closingDocuments(tx, month)
}
