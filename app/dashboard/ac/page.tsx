import { Suspense } from 'react'
import { connection } from 'next/server'
import { BanknoteX } from 'lucide-react'
import { PageContainer } from '@/components/ui/page-container'
import { Header } from '@/components/ui/header'
import { Card } from '@/components/ui/card'
import { getCurrentUser } from '@/lib/auth/current-user'
import { prisma } from '@/lib/prisma'
import { bangkokToday } from '@/lib/ledger'
import type { ClosingLine } from '@/lib/account-closing'
import { ClosingForm } from './closing-form'
const money = (n: number) => (n / 100).toLocaleString('th-TH', { minimumFractionDigits: 2 })
export default function AC() {
  return <Suspense fallback={<PageContainer><p role="status">กำลังโหลดงวดบัญชี…</p></PageContainer>}><ClosingContent /></Suspense>
}
async function ClosingContent() {
  await connection()
  const user = await getCurrentUser()
  if (!user || user.status !== 'ACTIVE') return <PageContainer>ไม่มีสิทธิ์เข้าถึงข้อมูล</PageContainer>
  const closes = await prisma.accountingClose.findMany({ orderBy: { endOn: 'desc' } })
  const latest = closes[0]
  const nextStart = latest ? new Date(Date.parse(latest.endOn) + 86400000).toISOString().slice(0, 10) : ''
  return <PageContainer>
    <Header title="ปิดบัญชี" eyebrow="Account Closing" description="ปิดรายได้–ค่าใช้จ่ายผ่านสรุปผลกำไรขาดทุน ก่อนโอนเข้าทุนหรือกำไรสะสม" icon={<BanknoteX size={21} aria-hidden="true" />} />
    <div className="space-y-5">
      <Card className="p-5"><h2 className="font-semibold">{latest ? `ปิดบัญชีถึงวันที่ ${latest.endOn}` : 'ยังไม่มีงวดที่ปิดบัญชี'}</h2><p className="mt-2 text-sm text-slate-600">รายการปิดบัญชีเก็บแยกจากรายการรับ–จ่าย จึงไม่เพิ่มหรือลดเงินสด ระบบยังไม่ได้จัดทำงบแสดงฐานะการเงินจากบัญชีแยกประเภท</p></Card>
      <Card className="p-5"><h2 className="mb-4 font-semibold">ปิดงวดใหม่</h2>{['ADMIN', 'SUPER_ADMIN'].includes(user.role) ? <ClosingForm nextStart={nextStart} today={bangkokToday()} /> : <p className="text-sm text-slate-600">เฉพาะผู้ดูแลระบบที่ปิดงวดบัญชีได้ คุณสามารถตรวจประวัติด้านล่าง</p>}</Card>
      <section className="space-y-4"><h2 className="font-semibold">ประวัติและรายการปิดบัญชี</h2>{!closes.length && <Card className="p-6 text-sm text-slate-500">เมื่อปิดงวด รายการเดบิต–เครดิตและผู้บันทึกจะแสดงที่นี่</Card>}{closes.map(close => {
        const lines = JSON.parse(close.journalJson) as ClosingLine[]
        const entries = JSON.parse(close.cashSnapshotJson) as { direction: string; amountSatang: number }[]
        const total = (direction: string) => entries.filter(e => e.direction === direction).reduce((s, e) => s + e.amountSatang, 0)
        return <Card key={close.id} className="p-5"><details><summary className="cursor-pointer font-semibold">AC-{close.id} · {close.startOn} ถึง {close.endOn} · กำไร (ขาดทุน) {money(close.profitSatang)} บาท</summary><p className="mt-3 whitespace-pre-wrap text-sm">{close.note}</p><p className="mt-2 text-xs text-slate-500">บันทึกโดย {close.createdBy} · {close.createdAt.toLocaleString('th-TH', { timeZone: 'Asia/Bangkok' })}</p><p className="mt-3 text-sm">รายการรับ–จ่าย ณ วันปิดงวด {entries.length} รายการ · รับ {money(total('IN'))} · จ่าย {money(total('OUT'))} บาท (ไม่ใช่กำไรสุทธิ)</p><div className="mt-4 overflow-x-auto"><table className="w-full text-left text-sm"><thead><tr><th className="p-3">ขั้นตอน</th><th className="p-3">บัญชี</th><th className="p-3 text-right">เดบิต</th><th className="p-3 text-right">เครดิต</th></tr></thead><tbody>{lines.map((line, index) => <tr key={`${line.step}-${line.code}-${index}`} className="border-t border-slate-200"><td className="p-3">{line.step ?? 'รายการเดิม'}</td><td className="p-3">{line.code} · {line.name}</td><td className="p-3 text-right">{money(line.debit)}</td><td className="p-3 text-right">{money(line.credit)}</td></tr>)}</tbody></table></div></details></Card>
      })}</section>
    </div>
  </PageContainer>
}
