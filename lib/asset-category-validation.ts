export type AssetCategoryInput = { nameTh: string; nameEn: string; description: string; parentCode: string | null; sortOrder: number }
export class AssetCategoryError extends Error {
  constructor(message: string, public status = 400) { super(message) }
}
export function parseAssetCategory(value: Record<string, unknown>): AssetCategoryInput {
  const text = (key: string) => typeof value[key] === 'string' ? value[key].trim() : ''
  const nameTh = text('nameTh'), nameEn = text('nameEn'), description = text('description')
  if (!nameTh || nameTh.length > 120) throw new AssetCategoryError('กรุณาระบุชื่อภาษาไทย 1–120 ตัวอักษร')
  if (nameEn.length > 120) throw new AssetCategoryError('ชื่อภาษาอังกฤษต้องไม่เกิน 120 ตัวอักษร')
  if (description.length > 1000) throw new AssetCategoryError('คำอธิบายต้องไม่เกิน 1,000 ตัวอักษร')
  if (value.parentCode !== null && value.parentCode !== undefined && typeof value.parentCode !== 'string') throw new AssetCategoryError('หมวดแม่ไม่ถูกต้อง')
  const parentCode = text('parentCode') || null
  if (parentCode && !/^[A-Z0-9_]{2,80}$/.test(parentCode)) throw new AssetCategoryError('หมวดแม่ไม่ถูกต้อง')
  if (typeof value.sortOrder !== 'number' || !Number.isInteger(value.sortOrder) || value.sortOrder < 0 || value.sortOrder > 99999) throw new AssetCategoryError('ลำดับต้องเป็นจำนวนเต็มตั้งแต่ 0 ถึง 99999')
  return { nameTh, nameEn, description, parentCode, sortOrder: value.sortOrder }
}
export function descendantCodes(code: string, categories: { code: string; parentCode: string | null }[]) {
  const result = new Set([code])
  const queue = [code]
  for (let i = 0; i < queue.length; i++) {
    for (const child of categories) if (child.parentCode === queue[i] && !result.has(child.code)) { result.add(child.code); queue.push(child.code) }
  }
  return result
}
