import { Suspense } from 'react'
import { connection } from 'next/server'
import AppFrame from '@/components/AppFrame'
import { AssetWorkspace } from './workspace'
import { AssetRegistry } from '../property/_components/asset-registry'
import { PropertyRegistry } from '../property/_components/property-registry'
import { getAssetWorkspace } from './actions'
import './thing.css'


export function AssetScreen({ section = 'assets', tab = 'overview' }: { section?: 'assets' | 'debts' | 'history' | 'basic-assets' | 'archived-assets'; tab?: string }) {
  return <Suspense fallback={<p className="p-8" role="status">กำลังโหลดสินทรัพย์…</p>}><Content section={section} tab={tab} /></Suspense>
}

async function Content({ section, tab }: { section: 'assets' | 'debts' | 'history' | 'basic-assets' | 'archived-assets'; tab: string }) {
  await connection()
  if (section === 'archived-assets') {
    const { data, categories, canWrite } = await getAssetWorkspace()
    return <AppFrame><AssetRegistry key="archived" initial={data} categories={categories} canWrite={canWrite} view="archived" /></AppFrame>
  }
  if (section === 'basic-assets') {
    const { data, categories, canWrite } = await getAssetWorkspace()
    return <AppFrame><AssetRegistry initial={data} categories={categories} canWrite={canWrite} mode="basic" /></AppFrame>
  }
  if (section === 'assets' && tab === 'overview') {
    const { data, categories, canWrite } = await getAssetWorkspace()
    return <AppFrame><PropertyRegistry initial={data} categories={categories} canWrite={canWrite} /></AppFrame>
  }
  return <AppFrame><AssetWorkspace initialSection={section} initialTab={tab} /></AppFrame>
}
