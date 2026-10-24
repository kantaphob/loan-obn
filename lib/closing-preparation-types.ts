export const checklistLabels = {
  documents: 'รวบรวมสัญญา สลิป และเอกสารประกอบครบ',
  cashBank: 'ตรวจเงินสดและเงินฝากเทียบ Statement',
  receivablesPayables: 'ตรวจลูกหนี้และเจ้าหนี้กับเอกสาร',
  inventory: 'ตรวจสินค้าคงเหลือ (ถ้ามี)',
  fixedAssets: 'ตรวจทรัพย์สินและค่าเสื่อมราคา (ถ้ามี)',
  adjustments: 'ตรวจรายการค้างรับ–ค้างจ่ายและรายการปรับปรุง',
} as const
export type ChecklistKey = keyof typeof checklistLabels
export type Checklist = Record<ChecklistKey, { status: 'PENDING' | 'DONE' | 'NA'; note: string }>
export const emptyChecklist = (): Checklist => Object.fromEntries(Object.keys(checklistLabels).map(key => [key, { status: 'PENDING', note: '' }])) as Checklist
export type ClosingDocumentInfo = { sourceKey: string; category: string; name: string; url: string; available: boolean; archived: boolean; sha256?: string; sizeBytes?: number }
