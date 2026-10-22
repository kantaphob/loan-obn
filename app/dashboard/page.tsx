import { Header } from '@/components/ui/header'
import { PageContainer } from '@/components/ui/page-container'
import Link from 'next/link'
import { Icon } from '@/components/dashboard/icon'
import { Card } from '@/components/ui/card'
import { MetricCard } from '@/components/dashboard/metric-card'

export default function DashboardPage() {
  return (
    <div className="relative z-10 min-h-[calc(100dvh-24px)] font-sans text-[#202a3c]">
        <PageContainer>
          <Header title="ภาพรวม" eyebrow="Workspace" description="ภาพรวมสินเชื่อและการดำเนินงาน" />
          <div id="metrics" className="grid grid-cols-3 gap-3 max-[760px]:grid-cols-1">
            <MetricCard label="คำขอสินเชื่อทั้งหมด" value="1,284" change="↑ 12.8%" note="จากเดือนที่แล้ว" icon="file" tone="emerald" />
            <MetricCard label="รอพิจารณา" value="86" change="ต้องดำเนินการ" note="ภายในวันนี้" icon="users" tone="amber" />
            <MetricCard label="อนุมัติเดือนนี้" value="฿8.42M" change="↑ 8.2%" note="จากเดือนที่แล้ว" icon="chart" tone="green" />
          </div>

          <div className="dashboard-insights">
            <Card as="section" className="trend-panel">
              <div className="insight-heading"><h2><Icon name="chart" />แนวโน้มสินเชื่อ</h2><span className="sample-label">ข้อมูลตัวอย่าง</span></div>
              <p className="insight-description">ภาพรวมวงเงินอนุมัติรายเดือน</p>
              <svg className="loan-trend" viewBox="0 0 600 200" role="img" aria-label="กราฟตัวอย่างวงเงินอนุมัติเดือนพฤษภาคมถึงตุลาคม ยังไม่เชื่อมต่อข้อมูลจริง">
                <defs><linearGradient id="loan-trend-fill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#dfb575" stopOpacity=".45" /><stop offset="100%" stopColor="#dfb575" stopOpacity="0" /></linearGradient></defs>
                {[40, 80, 120, 160].map(y => <line key={y} x1="25" x2="575" y1={y} y2={y} stroke="#a6c3d5" strokeOpacity=".08" />)}
                <path d="M25 133 C65 133 90 153 135 125 S205 120 245 99 S310 43 355 58 S422 90 465 65 S540 38 575 32 L575 170 L25 170Z" fill="url(#loan-trend-fill)" />
                <path d="M25 133 C65 133 90 153 135 125 S205 120 245 99 S310 43 355 58 S422 90 465 65 S540 38 575 32" fill="none" stroke="#e8c58e" strokeWidth="2" />
                {[[25,133],[135,125],[245,99],[355,58],[465,65],[575,32]].map(([x,y]) => <circle key={x} cx={x} cy={y} r="3" fill="#f5d6a1" />)}
                {['พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.'].map((month,i) => <text key={month} x={25+i*110} y="192" textAnchor="middle" fill="#91a5b5" fontSize="11">{month}</text>)}
              </svg>
            </Card>
            <Card as="section" className="portfolio-panel">
              <div className="insight-heading"><h2><Icon name="wallet" />สรุปการดำเนินงาน</h2></div>
              <dl className="portfolio-details">
                <div><dt><Icon name="file" />คำขอทั้งหมด</dt><dd>1,284 <small>รายการ</small></dd></div>
                <div><dt><Icon name="users" />รอพิจารณา</dt><dd>86 <small>รายการ</small></dd></div>
                <div><dt><Icon name="chart" />วงเงินอนุมัติ</dt><dd>฿8.42M</dd></div>
              </dl>
              <Link href="/dashboard/applications" className="portfolio-link">จัดการคำขอสินเชื่อ <Icon name="chevron" /></Link>
            </Card>
          </div>

          <Card as="section" className="dashboard-shortcuts">
            <div className="insight-heading"><h2><Icon name="grid" />เข้าถึงด่วน</h2></div>
            <div className="shortcut-grid">
              {[{href:'/dashboard/applications',label:'ผู้กู้',icon:'users' as const},{href:'/dashboard/lenders',label:'ผู้ให้กู้',icon:'wallet' as const},{href:'/dashboard/contracts',label:'สัญญากู้',icon:'file' as const},{href:'/dashboard/logs',label:'บันทึกการทำงาน',icon:'chart' as const}].map(item => <Link key={item.href} href={item.href} className="dashboard-shortcut"><span><Icon name={item.icon} /></span>{item.label}<Icon name="chevron" /></Link>)}
            </div>
          </Card>

          <Card id="applications" as="section" className="mt-5 overflow-hidden">
            <div className="flex items-center justify-between border-b border-white/70 px-[21px] py-[19px] max-[760px]:p-4">
              <div><h2 className="m-0 text-[13px] font-semibold text-[#292a2c]">คำขอล่าสุด</h2><p className="mt-[5px] text-[10px] text-[#77787b]">ติดตามสถานะคำขอสินเชื่อที่เข้ามา</p></div>
              <Link href="/dashboard/applications" className="flex items-center gap-[3px] text-[10px] font-semibold text-[#286fe8] no-underline">ดูคำขอทั้งหมด <Icon name="chevron" /></Link>
            </div>
            <div className="flex min-h-[210px] flex-col items-center justify-center px-[22px] py-[22px] text-center">
              <span className="grid h-[42px] w-[42px] place-items-center rounded-xl border border-white/75 bg-white/35 text-[#565659] shadow-[inset_0_1px_0_#ffffff]"><Icon name="file" /></span>
              <strong className="mt-3 text-[11px] text-[#343537]">ทุกอย่างเรียบร้อยดี</strong>
              <p className="mt-[6px] text-[10px] text-[#77787b]">คำขอสินเชื่อใหม่จะแสดงที่นี่เมื่อมีรายการเข้ามา</p>
            </div>
          </Card>
        </PageContainer>
    </div>
  )
}
