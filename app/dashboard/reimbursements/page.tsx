import { Suspense } from 'react'
import { connection } from 'next/server'
import { Header } from '@/components/ui/header'
import { PageContainer } from '@/components/ui/page-container'
import { getReimbursements } from './actions'
import { ReimbursementWorkspace } from './workspace'
export default function Page() { return <PageContainer><Header title="สำรองจ่ายและเบิกคืน" description="เก็บใบเบิก ติดตามยอดค้าง และบันทึกโอนคืนเข้าบัญชีทั่วไป" /><Suspense fallback={<p>กำลังโหลด…</p>}><Content /></Suspense></PageContainer> }
async function Content() { await connection(); return <ReimbursementWorkspace data={await getReimbursements()} /> }
