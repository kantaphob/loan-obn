'use client'

import { DataLoading } from '@/components/ui/data-loading'
import { agingBands, parseRevision, receivedBreakdown } from '@/lib/credit-history'
import { useFeedbackToast } from '@/components/ui/use-feedback-toast'
import { useCallback, useEffect, useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { bangkokToday } from '@/lib/ledger'
import Link from 'next/link'
import { Search, UserRound, FileText, RefreshCw, CircleCheck, Clock3, AlertCircle, CalendarDays } from 'lucide-react'
import { SlipPreview } from '@/components/ui/slip-preview'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { contractCode, formatContractMoney as money } from '@/lib/contracts'
import { getCreditHistory, type getCreditDirectory } from './actions'

type Person = Awaited<ReturnType<typeof getCreditDirectory>>[number]
type History = Awaited<ReturnType<typeof getCreditHistory>>
const field = 'w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm focus:ring-2 focus:ring-blue-500'
const date = (value: string) => new Date(value.length === 10 ? `${value}T00:00:00+07:00` : value).toLocaleDateString('th-TH', { timeZone: 'Asia/Bangkok', dateStyle: 'medium' })
const changes: Record<string, string> = { amountSatang: 'ยอดเงิน', occurredOn: 'วันที่', categoryName: 'หมวด', channelName: 'ช่องทาง', reference: 'เลขอ้างอิง', note: 'หมายเหตุ', direction: 'ประเภท' }
function showValue(key: string, value: unknown) { return key === 'amountSatang' ? `${money(Number(value))} บาท` : key === 'direction' ? value === 'IN' ? 'รับเงิน' : 'จ่ายเงิน' : String(value || '—') }
const closureLabels: Record<string, string> = { FULL_PAYMENT: 'ชำระครบตามยอด', SETTLEMENT_WAIVER: 'ปิดด้วยการยกเว้นส่วนต่าง', PENALTY_WAIVER: 'ปิดโดยยกเว้นค่าปรับ', HISTORICAL: 'ปิดจากข้อมูลเดิม', UNKNOWN: 'ต้องตรวจสอบวิธีปิด' }
export function CreditWorkspace({ people }: { people: Person[] }) {
  const router = useRouter()
  const [query, setQuery] = useState(''), [role, setRole] = useState<'BORROWER' | 'LENDER' | 'PERSUADER'>('BORROWER')
  const [person, setPerson] = useState<Person | null>(null), [history, setHistory] = useState<History | null>(null)
  const [pending, startTransition] = useTransition(), [error, setError] = useState('')
  useFeedbackToast({ error })
  const [contract, setContract] = useState(''), [from, setFrom] = useState(''), [to, setTo] = useState(''), [voids, setVoids] = useState(false)
  const [cashDirection, setCashDirection] = useState('')
  const [tab, setTab] = useState('CONTRACTS'), [page, setPage] = useState(1), [peoplePage, setPeoplePage] = useState(1)
  const request = useRef(0)
  const detailsRef = useRef<HTMLDivElement>(null)
  const latestDay = useRef('')
  const refreshing = useRef(false)
  const refresh = useCallback(() => {
    if (!person || refreshing.current) return
    const token = ++request.current
    refreshing.current = true
    setError('')
    startTransition(async () => {
      try {
        const data = await getCreditHistory(person.role, person.id)
        if (request.current === token) { setHistory(data); latestDay.current = data.asOf }
      } catch { if (request.current === token) setError('อัปเดตไม่สำเร็จ ข้อมูลที่แสดงยังเป็นชุดเดิม กรุณาลองอีกครั้ง') }
      finally { refreshing.current = false }
    })
  }, [person])
  useEffect(() => {
    const onVisible = () => { if (document.visibilityState === 'visible') refresh() }
    const timer = window.setInterval(() => {
      if (document.visibilityState === 'visible' && latestDay.current && latestDay.current !== bangkokToday()) refresh()
    }, 60000)
    window.addEventListener('focus', onVisible)
    document.addEventListener('visibilitychange', onVisible)
    return () => { clearInterval(timer); window.removeEventListener('focus', onVisible); document.removeEventListener('visibilitychange', onVisible) }
  }, [refresh])
  useEffect(() => {
    const onCreditBureauChanged = () => {
      router.refresh()
      refresh()
    }
    window.addEventListener('credit-bureau-changed', onCreditBureauChanged)
    return () => window.removeEventListener('credit-bureau-changed', onCreditBureauChanged)
  }, [refresh, router])
  const filteredPeople = people.filter(p => p.role === role && `${p.name} ${p.nickname} ${p.phone} ${p.code}`.toLowerCase().includes(query.toLowerCase()))
  const personPage = Math.min(peoplePage, Math.max(1, Math.ceil(filteredPeople.length / 15)))
  function select(p: Person) {
    const token = ++request.current
    detailsRef.current?.scrollTo({ top: 0 })
    setPerson(p); setHistory(null); setVoids(false); setCashDirection(''); setError(''); setContract(''); setFrom(''); setTo(''); setPage(1); setTab('CONTRACTS')
    startTransition(async () => {
      try { const data = await getCreditHistory(p.role, p.id); if (request.current === token) { setHistory(data); latestDay.current = data.asOf } }
      catch { if (request.current === token) setError('โหลดประวัติไม่สำเร็จ กรุณาเลือกบุคคลอีกครั้ง') }
    })
  }
  const all = history?.contracts ?? []
  const selectedContracts = all.filter(c => !contract || String(c.id) === contract)
  const matchingEvents = selectedContracts.flatMap(c => c.entries.map(e => ({ ...e, contractId: c.id, contractLabel: c.legacySourceCode || contractCode(c.id), allocation: c.balance.repaymentBreakdown.find(row => row.id === e.id) }))).filter(e => (voids || !e.voidedAt) && (!from || e.occurredOn >= from) && (!to || e.occurredOn <= to)).sort((a, b) => b.occurredOn.localeCompare(a.occurredOn) || b.id - a.id)
  const cashIn = matchingEvents.filter(e => !e.voidedAt && e.direction === 'IN').reduce((sum, e) => sum + e.amountSatang, 0)
  const cashOut = matchingEvents.filter(e => !e.voidedAt && e.direction === 'OUT').reduce((sum, e) => sum + e.amountSatang, 0)
  const events = matchingEvents.filter(e => !cashDirection || e.direction === cashDirection)
  const currentPage = Math.min(page, Math.max(1, Math.ceil(events.length / 20)))
  const overdue = all.filter(c => c.balance.disbursed && c.balance.remaining > 0 && c.balance.overdueDays > 0)
  const openContracts = all.filter(c => c.balance.disbursed && c.balance.remaining > 0)
  const waiting = all.filter(c => c.status === 'WAITING_PAYMENT' && !c.limitApprovalRequired && !c.balance.disbursed)
  const waitingApproval = all.filter(c => c.status === 'WAITING_PAYMENT' && c.limitApprovalRequired)
  const rejected = all.filter(c => c.status === 'REJECTED')
  const closed = all.filter(c => c.balance.disbursed && c.balance.remaining === 0)
  const dueToday = openContracts.filter(c => c.repaymentDueDate === history?.asOf)
  const needsReview = all.some(c => c.balance.invalid)
  const persuaderDue = history?.persuaderShareSummary?.dueSatang ?? 0
  const profileTone = !history ? 'neutral' : person?.role === 'PERSUADER' ? persuaderDue > 0 ? 'warning' : history.persuaderProfile?.isActive ? 'active' : 'neutral' : needsReview ? 'warning' : rejected.length === all.length && rejected.length > 0 ? 'overdue' : overdue.length ? 'overdue' : dueToday.length ? 'warning' : openContracts.length ? 'active' : closed.length ? 'settled' : 'neutral'
  const statusLabel = !history ? pending ? 'กำลังโหลดข้อมูล' : 'ยังไม่มีข้อมูลสถานะ' : person?.role === 'PERSUADER' ? persuaderDue > 0 ? 'มีส่วนแบ่งรอจ่าย' : history.persuaderProfile?.isActive ? 'ใช้งาน' : 'ไม่ใช้งาน' : needsReview ? 'ต้องตรวจสอบยอด' : overdue.length ? `เกินกำหนด ${overdue.length} สัญญา` : dueToday.length ? `ครบกำหนดวันนี้ ${dueToday.length} สัญญา` : openContracts.length ? 'อยู่ระหว่างชำระ' : closed.length ? 'ชำระครบทุกสัญญาที่จ่ายกู้แล้ว' : rejected.length ? `ไม่อนุมัติ ${rejected.length} สัญญา` : waitingApproval.length ? `รออนุมัติวงเงิน ${waitingApproval.length} สัญญา` : waiting.length ? `รอจ่ายเงินกู้ ${waiting.length} สัญญา` : 'ยังไม่มีสัญญา'
  const StatusIcon = profileTone === 'overdue' || needsReview ? AlertCircle : profileTone === 'settled' ? CircleCheck : profileTone === 'warning' ? CalendarDays : Clock3
  const historyParts = openContracts.reduce((sum, c) => {
    const principal = Math.min(c.principalSatang, c.balance.baseRemaining)
    return { principal: sum.principal + principal, interest: sum.interest + Math.max(0, c.balance.baseRemaining - principal), penalty: sum.penalty + c.balance.penaltyRemaining, total: sum.total + c.balance.remaining }
  }, { principal: 0, interest: 0, penalty: 0, total: 0 })
  const overdueTotal = overdue.reduce((sum, c) => sum + c.balance.remaining, 0)
  const receivedParts = all.reduce((sum, c) => {
    const parts = receivedBreakdown(c)
    return { principal: sum.principal + parts.principal, interest: sum.interest + parts.interest, interestUpfront: sum.interestUpfront + parts.interestUpfront, interestAfter: sum.interestAfter + parts.interestAfter, penalty: sum.penalty + parts.penalty, total: sum.total + parts.total }
  }, { principal: 0, interest: 0, interestUpfront: 0, interestAfter: 0, penalty: 0, total: 0 })
  const ledgerReceived = all.reduce((sum, c) => sum + c.balance.received, 0)
  const lenderDisbursed = all.reduce((sum, c) => {
    if (!c.balance.disbursed) return sum
    const entry = c.entries.find(e => e.kind === 'DISBURSEMENT' && !e.voidedAt && e.occurredOn <= (history?.asOf ?? ''))
    return sum + (entry?.amountSatang ?? c.netSatang)
  }, 0)
  const persuaderSharesByContract = new Map((history?.persuaderShareSummary?.byContract ?? []).map(row => [row.contractId, row]))
  const debtSegments = [
    { label: 'เงินต้นรอชำระ', amount: historyParts.principal, color: '#4379da' },
    { label: 'ดอกเบี้ยรอชำระ', amount: historyParts.interest, color: '#9460d9' },
    { label: 'ค่าปรับรอชำระ', amount: historyParts.penalty, color: '#dd7950' },
  ]
  const sortedContracts = [...all].sort((a, b) => {
    const rank = (c: typeof a) => !c.balance.disbursed ? 2 : c.balance.remaining === 0 ? 3 : c.balance.overdueDays > 0 ? 0 : 1
    return rank(a) - rank(b) || (a.repaymentDueDate || '9999').localeCompare(b.repaymentDueDate || '9999') || b.id - a.id
  })
  const upcoming = openContracts.filter(c => c.repaymentDueDate && c.repaymentDueDate >= (history?.asOf ?? '')).sort((a, b) => a.repaymentDueDate!.localeCompare(b.repaymentDueDate!))
  const upcomingDate = upcoming[0]?.repaymentDueDate
  const upcomingAmount = upcoming.filter(c => c.repaymentDueDate === upcomingDate).reduce((sum, c) => sum + c.balance.remaining, 0)
  return <div className="borrower-workspace credit-workspace space-y-5">
    
    <div className="credit-panes grid items-start gap-5 xl:grid-cols-[300px_minmax(0,1fr)]">
      <Card className="credit-directory p-4" role="region" aria-label="ค้นหาและเลือกบุคคล" tabIndex={0}>
        <div className="credit-directory-tools"><h2 className="font-semibold">ค้นหาบุคคล</h2><div className="my-3 grid grid-cols-3 gap-2" role="group" aria-label="บทบาท">{[['BORROWER', 'ผู้กู้'], ['LENDER', 'ผู้ให้กู้'], ['PERSUADER', 'ผู้แนะนำ']].map(([value, label]) => <button key={value} aria-pressed={role === value} className={`rounded-xl px-2 py-2 text-xs ${role === value ? 'bg-blue-700 text-white' : 'bg-slate-100 text-slate-600'}`} onClick={() => { ++request.current; setRole(value as typeof role); setPeoplePage(1); setPerson(null); setHistory(null); setError('') }}>{label}</button>)}</div>
        <label className="relative block"><span className="sr-only">ค้นหาชื่อ ชื่อเล่น หรือรหัสบุคคล</span><Search className="absolute left-3 top-3 text-slate-400" size={16} aria-hidden="true" /><input className={`${field} !pl-9`} placeholder="ชื่อ ชื่อเล่น หรือรหัส" value={query} onChange={e => { setQuery(e.target.value); setPeoplePage(1) }} /></label>
        <p className="my-3 text-xs text-slate-400">{filteredPeople.length} คน</p></div>
        <div className="credit-people-scroll space-y-1" tabIndex={0} role="region" aria-label="รายชื่อบุคคล">{filteredPeople.slice((personPage - 1) * 15, personPage * 15).map(p => <button key={`${p.role}-${p.id}`} onClick={() => select(p)} aria-pressed={person?.role === p.role && person.id === p.id} className={`w-full rounded-xl border p-3 text-left transition ${person?.role === p.role && person.id === p.id ? 'border-blue-200 bg-blue-50' : 'border-transparent hover:bg-slate-50'}`}><p className="text-sm font-medium">{p.name}</p><p className="mt-1 text-xs text-slate-500">{p.nickname || p.phone || (p.role === 'PERSUADER' ? 'Persuader' : '—')} · {p.code}</p><p className="mt-1 text-xs text-slate-400">{p.contracts} สัญญา{p.isActive ? '' : ' · ไม่ใช้งาน'}</p></button>)}{!filteredPeople.length && <p className="py-6 text-center text-sm text-slate-500">ไม่พบบุคคล</p>}</div>
        {filteredPeople.length > 15 && <div className="mt-3 flex justify-between gap-2"><Button disabled={personPage <= 1} onClick={() => setPeoplePage(personPage - 1)}>ก่อนหน้า</Button><Button disabled={personPage * 15 >= filteredPeople.length} onClick={() => setPeoplePage(personPage + 1)}>ถัดไป</Button></div>}
      </Card>
      <div ref={detailsRef} className="credit-details min-w-0 space-y-5" role="region" aria-label="รายละเอียดประวัติการเงิน" tabIndex={0} aria-busy={pending}>
        {!person && <Card className="p-16 text-center"><UserRound className="mx-auto mb-4 text-slate-300" size={38} aria-hidden="true" /><h2 className="font-semibold">เลือกบุคคลเพื่อดูประวัติ</h2></Card>}
        {person && <Card className="credit-person-card" data-tone={profileTone}>
          <div className="credit-person-top">
            <div className="credit-person-identity"><div className="credit-person-avatar" aria-hidden="true">{person.name.slice(0, 1)}</div><div className="credit-person-copy"><div className="credit-person-code"><span>{person.role === 'BORROWER' ? 'ผู้กู้' : person.role === 'LENDER' ? 'ผู้ให้กู้' : 'Persuader · ผู้แนะนำ'}</span><span>{history?.borrowerProfile?.borrowerId || person.code}</span></div><h2>{person.name}</h2><div className="credit-person-meta">{person.role === 'BORROWER' && <span>ชื่อเล่น {history?.borrowerProfile?.nickname || person.nickname || '—'}</span>}{person.role === 'PERSUADER' && <span>ผู้แนะนำ</span>}{person.role !== 'BORROWER' && <><span aria-hidden="true">·</span><span>โทร {person.phone || 'ยังไม่ระบุ'}</span></>}{history?.borrowerProfile && <><span aria-hidden="true">·</span><span>โทร {history.borrowerProfile.phone || 'ยังไม่ระบุ'}</span><span className="credit-risk-chip" data-grade={history.borrowerProfile.riskRating}>แรงก์ {history.borrowerProfile.riskRating}</span></>}</div></div></div>
            <div className="credit-person-status"><span className="credit-person-badge"><StatusIcon size={15} aria-hidden="true" />{statusLabel}</span></div>
          </div>
          <div className="credit-person-footer"><p>{history ? <>ข้อมูล ณ {date(history.asOf)}<span>·</span>อัปเดต {new Date(history.loadedAt).toLocaleTimeString('th-TH', { timeZone: 'Asia/Bangkok' })}{person.role !== 'PERSUADER' && waiting.length > 0 && <><span>·</span>รอจ่าย {waiting.length} สัญญา</>}</> : 'เลือกอัปเดตข้อมูลเพื่อโหลดสถานะล่าสุด'}</p><button type="button" disabled={pending} onClick={refresh}><RefreshCw size={13} aria-hidden="true" className={pending ? 'animate-spin' : ''} />{pending ? 'กำลังอัปเดต…' : 'อัปเดตข้อมูล'}</button></div>
        </Card>}
        {pending && <DataLoading compact label="กำลังโหลดประวัติ…" />}{error && <p role="alert" className="text-sm text-rose-700">{error}</p>}
        {history && person && <>
          {person.role === 'PERSUADER' ? <Card className="credit-money-bars credit-persuader-summary"><div className="credit-money-bars-heading"><h3>ส่วนแบ่ง Persuader สะสม</h3><strong className="credit-debt-total">{money(history.persuaderShareSummary?.accruedSatang ?? 0)} <small>บาท</small></strong></div><dl className="credit-persuader-grid"><div><dt>ส่วนแบ่งสะสม</dt><dd>{money(history.persuaderShareSummary?.accruedSatang ?? 0)} บาท</dd></div><div><dt>จ่ายแล้ว</dt><dd>{money(history.persuaderShareSummary?.paidSatang ?? 0)} บาท</dd></div><div data-due={(history.persuaderShareSummary?.dueSatang ?? 0) > 0}><dt>ค้างจ่าย</dt><dd>{money(history.persuaderShareSummary?.dueSatang ?? 0)} บาท</dd></div></dl><p className="credit-received-note">ส่วนแบ่งจะเกิดสิทธิ์เมื่อผู้กู้ชำระครบสัญญา · รวมรายการปรับลดสิทธิ์แล้ว</p><Link href="/dashboard/persuaders/shares" className="mt-3 inline-block text-xs text-violet-700 underline">เปิดหน้ารายการส่วนแบ่ง Persuader</Link></Card> : <>
          <Card className="credit-money-bars">
            <div className="credit-money-bars-heading"><h3>ยอดรอรับคืนรวมค่าปรับ</h3><strong className="credit-debt-total">{money(historyParts.total)} <small>บาท</small></strong></div>
            {needsReview ? <p className="mt-4 text-sm text-amber-700">ต้องตรวจสอบยอดก่อนแสดงสัดส่วน</p> : <>
              <div className="credit-debt-track" role="img" aria-label={historyParts.total > 0 ? debtSegments.map(m => `${m.label} ${money(m.amount)} บาท`).join(' · ') : 'ไม่มียอดรอรับคืน'}>{debtSegments.filter(m => m.amount > 0).map(m => <span key={m.label} title={`${m.label} ${money(m.amount)} บาท`} style={{ width: `${m.amount / historyParts.total * 100}%`, background: m.color }} />)}{historyParts.total === 0 && <span className="credit-debt-empty">ไม่มียอดรอรับคืน</span>}</div>
              <dl className="credit-debt-legend">{debtSegments.map(m => <div key={m.label}><dt><span style={{ background: m.color }} />{m.label}</dt><dd style={{ color: m.color }}>{money(m.amount)} <small>บาท</small></dd></div>)}</dl>
              <dl className="credit-key-amounts"><div><dt>วงเงินคงเหลือ</dt><dd>{history.creditLimit ? `${money(history.creditLimit.available * 100)} บาท` : '—'}</dd></div><div data-overdue={overdueTotal > 0}><dt>คงค้างเกินกำหนด</dt><dd>{money(overdueTotal)} บาท</dd></div></dl>
              <Card className="credit-history-summary p-5"><h3 className="font-semibold">ประวัติสะสม</h3><dl className="credit-history-grid"><div><dt>สัญญาทั้งหมด</dt><dd>{all.length} สัญญา</dd></div><div><dt>ปิดยอดแล้ว</dt><dd>{closed.length} สัญญา</dd></div><div><dt>รับชำระสะสม</dt><dd>{money(all.reduce((sum, c) => sum + c.balance.received, 0))} บาท</dd></div><div><dt>ปิดด้วยการยกเว้นยอด / ค่าปรับ</dt><dd>{closed.filter(c => ['SETTLEMENT_WAIVER', 'PENALTY_WAIVER'].includes(c.closureMethod)).length} สัญญา</dd></div></dl></Card>
              {person.role === 'LENDER' && <Card className="credit-received-summary p-5"><h3 className="font-semibold">เงินปล่อยและดอกเบี้ยสะสม</h3><dl className="credit-received-grid"><div><dt>เงินปล่อยสะสม</dt><dd>{money(lenderDisbursed)} <small>บาท</small></dd></div><div><dt>เงินต้นรับคืนสะสม</dt><dd>{money(receivedParts.principal)} <small>บาท</small></dd></div><div><dt>ดอกเบี้ยรับสะสมรวม</dt><dd>{money(receivedParts.interest)} <small>บาท</small></dd></div></dl><div className="credit-interest-split"><div><span>หักก่อนจ่ายสะสม</span><strong>{money(receivedParts.interestUpfront)} บาท</strong></div><div><span>รับหลังชำระสะสม</span><strong>{money(receivedParts.interestAfter)} บาท</strong></div></div><p className="credit-received-note">ค่าปรับรับแล้ว {money(receivedParts.penalty)} บาท · รับเงินตามรายการบัญชี {money(ledgerReceived)} บาท</p><p className="credit-received-note">ดอกเบี้ยหักก่อนจ่ายนับเมื่อปล่อยกู้แล้ว · ดอกเบี้ยหลังจ่ายคำนวณตามลำดับตัดชำระ · สัญญาเดิมที่ไม่มีรายการจ่ายกู้ใช้ยอดสุทธิตามสัญญา</p></Card>}
          <Card className="p-5">
            <h3 className="font-semibold">{person.role === 'LENDER' ? 'พฤติกรรมชำระของลูกหนี้ในพอร์ต' : 'พฤติกรรมการชำระ'}</h3>
            <div className="mt-4 grid gap-3 sm:grid-cols-3 lg:grid-cols-6">{[
              ['ON_TIME', 'ชำระครบตรงเวลา'], ['LATE', 'ชำระครบล่าช้า'], ['OVERDUE', 'ยังค้างเกินกำหนด'],
              ['CURRENT', 'ยังไม่เกินกำหนด'], ['PENDING', 'รอจ่ายกู้'], ['UNKNOWN', 'ข้อมูลไม่พอ / ต้องตรวจสอบ'],
            ].map(([key, label]) => <div key={key} className="rounded-xl bg-slate-50 p-3"><p className="text-xs text-slate-500">{label}</p><p className="mt-2 text-xl font-semibold tabular-nums">{all.filter(c => c.behavior === key && (!['ON_TIME', 'LATE'].includes(key) || c.closureMethod === 'FULL_PAYMENT')).length} <span className="text-xs font-normal">สัญญา</span></p></div>)}</div>
            
          </Card>
          <Card className="p-5">
            <h3 className="font-semibold">อายุหนี้ค้างชำระ{person.role === 'LENDER' ? 'ในพอร์ต' : ''}</h3>
            
            <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{agingBands.map(band => {
              const contracts = overdue.filter(c => c.balance.overdueDays >= band.min && c.balance.overdueDays <= band.max)
              return <div key={band.label} className="rounded-xl border border-rose-100 bg-rose-50/50 p-4"><p className="text-sm font-medium text-rose-800">{band.label}</p><p className="mt-2 text-xl font-semibold tabular-nums">{money(contracts.reduce((sum, c) => sum + c.balance.remaining, 0))} <span className="text-xs font-normal">บาท</span></p><p className="mt-1 text-xs text-slate-500">{contracts.length} สัญญา</p></div>
            })}</div>
          </Card>
        </>}
            <div className="credit-due-summary"><div><span>ครบกำหนดใกล้ที่สุด</span><strong>{upcomingDate ? date(upcomingDate) : '—'}</strong><small>{upcomingDate ? `${money(upcomingAmount)} บาท` : 'ไม่มีสัญญาที่ยังไม่เกินกำหนด'}</small></div><div data-overdue={overdue.length > 0}><span>เกินกำหนด</span><strong>{overdue.length} สัญญา</strong><small>{money(overdue.reduce((sum, c) => sum + c.balance.remaining, 0))} บาท</small></div></div>
            <p className="credit-summary-note">เฉพาะสัญญาที่จ่ายแล้ว · ไม่รวมกันวงเงินรอจ่าย · ดอกหักล่วงหน้าไม่บวกซ้ำ</p>
          </Card>
          </>}
          {history?.creditLimit && <div className="credit-limit-card credit-limit-panel" data-over-limit={history.creditLimit.overLimit > 0}>
            <div className="credit-limit-heading"><h3>วงเงินผู้กู้{history.creditLimit.overLimit > 0 && <span className="credit-limit-warning-badge"><AlertCircle size={13} aria-hidden="true" />เกินวงเงิน</span>}</h3><p>วงเงินอนุมัติ <strong>{money(history.creditLimit.approved * 100)}</strong> บาท</p></div>
            {history.creditLimit.approved > 0 ? <div className="credit-limit-track" role="img" aria-label={`วงเงินอนุมัติ ${history.creditLimit.approved} บาท ใช้ไป ${history.creditLimit.used} บาท รอจ่าย ${history.creditLimit.reserved} บาท คงเหลือ ${history.creditLimit.available} บาท เกินวงเงิน ${history.creditLimit.overLimit} บาท`}>
              <span className="credit-limit-used" style={{ width: `${Math.min(history.creditLimit.approved, history.creditLimit.used) / Math.max(history.creditLimit.approved, history.creditLimit.used + history.creditLimit.reserved) * 100}%` }} /><span className="credit-limit-reserved" style={{ width: `${Math.min(Math.max(0, history.creditLimit.approved - history.creditLimit.used), history.creditLimit.reserved) / Math.max(history.creditLimit.approved, history.creditLimit.used + history.creditLimit.reserved) * 100}%` }} />
              {history.creditLimit.overLimit > 0 && <span className="credit-limit-excess" style={{ width: `${history.creditLimit.overLimit / Math.max(history.creditLimit.approved, history.creditLimit.used + history.creditLimit.reserved) * 100}%` }} />}
            </div> : <p className="my-4 text-sm text-slate-500">ยังไม่ได้กำหนดวงเงินอนุมัติ</p>}
            <dl className="credit-limit-legend"><div><dt><span className="credit-limit-used" />ใช้ไปแล้ว</dt><dd>{money(history.creditLimit.used * 100)} <small>บาท</small></dd></div>{history.creditLimit.reserved > 0 && <div><dt><span className="credit-limit-reserved" />กันไว้รอจ่าย</dt><dd>{money(history.creditLimit.reserved * 100)} <small>บาท</small></dd></div>}<div><dt><span className="credit-limit-available" />วงเงินคงเหลือ</dt><dd className="text-emerald-700">{money(history.creditLimit.available * 100)} <small>บาท</small></dd></div></dl>
          </div>}

          <Card className="overflow-hidden">
            <div className="flex gap-5 border-b border-slate-200 px-5" role="group" aria-label="ส่วนประวัติ">{(person.role === 'PERSUADER' ? [['CONTRACTS', 'สัญญาที่แนะนำ']] : [['CONTRACTS', 'สัญญาทั้งหมด'], ['PAYMENTS', 'ประวัติรับ–จ่าย']]).map(([value, label]) => <button key={value} aria-pressed={tab === value} onClick={() => { setTab(value); setPage(1) }} className={`border-b-2 py-4 text-sm font-medium ${tab === value ? 'border-blue-600 text-blue-700' : 'border-transparent text-slate-500'}`}>{label}</button>)}</div>
            {tab === 'CONTRACTS' ? <div className="divide-y divide-slate-100">{sortedContracts.map(c => <article key={c.id} className="credit-contract-card p-5" data-tone={c.status === 'REJECTED' ? 'overdue' : c.limitApprovalRequired ? 'warning' : c.balance.invalid ? 'warning' : !c.balance.disbursed ? 'neutral' : c.balance.remaining === 0 ? 'settled' : c.balance.overdueDays > 0 ? 'overdue' : c.repaymentDueDate === history.asOf ? 'warning' : 'active'}><div className="flex flex-wrap justify-between gap-3"><div><h3 className="font-semibold">{c.legacySourceCode || contractCode(c.id)}</h3><p className="mt-1 text-xs text-slate-500">{c.legacySourceCode && `${contractCode(c.id)} · `}{person?.role === 'BORROWER' ? `ผู้ให้กู้ ${c.lenderName}` : person?.role === 'LENDER' ? `ผู้กู้ ${c.borrowerName}` : `ผู้กู้ที่แนะนำ · ${c.borrowerName}`}</p></div><span className={`h-fit rounded-full px-3 py-1 text-xs ${c.status === 'REJECTED' ? 'bg-rose-50 text-rose-700' : c.limitApprovalRequired ? 'bg-amber-50 text-amber-800' : !c.balance.disbursed ? 'bg-slate-100 text-slate-600' : c.balance.remaining === 0 ? 'bg-emerald-50 text-emerald-700' : c.balance.overdueDays > 0 ? 'bg-rose-50 text-rose-700' : 'bg-amber-50 text-amber-800'}`}>{c.status === 'REJECTED' ? 'ไม่อนุมัติ' : c.limitApprovalRequired ? 'รออนุมัติวงเงิน' : !c.balance.disbursed ? 'รอจ่ายเงินกู้' : c.balance.remaining === 0 ? 'ปิดยอดแล้ว' : c.balance.overdueDays > 0 ? `เกินกำหนด ${c.balance.overdueDays} วัน` : 'รอชำระ'}</span></div>{c.closureMethod !== 'OPEN' && <p className="mt-3 text-xs text-blue-700">{closureLabels[c.closureMethod]} · {c.behavior === 'ON_TIME' ? 'ปิดภายในกำหนด' : c.behavior === 'LATE' ? 'ปิดหลังกำหนด' : 'ไม่ทราบวันปิดที่ประเมินได้'}</p>}<dl className="mt-4 grid gap-3 text-sm sm:grid-cols-3"><div><dt className="text-xs text-slate-400">เงินต้น / ยอดต้องคืน</dt><dd className="mt-1 tabular-nums">{money(c.principalSatang)} / {money(c.repaymentSatang)}</dd></div><div><dt className="text-xs text-slate-400">ดอกเบี้ยตามสัญญา</dt><dd className="mt-1 tabular-nums">{money(c.interestSatang)} บาท</dd><dd className="mt-1 text-xs text-slate-500">{c.interestMethod === 'INTEREST_UPFRONT' ? 'หักดอกเบี้ยล่วงหน้า' : 'ชำระพร้อมเงินต้น'}</dd></div><div><dt className="text-xs text-slate-400">{person?.role === 'PERSUADER' ? 'ผู้กู้ชำระแล้ว / คงค้าง' : 'รับแล้ว / ยอดรอรับคืนรวมค่าปรับ'}</dt><dd className="mt-1 tabular-nums">{money(c.balance.received)} / {money(c.balance.disbursed ? c.balance.remaining : 0)}</dd></div><div><dt className="text-xs text-slate-400">วันจ่าย / ครบกำหนด</dt><dd className="mt-1">{c.balance.disbursementOn ? date(c.balance.disbursementOn) : c.paidAt ? date(c.paidAt) : 'ยังไม่จ่าย'} / {c.repaymentDueDate ? date(c.repaymentDueDate) : '—'}</dd></div></dl>{person?.role === 'PERSUADER' && <p className="mt-3 rounded-lg bg-violet-50 px-3 py-2 text-xs text-violet-800">ส่วนแบ่งตามสัญญา {money(c.persuaderShareSatang ?? 0)} บาท · {(c.persuaderShareBasisPoints ?? 0) / 100}% ของเงินต้น · เกิดสิทธิ์สะสม {money(persuaderSharesByContract.get(c.id)?.accruedSatang ?? 0)} · จ่ายแล้ว {money(persuaderSharesByContract.get(c.id)?.paidSatang ?? 0)} · ค้างจ่าย {money(persuaderSharesByContract.get(c.id)?.dueSatang ?? 0)} บาท</p>}{c.balance.legacyReceivedSatang > 0 && <p className="mt-3 text-xs text-slate-500">ยอดรับเดิม {money(c.balance.legacyReceivedSatang)} บาท</p>}{c.balance.settlementWaived + c.balance.penaltyWaived > 0 && <p className="mt-2 text-xs text-slate-500">ยกเว้นยอด {money(c.balance.settlementWaived)} บาท · ยกเว้นค่าปรับ {money(c.balance.penaltyWaived)} บาท</p>}<div className="mt-4 flex gap-4 text-xs">{person?.role !== 'PERSUADER' && <button className="text-blue-700 underline" onClick={() => { setContract(String(c.id)); setTab('PAYMENTS'); setPage(1) }}>ดูรายการรับ–จ่าย</button>}<Link href="/dashboard/contracts" className="text-slate-500 underline">ทะเบียนสัญญา</Link></div></article>)}{!all.length && <p className="p-12 text-center text-sm text-slate-500">ยังไม่มีสัญญาของบุคคลนี้</p>}</div> : <>
              <div className="flex flex-wrap items-end gap-3 p-4"><label className="min-w-40 flex-1 text-xs text-slate-500">สัญญา<select className={`${field} mt-1`} value={contract} onChange={e => { setContract(e.target.value); setPage(1) }}><option value="">ทุกสัญญา</option>{all.map(c => <option key={c.id} value={c.id}>{c.legacySourceCode || contractCode(c.id)}</option>)}</select></label><label className="text-xs text-slate-500">ตั้งแต่<input type="date" className={`${field} mt-1`} value={from} onChange={e => { setFrom(e.target.value); if (to && e.target.value > to) setTo(''); setPage(1) }} /></label><label className="text-xs text-slate-500">ถึง<input type="date" min={from} className={`${field} mt-1`} value={to} onChange={e => { if (from && e.target.value && e.target.value < from) { setError('วันสิ้นสุดต้องไม่ก่อนวันเริ่มต้น'); return } setError(''); setTo(e.target.value); setPage(1) }} /></label><label className="flex items-center gap-2 py-3 text-xs"><input type="checkbox" checked={voids} onChange={e => { setVoids(e.target.checked); setPage(1) }} />รวมรายการยกเลิก</label></div>
              
              <div className="grid gap-3 px-4 pb-4 sm:grid-cols-2">
                <div className="rounded-2xl border border-emerald-100 bg-emerald-50/70 p-4"><p className="text-xs text-emerald-700">รับเงินในช่วงที่เลือก</p><p className="mt-1 text-2xl font-semibold tabular-nums text-emerald-800">{money(cashIn)} <span className="text-xs font-normal">บาท</span></p></div>
                <div className="rounded-2xl border border-rose-100 bg-rose-50/70 p-4"><p className="text-xs text-rose-700">จ่ายเงินในช่วงที่เลือก</p><p className="mt-1 text-2xl font-semibold tabular-nums text-rose-800">{money(cashOut)} <span className="text-xs font-normal">บาท</span></p></div>
              </div>
              <div className="flex flex-wrap items-center justify-between gap-3 px-4 pb-4"><div className="inline-flex gap-1 rounded-xl bg-slate-100 p-1" role="group" aria-label="กรองเงินรับจ่าย">{[['', 'ทั้งหมด'], ['IN', 'เงินรับ'], ['OUT', 'เงินจ่าย']].map(([value, label]) => <button key={value} aria-pressed={cashDirection === value} onClick={() => { setCashDirection(value); setPage(1) }} className={`rounded-lg px-4 py-2 text-sm ${cashDirection === value ? 'bg-white font-semibold text-blue-700 shadow-sm' : 'text-slate-500'}`}>{label}</button>)}</div><span className="text-xs text-slate-400">ใหม่ → เก่า · หน่วย: บาท</span></div>
              <div className="overflow-x-auto"><table className="w-full min-w-[640px] text-left text-sm"><thead className="bg-slate-50 text-xs text-slate-500"><tr>{['วันที่', 'รายการ / สัญญา', 'รับเงิน', 'จ่ายเงิน', 'ช่องทาง'].map((label, i) => <th key={label} scope="col" className={`px-4 py-3 ${i === 2 || i === 3 ? 'text-right' : ''}`}>{label}</th>)}</tr></thead><tbody className="divide-y divide-slate-100">{events.slice((currentPage - 1) * 20, currentPage * 20).map(e => <tr key={e.id} className={`align-top hover:bg-slate-50/70 ${e.voidedAt ? 'bg-slate-50 text-slate-400' : ''}`}>
                <td className="whitespace-nowrap px-4 py-4"><p>{date(e.occurredOn)}</p><p className="mt-1 text-[10px] text-slate-400">TX-{String(e.id).padStart(6, '0')}</p></td>
                <td className="min-w-48 px-4 py-4"><p className={`font-medium ${e.voidedAt ? 'line-through' : ''}`}>{e.categoryName}</p><p className="mt-1 text-xs text-blue-700">{e.contractLabel}</p>{e.voidedAt && <span className="mt-2 inline-block rounded-full bg-slate-200 px-2 py-0.5 text-[10px] text-slate-600">ยกเลิกแล้ว · ไม่นับยอด</span>}
                  <details className="mt-2 text-xs"><summary className="cursor-pointer text-slate-500">ดูรายละเอียด{e.revisions.length > 0 ? ` · แก้ไข ${e.revisions.length} ครั้ง` : ''}</summary><div className="mt-2 max-w-sm space-y-2 rounded-xl bg-slate-50 p-3"><p>บันทึกโดย {e.createdBy} · {date(e.createdAt)}</p>
                    {e.slip && <SlipPreview entryId={e.id} className="text-blue-700 underline" />}
                    
                    {e.allocation && (e.allocation.penaltyPaidSatang > 0 || e.allocation.excessPaymentSatang > 0) && <p>แยกยอดรับ: ค่าปรับ {money(e.allocation.penaltyPaidSatang)} · ตัดยอดตามสัญญา {money(e.allocation.contractPaidSatang)} บาท</p>}{e.allocation?.excessPaymentSatang ? <p className="font-medium text-rose-700">รับเกินยอดตามสัญญา {money(e.allocation.excessPaymentSatang)} บาท · ตรวจสอบยอดรับคืน</p> : null}{e.allocation?.excessSettlementWaiverSatang ? <p className="font-medium text-rose-700">ยกเว้นส่วนต่างเกินยอดหนี้ {money(e.allocation.excessSettlementWaiverSatang)} บาท · ตรวจสอบการยกเว้น</p> : null}{e.settlementWaivedSatang > 0 && <p>ยกเว้นส่วนต่าง {money(e.settlementWaivedSatang)} บาท · {e.settlementWaiverReason || 'ไม่ระบุเหตุผล'}</p>}
                    {e.penaltyWaivedSatang > 0 && <p>ยกเว้นค่าปรับ {money(e.penaltyWaivedSatang)} บาท · {e.penaltyWaiverReason || 'ไม่ระบุเหตุผล'}</p>}
                    <p className="break-all">เลขอ้างอิง: {e.reference || '—'}</p>{e.note && <p className="whitespace-pre-wrap break-words">{e.note}</p>}{e.voidedAt && <p className="text-rose-700">ยกเลิก {date(e.voidedAt)} · {e.voidReason} · โดย {e.voidedBy}</p>}{e.revisions.map(r => { const before = parseRevision(r.beforeJson), after = parseRevision(r.afterJson); if (!before || !after) return <p key={r.id} className="text-rose-700">อ่านประวัติแก้ไขไม่ได้ · {r.reason} · โดย {r.createdBy}</p>; return <div key={r.id} className="border-t border-slate-200 pt-2"><p className="font-medium">แก้ไข {date(r.createdAt)} · {r.reason} · โดย {r.createdBy}</p>{Object.entries(changes).filter(([key]) => before[key] !== after[key]).map(([key, label]) => <p key={key} className="mt-1 break-words">{label}: {showValue(key, before[key])} → {showValue(key, after[key])}</p>)}</div> })}</div></details>
                </td>
                <td className={`whitespace-nowrap px-4 py-4 text-right font-semibold tabular-nums ${e.voidedAt ? 'line-through' : 'text-emerald-700'}`}>{e.direction === 'IN' ? money(e.amountSatang) : <span className="font-normal text-slate-300">—</span>}</td>
                <td className={`whitespace-nowrap px-4 py-4 text-right font-semibold tabular-nums ${e.voidedAt ? 'line-through' : 'text-rose-700'}`}>{e.direction === 'OUT' ? money(e.amountSatang) : <span className="font-normal text-slate-300">—</span>}</td>
                <td className="whitespace-nowrap px-4 py-4 text-xs text-slate-500">{e.channelName}</td>
              </tr>)}</tbody></table>{!events.length && <div className="p-12 text-center text-slate-500"><FileText size={28} aria-hidden="true" className="mx-auto mb-3 text-slate-300" /><p className="text-sm">ไม่มีรายการรับ–จ่ายในช่วงที่เลือก</p></div>}</div>
              <div className="flex justify-between border-t border-slate-100 p-4 text-xs"><span>{events.length} รายการ · หน้า {currentPage}</span><div className="flex gap-3"><Button disabled={currentPage <= 1} onClick={() => setPage(currentPage - 1)}>ก่อนหน้า</Button><Button disabled={currentPage * 20 >= events.length} onClick={() => setPage(currentPage + 1)}>ถัดไป</Button></div></div>
            </>}
          </Card>
        </>}
      </div>
    </div>
  </div>
}
