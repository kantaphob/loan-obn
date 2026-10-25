import { Suspense } from 'react'
import { connection } from 'next/server'
import AppFrame from '@/components/AppFrame'
import { getAssetWorkspace } from './actions'
import { AssetWorkspace } from './workspace'
import './asset.css'

export const metadata = { title: 'สินทรัพย์ | OBN Workspace' }

export default function AssetPage({ section = 'assets' }: { section?: 'assets' | 'debts' }) {
  return <Suspense fallback={<p className="p-8" role="status">กำลังโหลดสินทรัพย์…</p>}><Content section={section} /></Suspense>
}

async function Content({ section }: { section: 'assets' | 'debts' }) {
  await connection()
  const { data, categories, canWrite, ledger, history } = await getAssetWorkspace()
  return <AppFrame><AssetWorkspace initial={data} categories={categories} canWrite={canWrite} ledger={ledger} history={history} initialSection={section} /></AppFrame>
}
