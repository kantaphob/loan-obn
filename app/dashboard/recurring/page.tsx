import { Suspense } from 'react'
import { connection } from 'next/server'
import { Repeat2 } from 'lucide-react'
import { PageContainer } from '@/components/ui/page-container'
import { Header } from '@/components/ui/header'
import { getRecurring } from './actions'
import { RecurringWorkspace } from './recurring-workspace'
export default function RecurringPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  return <PageContainer><Header title="รายการรับ–จ่ายประจำ" eyebrow="Accounting · General account" description="วางแผนรายเดือนและรายปี แล้วจับคู่หรือบันทึกเงินรับ–จ่ายจริงเข้าบัญชีทั่วไป" icon={<Repeat2 size={21} />} /><Suspense fallback={<p role="status" className="p-6 text-sm text-slate-500">กำลังโหลดรายการประจำ…</p>}><Content searchParams={searchParams} /></Suspense></PageContainer>
}
async function Content({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) { await connection(); const params = await searchParams; return <RecurringWorkspace data={await getRecurring()} initialAssetId={typeof params.asset === 'string' ? params.asset : ''} /> }
