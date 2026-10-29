import { DashboardSkeleton } from './dashboard-skeleton'
import Link from 'next/link'
import { Suspense } from 'react'
import { connection } from 'next/server'
import { Header } from '@/components/ui/header'
import { PageContainer } from '@/components/ui/page-container'
import { Card } from '@/components/ui/card'
import { Icon } from '@/components/dashboard/icon'
import { getDashboardSummary } from '@/lib/dashboard-summary'
import { getCurrentUser } from '@/lib/auth/current-user'
import { getDashboardAssets } from '@/lib/dashboard-assets'
import { propertyStatuses } from '@/app/thing/_shared/model'
import { getDashboardOperations } from '@/lib/dashboard-operations'
import { AnimatedMoney, DashboardMotion } from './dashboard-motion'
import './summary.css'

const number = (n: number) => new Intl.NumberFormat('th-TH', { maximumFractionDigits: 0 }).format(n)
const money = (satang: number) => `฿${new Intl.NumberFormat('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(satang / 100)}`
const colors = ['#245fbd', '#087e60', '#6899dd', '#36a889', '#d68b35', '#ba3b51']

export default function DashboardPage() {
  return <Suspense fallback={<DashboardSkeleton />}><DashboardContent /></Suspense>
}

async function DashboardContent() {
  await connection()
  const [s, operator] = await Promise.all([getDashboardSummary('all'), getCurrentUser()])
  const [assets, operations] = await Promise.all([operator?.status === 'ACTIVE' ? getDashboardAssets(operator.id, s.today) : Promise.resolve(null), getDashboardOperations(s.today)])
  const dueAmount = s.dueSoon.reduce((n,r)=>n+r.remaining,0)
  const liquidityGap = Math.max(0,s.pendingPrincipal-s.lendingCashAvailable)
  const receivableTotal = operations.receivables.reduce((n,r)=>n+r.remaining,0)
  const loanChartMax = Math.max(1,...s.loanMonths.map(m=>m.principal+m.interest+m.penalty))
  const max = Math.max(1, ...s.months.flatMap(m => [m.incoming, m.outgoing]))
  const incomingPoints = s.months.map((m,i) => `${54+i*118},${220-m.incoming/max*180}`).join(' ')
  const outgoingPoints = s.months.map((m,i) => `${54+i*118},${220-m.outgoing/max*180}`).join(' ')
  const returnedTotal = s.totalPrincipal
  const returnedPercent = returnedTotal > 0 ? s.principalReturned / returnedTotal * 100 : 0
  const usage = s.approved > 0 ? s.used / s.approved * 100 : 0
  const ledgerCash = s.cashSources.find(row => row.source === 'LEDGER')
  const historicalCash = s.cashSources.find(row => row.source === 'HISTORICAL')
  const shownIncoming = s.cashAvailable ? s.allIncoming : ledgerCash?.incoming ?? 0
  const shownOutgoing = s.cashAvailable ? s.allOutgoing : ledgerCash?.outgoing ?? 0
  const shownNet = shownIncoming - shownOutgoing
  const metrics = [
    { label: s.cashAvailable ? 'รับ' : 'รับตามบัญชีหลัก', value: shownIncoming, href: '/dashboard/ledger' },
    { label: s.cashAvailable ? 'จ่าย' : 'จ่ายตามบัญชีหลัก', value: shownOutgoing, href: '/dashboard/accounting' },
    { label: s.cashAvailable ? 'สุทธิ' : 'สุทธิตามบัญชีหลัก', value: shownNet, href: '/dashboard/accounting' },
    { label: 'เงินจ่ายปล่อยกู้จริง', value: s.actualDisbursement, href: '/dashboard/capital' },
    { label: 'เงินรับคืนรวม', value: s.totalLoanReceived, href: '/dashboard/capital' },
    { label: 'เงินต้นคงค้าง', value: s.principalOutstanding, href: '/dashboard/capital' },
    { label: 'เงินต้นรับคืนแล้ว', value: s.principalReturned, href: '/dashboard/capital' },
    { label: 'ดอกเบี้ยตามสัญญาคงค้าง', value: s.interestOutstanding, href: '/dashboard/capital' },
  ]
  const segments = s.statuses.map((row, i) => { const from = s.statuses.slice(0, i).reduce((sum, r) => sum + r.count, 0) / s.totalContracts * 100; const offset = from + row.count / s.totalContracts * 100; return `${colors[i % colors.length]} ${from}% ${offset}%` })
  return <PageContainer><DashboardMotion>
    <Header title="ภาพรวมธุรกิจ" description={`ณ ${s.today}`} />
    <div className="dash-section-label">สถานะวันนี้ <span>ข้อมูล ณ {s.today}</span></div>
    <div className="dash-today-grid">{[
      {label:'เงินสดพร้อมปล่อยกู้',value:s.lendingCashAvailable,note:'เฉพาะบัญชีสินเชื่อ',href:'/dashboard/capital',tone:'blue'},
      {label:'รอจ่ายเงินกู้',value:s.pendingPrincipal,note:`${s.pendingCount} สัญญา · เงินพร้อมปล่อยต่ำกว่ายอดรอจ่าย ${money(liquidityGap)}`,href:'/dashboard/ap',tone:'amber'},
      {label:'ครบกำหนดใน 7 วัน',value:dueAmount,note:`${s.dueSoon.length} สัญญา`,href:'/dashboard/repayments',tone:'green'},
      {label:'เกินกำหนดสินเชื่อ',value:s.overdueAmount,note:`${s.overdueCount} สัญญา`,href:'/dashboard/repayments',tone:'red'},
    ].map(item=><Card key={item.label} className={`dash-today-card tone-${item.tone}`}><Link href={item.href}><span>{item.label}</span><strong><AnimatedMoney satang={item.value} /></strong><small>{item.note}</small></Link></Card>)}</div>
    {(operations.receivables.length>0 || operations.payables.length>0) && <div className="dash-action-inline"><Link href="/dashboard/receivables">ลูกหนี้ค้างรับนอกสินเชื่อ <strong>{money(receivableTotal)}</strong> · {operations.receivables.filter(r=>r.overdue).length} รายการเกินกำหนด</Link>{operations.payables.length>0 && <Link href="/dashboard/ap">เจ้าหนี้ค้างจ่าย <strong>{money(operations.payables.reduce((n,r)=>n+r.remaining,0))}</strong></Link>}</div>}

    <div className="dash-section-label">ยอดรับ–จ่ายทั้งหมด <span>ตั้งแต่เริ่มบันทึกถึงวันนี้</span></div><div className="dash-cash-grid">{metrics.slice(0,3).map((m,i) => <Card key={m.label} className={`dash-metric dash-cash-card dash-cash-${i}`}><div className="dash-metric-value"><div className="dash-metric-top"><span className="dash-kicker">{m.label}</span><span className="dash-icon"><Icon name={i===0?'wallet':i===1?'chart':'grid'} /></span></div><strong><AnimatedMoney satang={m.value} /></strong><span className="dash-card-tag">{i===0?'เงินรับสะสม':i===1?'เงินจ่ายสะสม':'รับ − จ่ายสะสม'}</span></div></Card>)}</div>
    {!s.cashAvailable && historicalCash && historicalCash.periodCount > 0 && <Card as="section" className="dash-panel dash-history-summary"><div className="dash-heading"><h2>ประวัติรับ–จ่ายเดิม · แสดงแยกจากบัญชีหลัก</h2><span>{number(historicalCash.periodCount)} รายการ</span></div><div className="dash-history-totals"><div><span>รับ</span><strong>{money(historicalCash.incoming)}</strong></div><div><span>จ่าย</span><strong>{money(historicalCash.outgoing)}</strong></div><div><span>สุทธิ</span><strong>{money(historicalCash.incoming-historicalCash.outgoing)}</strong></div></div></Card>}
    {!s.cashAvailable && <p className={'dash-warning'}>แสดงยอดบัญชีหลักและประวัติเดิมแยกกัน เนื่องจากมีข้อมูลหลายแหล่งในปีเดียวกัน ยังไม่รวมเป็นยอดเดียว</p>}
    {s.unrecordedDisbursementCount > 0 && <p className={'dash-warning'}>พบ {number(s.unrecordedDisbursementCount)} สัญญาที่ระบุว่าจ่ายแล้ว แต่ไม่มีรายการบันทึกการจ่ายจริง รวมยอดสุทธิตามสัญญา {money(s.unrecordedDisbursementAmount)}</p>}
    {s.invalidCount > 0 && <p className={'dash-warning'}>พบ {number(s.invalidCount)} สัญญาที่ข้อมูลรับชำระควรตรวจสอบ ยอดสรุปคำนวณตามรายการที่บันทึกไว้</p>}
    <Card as="section" className="dash-panel dash-year-summary"><div className="dash-heading"><h2>ยอดรับ–จ่ายแยกตามปี</h2><span>หน่วย: บาท</span></div><div className="dash-tableWrap"><table><thead><tr><th>ปี</th><th>แหล่งข้อมูล</th><th>รับ</th><th>จ่าย</th><th>สุทธิ</th></tr></thead><tbody>{s.cashYears.flatMap(year => year.available ? [<tr key={year.year}><th>{Number(year.year)+543}</th><td>ทั้งหมด</td><td>{money(year.incoming ?? 0)}</td><td>{money(year.outgoing ?? 0)}</td><td>{money((year.incoming ?? 0)-(year.outgoing ?? 0))}</td></tr>] : year.sources.filter(row => row.periodCount>0).map(row=><tr key={`${year.year}-${row.source}`}><th>{Number(year.year)+543}</th><td>{row.source==='LEDGER'?'บัญชีหลัก':'ประวัติเดิม'}</td><td>{money(row.incoming)}</td><td>{money(row.outgoing)}</td><td>{money(row.incoming-row.outgoing)}</td></tr>))}</tbody></table></div>{!s.cashYears.length && <p className="dash-empty">ยังไม่มีข้อมูลรับ–จ่าย</p>}</Card>
    <div className="dash-section-label">6 เดือนล่าสุด <span>{s.months[0].label} – {s.months[s.months.length-1].label}</span></div>
    <div className="dash-cash-chart-row">
      <Card as="section" className={'dash-panel'}><div className={'dash-heading'}><h2>กระแสเงินสด 6 เดือน</h2><span>หน่วย: บาท</span></div>
        {!s.cashAvailable && <p className="dash-warning">กราฟแสดงเฉพาะรายการบัญชีรับ–จ่าย ไม่รวมประวัติเดิม และยังใช้ยืนยันยอดรวมไม่ได้ </p>}<div className={'dash-legend'}><span><i style={{ background: colors[0] }} />เงินรับ</span><span><i style={{ background: colors[1] }} />เงินจ่าย</span></div>
        <div className="dash-area-chart">
          <svg viewBox="0 0 700 270" role="img" aria-label="กราฟเปรียบเทียบเงินรับและเงินจ่าย 6 เดือน รายละเอียดยอดอยู่ในตาราง">
            <defs>
              <linearGradient id="cash-in-area" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#245fbd" stopOpacity=".5" /><stop offset="1" stopColor="#245fbd" stopOpacity=".03" /></linearGradient>
              <linearGradient id="cash-out-area" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#087e60" stopOpacity=".35" /><stop offset="1" stopColor="#087e60" stopOpacity=".02" /></linearGradient>
            </defs>
            {[0, .25, .5, .75, 1].map(t => <g key={t}>
              <line x1="54" x2="644" y1={220 - t * 180} y2={220 - t * 180} stroke="currentColor" opacity=".12" />
              <text x="44" y={224 - t * 180} textAnchor="end" fontSize="9" fill="currentColor">{number(max * t / 100)}</text>
            </g>)}
            <polygon points={`54,220 ${outgoingPoints} 644,220`} fill="url(#cash-out-area)" />
            <polygon points={`54,220 ${incomingPoints} 644,220`} fill="url(#cash-in-area)" />
            <polyline points={outgoingPoints} fill="none" stroke="#087e60" strokeWidth="2.5" strokeLinejoin="round" />
            <polyline points={incomingPoints} fill="none" stroke="#245fbd" strokeWidth="2.5" strokeLinejoin="round" />
            {s.months.map((m, i) => <g key={m.key}>
              <g role="img" aria-label={`${m.label} รับ ${money(m.incoming)}`}><circle cx={54 + i * 118} cy={220 - m.incoming / max * 180} r="4" fill="#245fbd" /></g>
              <g role="img" aria-label={`${m.label} จ่าย ${money(m.outgoing)}`}><circle cx={54 + i * 118} cy={220 - m.outgoing / max * 180} r="4" fill="#087e60" /></g>
              <text x={54 + i * 118} y="250" textAnchor="middle" fontSize="10" fill="currentColor">{m.label}</text>
            </g>)}
          </svg>
        </div>
        <div className="dash-chart-totals"><div><span>รับ 6 เดือน</span><strong>{money(s.months.reduce((sum,m)=>sum+m.incoming,0))}</strong></div><div><span>จ่าย 6 เดือน</span><strong>{money(s.months.reduce((sum,m)=>sum+m.outgoing,0))}</strong></div></div>
        {!s.months.some(m => m.incoming || m.outgoing) && <p className={'dash-muted'}>ยังไม่มีรายการรับ–จ่ายในช่วงนี้</p>}
<details className="dash-chart-details"><summary>ตารางยอดรับ–จ่าย</summary>        <div className={'dash-tableWrap'}><table><thead><tr><th>เดือน</th><th>รับ</th><th>จ่าย</th><th>สุทธิ</th></tr></thead><tbody>{s.months.map(m => <tr key={m.key}><th>{m.label}</th><td>{money(m.incoming)}</td><td>{money(m.outgoing)}</td><td>{money(m.incoming - m.outgoing)}</td></tr>)}</tbody></table></div></details>
      </Card>

    </div>
    <div className="dash-loan-section"><div className="dash-section-label">พอร์ตสินเชื่อ <span>หน่วย: บาท</span></div>
    <div className="dash-loan-grid">{metrics.slice(3).map((m,i) => <Card key={m.label} className="dash-metric dash-loan-card"><div className="dash-metric-value"><span className="dash-loan-index">{String(i+1).padStart(2,'0')}</span><span className="dash-kicker">{m.label}</span><strong><AnimatedMoney satang={m.value} /></strong></div></Card>)}</div>
    <div className="dash-section-label">เงินทุน <span>ตามรายการบัญชีทุนที่บันทึก</span></div>

    <div className="dash-funding-grid">
      <Card as="section" className="dash-panel dash-funding-main"><div className="dash-heading"><h2>เงินทุนของกิจการสุทธิ</h2></div><p className="dash-pending-value"><AnimatedMoney satang={s.funding.opening+s.funding.added-s.funding.withdrawn} /></p><dl className="dash-funding-list"><div><dt>ทุนเริ่มต้น</dt><dd>{money(s.funding.opening)}</dd></div><div><dt>เติมทุน</dt><dd>{money(s.funding.added)}</dd></div><div><dt>ถอนทุน</dt><dd>{money(s.funding.withdrawn)}</dd></div></dl></Card>
      {[s.funding.borrowed,s.funding.repaid,s.funding.interestPaid,s.funding.profitDistributed].some(value => value>0) && <Card as="section" className="dash-panel"><div className="dash-heading"><h2>เงินทุนจากผู้ให้ทุน</h2></div><p className="dash-pending-value">{money(s.funding.borrowed-s.funding.repaid)}</p><dl className="dash-funding-list"><div><dt>รับทุนสะสม</dt><dd>{money(s.funding.borrowed)}</dd></div><div><dt>คืนเงินต้นผู้ให้ทุน</dt><dd>{money(s.funding.repaid)}</dd></div><div><dt>ดอกเบี้ยจ่ายผู้ให้ทุน</dt><dd>{money(s.funding.interestPaid)}</dd></div><div><dt>ส่วนแบ่งกำไรที่จ่าย</dt><dd>{money(s.funding.profitDistributed)}</dd></div></dl></Card>}
      <Card as="section" className="dash-panel"><div className="dash-heading"><h2>ลูกหนี้ค้างรับนอกสินเชื่อ</h2><Link href="/dashboard/receivables">เปิดทะเบียน ↗</Link></div><p className="dash-pending-value">{money(receivableTotal)}</p><p className="dash-muted">{operations.receivables.length} รายการค้างรับ · {operations.receivables.filter(r=>r.overdue).length} รายการเกินกำหนด</p>{operations.receivables.map(row=><div className="dash-open-item" key={row.id}><span>#{row.id} · ครบกำหนด {row.dueDate || 'ยังไม่ระบุ'}</span><strong>{money(row.remaining)}</strong></div>)}</Card>
    </div>
    <div className="dash-section-label">องค์ประกอบสินเชื่อ <span>{number(s.totalContracts)} สัญญาทั้งหมด · {number(s.activeCount)} สัญญามียอดค้าง</span></div>
    <div className="dash-loan-grid">{[
      ['เงินต้นตามสัญญาที่จ่ายแล้ว',s.totalPrincipal],
      ['ดอกเบี้ยรับจากการชำระ',s.interestReceived],
      ['ดอกเบี้ยหักล่วงหน้า',s.upfrontInterest],
      ['ค่าปรับรับแล้ว',s.penaltyReceived],
      ['เงินต้นยกเว้น',s.principalWaived],
    ].map(([label,value])=><Card key={label} className="dash-metric dash-loan-card"><div className="dash-metric-value"><span className="dash-kicker">{label}</span><strong>{money(value as number)}</strong></div></Card>)}</div>
    <div className="dash-graphic-grid">
      <Card as="section" className="dash-panel dash-recovery"><div className="dash-heading"><h2>สัดส่วนเงินต้นรับคืน</h2><span>รับคืน / เงินต้นตามสัญญาที่จ่ายแล้ว</span></div><div className="dash-recovery-content"><div className="dash-recovery-ring" style={{background:`conic-gradient(#245fbd ${returnedPercent}%, #ffffff55 0)`}}><strong>{returnedPercent.toFixed(1)}%</strong></div><div><span className="dash-kicker">รับคืนแล้ว</span><p className="dash-pending-value"><AnimatedMoney satang={s.principalReturned} /></p><span className="dash-muted">คงค้าง {money(s.principalOutstanding)} · ยกเว้น {money(s.principalWaived)}</span></div></div></Card>
      <Card as="section" className={'dash-panel dash-status-panel dash-loan-section'}><div className={'dash-heading'}><h2>สถานะสัญญา</h2><span>{number(s.totalContracts)} สัญญา</span></div><div className={'dash-donut'} role="img" aria-label={`สัญญารวม ${s.totalContracts} รายการ`} style={{ background: segments.length ? `conic-gradient(${segments.join(',')})` : '#e2e8f0' }}><div><strong>{number(s.totalContracts)}</strong><small>สัญญาทั้งหมด</small></div></div><ul className={'dash-statuses'}>{s.statuses.map((r,i) => <li key={r.code}><i style={{ background: colors[i % colors.length] }} /><span>{r.label}</span><strong>{number(r.count)}</strong><small>{(r.count / s.totalContracts * 100).toFixed(1)}%</small></li>)}</ul>{!s.totalContracts && <p className={'dash-muted'}>ยังไม่มีข้อมูลสัญญา</p>}</Card>

    </div>
    <div className={'dash-charts'}>
      <Card as="section" className={'dash-panel'}><div className={'dash-heading'}><h2>ครบกำหนดภายใน 7 วัน</h2><span>{number(s.dueSoon.length)} สัญญา</span></div>{s.dueSoon.length ? <div className={'dash-tableWrap'}><table><thead><tr><th>สัญญา</th><th>ครบกำหนด</th><th>คงค้าง</th></tr></thead><tbody>{s.dueSoon.map(c => <tr key={c.id}><td><Link href="/dashboard/repayments">CT-{String(c.id).padStart(6, '0')}</Link></td><td>{c.due}</td><td>{money(c.remaining)}</td></tr>)}</tbody></table>{s.dueSoon.length > 8 && <Link href="/dashboard/repayments">ดูรายการทั้งหมด →</Link>}</div> : <p className={'dash-empty'}>ไม่มีสัญญาที่ยังมียอดค้างครบกำหนดในช่วงนี้</p>}</Card>
      <Card as="section" className={'dash-panel'}><div className={'dash-heading'}><h2>ทะเบียนและวงเงิน</h2><span>ภาพรวมทั้งหมด</span></div><div className={'dash-registry'}><Link href="/dashboard/borrower"><strong>{number(s.borrowers)}</strong><span>ผู้กู้</span></Link><Link href="/dashboard/lenders"><strong>{number(s.lenders)}</strong><span>ผู้ให้กู้</span></Link></div><div className={'dash-heading'}><span>ใช้วงเงิน {usage.toFixed(1)}%</span><span>อนุมัติ ฿{number(s.approved)}</span></div><progress className={'dash-progress'} value={Math.min(usage,100)} max={100} aria-label="สัดส่วนวงเงินที่ใช้" /><p className={'dash-muted'}>ใช้ไป ฿{number(s.used)} · เหลือ ฿{number(Math.max(0,s.approved-s.used))}</p>{s.used > s.approved && <p className={'dash-warning'}>ยอดใช้วงเงินสูงกว่าวงเงินอนุมัติรวม</p>}</Card>
    </div>
    <div className="dash-charts">
      <Card as="section" className="dash-panel"><div className="dash-heading"><h2>สัญญาที่ต้องติดตาม</h2><span>{s.overdueContracts.length} สัญญาเกินกำหนด</span></div>{s.overdueContracts.length ? <div className="dash-tableWrap"><table><thead><tr><th>สัญญา</th><th>เกินกำหนด</th><th>ยอดค้าง</th></tr></thead><tbody>{s.overdueContracts.map(row=><tr key={row.id}><td><Link href="/dashboard/repayments">CT-{String(row.id).padStart(6,'0')}</Link></td><td>{row.days} วัน</td><td>{money(row.remaining)}</td></tr>)}</tbody></table></div>:<p className="dash-empty">ไม่มีสัญญาเกินกำหนด</p>}</Card>
      <Card as="section" className="dash-panel"><div className="dash-heading"><h2>การจัดสรรเงินรับคืน 6 เดือน</h2></div><div className="dash-legend"><span><i style={{background:'#245fbd'}} />เงินต้น</span><span><i style={{background:'#087e60'}} />ดอกเบี้ย</span><span><i style={{background:'#d68b35'}} />ค่าปรับ</span></div><div className="dash-allocation-chart">{s.loanMonths.map(m=><div key={m.key}><span>{m.label}</span><div className="dash-allocation-track">{[m.principal,m.interest,m.penalty].map((v,i)=><i key={i} style={{width:`${v/loanChartMax*100}%`,background:['#245fbd','#087e60','#d68b35'][i]}} />)}</div><strong>{money(m.principal+m.interest+m.penalty)}</strong></div>)}</div><p className="dash-muted">ตามทะเบียนสินเชื่อ รวมยอดรับคืนยกมา</p><details className="dash-chart-details"><summary>ตัวเลขแยกองค์ประกอบ</summary><div className="dash-tableWrap"><table><thead><tr><th>เดือน</th><th>ต้น</th><th>ดอกเบี้ย</th><th>ค่าปรับ</th></tr></thead><tbody>{s.loanMonths.map(m=><tr key={m.key}><td>{m.label}</td><td>{money(m.principal)}</td><td>{money(m.interest)}</td><td>{money(m.penalty)}</td></tr>)}</tbody></table></div></details></Card>
    </div>
    </div>
    {assets && <div className="dash-asset-section">
      <div className="dash-section-label">ASSET &amp; PROPERTY <span>ทะเบียนของบัญชีปัจจุบัน</span></div>
      <div className="dash-asset-metrics">{[
        ['ASSET ที่ใช้งาน',`${number(assets.count)} รายการ`],
        ['ต้นทุนสินทรัพย์รวม',money(Math.round(assets.cost*100))],
        ['ภาระหนี้ตามทะเบียน',money(Math.round(assets.debt*100))],
        ['PROPERTY ที่ถืออยู่',`${number(assets.heldPropertyCount)} แห่ง · ขายแล้ว ${number(assets.soldPropertyCount)}`],
      ].map(([label,value])=><Card key={label} className="dash-metric"><div className="dash-metric-value"><span className="dash-kicker">{label}</span><strong>{value}</strong></div></Card>)}</div>
      <div className="dash-graphic-grid">
        <Card as="section" className="dash-panel"><div className="dash-heading"><h2>ประเภทสินทรัพย์</h2><Link href="/thing/asset">ASSET ↗</Link></div><div className="dash-asset-groups">{assets.groups.map((group,i)=><div key={group.label}><div className="dash-heading"><span>{group.label} · {number(group.count)} รายการ</span><strong>{money(Math.round(group.cost*100))}</strong></div><div className="dash-asset-track"><span style={{width:`${assets.cost > 0 ? group.cost/assets.cost*100 : 0}%`,background:colors[i%colors.length]}} /></div></div>)}</div>{!assets.count && <p className="dash-empty">ยังไม่มีสินทรัพย์ที่ใช้งาน</p>}<p className="dash-muted">ขายแล้ว {number(assets.sold)} รายการ · เก็บถาวร {number(assets.archived)} รายการ · แสดงมูลค่าต้นทุนตามทะเบียน</p></Card>
        <Card as="section" className="dash-panel dash-property-panel">
          <div className="dash-heading"><h2>Property</h2><Link href="/thing/property">ทะเบียน ↗</Link></div>
          <div className="dash-property-total"><span>ต้นทุนทรัพย์สินที่ถืออยู่</span><strong>{money(Math.round(assets.propertyCost*100))}</strong><small>{number(assets.linkedCount)} ASSET ที่เชื่อมอยู่</small></div>
          <div className="dash-property-list">{assets.properties.map(row => <article key={row.id} className="dash-property-item">
            <header className="dash-property-header"><div><span className="dash-property-code">{row.code}</span><h3>{row.name}</h3></div><span className={`dash-property-badge ${row.status === 'DISPOSED' ? 'is-sold' : ''}`}>{propertyStatuses[row.status as keyof typeof propertyStatuses] ?? row.status}</span></header>
            {row.status === 'DISPOSED' ? <>
              <div className="dash-property-cost"><span>ต้นทุนเดิม</span><strong>{money(Math.round(row.historicalCost*100))}</strong></div>
              {row.saleAmounts && <><div className="dash-property-sale-status"><i />{row.saleRecorded ? 'เชื่อมรายการรับเงินแล้ว' : 'แจ้งยอดขายแล้ว · รอตรวจบัญชี'}</div><dl className="dash-property-sale-grid"><div><dt>ยอดรับจากการขาย</dt><dd>{money(Math.round(row.saleAmounts.income*100))}</dd></div><div><dt>ปิดธนาคารและค่าธรรมเนียม</dt><dd>{money(Math.round(row.saleAmounts.outflow*100))}</dd></div><div className="dash-property-remaining"><dt>เงินเหลือหลังรายการขาย</dt><dd>{money(Math.round(row.saleAmounts.remaining*100))}</dd><small>ไม่ใช่กำไรสุทธิ</small></div></dl></>}
              <footer className="dash-property-footer"><span>จำหน่ายแล้ว · ไม่รวมในทรัพย์สินที่ถืออยู่</span><Link href="/thing/property">ประวัติการขาย ↗</Link></footer>
            </> : <div className="dash-property-cost"><span>ต้นทุน · {number(row.count)} ASSET</span><strong>{money(Math.round(row.cost*100))}</strong></div>}
          </article>)}</div>
          {!assets.properties.length && <p className="dash-empty">ยังไม่มี Property</p>}
        </Card>
      </div>
    </div>}

    {assets && <div className="dash-operating-section"><div className="dash-section-label">หนี้สินและงานทรัพย์สิน <span>ตามทะเบียนปัจจุบัน</span></div><div className="dash-charts">
      <Card as="section" className="dash-panel"><div className="dash-heading"><h2>ภาระหนี้ธนาคาร</h2><Link href="/thing/liabilities">ทะเบียนหนี้ ↗</Link></div>{assets.liabilities.length?<div className="dash-tableWrap"><table><thead><tr><th>บัญชี</th><th>คงเหลือ</th><th>ค่างวดตามเงื่อนไข</th><th>ชำระล่าสุด</th></tr></thead><tbody>{assets.liabilities.map(row=><tr key={row.id}><td>{row.name || row.bank}</td><td>{money(Math.round(row.remaining*100))}</td><td>{row.installment === null ? 'ยังไม่ระบุ' : money(Math.round(row.installment*100))}</td><td>{row.lastPaid ?? 'ยังไม่มีรายการ'}</td></tr>)}</tbody></table></div>:<p className="dash-empty">ไม่มีหนี้คงเหลือในทะเบียน</p>}<p className="dash-muted">ค่างวดอ้างอิงเงื่อนไขในทะเบียน ไม่ใช่ยอดแจ้งหนี้ธนาคาร · ยังไม่ระบุวันครบกำหนด</p></Card>
      <Card as="section" className="dash-panel"><div className="dash-heading"><h2>งานพัฒนาทรัพย์สิน</h2><span>{assets.projects.length} งาน</span></div>{assets.projects.length?<div className="dash-tableWrap"><table><thead><tr><th>งาน / สถานะ</th><th>งบ</th><th>ต้นทุนบันทึก</th><th>จ่ายสุทธิ</th><th>ค้างต้นทุน</th></tr></thead><tbody>{assets.projects.map(row=><tr key={row.id}><td><strong>{row.name}</strong><small className="dash-project-sub">{({planned:'วางแผน',in_progress:'กำลังดำเนินการ',completed:'เสร็จแล้ว',approved:'อนุมัติแล้ว'} as Record<string,string>)[row.status] ?? row.status} · {row.asset}</small></td><td>{money(Math.round(row.budget*100))}</td><td>{money(Math.round(row.actual*100))}</td><td>{money(Math.round(row.paid*100))}</td><td>{money(Math.round(Math.max(0,row.actual-row.paid)*100))}</td></tr>)}</tbody><tfoot><tr><th>รวม</th><td>{money(Math.round(assets.projects.reduce((n,r)=>n+r.budget,0)*100))}</td><td>{money(Math.round(assets.projects.reduce((n,r)=>n+r.actual,0)*100))}</td><td>{money(Math.round(assets.projects.reduce((n,r)=>n+r.paid,0)*100))}</td><td>{money(Math.round(assets.projects.reduce((n,r)=>n+Math.max(0,r.actual-r.paid),0)*100))}</td></tr></tfoot></table></div>:<p className="dash-empty">ยังไม่มีงานพัฒนาในทรัพย์สินที่ถืออยู่</p>}</Card>
    </div></div>}
    <Card as="section" className="dash-panel dash-recent"><div className="dash-heading"><h2>รายการเงินจริงล่าสุด</h2><Link href="/dashboard/ledger">บัญชีรับ–จ่าย ↗</Link></div><div className="dash-tableWrap"><table><thead><tr><th>วันที่ / เลขรายการ</th><th>หมวด</th><th>สัญญา</th><th>รับ</th><th>จ่าย</th></tr></thead><tbody>{operations.recent.map(row=><tr key={row.id}><td>{row.occurredOn} · #{row.id}</td><td>{row.categoryName}</td><td>{row.contractId ? `CT-${String(row.contractId).padStart(6,'0')}` : '—'}</td><td>{row.direction==='IN'?money(row.amountSatang):'—'}</td><td>{row.direction==='OUT'?money(row.amountSatang):'—'}</td></tr>)}</tbody></table></div>{!operations.recent.length&&<p className="dash-empty">ยังไม่มีรายการบัญชี</p>}</Card>
  </DashboardMotion></PageContainer>
}
