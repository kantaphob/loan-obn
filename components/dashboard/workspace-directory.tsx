import Link from 'next/link'
import { ArrowRight, ArrowUpRight } from 'lucide-react'
import { Header } from '@/components/ui/header'
import { PageContainer } from '@/components/ui/page-container'
import { NAV_CHILD_PAGES, NAV_GROUPS, type NavGroup } from '@/lib/nav'

export function WorkspaceDirectory({ group }: { group?: NavGroup }) {
  if (!group) return <PageContainer className="workspace-directory">
    <Header title="พื้นที่ทำงานทั้งหมด" description="เลือกกลุ่มงานที่ต้องการ แล้วเข้าถึงข้อมูลและรายการของคุณ" />
    <div className="workspace-directory-intro"><div><span className="workspace-eyebrow">เริ่มต้นจากงานที่ต้องทำ</span><h2>ทุกส่วนของธุรกิจ อยู่ในที่เดียว</h2><p>ดูภาพรวม บันทึกรายการ ติดตามสินเชื่อ และจัดการทรัพย์สิน</p></div><Link href="/dashboard" className="workspace-primary-link">ดูภาพรวมธุรกิจ<ArrowUpRight size={17} aria-hidden="true" /></Link></div>
    <div className="workspace-area-grid">{NAV_GROUPS.filter(area=>area.id!=='overview').map(area => <Link key={area.id} href={area.href} className="workspace-area-card"><span className="workspace-area-icon"><area.icon size={23} aria-hidden="true" /></span><div><h2>{area.title}</h2><p>{area.description}</p></div><span className="workspace-area-footer">{area.items.length} หน้าทำงาน<ArrowRight size={17} aria-hidden="true" /></span></Link>)}</div>
    <section className="workspace-start-section"><h2>ทางลัดงานประจำ</h2><div>{['/dashboard/ledger','/dashboard/contracts/new','/dashboard/repayments','/thing/property'].map(href => {
      const item = [...NAV_GROUPS.flatMap(area=>area.items),...NAV_CHILD_PAGES].find(item=>item.href===href)!
      return <Link key={href} href={href}><item.icon size={17} aria-hidden="true" />{item.label}<ArrowUpRight size={14} aria-hidden="true" /></Link>
    })}</div></section>
  </PageContainer>

  const children = NAV_CHILD_PAGES.filter(page => group.items.some(item=>item.href===page.parentHref))
  return <PageContainer className="workspace-directory">
    <Header title={group.title} description={group.description} eyebrow="พื้นที่ทำงาน" icon={<group.icon size={22} aria-hidden="true" />} actions={<Link href="/dashboard/workspace" className="action-button action-button--secondary">ทุกกลุ่มงาน</Link>} />
    {group.workflow && <section className="workspace-workflow"><h2>ทางลัดงานหลัก</h2><div>{group.workflow.map((href,index) => {
      const page = group.items.find(item=>item.href===href)!
      return <Link key={href} href={href}><span>{String(index+1).padStart(2,'0')}</span><strong>{page.label}</strong><ArrowUpRight size={15} aria-hidden="true" /></Link>
    })}</div></section>}
    <section aria-label={`หน้าทำงานในหมวด${group.title}`}><div className="workspace-directory-heading"><h2>เลือกงานที่ต้องการ</h2><span>{group.items.length} หน้าทำงาน</span></div><div className="workspace-page-grid">{group.items.map(page => <Link key={page.href} href={page.href} className="workspace-page-card"><span className="workspace-area-icon"><page.icon size={20} aria-hidden="true" /></span><div><h2>{page.label}</h2><p>{page.description}</p></div><ArrowUpRight size={18} aria-hidden="true" /></Link>)}</div></section>
    {children.length > 0 && <section className="workspace-start-section"><h2>หน้ารายละเอียดและเครื่องมือ</h2><div>{children.map(page => <Link key={page.href} href={page.href}><page.icon size={16} aria-hidden="true" />{page.label}<ArrowUpRight size={14} aria-hidden="true" /></Link>)}</div></section>}
  </PageContainer>
}
