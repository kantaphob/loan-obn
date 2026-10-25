import Link from 'next/link'
import { ArrowUpRight, ChevronDown, Database, ListChecks, WalletCards } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Header } from '@/components/ui/header'
import { PageContainer } from '@/components/ui/page-container'
import { MasterdataSubnav } from '@/components/dashboard/masterdata-subnav'
import { GoogleSyncButton } from './google-sync-button'
import { MASTERDATA_MENUS } from '@/lib/masterdata-nav'
import { prisma } from '@/lib/prisma'

type OverviewItem = { code: string; label: string; note?: string; href?: string }

export default async function Masterdata() {
  const [categories, rates, statuses, risks, banks, postcodes, channels, assetCategories] = await Promise.all([
    prisma.financialCategory.findMany({ where: { isActive: true }, orderBy: { sortOrder: 'asc' }, select: { code: true, nameTh: true, direction: true } }),
    prisma.interestRate.findMany({ where: { isActive: true }, orderBy: { sortOrder: 'asc' }, select: { code: true, percent: true } }),
    prisma.loanStatus.findMany({ where: { isActive: true }, orderBy: { sortOrder: 'asc' }, select: { code: true, nameTh: true } }),
    prisma.riskRating.findMany({ where: { isActive: true }, orderBy: { score: 'asc' }, select: { code: true, nameTh: true, isBlacklist: true } }),
    prisma.bank.findMany({ where: { isActive: true }, orderBy: { sortOrder: 'asc' }, select: { code: true, nameTh: true } }),
    prisma.postcode.findMany({ orderBy: { code: 'asc' }, select: { code: true } }),
    prisma.paymentChannel.findMany({ where: { isActive: true }, orderBy: { code: 'asc' }, select: { code: true, nameTh: true } }),
    prisma.assetCategory.findMany({ where: { isActive: true }, orderBy: [{ sortOrder: 'asc' }, { code: 'asc' }], select: { code: true, nameTh: true, parent: { select: { nameTh: true } } } }),
  ])
  const data: Record<string, OverviewItem[]> = {
    'asset-category': assetCategories.map((item) => ({ code: item.code, label: item.nameTh, note: item.parent?.nameTh ?? 'ประเภทหลัก' })),
    category: categories.map((item) => ({ code: item.code, label: item.nameTh, note: item.direction === 'IN' ? 'เงินเข้า' : 'เงินออก' })),
    'interest-rate': rates.map((item) => ({ code: item.code, label: `${item.percent}%`, note: 'ร้อยละดอกเบี้ย' })),
    'loan-status': statuses.map((item) => ({ code: item.code, label: item.nameTh })),
    'risk-rating': risks.map((item) => ({ code: item.code, label: item.nameTh, note: item.isBlacklist ? 'รายการระงับ' : undefined })),
    bank: banks.map((item) => ({ code: item.code, label: item.nameTh })),
    postcode: postcodes.map((item) => ({ code: item.code, label: item.code, href: `/dashboard/admin/masterdata/postcode?q=${encodeURIComponent(item.code)}` })),
    'payment-channel': channels.map((item) => ({ code: item.code, label: item.nameTh })),
  }
  const sections = [
    ...MASTERDATA_MENUS.map((menu) => ({ ...menu, key: menu.href.split('/').pop()! })),
    { key: 'payment-channel', title: 'ช่องทางการเงิน', description: 'ช่องทางรับและจ่ายเงินในระบบ', href: '/dashboard/admin/masterdata/category', icon: WalletCards },
  ]
  const total = Object.values(data).reduce((sum, items) => sum + items.length, 0)

  return (
    <PageContainer>
      <Header title="Masterdata" eyebrow="Administration" description="ข้อมูลหลักทั้งหมดในระบบ แยกตามประเภทข้อมูล" status={{ label: `${total.toLocaleString('th-TH')} รายการ`, tone: 'success' }} />
      <MasterdataSubnav />
      <Card className="mb-5 flex flex-wrap items-center justify-between gap-4 p-5">
        <div><h2 className="m-0 text-sm font-semibold text-slate-100">Google Sheets และ Google Drive</h2><p className="mb-0 mt-1 text-xs text-slate-400">ส่งข้อมูลเดิมเข้า Spreadsheet และเก็บเอกสารไว้ใน Drive</p></div>
        <GoogleSyncButton />
      </Card>
      <div className="mb-5 grid gap-3 sm:grid-cols-3">
        {[
          { label: 'ข้อมูลหลักทั้งหมด', value: total, unit: 'รายการ', icon: Database },
          { label: 'ประเภทข้อมูล', value: sections.length, unit: 'ประเภท', icon: ListChecks },
          { label: 'หมวดรับ–จ่าย', value: categories.length, unit: 'หมวดหมู่', icon: WalletCards },
        ].map(({ label, value, unit, icon: Icon }) => (
          <Card key={label} className="p-5"><div className="flex items-center justify-between text-xs text-slate-400"><span>{label}</span><Icon size={17} aria-hidden="true" /></div><p className="mb-0 mt-3 text-2xl font-semibold tabular-nums text-slate-100">{value.toLocaleString('th-TH')} <span className="text-xs font-normal text-slate-400">{unit}</span></p></Card>
        ))}
      </div>
      <div className="space-y-4">
        {sections.map(({ key, title, description, href, icon: Icon }) => {
          const items = data[key] ?? []
          const isPostcode = key === 'postcode'
          return (
            <Card key={key} as="section" className="overflow-hidden">
              <details open={!isPostcode} className="group">
                <summary className="flex cursor-pointer list-none items-center gap-3 px-5 py-4 focus-visible:outline-2 focus-visible:outline-offset-[-3px] focus-visible:outline-sky-300 [&::-webkit-details-marker]:hidden">
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-sky-300/20 bg-sky-300/5 text-sky-200"><Icon size={18} aria-hidden="true" /></span>
                  <span className="min-w-0 flex-1"><h2 className="m-0 text-sm font-semibold text-slate-100">{title}</h2><span className="mt-1 block text-[11px] text-slate-400">{description}</span></span>
                  <span className="shrink-0 text-xs tabular-nums text-slate-300">{items.length.toLocaleString('th-TH')} รายการ</span>
                  <ChevronDown size={16} aria-hidden="true" className="shrink-0 text-slate-400 transition-transform group-open:rotate-180" />
                </summary>
                <div className="border-t border-white/10 px-5 pb-5 pt-4">
                  {items.length ? <ul className={`grid gap-2 ${isPostcode ? 'grid-cols-3 sm:grid-cols-6 lg:grid-cols-10' : 'sm:grid-cols-2 xl:grid-cols-3'}`}>
                    {items.map((item) => <li key={item.code} className="min-w-0 rounded-xl border border-slate-400/15 bg-slate-400/5">
                      {item.href ? <Link href={item.href} className="block rounded-xl px-3 py-3 text-center font-mono text-xs text-sky-200 hover:bg-sky-300/10 focus-visible:outline-2 focus-visible:outline-sky-300">{item.label}</Link> : <div className="flex items-center justify-between gap-3 px-3 py-3"><span className="min-w-0 break-words text-xs leading-6 text-slate-200">{item.label}</span>{item.note ? <span className={`shrink-0 text-[10px] ${item.note === 'เงินเข้า' ? 'text-emerald-200' : item.note === 'เงินออก' ? 'text-orange-200' : 'text-slate-400'}`}>{item.note}</span> : null}</div>}
                    </li>)}
                  </ul> : <p className="py-5 text-center text-xs text-slate-400">ยังไม่มีข้อมูล</p>}
                </div>
              </details>
              <div className="flex justify-end border-t border-white/10 px-5 py-3"><Link href={href} className="inline-flex min-h-9 items-center gap-1.5 rounded-lg px-2 text-xs font-medium text-sky-200 hover:bg-sky-300/10 focus-visible:outline-2 focus-visible:outline-sky-300">เปิดหน้า{title}<ArrowUpRight size={14} aria-hidden="true" /></Link></div>
            </Card>
          )
        })}
      </div>
    </PageContainer>
  )
}
