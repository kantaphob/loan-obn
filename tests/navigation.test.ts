import assert from 'node:assert/strict'
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import test from 'node:test'
import { NAV_CHILD_PAGES, NAV_GROUPS, findActiveNavItem, getWorkspaceContext, searchWorkspace } from '../lib/nav'

test('every destination has a page and occurs in exactly one work area', () => {
  const pages = [...NAV_GROUPS.flatMap(group=>group.items),...NAV_CHILD_PAGES]
  assert.equal(new Set(pages.map(page=>page.href)).size,pages.length)
  for (const page of pages) assert.ok(existsSync(join(process.cwd(),'app',page.href,'page.tsx')),page.href)
  assert.equal(new Set(NAV_GROUPS.map(group=>group.id)).size,8)
  for (const group of NAV_GROUPS) {
    for (const href of group.workflow ?? []) assert.ok(group.items.some(page=>page.href===href),href)
  }
})

test('nested summaries and child pages select the precise page and work area', () => {
  assert.equal(findActiveNavItem('/dashboard/repayments/summary')?.href,'/dashboard/repayments/summary')
  const contract = getWorkspaceContext('/dashboard/contracts/new')
  assert.equal(contract.group?.id,'loans')
  assert.equal(contract.item?.href,'/dashboard/contracts')
  assert.equal(contract.page?.label,'สร้างสัญญาสินเชื่อ')
  assert.equal(getWorkspaceContext('/thing/property/history').group?.id,'assets')
  assert.equal(getWorkspaceContext('/dashboard/admin/masterdata/bank').page?.label,'ธนาคาร')
})

test('work area pages resolve their own group without treating unknown routes as Dashboard', () => {
  const context = getWorkspaceContext('/dashboard/workspace/finance')
  assert.equal(context.group?.id,'finance')
  assert.equal(context.isHub,true)
  assert.equal(context.item,undefined)
  assert.equal(findActiveNavItem('/dashboard/unknown'),undefined)
})

test('legacy links preserve navigation selection', () => {
  assert.equal(findActiveNavItem('/dashboard/cashbook-2025','?year=2025')?.href,'/dashboard/ledger')
  assert.equal(findActiveNavItem('/dashboard/ar')?.href,'/dashboard/repayments')
  assert.equal(findActiveNavItem('/dashboard/invoice')?.href,'/dashboard/ap')
})

test('search accepts Thai and previous English names and includes child tools', () => {
  for (const [query,href] of [
    ['borrowers','/dashboard/borrower'],['property','/thing/property'],['capital','/dashboard/capital'],
    ['masterdata','/dashboard/admin/masterdata'],['ประวัติการขาย','/thing/property/history'],
    ['สร้างสัญญา','/dashboard/contracts/new'],['การเงิน','/dashboard/workspace/finance'],
  ]) assert.ok(searchWorkspace(query).some(page=>page.href===href),query)
  assert.deepEqual(searchWorkspace('  '),[])
  assert.equal(searchWorkspace('zzzznotapage').length,0)
})
