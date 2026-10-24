import type { cashCarryforward } from '@/lib/cash-carryforward'
const money = (n: number) => (n / 100).toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
export function CashBalance({ cash, period }: { cash: ReturnType<typeof cashCarryforward>; period: 'month' | 'year' }) {
  if (!cash.available) return <div role="status" className="rounded-xl bg-amber-50 p-4 text-sm text-amber-900">มีข้อมูลหลายแหล่งในปี {cash.overlappingYears.join(', ')} จึงยังไม่รวมยอดเงินอัตโนมัติ โปรดตรวจว่าเป็นบัญชีเดียวกันหรือรายการซ้ำก่อนปิดยอด</div>
  const term = period === 'year' ? 'ปี' : 'เดือน'
  return <section aria-label={`ยอดเงินยกมาและคงเหลือราย${term}`} className="space-y-3 rounded-xl border border-blue-200 bg-blue-50/50 p-4">
    <h3 className="font-semibold">ยอดเงินต่อเนื่อง{period === 'year' ? 'ข้ามปี' : 'รายเดือน'}</h3>
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{[
      [`ยอดยกมาต้น${term}`, cash.opening], [`เงินรับ${term}นี้`, cash.incoming], [`เงินจ่าย${term}นี้`, cash.outgoing], ['คงเหลือสะสมตามรายการ', cash.closing],
    ].map(([label, value]) => <div key={label}><p className="text-xs text-slate-600">{label}</p><p className="mt-2 text-xl font-semibold tabular-nums">{money(Number(value))}</p></div>)}</div>
    <p className="text-xs leading-5 text-slate-600">ยอดยกมา + เงินรับ − เงินจ่าย = ยอดคงเหลือ ถึง {cash.asOf} · ยอดยกมาไม่ใช่รายรับหรือกำไรของ{term}ใหม่ ไม่สร้างรายการรับเงินซ้ำ และยังคำนวณต่อได้แม้ยังไม่ปิดงวด</p>
    {cash.recordedOpeningCapital > 0 && <p className="text-xs text-slate-600">เงินรับ{term}นี้รวมรายการเงินทุนเริ่มต้น {money(cash.recordedOpeningCapital)} บาท ซึ่งเป็นเงินเติมใหม่และบวกเพิ่มจากยอดยกมา</p>}
    <details className="text-xs"><summary className="cursor-pointer text-blue-800">ดูที่มาของยอดยกมาและเงินเคลื่อนไหว</summary><div className="mt-2 overflow-x-auto"><table className="w-full text-left"><thead><tr>{['แหล่งข้อมูล', 'ยกมา', 'รับในงวด', 'จ่ายในงวด'].map(label => <th key={label} scope="col" className="p-2">{label}</th>)}</tr></thead><tbody>{cash.sources.map(source => <tr key={source.source} className="border-t border-blue-100"><th scope="row" className="p-2 font-normal">{source.source === 'HISTORICAL' ? 'บัญชีรับ–จ่ายย้อนหลัง' : 'บัญชีรับ–จ่ายในระบบ'}</th><td className="p-2">{money(source.opening)}</td><td className="p-2">{money(source.incoming)}</td><td className="p-2">{money(source.outgoing)}</td></tr>)}</tbody></table></div></details>
    <p className="text-xs text-slate-500">เป็นยอดคำนวณจากรายการที่มีในระบบ ต้องตรวจเทียบเงินสดและ Statement ก่อนยืนยันปิดยอด</p>
  </section>
}
