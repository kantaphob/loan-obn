import { Button } from '@/components/ui/button'
import '../borrower/borrower.css'
import '../invoice/invoice.css'
import './ap.css'
import { Suspense } from 'react'
import Link from 'next/link'
import { connection } from 'next/server'
import { Wallet, Clock3, CalendarClock, ReceiptText, Search, Plus, Info, ArrowUpRight } from 'lucide-react'
import { PageContainer } from '@/components/ui/page-container'
import { Header } from '@/components/ui/header'
import { getCurrentUser } from '@/lib/auth/current-user'
import { prisma } from '@/lib/prisma'
import { bangkokToday } from '@/lib/ledger'
import { formatContractMoney, formatContractDate } from '@/lib/contracts'
import { PayableForm } from './payable-form'

const filters = [['open', 'ค้างจ่ายทั้งหมด'], ['overdue', 'เลยกำหนด'], ['today', 'ครบกำหนดวันนี้'], ['upcoming', 'ยังไม่ถึงกำหนด'], ['paid', 'ชำระแล้ว']] as const
type Params = { q?: string; status?: string }
export default function PayablesPage({ searchParams }: { searchParams: Promise<Params> }) {
  return <Suspense fallback={<PageContainer><p role="status">กำลังโหลดเจ้าหนี้การค้า…</p></PageContainer>}><Content searchParams={searchParams} /></Suspense>
}
async function Content({ searchParams }: { searchParams: Promise<Params> }) {
  await connection()
  const user = await getCurrentUser()
  if (!user || user.status !== 'ACTIVE') return <PageContainer><p>ไม่มีสิทธิ์เข้าถึงข้อมูล</p></PageContainer>
  const [params, bills, channels] = await Promise.all([searchParams, prisma.tradePayable.findMany({ include: { payments: { where: { voidedAt: null } } }, orderBy: [{ dueDate: 'asc' }, { id: 'desc' }] }), prisma.paymentChannel.findMany({ where: { isActive: true }, orderBy: { code: 'asc' } })])
  const today = bangkokToday(), query = (params.q ?? '').trim().slice(0, 100), status = filters.some(([key]) => key === params.status) ? params.status : 'open'
  const unpaid = bills.filter(b => !b.payments.length)
  const groups = [{ title: 'เจ้าหนี้คงค้าง', items: unpaid, Icon: Wallet, tone: 'gold' }, { title: 'ครบกำหนดวันนี้', items: unpaid.filter(b => b.dueDate === today), Icon: CalendarClock, tone: 'green' }, { title: 'เลยกำหนดชำระ', items: unpaid.filter(b => b.dueDate < today), Icon: Clock3, tone: 'rose' }]
  const visible = bills.filter(b => (status === 'paid' ? b.payments.length > 0 : !b.payments.length && (status === 'open' || status === 'overdue' && b.dueDate < today || status === 'today' && b.dueDate === today || status === 'upcoming' && b.dueDate > today)) && `${b.supplier} ${b.invoiceNumber} ${b.description}`.toLowerCase().includes(query.toLowerCase()))
  const canWrite = user.role !== 'REVIEWER'
  return <PageContainer className="borrower-page invoice-page ap-page">
    <Header title="เจ้าหนี้การค้า" eyebrow="Accounts Payable" description="ติดตามค่าสินค้าและบริการที่ค้างจ่าย พร้อมวางแผนชำระภายในวันครบกำหนด" icon={<ReceiptText size={21} />} actions={<><Link className="invoice-primary" href="/dashboard/ap">จ่ายเงินตามสัญญา</Link><Link className="invoice-primary" href="/dashboard/ledger">บัญชีรับ–จ่าย <ArrowUpRight size={16} aria-hidden="true" /></Link>{canWrite && <Link className="invoice-primary ap-add-button" href="/dashboard/ap/new"><Plus size={16} aria-hidden="true" /> เพิ่มบิลเจ้าหนี้</Link>}</>} />
    <div className="invoice-date">ข้อมูล ณ {formatContractDate(today)} · เวลาประเทศไทย</div>
    <section className="borrower-metrics" aria-label="สรุปเจ้าหนี้การค้า">{groups.map(({ title, items, Icon, tone }) => <article key={title} className={`borrower-metric borrower-metric--${tone}`}><div className="borrower-metric-top">{title}<span className="borrower-metric-icon"><Icon size={19} /></span></div><div className="borrower-metric-value">{formatContractMoney(items.reduce((sum, b) => sum + b.amountSatang, 0))}<span>บาท</span></div><div className="borrower-metric-detail">{items.length} ใบแจ้งหนี้</div></article>)}</section>
    <p className="ap-explainer"><Info size={18} aria-hidden="true" /><span>บันทึกหนี้เมื่อได้รับสินค้า / บริการ และจ่ายได้ก่อนหรือภายในวันครบกำหนด การเพิ่มบิลยังไม่ใช่การจ่ายเงินจริง</span></p>
    <section className="invoice-panel" aria-labelledby="ap-title"><div className="invoice-panel-heading"><div><h2 id="ap-title">รายการเจ้าหนี้ <span className="borrower-count">{visible.length} รายการ</span></h2><p>บันทึกจ่ายเต็มยอดตามจำนวนที่จ่ายจริง รองรับการจ่ายก่อนครบกำหนด</p></div></div>
      <nav className="invoice-tabs" aria-label="สถานะเจ้าหนี้">{filters.map(([key, label]) => <Link key={key} aria-current={status === key ? 'page' : undefined} href={`/dashboard/ap/trade?${new URLSearchParams({ status: key, ...(query ? { q: query } : {}) })}`}>{label}</Link>)}</nav>
      <form className="invoice-search" action="/dashboard/ap/trade"><input type="hidden" name="status" value={status} /><label><Search size={17} aria-hidden="true" /><span className="sr-only">ค้นหาผู้ขายหรือใบแจ้งหนี้</span><input name="q" defaultValue={query} maxLength={100} placeholder="ค้นหาผู้ขาย เลขใบแจ้งหนี้ หรือรายละเอียด" /></label><Button type="submit">ค้นหา</Button>{query && <Link href={`/dashboard/ap/trade?status=${status}`}>ล้างคำค้น</Link>}</form>
      <div className="invoice-table-wrap"><table className="invoice-table"><caption className="sr-only">รายการเจ้าหนี้การค้าตามตัวกรอง</caption><thead><tr><th scope="col">ผู้ขาย / ใบแจ้งหนี้</th><th scope="col">รายละเอียด</th><th scope="col">วันที่ใบแจ้งหนี้</th><th scope="col">ครบกำหนด / สถานะ</th><th scope="col" className="invoice-number">ยอดเงิน (บาท)</th><th scope="col">การชำระเงิน</th></tr></thead><tbody>{visible.map(b => {
        const payment = b.payments[0]
        return <tr key={b.id}><td><strong>{b.supplier}</strong><small>{b.invoiceNumber}</small></td><td className="ap-description">{b.description}</td><td>{formatContractDate(b.invoiceDate)}</td><td><strong>{formatContractDate(b.dueDate)}</strong><span className="invoice-badge" data-tone={payment ? 'green' : b.dueDate < today ? 'danger' : b.dueDate === today ? 'gold' : 'muted'}>{payment ? 'ชำระแล้ว' : b.dueDate < today ? 'เลยกำหนด' : b.dueDate === today ? 'ครบกำหนดวันนี้' : 'ยังไม่ถึงกำหนด'}</span></td><td className="invoice-number invoice-net">{formatContractMoney(b.amountSatang)}</td><td>{payment ? <><strong>{formatContractDate(payment.occurredOn)}</strong><small>{payment.channelName} · {payment.reference}</small></> : canWrite ? <details className="ap-pay"><summary>บันทึกจ่ายเงิน</summary><PayableForm today={today} payment={{ id: b.id, invoiceDate: b.invoiceDate, channels }} /></details> : 'รอชำระ'}</td></tr>
      })}</tbody></table></div>
      {!visible.length && <div className="invoice-empty"><span className="ap-empty-icon"><ReceiptText size={30} aria-hidden="true" /></span><h3>{query ? 'ไม่พบรายการที่ตรงกับคำค้น' : 'ไม่มีรายการในสถานะนี้'}</h3><p>เพิ่มบิลเจ้าหนี้เพื่อเริ่มติดตามยอดค้างและวันครบกำหนด</p></div>}
      <footer className="invoice-footer"><span>{visible.length} รายการ · ยอดรวมตามตัวกรอง</span><strong>{formatContractMoney(visible.reduce((sum, b) => sum + b.amountSatang, 0))} บาท</strong></footer>
    </section><p className="invoice-note">ตรวจสอบการจ่ายเงินจริงก่อนยืนยัน ระบบจะบันทึกเงินออกในบัญชีรับ–จ่าย หากยกเลิกรายการจ่ายในบัญชีรับ–จ่าย บิลจะกลับมาค้างจ่ายอีกครั้ง</p>
  </PageContainer>
}
