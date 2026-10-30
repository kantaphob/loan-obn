'use client'

import { useState } from 'react'
import { Card } from '@/components/ui/card'
import type { lendingReceiptPeriods } from '@/lib/lending-receipts'

const money = (value: number) => (value / 100).toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const shortMoney = (value: number) => (value / 100).toLocaleString('th-TH', { maximumFractionDigits: 0 })
const monthNames = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.']
const monthLabel = (key: string) => `${monthNames[Number(key.slice(5, 7)) - 1]} ${Number(key.slice(0, 4)) + 543}`
const series = [
  { key: 'funding', label: 'ทุนเข้า', color: 'bg-indigo-400' },
  { key: 'principal', label: 'เงินต้นรับคืน', color: 'bg-emerald-500' },
  { key: 'interest', label: 'ดอกเบี้ยรับชำระ', color: 'bg-sky-400' },
  { key: 'penalty', label: 'ค่าปรับ', color: 'bg-amber-400' },
  { key: 'unallocated', label: 'ยังไม่แยกประเภท', color: 'bg-slate-400' },
] as const

type Report = ReturnType<typeof lendingReceiptPeriods>
export function ReceiptsOverview({ report }: { report: Report }) {
  const [view, setView] = useState<'month' | 'six' | 'year'>('year')
  const periods = {
    month: { title: 'เดือนนี้', range: monthLabel(report.asOf), data: report.thisMonth, rows: report.days },
    six: { title: '6 เดือน', range: `${monthLabel(report.sixMonths.from)} – ${monthLabel(report.asOf)}`, data: report.sixMonths, rows: report.sixMonthRows },
    year: { title: 'ทั้งปี', range: `ปี ${report.year + 543} · ถึง ${Number(report.asOf.slice(8, 10))} ${monthLabel(report.asOf)}`, data: report.thisYear, rows: report.months },
  }
  const selected = periods[view]
  const visibleSeries = series.filter(item => ['funding', 'principal', 'interest'].includes(item.key) || selected.data[item.key] > 0)
  const maximum = Math.max(...selected.rows.map(row => row.total), 1)
  const label = (key: string) => view === 'month' ? key.slice(8, 10) : monthNames[Number(key.slice(5, 7)) - 1]
  const currentKey = view === 'month' ? report.asOf : report.asOf.slice(0, 7)
  return <Card as="section" className="min-w-0 overflow-hidden p-5 [&>.liquid-glass-content]:min-w-0">
    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200/60 pb-4">
      <div><h2 className="text-sm font-semibold text-slate-800">ยอดรับสินเชื่อ</h2><p className="mt-1 text-[11px] text-slate-500">{selected.range} · หน่วย: บาท</p></div>
      <div className="flex rounded-xl bg-slate-100 p-1" role="group" aria-label="ช่วงเวลายอดรับ">{(['month', 'six', 'year'] as const).map(key => <button key={key} type="button" onClick={() => setView(key)} aria-pressed={view === key} className={`min-h-9 rounded-lg px-4 text-xs transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600 ${view === key ? 'bg-white font-semibold text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}>{periods[key].title}</button>)}</div>
    </div>
    <div className="grid gap-6 pt-5 lg:grid-cols-[240px_minmax(0,1fr)]">
      <div className="rounded-2xl bg-slate-50/80 p-4">
        <p className="text-xs text-slate-500">รับเงินรวมทุน</p><p className="mt-2 break-words text-3xl font-semibold tracking-tight text-slate-900 tabular-nums">{money(selected.data.total)}</p><p className="mt-1 text-[10px] text-slate-400">{selected.data.count.toLocaleString('th-TH')} รายการ</p>
        <dl className="mt-5 space-y-3 border-t border-slate-200/70 pt-4">{visibleSeries.map(item => <div key={item.key} className="flex items-center justify-between gap-3 text-xs"><dt className="flex items-center gap-2 text-slate-500"><span className={`h-2 w-2 rounded-full ${item.color}`} />{item.label}</dt><dd className="font-semibold tabular-nums text-slate-700">{money(selected.data[item.key])}</dd></div>)}</dl>
      </div>
      <div className="min-w-0">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3"><h3 className="text-xs font-medium text-slate-600">{view === 'month' ? 'ยอดรับรายวัน' : 'ยอดรับรายเดือน'}</h3><div className="flex flex-wrap gap-x-3 gap-y-1 text-[10px] text-slate-500">{visibleSeries.map(item => <span key={item.key} className="flex items-center gap-1"><span className={`h-1.5 w-1.5 rounded-sm ${item.color}`} />{item.label}</span>)}</div></div>
        <div className="overflow-x-auto pb-2"><div style={{ minWidth: view === 'month' ? 650 : view === 'six' ? 300 : 480 }}>
          <div className="relative grid h-44 gap-2 border-b border-slate-200" style={{ gridTemplateColumns: `repeat(${selected.rows.length},minmax(0,1fr))` }} role="img" aria-label={`${view === 'month' ? 'กราฟรายวัน' : 'กราฟรายเดือน'} ${selected.range} แยกทุน เงินต้น ดอกเบี้ย และค่าปรับ มีตารางตัวเลขด้านล่าง`}>
            <div aria-hidden="true" className="pointer-events-none absolute inset-0 flex flex-col justify-between"><span className="border-t border-dashed border-slate-200/70" /><span className="border-t border-dashed border-slate-200/70" /><span className="border-t border-dashed border-slate-200/70" /><span /></div>
            {selected.rows.map(row => <div key={row.key} className="relative flex min-w-0 flex-col items-center justify-end px-0.5 pt-6" title={`${row.key}: ${row.future ? 'ยังไม่ถึงวัน/เดือนนี้' : `${money(row.total)} บาท`}`}>
              {!row.future && (view !== 'month' || row.total > 0) && <span className={`absolute top-0 text-[9px] tabular-nums ${row.key === currentKey ? 'font-semibold text-emerald-700' : 'text-slate-400'}`}>{row.total ? shortMoney(row.total) : '0'}</span>}
              <div className={`flex w-full max-w-7 flex-col justify-end overflow-hidden rounded-t-md ${row.future ? 'bg-slate-100' : ''}`} style={{ height: row.future ? '3%' : `${row.total / maximum * 100}%`, minHeight: row.total ? 3 : 0 }} aria-hidden="true">{[...visibleSeries].reverse().map(item => <div key={item.key} className={item.color} style={{ height: `${row.total ? row[item.key] / row.total * 100 : 0}%` }} />)}</div>
            </div>)}
          </div>
          <div className="mt-2 grid gap-2 text-center text-[9px]" style={{ gridTemplateColumns: `repeat(${selected.rows.length},minmax(0,1fr))` }}>{selected.rows.map(row => <span key={row.key} className={row.key === currentKey ? 'font-semibold text-emerald-700' : row.future ? 'text-slate-300' : 'text-slate-500'}>{view !== 'month' || Number(row.key.slice(8, 10)) % 5 === 0 || row.key.endsWith('-01') ? label(row.key) : ''}</span>)}</div>
        </div></div>
      </div>
    </div>
    <details className="mt-4 border-t border-slate-200/60 pt-3 text-xs"><summary className="w-fit cursor-pointer rounded text-slate-500 focus-visible:outline-2 focus-visible:outline-offset-4">ดูรายละเอียด{view === 'month' ? 'รายวัน' : 'รายเดือน'}</summary><div className="mt-3 overflow-x-auto"><table className="w-full min-w-[580px] text-right tabular-nums"><thead className="text-[11px] text-slate-500"><tr><th scope="col" className="py-2 text-left">{view === 'month' ? 'วันที่' : 'เดือน'}</th>{visibleSeries.map(item => <th key={item.key} scope="col" className="px-2">{item.label}</th>)}<th scope="col">รวม</th></tr></thead><tbody>{selected.rows.filter(row => !row.future).map(row => <tr key={row.key} className="border-t border-slate-100"><th scope="row" className="py-2.5 text-left font-normal text-slate-600">{view === 'month' ? row.key : monthLabel(row.key)}</th>{visibleSeries.map(item => <td key={item.key} className="px-2">{money(row[item.key])}</td>)}<td className="font-semibold">{money(row.total)}</td></tr>)}</tbody></table></div></details>
    <p className="mt-2 text-[10px] leading-5 text-slate-400">แยกเงินต้นและดอกเบี้ยตามการตัดชำระ · ดอกเบี้ยหักล่วงหน้าไม่บวกซ้ำในยอดรับ · 6 เดือนรวมเดือนปัจจุบัน</p>
  </Card>
}
