import { Suspense } from 'react'
import { connection } from 'next/server'
import AppFrame from '@/components/AppFrame'
import { getAssetWorkspace } from './actions'
import { AssetWorkspace } from './workspace'
import './asset.css'

export const metadata = { title: 'สินทรัพย์ | OBN Workspace' }

export default function AssetPage() {
  return <Suspense fallback={<p className="p-8" role="status">กำลังโหลดสินทรัพย์…</p>}><Content /></Suspense>
}

async function Content() {
  await connection()
  const { data, canWrite } = await getAssetWorkspace()
  return <AppFrame><AssetWorkspace initial={data} canWrite={canWrite} /></AppFrame>
}
