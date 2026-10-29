import '../repayments.css'
import './summary.css'
import Link from 'next/link'
import { Suspense } from 'react'
import { connection } from 'next/server'
import { FileText } from 'lucide-react'
import { PageContainer } from '@/components/ui/page-container'
import { Header } from '@/components/ui/header'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { DataLoading } from '@/components/ui/data-loading'
import { formatContractMoney as money } from '@/lib/contracts'
import { borrowerSummaryText, loanSummaryCsv } from '@/lib/loan-repayment-summary'
import { getLoanRepaymentSummary } from './data'
import { SummaryControls } from './summary-controls'
import { PersonTextControls } from './person-text-controls'

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> }
const dateLabel = (date: string) => new Intl.DateTimeFormat('th-TH', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Asia/Bangkok' }).format(new Date(`${date}T00:00:00+07:00`))

export default function LoanSummaryPage(props: Props) {
  return <PageContainer className="loan-summary-page"><Header title="สรุปยอดผู้กู้ต้องคืน" eyebrow="Loan repayment summary" description="รวมรายบุคคล แยกเลขสัญญา เงินต้น ดอกเบี้ย และยอดค้างที่ต้องคืนทั้งหมด" icon={<FileText size={21} aria-hidden="true" />} />
    <Suspense fallback={<DataLoading showHeader={false} label="กำลังรวมยอดทุกสัญญาของผู้กู้…" />}><SummaryContent {...props} /></Suspense>
  </PageContainer>
}

async function SummaryContent({ searchParams }: Props) {
  await connection()
  const params = await searchParams
  const query = typeof params.q === 'string' ? params.q.trim().slice(0, 100) : ''
  const data = await getLoanRepaymentSummary(query)
  return <div className="loan-summary-content">
    <div className="loan-summary-toolbar"><div><p className="loan-summary-asof">ยอดคงค้าง ณ {dateLabel(data.asOf)}</p><p className="loan-summary-meta">{data.borrowerCount} คน · {data.contractCount} สัญญา · รวมทุกสัญญาที่จ่ายเงินแล้วและยังค้าง</p></div><SummaryControls csv={loanSummaryCsv(data)} date={data.asOf} disabled={!data.contractCount} /></div>
    <div className="loan-summary-metrics">{[['เงินต้นคงค้าง', data.totals.principal], ['ดอกเบี้ยคงค้าง', data.totals.interest], ['ค่าปรับคงค้าง', data.totals.penalty], ['รวมต้องคืนทั้งหมด', data.totals.total]].map(([title, amount]) => <Card key={String(title)} className="loan-summary-metric"><p>{title}</p><strong>{money(Number(amount))} <span>บาท</span></strong></Card>)}</div>
    <form className="loan-summary-search" action="/dashboard/repayments/summary"><label htmlFor="loan-summary-query">ค้นหาผู้กู้หรือเลขสัญญา<input id="loan-summary-query" name="q" defaultValue={query} maxLength={100} placeholder="ชื่อผู้กู้ รหัสผู้กู้ เลข CT หรือเลขสัญญาเดิม" /></label><Button type="submit" variant="primary">ค้นหา</Button>{query && <Link href="/dashboard/repayments/summary">แสดงทั้งหมด</Link>}<Link href="/dashboard/repayments">ไปบันทึกชำระ ↗</Link></form>
    {data.invalidCount > 0 && <p role="alert" className="loan-summary-warning">พบ {data.invalidCount} สัญญาที่ต้องตรวจสอบยอดบัญชี รายการดังกล่าวมีป้าย “ตรวจสอบยอด” ก่อนนำยอดไปใช้</p>}
    <p className="loan-summary-note">เงินต้นและดอกเบี้ยในตารางเป็นยอดที่ยังค้างหลังรับชำระและยกเว้นแล้ว ดอกเบี้ยที่หักล่วงหน้าจะไม่บวกซ้ำ ค่าปรับแสดงแยกต่างหาก{query ? ' · ยอดรวมเฉพาะรายการที่ค้นพบ' : ''}</p>
    {!data.people.length && <Card className="loan-summary-empty"><h2>{query ? 'ไม่พบผู้กู้หรือสัญญาที่ค้นหา' : 'ไม่มีผู้กู้ที่มียอดค้าง'}</h2><p>{query ? 'ลองค้นหาด้วยชื่อ เลขสัญญา หรือแสดงทั้งหมด' : 'สัญญาที่ยังไม่จ่ายเงินและสัญญาที่ชำระครบแล้วจะไม่รวมในรายงานนี้'}</p></Card>}
    {data.people.map(person => <Card as="section" className="loan-summary-person" key={person.id} aria-labelledby={`borrower-summary-${person.id}`}>
      <div className="loan-summary-person-heading"><div><h2 id={`borrower-summary-${person.id}`}>{person.name}</h2><p>{person.code} · {person.contracts.length} สัญญาที่ยังค้าง</p></div><div className="loan-summary-person-actions"><p>รวมต้องคืน <strong>{money(person.amounts.total)} บาท</strong></p><PersonTextControls text={borrowerSummaryText(person, data.asOf, Boolean(query))} name={person.name} /></div></div>
      <div className="loan-summary-table-scroll"><table><caption className="sr-only">ยอดต้องคืนแยกตามสัญญาของ {person.name} หน่วยบาท</caption><thead><tr><th scope="col">เลขที่สัญญา</th><th scope="col">ครบกำหนด</th><th scope="col">เงินต้นคงค้าง</th><th scope="col">ดอกเบี้ยคงค้าง</th><th scope="col">ค่าปรับคงค้าง</th><th scope="col">รวมต้องคืน</th></tr></thead><tbody>{person.contracts.map(row => <tr key={row.id}><td><strong>{row.code}</strong>{row.legacyCode && <small>เลขเดิม {row.legacyCode}</small>}{row.invalid && <small className="loan-summary-warning">ตรวจสอบยอด</small>}</td><td>{row.dueDate ? dateLabel(row.dueDate) : 'ไม่ระบุ'}{row.overdue && <small className="loan-summary-overdue">เกินกำหนด</small>}</td><td>{money(row.principal)}<small>เงินต้นเดิม {money(row.originalPrincipal)}</small></td><td>{money(row.interest)}{row.upfrontInterestReceived > 0 ? <small>รับล่วงหน้าแล้ว {money(row.upfrontInterestReceived)}<br />ไม่รวมยอดคืน</small> : <small>ดอกเบี้ยเดิม {money(row.originalInterest)}</small>}</td><td>{money(row.penalty)}</td><td><strong>{money(row.total)}</strong></td></tr>)}</tbody><tfoot><tr><th scope="row" colSpan={2}>รวม {person.name}</th><td>{money(person.amounts.principal)}</td><td>{money(person.amounts.interest)}</td><td>{money(person.amounts.penalty)}</td><td>{money(person.amounts.total)}</td></tr></tfoot></table></div>
    </Card>)}
    {data.people.length > 0 && <div className="loan-summary-grand-total"><span>รวมทั้งหมด {data.borrowerCount} คน · {data.contractCount} สัญญา</span><strong>{money(data.totals.total)} บาท</strong></div>}
    <p className="loan-summary-footnote">แยกยอดค้างตามลำดับการตัดชำระของระบบ: ค่าปรับ → ดอกเบี้ย → เงินต้น · จัดกลุ่มตามรหัสผู้กู้ ไม่รวมคนละคนที่ชื่อเหมือนกัน</p>
  </div>
}
