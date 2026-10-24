import Link from 'next/link'
import { Suspense } from 'react'
import { connection } from 'next/server'
import { Landmark } from 'lucide-react'
import { Header } from '@/components/ui/header'
import { PageContainer } from '@/components/ui/page-container'
import { Card } from '@/components/ui/card'
import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/lib/auth/current-user'
import { capitalPercent, capitalPosition } from '@/lib/capital'
import { bangkokToday } from '@/lib/ledger'

const money = (value: number) => (value / 100).toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const percent = (value: number, total: number) => `${capitalPercent(value, total).toLocaleString('th-TH', { maximumFractionDigits: 1 })}%`

export default function CapitalPage() {
  return <PageContainer>
    <Header title="ภาพรวมเงินทุน" eyebrow="Capital" description="ปล่อยกู้ไปเท่าไร ได้คืนแล้วเท่าไร และเงินต้นยังค้างอยู่กับใครบ้าง" icon={<Landmark size={21} aria-hidden="true" />} />
    <Suspense fallback={<p role="status" className="p-8 text-sm text-slate-500">กำลังโหลดภาพรวมเงินทุน…</p>}><CapitalContent /></Suspense>
  </PageContainer>
}

async function CapitalContent() {
  await connection()
  const user = await getCurrentUser()
  if (!user || user.status !== 'ACTIVE') return <p role="alert">ไม่มีสิทธิ์ดูข้อมูลนี้</p>
  const asOf = bangkokToday()
  const contracts = await prisma.loanContract.findMany({
    select: { id: true, borrowerCode: true, borrowerName: true, principalSatang: true, interestSatang: true, netSatang: true, repaymentSatang: true, interestMethod: true, status: true, paidAt: true, legacyReceivedSatang: true, repaymentDueDate: true, penaltyMaxDays: true, ledgerEntries: { where: { voidedAt: null }, orderBy: [{ occurredOn: 'asc' }, { id: 'asc' }], select: { id: true, kind: true, amountSatang: true, occurredOn: true, penaltyAssessed: true, penaltyWaivedSatang: true, settlementWaivedSatang: true } } },
    orderBy: { id: 'desc' },
  })
  const rows = contracts.flatMap(c => {
    const position = capitalPosition(c, c.ledgerEntries, asOf)
    return position ? [{ ...position, id: c.id, borrowerName: c.borrowerName, borrowerCode: c.borrowerCode }] : []
  })
  const sum = (key: keyof (typeof rows)[number]) => rows.reduce((total, row) => total + (typeof row[key] === 'number' ? row[key] as number : 0), 0)
  const principal = sum('principal'), returned = sum('principalReceived'), remaining = sum('principalRemaining'), waived = sum('principalWaived'), cashOut = sum('cashOut'), cashReceived = sum('cashReceived')
  return <div className="space-y-5">
    <p className="text-xs text-slate-500">ข้อมูลสะสมถึง {new Date(`${asOf}T00:00:00+07:00`).toLocaleDateString('th-TH', { dateStyle: 'long', timeZone: 'Asia/Bangkok' })} · จ่ายเงินแล้ว {rows.length.toLocaleString('th-TH')} สัญญา · หน่วย: บาท</p>
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {[
        { label: 'เงินจ่ายปล่อยกู้จริง', value: cashOut, note: 'ยอดโอนสุทธิสะสม หลังหักดอกเบี้ยล่วงหน้า', color: 'text-slate-900' },
        { label: 'เงินต้นรับคืนแล้ว', value: returned, note: `${percent(returned, principal)} ของเงินต้นตามสัญญา`, color: 'text-emerald-700' },
        { label: 'เงินต้นคงค้าง', value: remaining, note: `${percent(remaining, principal)} ของเงินต้นตามสัญญา`, color: 'text-amber-700' },
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
    <div className="grid gap-4 sm:grid-cols-3">{[
      ['ดอกเบี้ยรับจากการชำระ', sum('interestReceived')], ['ดอกเบี้ยหักล่วงหน้า', sum('upfrontInterest')], ['ค่าปรับรับแล้ว', sum('penaltyReceived')],
    ].map(([label, amount]) => <Card key={label} className="p-5"><h2 className="text-xs text-slate-600">{label}</h2><p className="mt-3 text-xl font-semibold tabular-nums">{money(amount as number)}</p></Card>)}</div>
    <Card as="section" className="min-w-0 overflow-hidden [&>.liquid-glass-content]:min-w-0">
      <div className="flex flex-wrap items-center justify-between gap-3 p-5"><h2 className="text-base font-semibold">เงินทุนรายสัญญา</h2><Link href="/dashboard/repayments" className="text-xs text-blue-700 underline">ดูประวัติและรับชำระ</Link></div>
      <div className="overflow-x-auto"><table className="w-full whitespace-nowrap text-left text-xs"><thead className="bg-slate-50 text-slate-600"><tr>{['ผู้กู้ / สัญญา', 'จ่ายจริง', 'เงินต้นตามสัญญา', 'เงินต้นคืนแล้ว', 'คืนแล้ว (%)', 'เงินต้นคงค้าง', 'ยกเว้นเงินต้น', 'ดอกเบี้ยรับชำระ', 'รับคืนรวม'].map((label, i) => <th key={label} scope="col" className={`p-4 ${i ? 'text-right' : ''}`}>{label}</th>)}</tr></thead><tbody>{rows.map(row => <tr key={row.id} className="border-t border-slate-200/60"><th scope="row" className="p-4 font-medium"><Link href={`/dashboard/repayments?q=${encodeURIComponent(row.borrowerCode)}&view=ALL`} className="text-blue-700 hover:underline">{row.borrowerName}</Link><p className="mt-1 text-[11px] font-normal text-slate-500">{row.borrowerCode} · #{row.id}</p></th>{[row.cashOut, row.principal, row.principalReceived].map((value, i) => <td key={i} className="p-4 text-right tabular-nums">{money(value)}</td>)}<td className="p-4 text-right font-semibold text-emerald-700">{percent(row.principalReceived, row.principal)}</td>{[row.principalRemaining, row.principalWaived, row.interestReceived, row.cashReceived].map((value, i) => <td key={i} className="p-4 text-right tabular-nums">{money(value)}</td>)}</tr>)}</tbody></table></div>
      {!rows.length && <div className="p-10 text-center"><p className="text-sm text-slate-500">ยังไม่มีสัญญาที่จ่ายเงินกู้แล้ว</p><Link href="/dashboard/ap" className="mt-3 inline-block text-sm text-blue-700 underline">ไปที่จ่ายเงินตามสัญญา</Link></div>}
    </Card>
    <div className="space-y-2 text-xs leading-6 text-slate-500">
      <p>รับชำระตัดค่าปรับ → ดอกเบี้ย → เงินต้น ตามหลักการของระบบ ยอดยกเว้นไม่ถือเป็นเงินรับคืน ดอกเบี้ยหักล่วงหน้าแสดงแยกและไม่รวมในเงินรับคืนรวม</p>
      <p>รวมยอดรับคืนยกมา {money(sum('legacyReceived'))} บาท ตามข้อมูลนำเข้า ไม่นับรายการยกเลิกหรือรายการในอนาคต สัญญาที่ไม่มีรายการจ่ายใช้ยอดสุทธิตามสัญญา</p>
      <p>ยอดปล่อยกู้เป็นยอดสะสม หากนำเงินรับคืนไปปล่อยต่อจะนับเป็นการปล่อยกู้อีกครั้ง ระบบยังไม่มีทะเบียนเงินที่เจ้าของเติมหรือถอน จึงยังไม่แสดงทุนเจ้าของหรือกำไรสุทธิ</p>
    </div>
  </div>
}
