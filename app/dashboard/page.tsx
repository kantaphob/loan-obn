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
import './summary.css'

const number = (n: number) => new Intl.NumberFormat('th-TH', { maximumFractionDigits: 0 }).format(n)
const money = (satang: number) => `฿${new Intl.NumberFormat('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(satang / 100)}`
const colors = ['#7461ed', '#55c8da', '#b8a3f5', '#77b398', '#d79487', '#889baa']

type DashboardParams = Promise<{ period?: string; scope?: string }>
export default function DashboardPage({ searchParams }: { searchParams: DashboardParams }) {
  return <Suspense fallback={<PageContainer><p role="status">กำลังโหลดภาพรวม…</p></PageContainer>}><DashboardContent searchParams={searchParams} /></Suspense>
}

async function DashboardContent({ searchParams }: { searchParams: DashboardParams }) {
  await connection()
  const params = await searchParams
  const period = ['month','year'].includes(params.period ?? '') ? params.period! : 'all'
  const scope = ['assets','loans'].includes(params.scope ?? '') ? params.scope! : 'all'
  const [s, operator] = await Promise.all([getDashboardSummary(period), getCurrentUser()])
  const assets = operator?.status === 'ACTIVE' ? await getDashboardAssets(operator.id, s.today) : null
  const max = Math.max(1, ...s.months.flatMap(m => [m.incoming, m.outgoing]))
  const incomingPoints = s.months.map((m,i) => `${54+i*118},${220-m.incoming/max*180}`).join(' ')
  const outgoingPoints = s.months.map((m,i) => `${54+i*118},${220-m.outgoing/max*180}`).join(' ')
  const returnedTotal = s.totalPrincipal
  const returnedPercent = returnedTotal > 0 ? s.principalReturned / returnedTotal * 100 : 0
  const usage = s.approved > 0 ? s.used / s.approved * 100 : 0
  const cashValue = (amount: number) => s.cashAvailable ? money(amount) : 'รอตรวจข้อมูล'
  const metrics = [
    { label: 'รับรวม', value: cashValue(s.allIncoming), href: '/dashboard/ledger' },
    { label: 'จ่ายรวม', value: cashValue(s.allOutgoing), href: '/dashboard/accounting' },
    { label: 'สุทธิ', value: cashValue(s.cashNet), href: '/dashboard/accounting' },
    { label: 'เงินจ่ายปล่อยกู้จริง', value: money(s.actualDisbursement), href: '/dashboard/capital' },
    { label: 'เงินรับคืนรวม', value: money(s.totalLoanReceived), href: '/dashboard/capital' },
    { label: 'เงินต้นคงค้าง', value: money(s.principalOutstanding), href: '/dashboard/capital' },
    { label: 'เงินต้นรับคืนแล้ว', value: money(s.principalReturned), href: '/dashboard/capital' },
    { label: 'ดอกเบี้ยตามสัญญาคงค้าง', value: money(s.interestOutstanding), href: '/dashboard/capital' },
  ]
  const segments = s.statuses.map((row, i) => { const from = s.statuses.slice(0, i).reduce((sum, r) => sum + r.count, 0) / s.totalContracts * 100; const offset = from + row.count / s.totalContracts * 100; return `${colors[i % colors.length]} ${from}% ${offset}%` })
  return <PageContainer><div className={`dash-dashboard dash-scope-${scope}`}>
    <Header title="ภาพรวมธุรกิจ" description={`ณ ${s.today}`} />
    <form className="dash-filters" action="/dashboard"><label>กลุ่มงาน <select name="scope" defaultValue={scope}><option value="all">ภาพรวมแยกกลุ่ม</option><option value="assets">สินทรัพย์ / Property</option><option value="loans">สินเชื่อ</option></select></label><label>ช่วงรับ–จ่าย <select name="period" defaultValue={period}><option value="all">ทั้งหมด</option><option value="month">เดือนนี้</option><option value="year">ปีนี้</option></select></label><button type="submit">แสดงข้อมูล</button><small>ช่วงเวลามีผลกับยอดรับ–จ่ายด้านบน · ทะเบียนและหนี้คงค้าง ณ วันนี้ · กราฟย้อนหลัง 6 เดือน</small></form>
    <Card as="section" className="dash-panel dash-actions"><div className="dash-heading"><h2>รายการที่ต้องจัดการ</h2><span>ณ {s.today}</span></div><div className="dash-action-grid"><Link className="dash-loan-action" href="/dashboard/repayments">ใกล้ครบกำหนด 7 วัน <strong>{s.dueSoon.length} สัญญา</strong></Link><Link className="dash-loan-action" href="/dashboard/ap">รอจ่ายเงิน <strong>{s.pendingCount} สัญญา</strong></Link><Link className="dash-loan-action" href="/dashboard/repayments">เกินกำหนด <strong>{s.overdueCount} สัญญา</strong></Link>{s.unrecordedDisbursementCount > 0 && <Link className="dash-loan-action" href="/dashboard/ap">ระบุว่าจ่ายแล้วแต่ขาดรายการจริง <strong>{s.unrecordedDisbursementCount} สัญญา</strong></Link>}{s.invalidCount > 0 && <Link className="dash-loan-action" href="/dashboard/repayments">ตรวจข้อมูลรับชำระ <strong>{s.invalidCount} สัญญา</strong></Link>}{!s.cashAvailable && <a href="#cash-review">ตรวจแหล่งยอดเงิน <strong>{s.overlappingYears.length} ปีมีหลายแหล่ง</strong></a>}{assets && <Link className="dash-asset-action" href="/thing/property">ขายแล้วรอตรวจบัญชี <strong>{assets.properties.filter(row => row.saleAmounts && !row.saleRecorded).length} Property</strong></Link>}</div></Card>
    <details id="cash-review" className="dash-panel dash-cash-review"><summary>สถานะข้อมูลรับ–จ่าย: {s.cashAvailable ? 'พร้อมแสดงยอด' : 'รอตรวจสอบแหล่งข้อมูล'}</summary><p>ยอดรับ–จ่ายรวมทุกกลุ่มงาน แยกจากต้นทุนสินทรัพย์และยอดสินเชื่อ ห้ามนำยอดเหล่านี้บวกเข้าด้วยกัน</p>{!s.cashAvailable && <p role="status">พบข้อมูลหลายแหล่งในปี {s.overlappingYears.join(', ')} อาจมีรายการทับซ้อน ระบบยังไม่ยืนยันยอดรวม</p>}<ul>{s.cashSources.map(row => <li key={row.source}>{row.source === 'LEDGER' ? 'บัญชีรับ–จ่าย' : 'ประวัติรับ–จ่ายเดิม'} · {row.periodCount} รายการในช่วงที่เลือก · รับ {money(row.incoming)} · จ่าย {money(row.outgoing)}</li>)}</ul><Link href="/dashboard/ledger">เปิดบัญชีรับ–จ่ายเพื่อตรวจรายการ →</Link></details>
    <div className="dash-cash-grid">{metrics.slice(0,3).map((m,i) => <Card key={m.label} className={`dash-metric dash-cash-card dash-cash-${i}`}><div className="dash-metric-value"><div className="dash-metric-top"><span className="dash-kicker">{m.label}</span><span className="dash-icon"><Icon name={i===0?'wallet':i===1?'chart':'grid'} /></span></div><strong>{m.value}</strong><div className="dash-mini-bars" aria-hidden="true">{s.months.map(month => <span key={month.key} style={{height:`${Math.max(3,(i===1?month.outgoing:month.incoming)/max*36)}px`}} />)}</div><span className="dash-card-tag">{i===0?'เงินรับในช่วงที่เลือก':i===1?'เงินจ่ายในช่วงที่เลือก':'รับ − จ่ายในช่วงที่เลือก'}</span></div></Card>)}</div>
    <div className="dash-loan-section"><div className="dash-section-label">พอร์ตสินเชื่อ <span>หน่วย: บาท</span></div>
    <div className="dash-loan-grid">{metrics.slice(3).map((m,i) => <Card key={m.label} className="dash-metric dash-loan-card"><div className="dash-metric-value"><span className="dash-loan-index">{String(i+1).padStart(2,'0')}</span><span className="dash-kicker">{m.label}</span><strong>{m.value}</strong></div></Card>)}</div>
    {!s.cashAvailable && <p className={'dash-warning'}>ยอดรับ–จ่ายสะสมรอตรวจสอบ เนื่องจากพบข้อมูลซ้ำระหว่างแหล่งรายการเงินสด</p>}
    {s.unrecordedDisbursementCount > 0 && <p className={'dash-warning'}>พบ {number(s.unrecordedDisbursementCount)} สัญญาที่ระบุว่าจ่ายแล้ว แต่ไม่มีรายการบันทึกการจ่ายจริง รวมยอดสุทธิตามสัญญา {money(s.unrecordedDisbursementAmount)}</p>}
    {s.invalidCount > 0 && <p className={'dash-warning'}>พบ {number(s.invalidCount)} สัญญาที่ข้อมูลรับชำระควรตรวจสอบ ยอดสรุปคำนวณตามรายการที่บันทึกไว้</p>}
    </div><div className={'dash-charts'}>
      <Card as="section" className={'dash-panel'}><div className={'dash-heading'}><h2>กระแสเงินสด 6 เดือน</h2><span>หน่วย: บาท</span></div>
        {!s.cashAvailable && <p className="dash-warning">กราฟแสดงเฉพาะรายการบัญชีรับ–จ่าย ไม่รวมประวัติเดิม และยังใช้ยืนยันยอดรวมไม่ได้ <a href="#cash-review">ตรวจแหล่งข้อมูล</a></p>}<div className={'dash-legend'}><span><i style={{ background: colors[0] }} />เงินรับ</span><span><i style={{ background: colors[1] }} />เงินจ่าย</span></div>
        <div className="dash-area-chart">
          <svg viewBox="0 0 700 270" role="img" aria-label="กราฟเปรียบเทียบเงินรับและเงินจ่าย 6 เดือน รายละเอียดยอดอยู่ในตาราง">
            <defs>
              <linearGradient id="cash-in-area" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#7461ed" stopOpacity=".5" /><stop offset="1" stopColor="#7461ed" stopOpacity=".03" /></linearGradient>
              <linearGradient id="cash-out-area" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#55c8da" stopOpacity=".35" /><stop offset="1" stopColor="#55c8da" stopOpacity=".02" /></linearGradient>
            </defs>
            {[0, .25, .5, .75, 1].map(t => <g key={t}>
              <line x1="54" x2="644" y1={220 - t * 180} y2={220 - t * 180} stroke="currentColor" opacity=".12" />
              <text x="44" y={224 - t * 180} textAnchor="end" fontSize="9" fill="currentColor">{number(max * t / 100)}</text>
            </g>)}
            <polygon points={`54,220 ${outgoingPoints} 644,220`} fill="url(#cash-out-area)" />
            <polygon points={`54,220 ${incomingPoints} 644,220`} fill="url(#cash-in-area)" />
            <polyline points={outgoingPoints} fill="none" stroke="#55c8da" strokeWidth="2.5" strokeLinejoin="round" />
            <polyline points={incomingPoints} fill="none" stroke="#7461ed" strokeWidth="2.5" strokeLinejoin="round" />
            {s.months.map((m, i) => <g key={m.key}>
              <g role="img" aria-label={`${m.label} รับ ${money(m.incoming)}`}><circle cx={54 + i * 118} cy={220 - m.incoming / max * 180} r="4" fill="#7461ed" /></g>
              <g role="img" aria-label={`${m.label} จ่าย ${money(m.outgoing)}`}><circle cx={54 + i * 118} cy={220 - m.outgoing / max * 180} r="4" fill="#55c8da" /></g>
              <text x={54 + i * 118} y="250" textAnchor="middle" fontSize="10" fill="currentColor">{m.label}</text>
            </g>)}
          </svg>
        </div>
        <div className="dash-chart-totals"><div><span>รับ 6 เดือน</span><strong>{money(s.months.reduce((sum,m)=>sum+m.incoming,0))}</strong></div><div><span>จ่าย 6 เดือน</span><strong>{money(s.months.reduce((sum,m)=>sum+m.outgoing,0))}</strong></div></div>
        {!s.months.some(m => m.incoming || m.outgoing) && <p className={'dash-muted'}>ยังไม่มีรายการรับ–จ่ายในช่วงนี้</p>}
<details className="dash-chart-details"><summary>ตารางยอดรับ–จ่าย</summary>        <div className={'dash-tableWrap'}><table><thead><tr><th>เดือน</th><th>รับ</th><th>จ่าย</th><th>สุทธิ</th></tr></thead><tbody>{s.months.map(m => <tr key={m.key}><th>{m.label}</th><td>{money(m.incoming)}</td><td>{money(m.outgoing)}</td><td>{money(m.incoming - m.outgoing)}</td></tr>)}</tbody></table></div></details>
      </Card>
      <Card as="section" className={'dash-panel dash-status-panel dash-loan-section'}><div className={'dash-heading'}><h2>สถานะสัญญา</h2><span>{number(s.totalContracts)} สัญญา</span></div><div className={'dash-donut'} role="img" aria-label={`สัญญารวม ${s.totalContracts} รายการ`} style={{ background: segments.length ? `conic-gradient(${segments.join(',')})` : '#283b49' }}><div><strong>{number(s.totalContracts)}</strong><small>สัญญาทั้งหมด</small></div></div><ul className={'dash-statuses'}>{s.statuses.map((r,i) => <li key={r.code}><i style={{ background: colors[i % colors.length] }} /><span>{r.label}</span><strong>{number(r.count)}</strong><small>{(r.count / s.totalContracts * 100).toFixed(1)}%</small></li>)}</ul>{!s.totalContracts && <p className={'dash-muted'}>ยังไม่มีข้อมูลสัญญา</p>}</Card>
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
        <Card as="section" className="dash-panel"><div className="dash-heading"><h2>Property</h2><Link href="/thing/property">ทะเบียน ↗</Link></div><p className="dash-pending-value">{money(Math.round(assets.propertyCost*100))}</p><p className="dash-muted">ต้นทุน ASSET ที่เชื่อมอยู่ {number(assets.linkedCount)} รายการ · เป็นส่วนหนึ่งของต้นทุนสินทรัพย์รวม</p>{assets.properties.length ? <div className="dash-tableWrap"><table><thead><tr><th>Property</th><th>สถานะ</th><th>ต้นทุน</th></tr></thead><tbody>{assets.properties.map(row=><tr key={row.id}><td>{row.code} · {row.name}</td><td>{propertyStatuses[row.status as keyof typeof propertyStatuses] ?? row.status}</td><td>{row.status === 'DISPOSED' ? <>ต้นทุนเดิม {money(Math.round(row.historicalCost*100))}<small className="dash-sale-note">ไม่รวมในทรัพย์สินที่ถืออยู่</small>{row.saleAmounts && <details><summary>ผลการขาย · {row.saleRecorded ? 'เชื่อมรับเงินแล้ว' : 'แจ้งยอดแล้ว'}</summary><p>รับตามแจ้ง {money(Math.round(row.saleAmounts.income*100))}<br />ปิดธนาคารและค่าธรรมเนียม {money(Math.round(row.saleAmounts.outflow*100))}<br />เงินเหลือ {money(Math.round(row.saleAmounts.remaining*100))} · ไม่ใช่กำไร</p><Link href="/thing/property">ดูรายละเอียดและสถานะบัญชี →</Link></details>}</> : money(Math.round(row.cost*100))}</td></tr>)}</tbody></table></div> : <p className="dash-empty">ยังไม่มี Property</p>}</Card>
      </div>
    </div>}
    <div className="dash-loan-section"><div className="dash-section-label">เงินทุน <span>ตามรายการบัญชีทุนที่บันทึก</span></div>
    <Card as="section" className="dash-panel dash-lending-cash"><div className="dash-heading"><h2>เงินสดคงเหลือพร้อมปล่อยกู้ต่อ</h2><span>เฉพาะบัญชีสินเชื่อ</span></div><p className="dash-pending-value">{money(s.lendingCashAvailable)}</p><div className="dash-heading"><span>รับสะสม {money(s.lendingCashIn)}</span><span>จ่ายสะสม {money(s.lendingCashOut)}</span></div><details className="dash-chart-details"><summary>ที่มาของยอดเงิน</summary><p className="dash-muted">รวมทุนเริ่มต้น เติมทุน รับคืน และดอกเบี้ยรับ หักเงินจ่ายกู้ ถอนทุน และรายการจ่ายผู้ให้ทุนที่บันทึกแล้ว ไม่รวมบัญชีรับ–จ่ายทั่วไป และยังไม่หักสัญญารอจ่าย</p></details></Card>
    <div className="dash-funding-grid">
      <Card as="section" className="dash-panel dash-funding-main"><div className="dash-heading"><h2>เงินทุนของกิจการสุทธิ</h2></div><p className="dash-pending-value">{money(s.funding.opening+s.funding.added-s.funding.withdrawn)}</p><dl className="dash-funding-list"><div><dt>ทุนเริ่มต้น</dt><dd>{money(s.funding.opening)}</dd></div><div><dt>เติมทุน</dt><dd>{money(s.funding.added)}</dd></div><div><dt>ถอนทุน</dt><dd>{money(s.funding.withdrawn)}</dd></div></dl></Card>
      <Card as="section" className="dash-panel"><div className="dash-heading"><h2>เงินทุนจากผู้ให้ทุน</h2></div><p className="dash-pending-value">{money(s.funding.borrowed-s.funding.repaid)}</p><dl className="dash-funding-list"><div><dt>รับทุนสะสม</dt><dd>{money(s.funding.borrowed)}</dd></div><div><dt>คืนเงินต้นผู้ให้ทุน</dt><dd>{money(s.funding.repaid)}</dd></div><div><dt>ดอกเบี้ยจ่ายผู้ให้ทุน</dt><dd>{money(s.funding.interestPaid)}</dd></div><div><dt>ส่วนแบ่งกำไรที่จ่าย</dt><dd>{money(s.funding.profitDistributed)}</dd></div></dl></Card>
      <Card as="section" className="dash-panel"><div className="dash-heading"><h2>สุทธิรับ–จ่ายในช่วงที่เลือก</h2></div><p className="dash-pending-value">{cashValue(s.cashNet)}</p><div className="dash-heading"><span>เงินต้นอยู่กับผู้กู้</span><strong>{money(s.principalOutstanding)}</strong></div><p className="dash-muted">รับหักจ่ายในช่วงที่เลือก · ไม่ใช่ยอดคงเหลือบัญชีธนาคาร</p></Card>
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
      <Card as="section" className="dash-panel dash-recovery"><div className="dash-heading"><h2>สัดส่วนเงินต้นรับคืน</h2><span>รับคืน / เงินต้นตามสัญญาที่จ่ายแล้ว</span></div><div className="dash-recovery-content"><div className="dash-recovery-ring" style={{background:`conic-gradient(#7461ed ${returnedPercent}%, #ffffff55 0)`}}><strong>{returnedPercent.toFixed(1)}%</strong></div><div><span className="dash-kicker">รับคืนแล้ว</span><p className="dash-pending-value">{money(s.principalReturned)}</p><span className="dash-muted">คงค้าง {money(s.principalOutstanding)} · ยกเว้น {money(s.principalWaived)}</span></div></div></Card>

    </div>
    <div className={'dash-charts'}>
      <Card as="section" className={'dash-panel'}><div className={'dash-heading'}><h2>ครบกำหนดภายใน 7 วัน</h2><span>{number(s.dueSoon.length)} สัญญา</span></div>{s.dueSoon.length ? <div className={'dash-tableWrap'}><table><thead><tr><th>สัญญา</th><th>ครบกำหนด</th><th>คงค้าง</th></tr></thead><tbody>{s.dueSoon.slice(0, 8).map(c => <tr key={c.id}><td><Link href="/dashboard/repayments">CT-{String(c.id).padStart(6, '0')}</Link></td><td>{c.due}</td><td>{money(c.remaining)}</td></tr>)}</tbody></table>{s.dueSoon.length > 8 && <Link href="/dashboard/repayments">ดูรายการทั้งหมด →</Link>}</div> : <p className={'dash-empty'}>ไม่มีสัญญาที่ยังมียอดค้างครบกำหนดในช่วงนี้</p>}</Card>
      <Card as="section" className={'dash-panel'}><div className={'dash-heading'}><h2>ทะเบียนและวงเงิน</h2><span>ภาพรวมทั้งหมด</span></div><div className={'dash-registry'}><Link href="/dashboard/borrower"><strong>{number(s.borrowers)}</strong><span>ผู้กู้</span></Link><Link href="/dashboard/lenders"><strong>{number(s.lenders)}</strong><span>ผู้ให้กู้</span></Link></div><div className={'dash-heading'}><span>ใช้วงเงิน {usage.toFixed(1)}%</span><span>อนุมัติ ฿{number(s.approved)}</span></div><progress className={'dash-progress'} value={Math.min(usage,100)} max={100} aria-label="สัดส่วนวงเงินที่ใช้" /><p className={'dash-muted'}>ใช้ไป ฿{number(s.used)} · เหลือ ฿{number(Math.max(0,s.approved-s.used))}</p>{s.used > s.approved && <p className={'dash-warning'}>ยอดใช้วงเงินสูงกว่าวงเงินอนุมัติรวม</p>}</Card>
    </div>
    <div className="dash-charts">
      <Card as="section" className="dash-panel"><div className="dash-heading"><h2>ยอดเกินกำหนดชำระ</h2><span>{number(s.overdueCount)} สัญญา</span></div><p className="dash-pending-value">{money(s.overdueAmount)}</p></Card>
      <Card as="section" className="dash-panel"><div className="dash-heading"><h2>สัญญารอจ่ายเงิน</h2><span>{number(s.pendingCount)} สัญญา</span></div><p className="dash-pending-value">{money(s.pendingPrincipal)}</p></Card>
    </div>
  </div></div></PageContainer>
}
