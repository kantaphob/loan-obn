import { prisma } from '../lib/prisma'
import { getAssetWorkspace, saveAssetWorkspace } from '../app/thing/_shared/actions'
import { propertyAssetIds, today, type HomeSaleDeclaration } from '../app/thing/_shared/model'

async function main() {
  const current = await getAssetWorkspace()
  if (!current.canWrite) throw new Error('Current operator cannot edit assets')
  const property = current.data.properties?.find(row => row.code === 'PROP-002')
  if (!property || property.name !== 'บ้านภูกามยาว') throw new Error('Expected property not found; no changes made')
  const members = propertyAssetIds(property)
  const home = current.data.homes.find(row => members.includes(row.id) && row.assetCode === 'BLD-001')
  if (!home || home.name !== 'บ้านภูกามยาว' || members.length !== 1) throw new Error('Expected source asset not found; no changes made')
  const facts = { salePrice: 3200000, bankPayoff: 2800000, designRefund: 25000, mortgageRate: 1, transferRate: 1, stampRate: 0.05 }
  if (home.saleDeclaration) {
    if (Object.entries(facts).every(([key, value]) => home.saleDeclaration![key as keyof HomeSaleDeclaration] === value) && property.status === 'DISPOSED') { console.log('Matching reported sale already exists; nothing duplicated.'); return }
    throw new Error('Existing declaration differs; no changes made')
  }
  if (home.sale) throw new Error('An accounting sale already exists; reconcile instead of duplicating')
  const beforeLedger = await prisma.ledgerEntry.count()
  const declaration: HomeSaleDeclaration = { id: crypto.randomUUID(), reportedOn: today(), ...facts }
  const next = { ...current.data, properties: current.data.properties!.map(row => row.id === property.id ? { ...row, status: 'DISPOSED' as const } : row), homes: current.data.homes.map(row => row.id === home.id ? { ...row, saleDeclaration: declaration } : row) }
  const result = await saveAssetWorkspace(next, 'เจ้าของแจ้ง PROP-002 บ้านภูกามยาวขายแล้ว พร้อมยอดขาย ปิดธนาคาร ค่าธรรมเนียม และรับคืนค่าแบบ; ยังไม่ระบุวันรับจ่าย จึงไม่ลงบัญชีเงินจริง')
  if (!result.data) throw new Error(result.error || 'Save failed')
  const stored = await prisma.asset.findFirstOrThrow({ where: { id: home.id }, select: { status: true } })
  console.log(JSON.stringify({ property: 'PROP-002', status: 'DISPOSED', assetStatus: stored.status, accountingEntriesCreated: (await prisma.ledgerEntry.count()) - beforeLedger, revision: result.data.revision }))
}
main().catch(error => { console.error(error.message); process.exitCode = 1 }).finally(() => prisma.$disconnect())
