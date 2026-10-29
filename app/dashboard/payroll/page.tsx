import { Suspense } from 'react'
import { connection } from 'next/server'
import { Banknote } from 'lucide-react'
import { PageContainer } from '@/components/ui/page-container'
import { Header } from '@/components/ui/header'
import { getPayroll } from './actions'
import { PayrollWorkspace } from './payroll-workspace'

export default function PayrollPage() {
  return <PageContainer><Header title="เงินเดือนและรายได้ประจำ" eyebrow="Accounting · General account" description="บันทึกเงินได้และเงินหักตามงวด แล้วจับคู่หรือบันทึกรับเงินจริงเข้าบัญชีทั่วไป" icon={<Banknote size={21} />} /><Suspense fallback={<p role="status" className="p-6 text-sm text-slate-500">กำลังโหลดรายการเงินเดือน…</p>}><Content /></Suspense></PageContainer>
}
async function Content() {
  await connection()
  return <PayrollWorkspace data={await getPayroll()} />
}
