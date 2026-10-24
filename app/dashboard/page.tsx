import Link from 'next/link'
import { Header } from '@/components/ui/header'
import { PageContainer } from '@/components/ui/page-container'
import { Card } from '@/components/ui/card'
import { getDashboardSummary } from '@/lib/dashboard-summary'
import './summary.css'

const number = (n: number) => new Intl.NumberFormat('th-TH', { maximumFractionDigits: 0 }).format(n)
const money = (satang: number) => `฿${new Intl.NumberFormat('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(satang / 100)}`
const colors = ['#dfbb7e', '#7cb7c7', '#9b98d1', '#77b398', '#d79487', '#889baa']

export default async function DashboardPage() {
  const s = await getDashboardSummary()
  const current = s.months[s.months.length - 1]
  const max = Math.max(1, ...s.months.flatMap(m => [m.incoming, m.outgoing]))
  const usage = s.approved > 0 ? s.used / s.approved * 100 : 0
  const metrics = [
    { label: 'ยอดคงค้างตามสัญญา', value: money(s.outstanding), note: `${number(s.activeCount)} สัญญาที่ยังมียอดค้าง · รวมดอกเบี้ยและค่าปรับ`, href: '/dashboard/repayments' },
    { label: 'เกินกำหนดชำระ', value: money(s.overdueAmount), note: `${number(s.overdueCount)} สัญญา · ยอดคงค้างทั้งสัญญา`, href: '/dashboard/repayments' },
    { label: 'รับเงินจริงเดือนนี้', value: money(current.incoming), note: 'รวมทุกรายการรับที่ไม่ยกเลิก', href: '/dashboard/ledger' },
    { label: 'จ่ายเงินจริงเดือนนี้', value: money(current.outgoing), note: `เงินรับหักเงินจ่าย ${money(current.incoming - current.outgoing)}`, href: '/dashboard/accounting' },
  ]
  const segments = s.statuses.map((row, i) => { const from = s.statuses.slice(0, i).reduce((sum, r) => sum + r.count, 0) / s.totalContracts * 100; const offset = from + row.count / s.totalContracts * 100; return `${colors[i % colors.length]} ${from}% ${offset}%` })
  return <PageContainer><div className={'dash-dashboard'}>
    <Header title="ภาพรวมธุรกิจ" description={`ข้อมูลจริง ณ ${s.today} · เวลาไทย · อัปเดตเมื่อเปิดหรือรีเฟรชหน้า`} />
    <div className={'dash-metrics'}>{metrics.map((m, i) => <Card key={m.label} className={'dash-metric'}><Link href={m.href}><span className={'dash-kicker'}>0{i + 1} / {m.label}</span><strong>{m.value}</strong><small>{m.note}</small><span className={'dash-open'}>ดูรายละเอียด ↗</span></Link></Card>)}</div>
    {s.invalidCount > 0 && <p className={'dash-warning'}>พบ {number(s.invalidCount)} สัญญาที่ข้อมูลรับชำระควรตรวจสอบ ยอดสรุปคำนวณตามรายการที่บันทึกไว้</p>}
    <div className={'dash-charts'}>
      <Card as="section" className={'dash-panel'}><div className={'dash-heading'}><h2>กระแสเงินสด 6 เดือน</h2><span>หน่วย: บาท</span></div><p className={'dash-muted'}>ยอดรับ–จ่ายจริงตามวันที่ทำรายการ เดือนปัจจุบันถึงวันนี้</p>
        <div className={'dash-legend'}><span><i style={{ background: colors[0] }} />เงินรับ</span><span><i style={{ background: colors[1] }} />เงินจ่าย</span></div>
        <div className={'dash-bars'} role="img" aria-label="กราฟเงินรับและเงินจ่ายรายเดือน รายละเอียดตัวเลขอยู่ในตารางด้านล่าง">{s.months.map(m => <div key={m.key} className={'dash-month'}><div className={'dash-barPair'}><div title={`${m.label} รับ ${money(m.incoming)}`} style={{ height: `${m.incoming / max * 100}%`, background: colors[0] }} /><div title={`${m.label} จ่าย ${money(m.outgoing)}`} style={{ height: `${m.outgoing / max * 100}%`, background: colors[1] }} /></div><span>{m.label}</span></div>)}</div>
        {!s.months.some(m => m.incoming || m.outgoing) && <p className={'dash-muted'}>ยังไม่มีรายการรับ–จ่ายในช่วงนี้</p>}
        <details className={'dash-details'}><summary>ดูตัวเลขรายเดือน</summary><div className={'dash-tableWrap'}><table><thead><tr><th>เดือน</th><th>รับ</th><th>จ่าย</th><th>สุทธิ</th></tr></thead><tbody>{s.months.map(m => <tr key={m.key}><th>{m.label}</th><td>{money(m.incoming)}</td><td>{money(m.outgoing)}</td><td>{money(m.incoming - m.outgoing)}</td></tr>)}</tbody></table></div></details>
      </Card>
      <Card as="section" className={'dash-panel'}><div className={'dash-heading'}><h2>สถานะสัญญา</h2><span>{number(s.totalContracts)} สัญญา</span></div><div className={'dash-donut'} role="img" aria-label={`สัญญารวม ${s.totalContracts} รายการ`} style={{ background: segments.length ? `conic-gradient(${segments.join(',')})` : '#283b49' }}><div><strong>{number(s.totalContracts)}</strong><small>สัญญาทั้งหมด</small></div></div><ul className={'dash-statuses'}>{s.statuses.map((r,i) => <li key={r.code}><i style={{ background: colors[i % colors.length] }} /><span>{r.label}</span><strong>{number(r.count)}</strong><small>{(r.count / s.totalContracts * 100).toFixed(1)}%</small></li>)}</ul>{!s.totalContracts && <p className={'dash-muted'}>ยังไม่มีข้อมูลสัญญา</p>}</Card>
    </div>
    <div className={'dash-charts'}>
      <Card as="section" className={'dash-panel'}><div className={'dash-heading'}><h2>ครบกำหนดภายใน 7 วัน</h2><span>{number(s.dueSoon.length)} สัญญา</span></div>{s.dueSoon.length ? <div className={'dash-tableWrap'}><table><thead><tr><th>สัญญา</th><th>ครบกำหนด</th><th>คงค้าง</th></tr></thead><tbody>{s.dueSoon.slice(0, 8).map(c => <tr key={c.id}><td><Link href="/dashboard/repayments">CT-{String(c.id).padStart(6, '0')}</Link></td><td>{c.due}</td><td>{money(c.remaining)}</td></tr>)}</tbody></table>{s.dueSoon.length > 8 && <Link href="/dashboard/repayments">ดูรายการทั้งหมด →</Link>}</div> : <p className={'dash-empty'}>ไม่มีสัญญาที่ยังมียอดค้างครบกำหนดในช่วงนี้</p>}</Card>
      <Card as="section" className={'dash-panel'}><div className={'dash-heading'}><h2>ทะเบียนและวงเงิน</h2><span>ภาพรวมทั้งหมด</span></div><div className={'dash-registry'}><Link href="/dashboard/borrower"><strong>{number(s.borrowers)}</strong><span>ผู้กู้</span></Link><Link href="/dashboard/lenders"><strong>{number(s.lenders)}</strong><span>ผู้ให้กู้</span></Link></div><div className={'dash-heading'}><span>ใช้วงเงิน {usage.toFixed(1)}%</span><span>อนุมัติ ฿{number(s.approved)}</span></div><progress className={'dash-progress'} value={Math.min(usage,100)} max={100} aria-label="สัดส่วนวงเงินที่ใช้" /><p className={'dash-muted'}>ใช้ไป ฿{number(s.used)} · เหลือ ฿{number(Math.max(0,s.approved-s.used))}</p>{s.used > s.approved && <p className={'dash-warning'}>ยอดใช้วงเงินสูงกว่าวงเงินอนุมัติรวม</p>}</Card>
    </div>
    <p className={'dash-footnote'}>ยอดคงค้างใช้หลักเดียวกับหน้ารับชำระ รวมยอดยกมาและการยกเว้นที่บันทึกแล้ว · กระแสเงินสดไม่รวมยอดยกมาหรือรายการยกเลิก และไม่ใช่กำไรสุทธิ · วงเงินเป็นข้อมูลทะเบียนผู้กู้</p>
  </div></PageContainer>
}
