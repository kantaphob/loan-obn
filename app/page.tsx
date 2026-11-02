'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { ArrowUpRight, Code2, Crown, X } from 'lucide-react'
import { AgentVillage } from '@/components/agent-village/agent-village'
import './sect.css'

const teams = [
  { name: 'กู้ยืม', title: 'ตำหนักพันธสัญญา', symbol: '契', color: '#9fbbcf', icon: '📜', route: '/dashboard/contracts', description: 'ดูแลทุกพันธสัญญา ตั้งแต่คำขอกู้จนถึงการเบิกจ่าย', agents: ['ตรวจคำขอและเอกสาร', 'สรุปข้อมูลผู้กู้', 'ตรวจเงื่อนไขสัญญา', 'ติดตามการเบิกจ่าย'] },
  { name: 'บัญชี', title: 'หอบัญชีหยก', symbol: '簿', color: '#9ebfac', icon: '🧮', route: '/dashboard/accounting', description: 'จัดระเบียบตัวเลขและเตรียมความพร้อมก่อนปิดงวด', agents: ['จัดหมวดรายการ', 'ตรวจเอกสารบัญชี', 'กระทบยอด', 'เตรียมปิดงวด'] },
  { name: 'การเงิน', title: 'คลังธาราทอง', symbol: '金', color: '#ddc08a', icon: '🪙', route: '/dashboard/ledger', description: 'มองเห็นเงินรับ–จ่าย และงานการเงินที่ต้องจัดการ', agents: ['ตรวจรับชำระ', 'เตรียมรายการจ่าย', 'ตรวจเงินสดและธนาคาร', 'สรุปเงินรับ–จ่าย'] },
  { name: 'ไฟแนนซ์', title: 'หอวางกลยุทธ์', symbol: '策', color: '#b6aed0', icon: '🔮', route: '/dashboard/capital', description: 'วางแผนเงินทุนและสภาพคล่องเพื่อก้าวถัดไปของธุรกิจ', agents: ['วิเคราะห์แหล่งทุน', 'คำนวณต้นทุนเงินทุน', 'วางแผนสภาพคล่อง', 'จำลองแผนใช้เงิน'] },
  { name: 'ติดตาม', title: 'ตำหนักสารพันไมล์', symbol: '信', color: '#d8a18c', icon: '🕊️', route: '/dashboard/repayments', description: 'รวบรวมงานค้าง นัดหมาย และเรื่องที่ต้องติดตามต่อ', agents: ['จัดลำดับงานค้าง', 'เตรียมข้อความติดตาม', 'สรุปผลและนัดหมาย', 'ส่งต่อเคสให้เจ้าหน้าที่'] },
  { name: 'สินทรัพย์', title: 'ตำหนักสมบัติ', symbol: '宝', color: '#a8be96', icon: '🏯', route: '/thing/property', description: 'ดูแลทะเบียนและข้อมูลของสินทรัพย์ในอาณาจักร', agents: ['ตรวจทะเบียนและเอกสาร', 'ติดตามมูลค่าทรัพย์', 'สรุปรายได้และค่าใช้จ่าย', 'วางแผนบำรุงรักษา'] },
  { name: 'ก่อสร้าง', title: 'สำนักช่างเมฆา', symbol: '工', color: '#c1ac94', icon: '⚒️', route: '/thing/property/boq', description: 'ติดตามงบประมาณ งานก่อสร้าง และหลักฐานงวดงาน', agents: ['ตรวจ BOQ และงบ', 'ติดตามจัดซื้อและผู้รับเหมา', 'สรุปความคืบหน้า', 'ตรวจหลักฐานงวดงาน'] },
  { name: 'รายงาน', title: 'หอพยากรณ์ดารา', symbol: '星', color: '#9cb8c9', icon: '📊', route: '/dashboard/analytics', description: 'รวมข้อมูลทุกฝ่ายเป็นรายงานที่ตรวจสอบต้นทางได้', agents: ['สรุปประจำวัน', 'รายงานผู้บริหาร', 'รายงานรายโครงการ', 'วิเคราะห์ผลต่างจากแผน'] },
  { name: 'ตรวจสอบและความเสี่ยง', title: 'ตำหนักพิทักษ์', symbol: '守', color: '#c19b9f', icon: '🛡️', route: '/dashboard/invoice', description: 'ตรวจสัญญาก่อนจ่าย ข้อมูลที่เปลี่ยน และความพร้อมปิดเดือน', agents: ['ตรวจสัญญาก่อนจ่าย', 'ตรวจการเปลี่ยนข้อมูล', 'ตรวจความพร้อมปิดเดือน', 'ตรวจข้อมูลข้ามฝ่าย'] },
  { name: 'เอกสารและความรู้', title: 'หอคัมภีร์หมื่นเล่ม', symbol: '書', color: '#c7bd98', icon: '📚', route: '/dashboard/accounting', description: 'รวบรวมเอกสารสัญญา สลิป และเอกสารทรัพย์พร้อมแหล่งอ้างอิง', agents: ['รวบรวมเอกสารเคส', 'ตรวจความพร้อมเอกสาร', 'ค้นเอกสารทรัพย์และโครงการ', 'ดูแลคู่มือและความรู้'] },
]


const commandSteps = ['รับคำสั่งจากคุณ', 'ประสานทีมที่เกี่ยวข้อง', 'รวมผลพร้อมข้อมูลอ้างอิง', 'ส่งให้เจ้าหน้าที่ตรวจยืนยัน']
function AgentPortrait({ index }: { index: number }) {
  return <div className="sect-portrait" aria-hidden="true" style={{ backgroundPosition: `${(index % 5) * 25}% ${Math.floor(index / 5) * 100}%` }} />
}

export default function Home() {
  const [selected, setSelected] = useState<number | 'chief' | null>(null)
  const dialogRef = useRef<HTMLDialogElement>(null)
  const team = typeof selected === 'number' ? teams[selected] : null

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return
    if (selected !== null) {
      if (!dialog.open) dialog.showModal()
      const previous = document.body.style.overflow
      document.body.style.overflow = 'hidden'
      return () => { document.body.style.overflow = previous }
    }
    dialog.close()
  }, [selected])

  return <main className="sect-app guild-dashboard">
    <aside className="guild-rail" aria-label="ทีมในสำนัก">
      <button className="guild-railSeal" onClick={() => setSelected('chief')} title="เจ้าสำนัก" aria-label="ดูเจ้าสำนัก">雲</button>
      <button className="guild-coderTab" aria-label="ห้อง Coder ที่เชื่อมงานจริง" aria-current="page" onClick={() => setSelected(null)} title="Coder · ห้องทำงานปัจจุบัน"><Code2 size={19} /><span>CODER</span></button>
      <div className="guild-railDivider" />
      <nav aria-label="สิบทีมและ Agent ย่อย">{teams.map((t,index) => <button className="guild-teamAvatar" key={t.name} onClick={() => setSelected(index)} title={`${t.name} · 4 Agent ย่อย`} aria-label={`ดูทีม${t.name}`}><AgentPortrait index={index} /><span>{t.name}</span></button>)}</nav>
      <button className="guild-chiefTab" onClick={() => setSelected('chief')} aria-label="ดูหัวหน้าทีมใหญ่" title="หัวหน้าทีมใหญ่"><Crown size={18} /></button>
    </aside>
    <div className="guild-room"><AgentVillage />
      <div className="guild-brandPlaque"><span>雲</span><div><small>OBN · AI AGENT VILLAGE</small><strong>สำนักเมฆาหยก</strong><p>10 ทีม · 40 Agent ย่อย · ทดลองเชื่อม Coder</p></div></div>
      <Link href="/dashboard" className="guild-systemLink">เปิดระบบงาน <ArrowUpRight size={14} /></Link>
    </div>
    <dialog ref={dialogRef} className="sect-dialog" aria-labelledby="team-heading" onClose={() => setSelected(null)} onClick={e => { if(e.target === e.currentTarget) setSelected(null) }}>
      <div className="sect-panel"><button autoFocus className="sect-close" onClick={() => setSelected(null)} aria-label="ปิดรายละเอียด"><X size={20} /></button><div className="sect-panelEyebrow">JADE CLOUD / {team ? 'PAVILION' : 'COMMAND CENTER'}</div>
        {typeof selected === 'number' ? <div className="sect-panelPortrait"><AgentPortrait index={selected} /></div> : <div className="sect-masterPortrait"><span>雲</span></div>}
        <span className="sect-smallLabel">{team ? `ตำหนัก ${String((selected as number) + 1).padStart(2,'0')}` : 'THE GRAND MASTER'}</span><h2 id="team-heading">{team?.title ?? 'เจ้าสำนักเมฆาหยก'}</h2><h3>{team ? `ทีม${team.name}` : 'หัวหน้าทีม AI'}</h3><p>{team?.description ?? 'รับคำสั่งจากคุณ แบ่งงานให้หัวหน้าฝ่าย รวบรวมผล และส่งเรื่องที่ต้องตัดสินใจกลับมาให้คุณ'}</p><div className="sect-previewBadge"><span /> บทบาทที่ออกแบบไว้ · ยังไม่ได้เชื่อมโมเดล AI</div><h4>{team ? 'Agent ย่อยประจำตำหนัก' : 'ลำดับการทำงาน'}</h4><ol className="sect-members">{(team?.agents ?? commandSteps).map((a,i) => <li key={a}><span>{String(i+1).padStart(2,'0')}</span><div><strong>{a}</strong><small>{team ? 'หน้าที่ที่ออกแบบไว้' : 'ขั้นตอนที่ออกแบบไว้'}</small></div></li>)}</ol><Link className="sect-openModule" href={team?.route ?? '/dashboard'}>เปิด{team ? `ระบบ${team.name}` : 'ภาพรวมธุรกิจ'} <ArrowUpRight size={17} /></Link><p className="sect-panelFoot">การแก้ข้อมูลและอนุมัติใช้สิทธิ์ของระบบงานเดิม</p>
      </div>
    </dialog>
  </main>
}
