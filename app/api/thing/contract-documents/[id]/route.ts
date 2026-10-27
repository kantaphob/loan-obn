import { readFile } from 'node:fs/promises'
import { getCurrentUser } from '@/lib/auth/current-user'
import { prisma } from '@/lib/prisma'
import { contractDocumentPath } from '@/lib/contract-document-files'
import { migrateAssetData } from '@/app/thing/_shared/model'
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser()
  if (!user || user.status !== 'ACTIVE') return new Response(null, { status: 403 })
  const { id } = await params
  if (!/^[a-f0-9-]{36}$/i.test(id)) return new Response(null, { status: 404 })
  const state = await prisma.assetWorkspaceState.findUnique({ where: { operatorId: user.id } })
  const doc = state && migrateAssetData(JSON.parse(state.payload)).loans.flatMap(loan => (loan.contractorContracts ?? []).flatMap(contract => contract.documents ?? [])).find(doc => doc.id === id)
  if (!doc) return new Response(null, { status: 404 })
  try {
    const bytes = await readFile(contractDocumentPath(user.id, id, doc.storageCode, doc.mimeType))
    return new Response(bytes, { headers: { 'Content-Type': doc.mimeType, 'Content-Disposition': `inline; filename="document"; filename*=UTF-8''${encodeURIComponent(doc.name)}`, 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff', 'Content-Security-Policy': "default-src 'none'; sandbox" } })
  } catch { return new Response(null, { status: 404 }) }
}
