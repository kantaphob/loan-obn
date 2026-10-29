import { PageContainer } from '@/components/ui/page-container'
import { DataLoading } from '@/components/ui/data-loading'
import { Suspense } from 'react'
import { connection } from 'next/server'
import AppFrame from '@/components/AppFrame'
import { getAssetWorkspace } from '@/app/thing/_shared/actions'
import { BankLoanRegistry } from '@/app/thing/asset/_components/bank-loan-registry'
import '@/app/thing/_shared/thing.css'

export const metadata = { title: 'Liabilities — หนี้สิน | OBN Workspace' }

export default function LiabilitiesPage() {
  return <Suspense fallback={<AppFrame><PageContainer><DataLoading label="กำลังโหลดหนี้สิน…" /></PageContainer></AppFrame>}><LiabilitiesContent /></Suspense>
}

async function LiabilitiesContent() {
  await connection()
  const { data, canWrite, channels } = await getAssetWorkspace()
  return <AppFrame><BankLoanRegistry initial={data} canWrite={canWrite} channels={channels} /></AppFrame>
}
