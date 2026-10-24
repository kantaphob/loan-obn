import { DisbursementButton } from './disbursement-button'
import { LimitApprovalButton } from './limit-approval-button'
import { Button } from '@/components/ui/button'
import '../borrower/borrower.css'
import './invoice.css'
import { Suspense } from 'react'
import Link from 'next/link'
import { connection } from 'next/server'
import { CalendarClock, ArrowUpRight, Wallet, Clock3, Search, FileSignature } from 'lucide-react'
import { PageContainer } from '@/components/ui/page-container'
import { Header } from '@/components/ui/header'
import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/lib/auth/current-user'
import { bangkokToday } from '@/lib/ledger'
import { contractCode, contractSignaturesComplete, formatContractDate, formatContractMoney } from '@/lib/contracts'

export type Params = { q?: string; period?: string }
const periods = [['due', 'ถึงกำหนดแล้ว'], ['today', 'วันนี้'], ['upcoming', 'กำหนดถัดไป'], ['unscheduled', 'ยังไม่ระบุวัน'], ['all', 'รอจ่ายทั้งหมด']] as const

export function PendingDisbursements({ searchParams, basePath = '/dashboard/ap' }: { searchParams: Promise<Params>; basePath?: string }) {
  return <Suspense fallback={<PageContainer><p role="status">กำลังโหลดรายการถึงกำหนดจ่าย…</p></PageContainer>}><InvoiceContent searchParams={searchParams} basePath={basePath} /></Suspense>
}

async function InvoiceContent({ searchParams, basePath }: { searchParams: Promise<Params>; basePath: string }) {
  await connection()
  const user = await getCurrentUser()
  if (!user || user.status !== 'ACTIVE') return <PageContainer><p>ไม่มีสิทธิ์เข้าถึงรายการจ่ายเงิน</p></PageContainer>
  const params = await searchParams
  const query = (params.q ?? '').trim().slice(0, 100)
  const period = periods.some(([key]) => key === params.period) ? params.period! : 'all'
  const today = bangkokToday()
  const channels = await prisma.paymentChannel.findMany({ where: { isActive: true }, select: { code: true, nameTh: true }, orderBy: { code: 'asc' } })
  const contracts = await prisma.loanContract.findMany({
    where: { status: 'WAITING_PAYMENT', paidAt: null, ledgerEntries: { none: { kind: 'DISBURSEMENT', voidedAt: null } } },
    select: { id: true, borrowerName: true, borrowerCode: true, lenderName: true, legacySourceCode: true, principalSatang: true, interestSatang: true, netSatang: true, interestMethod: true, limitApprovalRequired: true, scheduledDisbursementDate: true, signingMethod: true, documentChoice: true, borrowerSignedAt: true, lenderSignedAt: true, documentPackage: true, witnessCount: true, guaranteeWitnessCount: true, witnesses: { select: { position: true, signedAt: true } }, documentSignatures: { select: { documentStage: true, signer: true, signedAt: true } } },
    orderBy: [{ scheduledDisbursementDate: 'asc' }, { id: 'asc' }],
  })
  const due = contracts.filter(c => c.scheduledDisbursementDate && c.scheduledDisbursementDate <= today)
  const overdue = due.filter(c => c.scheduledDisbursementDate! < today)
  const todayItems = due.filter(c => c.scheduledDisbursementDate === today)
  const filtered = contracts.filter(c => {
    const date = c.scheduledDisbursementDate
    const matches = period === 'all' || (period === 'due' && date && date <= today) || (period === 'today' && date === today) || (period === 'upcoming' && date && date > today) || (period === 'unscheduled' && !date)
    return matches && `${contractCode(c.id)} ${c.legacySourceCode ?? ''} ${c.borrowerName} ${c.borrowerCode} ${c.lenderName}`.toLowerCase().includes(query.toLowerCase())
  })
  const sum = (items: typeof contracts) => items.reduce((total, c) => total + c.netSatang, 0)
  return <PageContainer className="borrower-page invoice-page">
    <Header title="จ่ายเงินตามสัญญา" eyebrow="Disbursement schedule" description="ตรวจสอบวันนัดจ่ายและยอดเงินสุทธิที่ต้องจ่ายให้ผู้กู้ตามสัญญา" icon={<CalendarClock size={21} />} actions={<><Link className="invoice-primary" href="/dashboard/ap/trade">เจ้าหนี้การค้า</Link><Link className="invoice-primary" href="/dashboard/ledger">ไปบัญชีรับ–จ่าย <ArrowUpRight size={16} /></Link></>} />
    <div className="invoice-date">ข้อมูล ณ วันที่ {formatContractDate(today)} · ตามเวลาประเทศไทย</div>
    <section className="borrower-metrics" aria-label="สรุปยอดรอจ่าย">
      {[{ label: 'ยอดรอจ่ายทั้งหมด', items: contracts, icon: Wallet, tone: 'gold', detail: 'รวมทุกวันนัดและรายการยังไม่ระบุวัน' }, { label: 'กำหนดจ่ายวันนี้', items: todayItems, icon: CalendarClock, tone: 'green', detail: 'เตรียมเงินสำหรับรายการวันนี้' }, { label: 'เลยกำหนดจ่าย', items: overdue, icon: Clock3, tone: 'rose', detail: 'ควรตรวจสอบและดำเนินการก่อน' }].map(({ label, items, icon: Icon, tone, detail }) => <article key={label} className={`borrower-metric borrower-metric--${tone}`}><div className="borrower-metric-top">{label}<span className="borrower-metric-icon"><Icon size={19} /></span></div><div className="borrower-metric-value">{formatContractMoney(sum(items))}<span>บาท</span></div><div className="borrower-metric-detail">{items.length} สัญญา · {detail}</div></article>)}
    </section>
    <section className="invoice-panel" aria-labelledby="invoice-list-title">
      <div className="invoice-panel-heading"><div><h2 id="invoice-list-title">สัญญารอจ่ายเงินให้ผู้กู้ <span className="borrower-count">{filtered.length} รายการ</span></h2><p>ยอดจ่ายสุทธิหักดอกเบี้ยล่วงหน้าแล้ว เฉพาะสัญญาที่เลือกหักล่วงหน้า</p></div><FileSignature size={22} aria-hidden="true" /></div>
      <nav className="invoice-tabs" aria-label="ช่วงกำหนดจ่าย">{periods.map(([key, label]) => <Link key={key} aria-current={period === key ? 'page' : undefined} href={`${basePath}?${new URLSearchParams({ period: key, ...(query ? { q: query } : {}) })}`}>{label}</Link>)}</nav>
      <form className="invoice-search" action={basePath}><input type="hidden" name="period" value={period} /><label><Search size={17} aria-hidden="true" /><span className="sr-only">ค้นหาสัญญาหรือผู้กู้</span><input name="q" defaultValue={query} maxLength={100} placeholder="ค้นหาเลขสัญญา ชื่อผู้กู้ หรือผู้ให้กู้" /></label><Button type="submit">ค้นหา</Button>{query && <Link href={`${basePath}?period=${period}`}>ล้างคำค้น</Link>}</form>
      <div className="invoice-table-wrap"><table className="invoice-table"><caption className="sr-only">สัญญารอจ่ายเงินให้ผู้กู้ตามช่วงวันที่ที่เลือก</caption><thead><tr><th scope="col">วันนัดจ่าย / สถานะ</th><th scope="col">ผู้กู้ / สัญญา</th><th scope="col">ผู้ให้กู้</th><th scope="col" className="invoice-number">เงินต้น</th><th scope="col" className="invoice-number">หักดอกเบี้ย</th><th scope="col" className="invoice-number">ยอดจ่ายสุทธิ</th><th scope="col">เอกสาร</th><th scope="col">ดำเนินการ</th></tr></thead><tbody>{filtered.map(c => {
        const date = c.scheduledDisbursementDate
        const status = !date ? 'ยังไม่ระบุวัน' : date < today ? 'เลยกำหนด' : date === today ? 'ถึงกำหนดวันนี้' : 'ยังไม่ถึงกำหนด'
        const ready = c.signingMethod !== 'E_SIGNATURE' || contractSignaturesComplete(c)
        return <tr key={c.id}><td><strong>{formatContractDate(date)}</strong><span className="invoice-badge" data-tone={!date ? 'muted' : date < today ? 'danger' : date === today ? 'gold' : 'green'}>{status}</span></td><td><strong>{c.borrowerName}</strong><small>{contractCode(c.id)}{c.legacySourceCode ? ` · ${c.legacySourceCode}` : ''} · {c.borrowerCode}</small></td><td>{c.lenderName}</td><td className="invoice-number">{formatContractMoney(c.principalSatang)}</td><td className="invoice-number">{formatContractMoney(c.interestMethod === 'INTEREST_UPFRONT' ? c.interestSatang : 0)}</td><td className="invoice-number invoice-net">{formatContractMoney(c.netSatang)}<small>บาท</small></td><td><span className="invoice-badge" data-tone={c.limitApprovalRequired ? 'gold' : ready ? 'green' : 'gold'}>{c.limitApprovalRequired ? 'รออนุมัติวงเงิน' : c.documentChoice === 'NONE' ? 'จอง · ไม่มีเอกสาร' : c.signingMethod !== 'E_SIGNATURE' ? 'ตรวจเอกสารกระดาษ' : ready ? 'ลงนามครบแล้ว' : 'รอลงนามให้ครบ'}</span></td><td>{c.limitApprovalRequired ? ['ADMIN', 'SUPER_ADMIN'].includes(user.role) ? <LimitApprovalButton contractId={c.id} principalSatang={c.principalSatang} borrowerName={c.borrowerName} /> : 'รอผู้ดูแลอนุมัติ' : user.role !== 'REVIEWER' ? <DisbursementButton contractId={c.id} amountSatang={c.netSatang} borrowerName={c.borrowerName} today={today} channels={channels} ready={ready} /> : 'ดูข้อมูลเท่านั้น'}</td></tr>
      })}</tbody></table></div>
      {!filtered.length && <div className="invoice-empty"><CalendarClock size={32} /><h3>{query ? 'ไม่พบรายการที่ตรงกับคำค้น' : 'ไม่มีรายการในช่วงที่เลือก'}</h3><p>{query ? 'ลองค้นหาด้วยชื่อผู้กู้หรือเลขสัญญาอื่น' : 'รายการจะแสดงเมื่อมีสัญญารอจ่ายตามวันนัดที่กำหนด'}</p><Link href={`${basePath}?period=all`}>ดูรายการรอจ่ายทั้งหมด <ArrowUpRight size={14} /></Link></div>}
      <footer className="invoice-footer"><span>{filtered.length} รายการ · ยอดรวมตามตัวกรอง</span><strong>{formatContractMoney(sum(filtered))} <small>บาท</small></strong></footer>
    </section>
    <p className="invoice-note">ตรวจสอบเอกสารและลายเซ็นก่อนจ่ายเงินจริง จากนั้นกดบันทึกจ่ายแล้วในรายการ ระบบจะลงบัญชีรับ–จ่ายให้โดยอัตโนมัติ รายการที่บันทึกจ่ายแล้วจะออกจากหน้านี้</p>
  </PageContainer>
}
