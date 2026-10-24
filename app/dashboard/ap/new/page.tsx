import '../../borrower/borrower.css'
import '../../invoice/invoice.css'
import '../ap.css'
import { Suspense } from 'react'
import Link from 'next/link'
import { connection } from 'next/server'
import { ArrowLeft, ReceiptText, Info } from 'lucide-react'
import { PageContainer } from '@/components/ui/page-container'
import { Header } from '@/components/ui/header'
import { getCurrentUser } from '@/lib/auth/current-user'
import { bangkokToday } from '@/lib/ledger'
import { PayableForm } from '../payable-form'

export default function NewPayablePage() {
  return <Suspense fallback={<PageContainer><p role="status">กำลังโหลดแบบฟอร์ม…</p></PageContainer>}><NewPayableContent /></Suspense>
}

async function NewPayableContent() {
  await connection()
  const user = await getCurrentUser()
  if (!user || user.status !== 'ACTIVE' || user.role === 'REVIEWER') return <PageContainer><p>ไม่มีสิทธิ์เพิ่มบิลเจ้าหนี้</p><Link href="/dashboard/ap/trade">กลับไปรายการเจ้าหนี้</Link></PageContainer>
  return <PageContainer className="borrower-page invoice-page ap-page ap-new-page">
    <Header title="เพิ่มบิลเจ้าหนี้การค้า" eyebrow="Accounts Payable / New Bill" description="ระบุผู้ขาย รายละเอียดใบแจ้งหนี้ และกำหนดชำระเงิน" icon={<ReceiptText size={21} />} actions={<Link className="invoice-primary" href="/dashboard/ap/trade"><ArrowLeft size={16} aria-hidden="true" /> กลับไปรายการเจ้าหนี้</Link>} />
    <section className="invoice-panel ap-entry-panel" aria-labelledby="ap-entry-title">
      <div className="invoice-panel-heading"><div><h2 id="ap-entry-title">ข้อมูลใบแจ้งหนี้</h2><p>กรอกข้อมูลให้ครบถ้วนเพื่อบันทึกยอดค้างจ่ายให้ผู้ขาย</p></div></div>
      <PayableForm today={bangkokToday()} requestKey={crypto.randomUUID()} />
    </section>
    <p className="ap-explainer"><Info size={18} aria-hidden="true" /><span>การเพิ่มบิลเป็นการบันทึกยอดเจ้าหนี้ ยังไม่มีเงินออก เมื่อจ่ายเงินจริงให้บันทึกจ่ายจากหน้ารายการเจ้าหนี้</span></p>
  </PageContainer>
}
