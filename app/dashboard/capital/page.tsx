import { DataLoading } from '@/components/ui/data-loading'
import Link from 'next/link'
import { Suspense } from 'react'
import { connection } from 'next/server'
import { Landmark } from 'lucide-react'
import { Header } from '@/components/ui/header'
import { PageContainer } from '@/components/ui/page-container'
import { Card } from '@/components/ui/card'
import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/lib/auth/current-user'
import { lendingCapitalCash, capitalPercent, capitalPosition, capitalRepaymentAllocations } from '@/lib/capital'
import { bangkokToday } from '@/lib/ledger'
import { CapitalForm } from './capital-form'
import { ReceiptsOverview } from './receipts-overview'
import { lendingReceiptPeriods } from '@/lib/lending-receipts'

const money = (value: number) => (value / 100).toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const percent = (value: number, total: number) => `${capitalPercent(value, total).toLocaleString('th-TH', { maximumFractionDigits: 1 })}%`

export default function CapitalPage() {
  return <PageContainer>
    <Suspense fallback={<DataLoading label="กำลังโหลดภาพรวมเงินทุน…" />}><CapitalContent /></Suspense>
  </PageContainer>
}

async function CapitalContent() {
  await connection()
  const user = await getCurrentUser()
  if (!user || user.status !== 'ACTIVE') return <p role="alert">ไม่มีสิทธิ์ดูข้อมูลนี้</p>
  const canWrite = user.role !== 'REVIEWER'
  const channels = canWrite ? await prisma.paymentChannel.findMany({ where: { isActive: true }, select: { code: true, nameTh: true }, orderBy: { code: 'asc' } }) : []
  const asOf = bangkokToday()
  const contracts = await prisma.loanContract.findMany({
    select: { id: true, borrowerCode: true, borrowerName: true, principalSatang: true, interestSatang: true, netSatang: true, repaymentSatang: true, interestMethod: true, status: true, paidAt: true, legacyReceivedSatang: true, repaymentDueDate: true, penaltyMaxDays: true, ledgerEntries: { where: { voidedAt: null }, orderBy: [{ occurredOn: 'asc' }, { id: 'asc' }], select: { id: true, kind: true, amountSatang: true, occurredOn: true, penaltyAssessed: true, penaltyWaivedSatang: true, settlementWaivedSatang: true } } },
    orderBy: { id: 'desc' },
  })
  const cashEntries = await prisma.ledgerEntry.findMany({
    where: { accountScope: 'LENDING', voidedAt: null, occurredOn: { lte: asOf } },
    select: { id: true, accountScope: true, kind: true, contractId: true, direction: true, categoryCode: true, amountSatang: true, occurredOn: true },
  })
  const lendingCash = lendingCapitalCash(cashEntries, new Set(), asOf)
  const rows = contracts.flatMap(c => {
    const position = capitalPosition(c, c.ledgerEntries, asOf)
    return position ? [{ ...position, id: c.id, borrowerName: c.borrowerName, borrowerCode: c.borrowerCode }] : []
  })
  const sum = (key: keyof (typeof rows)[number]) => rows.reduce((total, row) => total + (typeof row[key] === 'number' ? row[key] as number : 0), 0)
  const principal = sum('principal'), returned = sum('principalReceived'), remaining = sum('principalRemaining'), interestRemaining = sum('interestRemaining'), waived = sum('principalWaived'), cashOut = sum('cashOut'), cashReceived = sum('cashReceived')
  const year = asOf.slice(0, 4)
  const beforeYear = `${Number(year) - 1}-12-31`
  const fundingAmount = (codes: string[], direction: string) => cashEntries.filter(entry => entry.kind === 'GENERAL' && entry.direction === direction && codes.includes(entry.categoryCode)).reduce((total, entry) => total + entry.amountSatang, 0)
  const openingCapital = fundingAmount(['OPENING_CAPITAL'], 'IN')
  const additionalCapital = fundingAmount(['CAPITAL_INCREASE', 'CAPITAL_INJECTION'], 'IN')
  const withdrawnCapital = fundingAmount(['CAPITAL_WITHDRAWAL'], 'OUT')
  const priorInterest = contracts.reduce((total, contract) => {
    const position = capitalPosition(contract, contract.ledgerEntries, beforeYear)
    return total + (position ? position.interestReceived + position.upfrontInterest : 0)
  }, 0)
  const totalInterest = sum('interestReceived') + sum('upfrontInterest')
  const yearInterest = totalInterest - priorInterest
  const receiptAllocations = new Map(contracts.flatMap(contract => [...capitalRepaymentAllocations(contract, contract.ledgerEntries, asOf)]))
  const receipts = lendingReceiptPeriods(cashEntries.map(entry => ({ ...entry, allocation: receiptAllocations.get(entry.id) })), asOf)

  return <>
    <Header title="ภาพรวมเงินทุน" eyebrow="Capital" description="เงินสดสำหรับปล่อยกู้ เงินรับคืน และเงินต้นที่ยังค้างกับผู้กู้" icon={<Landmark size={21} aria-hidden="true" />} actions={canWrite ? <CapitalForm channels={channels} /> : undefined} />
    <div className="space-y-5">
    <p className="text-xs text-slate-500">ข้อมูลสะสมถึง {new Date(`${asOf}T00:00:00+07:00`).toLocaleDateString('th-TH', { dateStyle: 'long', timeZone: 'Asia/Bangkok' })} · จ่ายเงินแล้ว {rows.length.toLocaleString('th-TH')} สัญญา · หน่วย: บาท</p>
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {[
        { label: 'เงินสดพร้อมปล่อยกู้', value: lendingCash.balance, note: 'คงเหลือตามบัญชีสินเชื่อ', color: 'text-emerald-700' },
        { label: 'ทุนที่ใส่สุทธิ', value: openingCapital + additionalCapital - withdrawnCapital, note: 'ทุนเจ้าของหลังถอนทุน', color: 'text-slate-900' },
        { label: 'ดอกเบี้ยรับแล้วรวม', value: totalInterest, note: `รับในปีนี้ ${money(yearInterest)} บาท`, color: 'text-sky-700' },
        { label: 'เงินต้นที่ยังค้าง', value: remaining, note: `คืนแล้ว ${percent(returned, principal)}`, color: 'text-amber-700' },
      ].map(item => <Card key={item.label} className="p-4"><p className="text-xs text-slate-500">{item.label}</p><p className={`mt-2 text-2xl font-semibold tracking-tight tabular-nums ${item.color}`}>{money(item.value)}</p><p className="mt-1.5 text-[10px] text-slate-400">{item.note}</p></Card>)}
    </div>
    <details className="rounded-2xl border border-slate-200/70 bg-white/50 px-5 py-3 text-xs">
      <summary className="w-fit cursor-pointer font-medium text-slate-600 focus-visible:outline-2 focus-visible:outline-offset-4">รายละเอียดทุนและดอกเบี้ยสะสม</summary>
      <div className="mt-4 grid gap-6 pb-2 md:grid-cols-3">
        {[
          { title: 'เงินทุนที่ใส่จริง', items: [['ทุนเริ่มต้น', openingCapital], ['เติมทุนเพิ่มเติม', additionalCapital], ['ถอนทุนแล้ว', withdrawnCapital]] },
          { title: 'ดอกเบี้ยรับแล้ว', items: [['รับจากการชำระ', sum('interestReceived')], ['หักล่วงหน้า', sum('upfrontInterest')], ['ค่าปรับรับแล้ว', sum('penaltyReceived')]] },
          { title: 'เงินเคลื่อนไหวสะสม', items: [['รับเงินรวมทุน', lendingCash.incoming], ['จ่ายเงินรวมถอนทุน', lendingCash.outgoing], ['คงเหลือตามบัญชี', lendingCash.balance]] },
        ].map(group => <div key={group.title}><h2 className="mb-3 font-semibold text-slate-700">{group.title}</h2><dl className="space-y-2">{group.items.map(([label, value]) => <div key={label} className="flex justify-between gap-3"><dt className="text-slate-500">{label}</dt><dd className="font-medium tabular-nums">{money(value as number)}</dd></div>)}</dl></div>)}
      </div>
    </details>
    <ReceiptsOverview report={receipts} />
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
      {[
        { label: 'เงินจ่ายปล่อยกู้จริง', value: cashOut, note: 'ยอดโอนสุทธิสะสม หลังหักดอกเบี้ยล่วงหน้า', color: 'text-slate-900' },
        { label: 'เงินต้นรับคืนแล้ว', value: returned, note: `${percent(returned, principal)} ของเงินต้นตามสัญญา`, color: 'text-emerald-700' },
        { label: 'เงินต้นคงค้าง', value: remaining, note: `${percent(remaining, principal)} ของเงินต้นตามสัญญา`, color: 'text-amber-700' },
        { label: 'ดอกเบี้ยตามสัญญาคงค้าง', value: interestRemaining, note: 'ดอกเบี้ยที่ยังไม่ได้รับชำระ', color: 'text-violet-700' },
        { label: 'เงินรับคืนรวม', value: cashReceived, note: `${percent(cashReceived, cashOut)} ของยอดจ่ายจริง · รวมดอกเบี้ยและค่าปรับ`, color: 'text-blue-700' },
      ].map(item => <Card key={item.label} className="p-5"><p className="text-xs text-slate-600">{item.label}</p><p className={`mt-3 break-words text-2xl font-semibold tabular-nums ${item.color}`}>{money(item.value)}</p><p className="mt-2 text-xs leading-5 text-slate-500">{item.note}</p></Card>)}
    </div>
    <Card as="section" className="p-5">
      <div className="flex flex-wrap items-center justify-between gap-3"><h2 className="text-base font-semibold">สัดส่วนเงินต้นตามสัญญา</h2><span className="text-sm text-slate-600">รวม {money(principal)} บาท</span></div>
      <p className="mt-2 text-sm text-emerald-700">ได้รับเงินต้นคืนแล้ว {percent(returned, principal)}</p>
      <div className="mt-4 flex h-5 overflow-hidden rounded-full bg-slate-100" role="img" aria-label={`เงินต้นคืนแล้ว ${percent(returned, principal)} คงค้าง ${percent(remaining, principal)} ยกเว้น ${percent(waived, principal)}`}>
        <div className="bg-emerald-500" style={{ width: `${capitalPercent(returned, principal)}%` }} />
        <div className="bg-amber-400" style={{ width: `${capitalPercent(remaining, principal)}%` }} />
        <div className="bg-slate-400" style={{ width: `${capitalPercent(waived, principal)}%` }} />
      </div>
      <div className="mt-4 flex flex-wrap gap-5 text-xs"><span className="text-emerald-700">● คืนแล้ว {money(returned)} ({percent(returned, principal)})</span><span className="text-amber-800">● คงค้าง {money(remaining)} ({percent(remaining, principal)})</span><span className="text-slate-600">● ยกเว้นเงินต้น {money(waived)} ({percent(waived, principal)})</span></div>
    </Card>
    <Card as="section" className="min-w-0 overflow-hidden [&>.liquid-glass-content]:min-w-0">
      <div className="flex flex-wrap items-center justify-between gap-3 p-5"><h2 className="text-base font-semibold">เงินทุนรายสัญญา</h2><Link href="/dashboard/repayments" className="text-xs text-blue-700 underline">ดูประวัติและรับชำระ</Link></div>
      <div className="overflow-x-auto"><table className="w-full whitespace-nowrap text-left text-xs"><thead className="bg-slate-50 text-slate-600"><tr>{['ผู้กู้ / สัญญา', 'จ่ายจริง', 'เงินต้นตามสัญญา', 'เงินต้นคืนแล้ว', 'คืนแล้ว (%)', 'เงินต้นคงค้าง', 'ดอกเบี้ยคงค้าง', 'ยกเว้นเงินต้น', 'ดอกเบี้ยรับชำระ', 'รับคืนรวม'].map((label, i) => <th key={label} scope="col" className={`p-4 ${i ? 'text-right' : ''}`}>{label}</th>)}</tr></thead><tbody>{rows.map(row => <tr key={row.id} className="border-t border-slate-200/60"><th scope="row" className="p-4 font-medium"><Link href={`/dashboard/repayments?q=${encodeURIComponent(row.borrowerCode)}&view=ALL`} className="text-blue-700 hover:underline">{row.borrowerName}</Link><p className="mt-1 text-[11px] font-normal text-slate-500">{row.borrowerCode} · #{row.id}</p></th>{[row.cashOut, row.principal, row.principalReceived].map((value, i) => <td key={i} className="p-4 text-right tabular-nums">{money(value)}</td>)}<td className="p-4 text-right font-semibold text-emerald-700">{percent(row.principalReceived, row.principal)}</td>{[row.principalRemaining, row.interestRemaining, row.principalWaived, row.interestReceived, row.cashReceived].map((value, i) => <td key={i} className="p-4 text-right tabular-nums">{money(value)}</td>)}</tr>)}</tbody></table></div>
      {!rows.length && <div className="p-10 text-center"><p className="text-sm text-slate-500">ยังไม่มีสัญญาที่จ่ายเงินกู้แล้ว</p><Link href="/dashboard/ap" className="mt-3 inline-block text-sm text-blue-700 underline">ไปที่จ่ายเงินตามสัญญา</Link></div>}
    </Card>
    <div className="space-y-2 text-xs leading-6 text-slate-500">
      <p>รับชำระตัดค่าปรับ → ดอกเบี้ย → เงินต้น ตามหลักการของระบบ ยอดยกเว้นไม่ถือเป็นเงินรับคืน ดอกเบี้ยหักล่วงหน้าแสดงแยกและไม่รวมในเงินรับคืนรวม</p>
      <p>รวมยอดรับคืนยกมา {money(sum('legacyReceived'))} บาท ตามข้อมูลนำเข้า ไม่นับรายการยกเลิกหรือรายการในอนาคต สัญญาที่ไม่มีรายการจ่ายใช้ยอดสุทธิตามสัญญา</p>
      <p>ยอดปล่อยกู้เป็นยอดสะสม หากนำเงินรับคืนไปปล่อยต่อจะนับเป็นการปล่อยกู้อีกครั้ง เงินเติมและถอนทุนอ้างอิงรายการในบัญชีรับ–จ่าย ยอดเงินสดคงเหลือจึงต่างจากเงินต้นคงค้างและกำไรสุทธิ</p>
    </div>
    </div>
  </>
}
