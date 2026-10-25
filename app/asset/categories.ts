import type { Home } from './model'

export type AssetCategory = { code: string; nameTh: string; parentCode: string | null; isActive: boolean }

export function categoryTree(categories: AssetCategory[]) {
  const result: AssetCategory[] = []
  const visited = new Set<string>()
  const visit = (category: AssetCategory) => {
    if (visited.has(category.code)) return
    visited.add(category.code); result.push(category)
    categories.filter(c => c.parentCode === category.code).forEach(visit)
  }
  categories.filter(c => !c.parentCode || !categories.some(parent => parent.code === c.parentCode)).forEach(visit)
  categories.forEach(visit)
  return result
}

export function categoryPath(code: string, categories: AssetCategory[]) {
  const parts: string[] = []
  const visited = new Set<string>()
  let current = categories.find(c => c.code === code)
  while (current && !visited.has(current.code)) {
    visited.add(current.code); parts.unshift(current.nameTh)
    current = categories.find(c => c.code === current!.parentCode)
  }
  return parts.join(' / ') || code || 'ยังไม่ระบุหมวดหมู่'
}

export function categoryKind(code: string, categories: AssetCategory[]): Home['kind'] {
  const visited = new Set<string>()
  let current = categories.find(c => c.code === code)
  while (current && !visited.has(current.code)) {
    if (current.code === 'VEHICLES') return 'vehicle'
    if (current.code === 'BUILDINGS' || current.code === 'LAND') return 'house'
    visited.add(current.code)
    current = categories.find(c => c.code === current!.parentCode)
  }
  return 'other'
}

export function validateCategories(homes: Home[], previous: Home[], categories: AssetCategory[]) {
  for (const home of homes) {
    const old = previous.find(h => h.id === home.id)
    if (old && old.categoryCode === home.categoryCode && old.kind === home.kind) continue
    if (!categories.some(c => c.code === home.categoryCode && c.isActive)) throw new Error('กรุณาเลือกหมวดหมู่สินทรัพย์ที่เปิดใช้งานใน Masterdata')
    if (home.kind !== categoryKind(home.categoryCode, categories)) throw new Error('รูปแบบสินทรัพย์ไม่ตรงกับหมวดหมู่ที่เลือก')
  }
}
