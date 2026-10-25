import test from 'node:test'
import assert from 'node:assert/strict'
import { activeCategoryTree, categoryChain, categoryKind, categoryPath, type AssetCategory } from '../app/thing/property/categories'
const categories: AssetCategory[] = [
  { code: 'CURRENT', nameTh: 'สินทรัพย์หมุนเวียน', parentCode: null, isActive: true },
  { code: 'CASH', nameTh: 'เงินสด', parentCode: 'CURRENT', isActive: true },
  { code: 'NON_CURRENT', nameTh: 'สินทรัพย์ไม่หมุนเวียน', parentCode: null, isActive: true },
  { code: 'TANGIBLE', nameTh: 'มีตัวตน', parentCode: 'NON_CURRENT', isActive: true },
  { code: 'VEHICLES', nameTh: 'ยานพาหนะ', parentCode: 'TANGIBLE', isActive: true },
  { code: 'MOTORCYCLE', nameTh: 'รถจักรยานยนต์', parentCode: 'VEHICLES', isActive: true },
]
test('picker retains the actual ancestry and detailed vehicle kind across more than three levels', () => {
  assert.deepEqual(categoryChain('MOTORCYCLE', categories).map(item => item.code), ['NON_CURRENT', 'TANGIBLE', 'VEHICLES', 'MOTORCYCLE'])
  assert.equal(categoryKind('MOTORCYCLE', categories), 'vehicle')
  assert.equal(categoryPath('MOTORCYCLE', categories), 'สินทรัพย์ไม่หมุนเวียน / มีตัวตน / ยานพาหนะ / รถจักรยานยนต์')
  assert.deepEqual(categoryChain('CASH', categories).map(item => item.code), ['CURRENT', 'CASH'])
})
test('active choices exclude descendants of disabled parents and orphaned/cyclic categories', () => {
  const items = categories.map(item => item.code === 'TANGIBLE' ? { ...item, isActive: false } : item)
  items.push({ code: 'ORPHAN', nameTh: 'หมวดกำพร้า', parentCode: 'MISSING', isActive: true })
  items.push({ code: 'LOOP_A', nameTh: 'A', parentCode: 'LOOP_B', isActive: true }, { code: 'LOOP_B', nameTh: 'B', parentCode: 'LOOP_A', isActive: true })
  assert.deepEqual(activeCategoryTree(items).map(item => item.code), ['CURRENT', 'CASH', 'NON_CURRENT'])
  assert.deepEqual(categoryChain('LOOP_A', items), [])
  assert.deepEqual(categoryChain('MISSING', items), [])
})
