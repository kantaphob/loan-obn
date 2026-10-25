import Link from 'next/link'
import { Suspense } from 'react'
import { connection } from 'next/server'
import { FolderOpen } from 'lucide-react'
import { PageContainer } from '@/components/ui/page-container'
import { Header } from '@/components/ui/header'
import { Card } from '@/components/ui/card'
import { getCurrentUser } from '@/lib/auth/current-user'
import { prisma } from '@/lib/prisma'
import { bangkokToday } from '@/lib/ledger'
import { annualSnapshot, nextMonth } from '@/lib/monthly-accounting'
import { closingDocuments, validateChecklist, type Checklist } from '@/lib/closing-preparation'
import { loadYearWorkpaper } from '@/lib/accounting-workpaper'
import type { ClosingLine } from '@/lib/account-closing'
import { CashBalance } from './cash-balance'
import { MonthReview } from './month-review'
import { PreparationPanel } from './preparation-panel'
import { YearWorkpaper } from './year-workpaper'
import { getMonthReview } from './month-actions'
const money = (n: number) => (n / 100).toLocaleString('th-TH', { minimumFractionDigits: 2 })
const monthName = (month: string) => new Intl.DateTimeFormat('th-TH', { month: 'long', timeZone: 'UTC' }).format(new Date(`${month}-01T00:00:00Z`))
type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> }
export default function AC(props: Props) {
  return <Suspense fallback={<PageContainer><p role="status">กำลังโหลดแฟ้มปิดดุล…</p></PageContainer>}><ClosingContent {...props} /></Suspense>
}
async function ClosingContent({ searchParams }: Props) {
  await connection()
  const user = await getCurrentUser()
  if (!user || user.status !== 'ACTIVE') return <PageContainer>ไม่มีสิทธิ์เข้าถึงข้อมูล</PageContainer>
  const [closes, locks, firstEntry, firstHistorical, params] = await Promise.all([
    prisma.accountingClose.findMany({ orderBy: { endOn: 'desc' } }),
    prisma.accountingMonthLock.findMany({ orderBy: { month: 'desc' } }),
    prisma.ledgerEntry.findFirst({ orderBy: { occurredOn: 'asc' }, select: { occurredOn: true } }),
    prisma.historicalCashEntry.findFirst({ orderBy: { occurredOn: 'asc' }, select: { occurredOn: true } }), searchParams,
  ])
  const today = bangkokToday(), canWrite = ['ADMIN', 'SUPER_ADMIN'].includes(user.role)
  const latest = locks[0]
  const firstYear = [firstEntry?.occurredOn, firstHistorical?.occurredOn, today].filter((d): d is string => Boolean(d)).sort()[0].slice(0, 4)
  const suggested = latest ? nextMonth(latest.month) : `${firstYear}-01`
  const validMonth = typeof params.month === 'string' && /^(19|[2-9]\d)\d{2}-(0[1-9]|1[0-2])$/.test(params.month) && params.month <= today.slice(0, 7) ? params.month : ''
  const reportYear = typeof params.year === 'string' && /^(19|[2-9]\d)\d{2}$/.test(params.year) && params.year <= today.slice(0, 4) ? params.year : validMonth ? validMonth.slice(0, 4) : suggested.slice(0, 4) > today.slice(0, 4) ? today.slice(0, 4) : suggested.slice(0, 4)
  const selectedMonth = validMonth && validMonth.startsWith(reportYear) ? validMonth : suggested.startsWith(reportYear) && suggested <= today.slice(0, 7) ? suggested : `${reportYear}-01`
  const annual = await prisma.$transaction(tx => annualSnapshot(tx, reportYear))
  const locked = locks.find(lock => lock.month === selectedMonth)
  const review = locked ? { snapshot: JSON.parse(locked.snapshotJson) as Awaited<ReturnType<typeof getMonthReview>>['snapshot'], reviewToken: '' } : await getMonthReview(selectedMonth)
  const [documents, index, workpaper] = await prisma.$transaction(async tx => Promise.all([
    closingDocuments(tx, selectedMonth),
    Promise.all(annual.months.map(async row => ({ month: row.month, documents: row.future ? 0 : (await closingDocuments(tx, row.month)).length, preparation: await tx.accountingPreparation.findUnique({ where: { month: row.month }, select: { checklistJson: true } }) }))),
    loadYearWorkpaper(tx, reportYear),
  ]), { timeout: 30000 })
  const yearClose = closes.find(c => c.startOn === `${reportYear}-01-01` && c.endOn === `${reportYear}-12-31`)
  const archivedWorkpaper = yearClose?.workpaperSnapshotJson ? JSON.parse(yearClose.workpaperSnapshotJson) as typeof workpaper : workpaper
  const prep = review.snapshot.preparation
  const checklist = prep ? JSON.parse(prep.checklistJson) as Checklist : null
  let prepared = false
  try { if (checklist) { validateChecklist(checklist, true); prepared = true } } catch { /* Display pending preparation below. */ }
  const years = [...new Set(['2025', '2026', today.slice(0, 4), firstYear, reportYear, ...locks.map(l => l.month.slice(0, 4)), ...closes.map(c => c.startOn.slice(0, 4))])].filter(y => y <= today.slice(0, 4)).sort().reverse()
  return <PageContainer>
    <Header title="ปิดดุล" eyebrow="Closing Files" description="รวบรวมเอกสารและปิดยอดทีละเดือน แล้วสรุปงบและผลกำไรขาดทุนรายปี" icon={<FolderOpen size={21} aria-hidden="true" />} />
    <div className="space-y-5">
      <section className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-blue-200 bg-blue-50 p-5"><div><h2 className="font-semibold">ปิดเดือนใน 3 ขั้นตอน</h2><p className="mt-2 text-sm text-slate-600">1. ตรวจเอกสาร → 2. ตรวจยอดและยอดยกมา → 3. ยืนยันปิดเดือน</p><p className="mt-1 text-xs text-slate-500">ใช้เอกสารจากตอนรับ–จ่าย ไม่ต้องแนบซ้ำ · ปิดครบ 12 เดือน → สรุปปี → บันทึกจ่ายส่วนแบ่งกำไรแยกต่างหาก</p></div>{suggested <= today.slice(0, 7) && <Link href={`/dashboard/ac?year=${suggested.slice(0, 4)}&month=${suggested}#month-file`} className="rounded-xl bg-blue-700 px-4 py-3 text-sm font-medium text-white">ทำเดือนถัดไป · {monthName(suggested)} {suggested.slice(0, 4)}</Link>}</section>
      <nav aria-label="โฟลเดอร์ปีปิดดุล" className="grid gap-3 sm:grid-cols-3 lg:grid-cols-5">{years.map(year => <Link key={year} aria-current={year === reportYear ? 'page' : undefined} href={`/dashboard/ac?year=${year}`} className={`rounded-2xl border p-5 ${year === reportYear ? 'border-blue-400 bg-blue-50' : 'border-slate-200 bg-white/60'}`}><FolderOpen size={24} aria-hidden="true" className="text-amber-600" /><p className="mt-2 text-xl font-semibold">{year}</p><p className="mt-1 text-xs text-slate-500">{locks.filter(lock => lock.month.startsWith(year)).length}/12 เดือน · {closes.some(c => c.kind === 'YEAR_END' && c.startOn.startsWith(year)) ? 'ปิดดุลปีแล้ว' : 'กำลังรวบรวม'}</p></Link>)}</nav>
      <Card as="section" className="space-y-4 p-5"><div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-lg font-semibold">ปิดดุล / {reportYear}</h2><p className="mt-1 text-sm text-slate-500">ข้อมูลถึง {annual.asOf} · ปิดแล้ว {annual.lockedCount}/12 เดือน</p></div><form action="/dashboard/ac" className="flex items-end gap-2"><label className="text-xs">ปีอื่น (ค.ศ.)<input required name="year" type="number" min="1900" max={today.slice(0, 4)} defaultValue={reportYear} className="ml-2 w-24 rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm" /></label><button className="rounded-xl border border-slate-300 px-3 py-2 text-sm">เปิดปี</button></form></div>
        <CashBalance cash={annual.cash} period="year" />
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{[['รับจริงในบัญชีเงินกู้', annual.incoming], ['จ่ายจริงในบัญชีเงินกู้', annual.outgoing], ['เงินต้นรับคืนที่ตรวจแล้ว', annual.principal], ['ยอดคงค้างตามสัญญา', annual.outstanding]].map(([label, amount]) => <div key={label} className="rounded-xl border border-slate-200 p-4"><p className="text-xs text-slate-600">{label}</p><p className="mt-2 text-xl font-semibold">{money(Number(amount))}</p></div>)}</div>
        {(annual.historicalIncoming > 0 || annual.historicalOutgoing > 0) && <p className="rounded-xl bg-amber-50 p-4 text-sm text-amber-900">บัญชีรับ–จ่ายย้อนหลัง: รับ {money(annual.historicalIncoming)} · จ่าย {money(annual.historicalOutgoing)} บาท แสดงแยกจากบัญชีเงินกู้เพื่อไม่รวมยอดซ้ำ <Link href={`/dashboard/cashbook-2025?month=${reportYear}-01`} className="underline">เปิดบัญชีต้นทาง ↗</Link></p>}
        <p className="text-sm text-slate-600">ดอกเบี้ยรับชำระที่แยกแล้ว {money(annual.interest)} · ค่าปรับรับชำระ {money(annual.penalty)} บาท ยอดรับหักจ่ายไม่ใช่กำไรสุทธิ ส่วนกำไรใช้จากงบทดลองที่ตรวจสอบด้านล่าง</p>
        <div className="overflow-x-auto"><table className="w-full whitespace-nowrap text-left text-sm"><caption className="sr-only">สรุปปิดยอดเดือน ปี {reportYear}</caption><thead><tr>{['เดือน', 'รับ / จ่าย บัญชีเงินกู้', 'รับ / จ่าย บัญชีย้อนหลัง', 'ยกมาต้นเดือน', 'คงเหลือสะสม', 'เอกสาร', 'สถานะ', 'ทำรายการ'].map(label => <th scope="col" key={label} className="p-3">{label}</th>)}</tr></thead><tbody>{annual.months.map(row => {
          const item = index.find(m => m.month === row.month)!
          return <tr key={row.month} className={`border-t border-slate-200 ${row.month === selectedMonth ? 'bg-blue-50/70' : ''}`}><th scope="row" className="p-3 font-medium">{monthName(row.month)} {reportYear}</th><td className="p-3 tabular-nums">{money(row.incoming)} / {money(row.outgoing)}</td><td className="p-3 tabular-nums">{money(row.historicalIncoming)} / {money(row.historicalOutgoing)}</td><td className="p-3 tabular-nums">{row.cash?.available ? money(row.cash.opening) : row.future ? '—' : 'รอตรวจ'}</td><td className="p-3 tabular-nums">{row.cash?.available ? money(row.cash.closing) : row.future ? '—' : 'รอตรวจ'}</td><td className="p-3">{item.documents} รายการ</td><td className="p-3">{row.future ? 'ยังไม่ถึงเดือน' : row.locked ? 'ปิดแล้ว' : item.preparation ? 'กำลังตรวจ' : 'รอรวบรวม'}</td><td className="p-3">{!row.future && <Link className="inline-block rounded-xl border border-slate-300 px-3 py-2 text-blue-700" href={`/dashboard/ac?year=${reportYear}&month=${row.month}#month-file`}>{row.locked ? 'ดูชุดปิดเดือน' : 'ตรวจเอกสาร / ปิดยอด'}</Link>}</td></tr>
        })}</tbody></table></div>
        {suggested <= today.slice(0, 7) && <p className="text-xs text-slate-500">ปิดเดือนตามลำดับตั้งแต่มกราคม เดือนถัดไปที่ปิดได้: <Link href={`/dashboard/ac?year=${suggested.slice(0, 4)}&month=${suggested}#month-file`} className="text-blue-700 underline">{monthName(suggested)} {suggested.slice(0, 4)}</Link></p>}
      </Card>
      <Card as="section" className="space-y-5 p-5" id="month-file"><div className="flex flex-wrap justify-between gap-3"><h2 className="text-lg font-semibold">สรุปปิดยอดเดือน {monthName(selectedMonth)} {reportYear}</h2><Link href="/dashboard/ledger" className="text-sm text-blue-700 underline">ดูบัญชีรับ–จ่าย ↗</Link></div>
        <PreparationPanel key={`${selectedMonth}:${prep?.version ?? 0}:${documents.length}`} month={selectedMonth} version={prep?.version ?? 0} initial={checklist} initialNote={prep?.note ?? ''} documents={documents} locked={Boolean(locked)} canWrite={canWrite} />
        {review.snapshot.historical?.length > 0 && <div className="rounded-xl bg-amber-50 p-4 text-sm"><p>บัญชีรับ–จ่ายย้อนหลังเดือนนี้ {review.snapshot.historical.length} รายการ · รับ {money(review.snapshot.historicalIncomingSatang)} · จ่าย {money(review.snapshot.historicalOutgoingSatang)} บาท</p><p className="mt-2 text-xs">ตรวจเทียบกับไฟล์นำเข้าเดิมและแนบหลักฐานประกอบ ไม่รวมกับเงินกู้ด้านล่าง</p><Link href={`/dashboard/cashbook-2025?month=${selectedMonth}`} className="mt-2 inline-block text-blue-700 underline">ดูรายการต้นทาง ↗</Link></div>}
        <MonthReview inSequence={selectedMonth === suggested} nextMonthHref={`/dashboard/ac?year=${nextMonth(selectedMonth).slice(0, 4)}&month=${nextMonth(selectedMonth)}#month-file`} key={`${selectedMonth}:${review.reviewToken}:${locked?.id ?? ''}`} review={review} canWrite={canWrite} locked={Boolean(locked)} completed={review.snapshot.endOn < today} prepared={prepared} />
        {locked && <p className="whitespace-pre-wrap text-xs text-slate-500">ปิดโดย {locked.createdBy} · {locked.createdAt.toLocaleString('th-TH', { timeZone: 'Asia/Bangkok' })} · {locked.note}</p>}
      </Card>
      <Card as="section" className="space-y-5 p-5" id="year-summary"><div><h2 className="text-lg font-semibold">สรุปปี {reportYear}</h2><p className="mt-2 text-sm text-slate-600">ปิดแล้ว {annual.lockedCount}/12 เดือน · ตรวจรายได้ ค่าใช้จ่าย และกำไรสุทธิ ก่อนปิดปีและพิจารณาจ่ายส่วนแบ่งกำไร เงินทุนและเงินต้นรับคืนไม่ใช่กำไร</p></div><details open={annual.lockedCount === 12}><summary className="cursor-pointer text-lg font-semibold">สรุปสิ้นปี · งบทดลอง รายการปรับปรุง และปิดดุลปี {reportYear}</summary><div className="mt-5"><YearWorkpaper key={`${reportYear}:${archivedWorkpaper.baseline?.version ?? 0}:${archivedWorkpaper.adjustments.length}:${yearClose?.id ?? ''}`} year={reportYear} data={archivedWorkpaper} canWrite={canWrite} closed={Boolean(yearClose)} completed={`${reportYear}-12-31` < today} lockedCount={annual.lockedCount} today={today} /></div></details><section className="rounded-xl border border-slate-200 p-4"><h3 className="font-semibold">จ่ายส่วนแบ่งกำไร / ปันผล</h3><p className="mt-2 text-sm text-slate-600">{yearClose ? `ปิดสรุปปีแล้ว · กำไร (ขาดทุน) ของปี ${money(yearClose.profitSatang)} บาท` : 'สรุปกำไรและปิดปีก่อน แล้วกำหนดยอดที่อนุมัติจ่ายและผู้รับ'} · เงินคงเหลือสะสมไม่ใช่ยอดปันผลที่จ่ายได้ทั้งหมด</p><p className="mt-2 text-xs text-slate-500">การปิดปีไม่โอนเงินออก การจ่ายจริงต้องมีรายการจ่ายและหลักฐาน โดยใช้วันที่จ่ายจริงในงวดที่ยังเปิดอยู่</p>{yearClose && <Link href="/dashboard/ledger" className="mt-3 inline-block rounded-xl border border-blue-300 px-4 py-2 text-sm text-blue-700">เปิดบัญชีรับ–จ่ายเพื่อบันทึกเงินออก ↗</Link>}</section></Card>
      <section className="space-y-4"><h2 className="font-semibold">ประวัติรายการปิดดุลปี</h2>{!closes.length && <p className="text-sm text-slate-500">ยังไม่มีรายการปิดดุลปี</p>}{closes.filter(close => close.startOn.startsWith(reportYear)).map(close => {
        const lines = JSON.parse(close.journalJson) as ClosingLine[]
        return <Card key={close.id} className="p-5"><details><summary className="cursor-pointer font-semibold">AC-{close.id} · {close.startOn} ถึง {close.endOn} · กำไร (ขาดทุน) {money(close.profitSatang)} บาท</summary><p className="mt-3 whitespace-pre-wrap text-sm">{close.note}</p><div className="mt-4 overflow-x-auto"><table className="w-full text-left text-sm"><thead><tr><th className="p-3">ขั้นตอน</th><th className="p-3">บัญชี</th><th className="p-3">เดบิต</th><th className="p-3">เครดิต</th></tr></thead><tbody>{lines.map((line, i) => <tr key={i} className="border-t border-slate-200"><td className="p-3">{line.step ?? 'รายการเดิม'}</td><td className="p-3">{line.name}</td><td className="p-3">{money(line.debit)}</td><td className="p-3">{money(line.credit)}</td></tr>)}</tbody></table></div></details></Card>
      })}</section>
    </div>
  </PageContainer>
}
