import { Card } from '@/components/ui/card'
import { Header } from '@/components/ui/header'
import { PageContainer } from '@/components/ui/page-container'
import { Skeleton } from '@/components/ui/data-loading'
import { Icon } from '@/components/dashboard/icon'
import './summary.css'

/** Uses the same containers, grid classes and reading order as the dashboard. */
export function DashboardSkeleton() {
  return <PageContainer><div className="dash-dashboard dash-skeleton" role="status" aria-busy="true">
    <span className="data-loading-label">กำลังโหลดภาพรวม…</span>
    <div aria-hidden="true">
      <Header title="ภาพรวมธุรกิจ" description={<Skeleton width="90px" className="loading-skeleton--small" />} />
      <div className="dash-section-label">สถานะวันนี้ <span><Skeleton width="92px" className="loading-skeleton--small" /></span></div>
      <div className="dash-today-grid">{['เงินสดพร้อมปล่อยกู้','รอจ่ายเงินกู้','ครบกำหนดใน 7 วัน','เกินกำหนดสินเชื่อ'].map((label, i) => <Card key={label} className="dash-today-card"><div className="dash-skeleton-today"><span>{label}</span><strong><Skeleton width="8ch" className="loading-skeleton--number" /></strong><small><Skeleton width="88%" className="loading-skeleton--small" />{i === 1 && <Skeleton width="64%" className="loading-skeleton--small" />}</small></div></Card>)}</div>
      <div className="dash-action-inline"><span className="dash-skeleton-action"><Skeleton width="240px" className="loading-skeleton--small" /></span></div>
      <div className="dash-section-label">ยอดรับ–จ่ายทั้งหมด <span>ตั้งแต่เริ่มบันทึกถึงวันนี้</span></div>
      <div className="dash-cash-grid">{['รับ','จ่าย','สุทธิ'].map((label, i) => <Card key={label} className={`dash-metric dash-cash-card dash-cash-${i}`}><div className="dash-metric-value"><div className="dash-metric-top"><span className="dash-kicker">{label}</span><span className="dash-icon"><Icon name={i === 0 ? 'wallet' : i === 1 ? 'chart' : 'grid'} /></span></div><strong><Skeleton width="10ch" className="loading-skeleton--number" /></strong><span className="dash-card-tag">{i === 0 ? 'เงินรับสะสม' : i === 1 ? 'เงินจ่ายสะสม' : 'รับ − จ่ายสะสม'}</span></div></Card>)}</div>
      <Card as="section" className="dash-panel dash-year-summary"><div className="dash-heading"><h2>ยอดรับ–จ่ายแยกตามปี</h2><span>หน่วย: บาท</span></div><div className="dash-tableWrap"><table><thead><tr>{['ปี','แหล่งข้อมูล','รับ','จ่าย','สุทธิ'].map(label => <th key={label}>{label}</th>)}</tr></thead><tbody>{[0,1].map(row => <tr key={row}>{[0,1,2,3,4].map(column => <td key={column}><Skeleton width={column < 2 ? '4ch' : '11ch'} /></td>)}</tr>)}</tbody></table></div></Card>
      <div className="dash-section-label">6 เดือนล่าสุด <span><Skeleton width="110px" className="loading-skeleton--small" /></span></div>
      <div className="dash-cash-chart-row"><Card as="section" className="dash-panel"><div className="dash-heading"><h2>กระแสเงินสด 6 เดือน</h2><span>หน่วย: บาท</span></div><div className="dash-legend"><span>เงินรับ</span><span>เงินจ่าย</span></div><div className="dash-area-chart dash-skeleton-plot"><Skeleton /></div><div className="dash-chart-totals">{['รับ 6 เดือน','จ่าย 6 เดือน'].map(label => <div key={label}><span>{label}</span><strong><Skeleton width="10ch" className="loading-skeleton--number" /></strong></div>)}</div><div className="dash-chart-details">ตารางยอดรับ–จ่าย</div></Card></div>
      <div className="dash-section-label">พอร์ตสินเชื่อ <span>หน่วย: บาท</span></div><div className="dash-loan-grid">{['เงินจ่ายปล่อยกู้จริง','เงินรับคืนรวม','เงินต้นคงค้าง','เงินต้นรับคืนแล้ว','ดอกเบี้ยตามสัญญาคงค้าง'].map((label,i) => <Card key={label} className="dash-metric dash-loan-card"><div className="dash-metric-value"><span className="dash-loan-index">{String(i+1).padStart(2,'0')}</span><span className="dash-kicker">{label}</span><strong><Skeleton width="7ch" className="loading-skeleton--number" /></strong></div></Card>)}</div>
    </div>
  </div></PageContainer>
}
