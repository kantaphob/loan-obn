import { propertyAssetIds, type AssetData, type Home } from '../_shared/model'

export function isPropertyComponent(code: string, root: 'LAND' | 'BUILDINGS', categories: AssetCategory[]) {
  const chain = categoryChain(code, categories)
  return chain.some(category => category.code === root) && !chain.some(category => category.code === 'HOUSE_WITH_LAND')
}

export function validatePropertyCategories(data: AssetData, categories: AssetCategory[]) {
  for (const property of data.properties ?? []) {
    if (!property.assetIds) {
      const land = data.homes.find(home => home.id === property.landId)
      const building = data.homes.find(home => home.id === property.buildingId)
      if (!land || !building || !isPropertyComponent(land.categoryCode, 'LAND', categories) || !isPropertyComponent(building.categoryCode, 'BUILDINGS', categories)) throw new Error('PROPERTY ต้องเชื่อมที่ดินกับอาคารแยกกัน ไม่ใช้สินทรัพย์บ้านพร้อมที่ดินที่รวมต้นทุนแล้ว')
    }
    for (const id of propertyAssetIds(property)) {
      const home = data.homes.find(home => home.id === id)
      if (!home || !isPropertyComponent(home.categoryCode, 'LAND', categories) && !isPropertyComponent(home.categoryCode, 'BUILDINGS', categories)) throw new Error('เลือกได้เฉพาะที่ดิน อาคาร และสิ่งปลูกสร้างที่แยกต้นทุน ไม่ใช้บ้านพร้อมที่ดินที่รวมต้นทุนแล้ว')
      if (property.type === 'LAND_ONLY' && !isPropertyComponent(home.categoryCode, 'LAND', categories)) throw new Error('PROPERTY ประเภทที่ดินเปล่าเชื่อมได้เฉพาะที่ดิน')
    }
  }
}

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
    if (!activeCategoryTree(categories).some(c => c.code === home.categoryCode)) throw new Error('กรุณาเลือกหมวดหมู่สินทรัพย์ที่เปิดใช้งานใน Masterdata')
    if (home.kind !== categoryKind(home.categoryCode, categories)) throw new Error('รูปแบบสินทรัพย์ไม่ตรงกับหมวดหมู่ที่เลือก')
  }
}

/** Root-to-category records, used to keep each picker level tied to its real parent. */
export function categoryChain(code: string, categories: AssetCategory[]) {
  const chain: AssetCategory[] = [], visited = new Set<string>()
  let current = categories.find((item) => item.code === code)
  while (current) {
    if (visited.has(current.code)) return []
    visited.add(current.code); chain.unshift(current)
    if (!current.parentCode) return chain
    current = categories.find((item) => item.code === current!.parentCode)
  }
  return []
}
export function activeCategoryTree(categories: AssetCategory[]) {
  return categoryTree(categories).filter((item) => {
    const chain = categoryChain(item.code, categories)
    return chain.length > 0 && chain.every((parent) => parent.isActive)
  })
}


/** Number within the category family; archived assets continue to reserve their codes. */
export function assignAssetCodes(homes: Home[], current: Home[], categories: AssetCategory[]): Home[] {
  const used = new Set(current.map(home => home.assetCode).filter((code): code is string => Boolean(code)))
  return homes.map(home => {
    const existing = current.find(row => row.id === home.id)?.assetCode
    if (existing) return { ...home, assetCode: existing }
    const prefixes: Record<string, string> = { LAND: 'LAND', BUILDINGS: 'BLD', VEHICLES: 'VEH' }
    const family = categoryChain(home.categoryCode, categories).find(category => prefixes[category.code])
    const prefix = family ? prefixes[family.code] : home.categoryCode || 'AST'
    let sequence = 0
    for (const code of used) {
      if (!code.startsWith(`${prefix}-`)) continue
      const suffix = code.slice(prefix.length + 1)
      if (/^\d+$/.test(suffix)) sequence = Math.max(sequence, Number(suffix))
    }
    let code: string
    do { code = `${prefix}-${String(++sequence).padStart(3, '0')}` } while (used.has(code))
    used.add(code)
    return { ...home, assetCode: code }
  })
}
