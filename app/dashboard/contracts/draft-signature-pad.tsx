'use client'

import { useEffect, useRef, useState, type PointerEvent } from 'react'
import Image from 'next/image'
import { Button } from '@/components/ui/button'
import { collateralAgreementSigners, type DraftContractSignature } from '@/lib/contracts'

type Signer = DraftContractSignature['signer']
type SignatureStage = DraftContractSignature['documentStage']
export function DraftSignaturePad({ borrowerName, lenderName, guarantorName, witnessCount, stage = 'LOAN', providerName, custodianName, collateralAgreementData, value, onChange }: {
  borrowerName: string; lenderName: string; guarantorName?: string; witnessCount: number; stage?: SignatureStage;
  providerName?: string; custodianName?: string; collateralAgreementData?: string;
  value: DraftContractSignature[]; onChange: (value: DraftContractSignature[]) => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null)
  const canvas = useRef<HTMLCanvasElement>(null)
  const drawing = useRef(false)
  const [target, setTarget] = useState<Signer | null>(null)
  const [name, setName] = useState('')
  const [hasInk, setHasInk] = useState(false)
  const people: { signer: Signer; role: string; name: string }[] = stage === 'COLLATERAL'
    ? collateralAgreementSigners({ borrowerName, lenderName, guarantorName, witnessCount, collateralAgreementData }).map(person => ({ signer: person.signer, role: person.label, name: person.signer === 'PROVIDER' ? providerName || person.name : person.signer === 'CUSTODIAN' ? custodianName || person.name : person.name }))
    : stage === 'GUARANTEE'
    ? [
        ...(guarantorName ? [{ signer: 'GUARANTOR' as Signer, role: 'ผู้ค้ำประกัน', name: guarantorName }] : []),
        { signer: 'LENDER', role: 'ผู้ให้กู้', name: lenderName },
        ...Array.from({ length: witnessCount }, (_, index) => ({ signer: `WITNESS_${index + 1}` as Signer, role: `พยานคนที่ ${index + 1}`, name: `พยานคนที่ ${index + 1}` })),
      ]
    : [
        { signer: 'BORROWER', role: 'ผู้กู้', name: borrowerName },
        { signer: 'LENDER', role: 'ผู้ให้กู้', name: lenderName },
        ...Array.from({ length: witnessCount }, (_, index) => ({ signer: `WITNESS_${index + 1}` as Signer, role: `พยานคนที่ ${index + 1}`, name: `พยานคนที่ ${index + 1}` })),
      ]
  useEffect(() => {
    if (!target) return
    const element = dialog.current
    element?.showModal()
    const pad = canvas.current
    const context = pad?.getContext('2d')
    if (pad && context) {
      const ratio = window.devicePixelRatio || 1
      const bounds = pad.getBoundingClientRect()
      pad.width = Math.round(bounds.width * ratio)
      pad.height = Math.round(bounds.height * ratio)
      context.scale(ratio, ratio)
      context.lineWidth = 2.5; context.lineCap = 'round'; context.lineJoin = 'round'; context.strokeStyle = '#183b35'
    }
    return () => { element?.close() }
  }, [target])
  function begin(event: PointerEvent<HTMLCanvasElement>) {
    event.currentTarget.setPointerCapture(event.pointerId)
    const bounds = event.currentTarget.getBoundingClientRect(), ctx = event.currentTarget.getContext('2d')
    ctx?.beginPath(); ctx?.moveTo(event.clientX - bounds.left, event.clientY - bounds.top)
    drawing.current = true
  }
  function draw(event: PointerEvent<HTMLCanvasElement>) {
    if (!drawing.current) return
    const bounds = event.currentTarget.getBoundingClientRect(), ctx = event.currentTarget.getContext('2d')
    ctx?.lineTo(event.clientX - bounds.left, event.clientY - bounds.top); ctx?.stroke()
    setHasInk(true)
  }
  const isWitness = target?.startsWith('WITNESS_')
  return <section className="mt-5 rounded-2xl border border-emerald-200 bg-emerald-50/40 p-4 sm:p-6">
    <h3 className="m-0 text-sm font-semibold">เขียนลายเซ็นบนจอ</h3>
    <p className="mt-1 text-sm text-slate-600">ให้ผู้ลงนามแต่ละคนเซ็นในกรอบ แล้วตรวจทานลายเซ็นทั้งหมดก่อนบันทึกสัญญา</p>
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{people.map(person => {
      const signature = value.find(item => item.signer === person.signer && item.documentStage === stage)
      return <div key={person.signer} className="rounded-xl border border-slate-200 bg-white p-4">
        <div className="flex items-start justify-between gap-3"><div><p className="m-0 text-xs text-slate-500">{person.role}</p><p className="mb-0 mt-1 text-sm font-semibold">{signature?.witnessName || person.name}</p></div><span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-medium ${signature ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-50 text-amber-800'}`}>{signature ? 'ลงนามแล้ว' : 'รอลงนาม'}</span></div>
        {signature && <Image src={signature.signatureData} width={480} height={160} alt={`ลายเซ็น ${person.name}`} unoptimized className="my-2 h-20 w-full object-contain" />}
        <div className="mt-3 flex flex-wrap gap-2"><Button onClick={() => { setTarget(person.signer); setName(signature?.witnessName || ''); setHasInk(false) }}>{signature ? 'เซ็นใหม่' : 'ลงนาม'}</Button>
        {signature && <Button onClick={() => onChange(value.filter(item => !(item.signer === person.signer && item.documentStage === stage)))}>ลบลายเซ็น</Button>}
        </div>
      </div>
    })}</div>
    <dialog ref={dialog} onCancel={event => { event.preventDefault(); event.stopPropagation(); setTarget(null) }} aria-label="แผ่นเขียนลายเซ็น" className="fixed inset-0 m-auto w-[calc(100%-2rem)] max-w-4xl rounded-3xl border border-slate-200 bg-white p-5 text-slate-800 shadow-2xl backdrop:bg-slate-900/40">
      <h3 className="m-0 text-lg font-semibold">ลงลายมือชื่อ · {people.find(item => item.signer === target)?.role}</h3>
      {isWitness && <label className="mt-3 block text-sm">ชื่อ-นามสกุลพยาน<input value={name} onChange={event => setName(event.target.value)} maxLength={150} className="mt-1 w-full rounded-xl border border-slate-300 p-3" /></label>}
      <p className="text-xs text-slate-500">ใช้นิ้ว เมาส์ หรือปากกาเขียนในกรอบด้านล่าง</p>
      <canvas ref={canvas} aria-label="พื้นที่เขียนลายเซ็น" onPointerDown={begin} onPointerMove={draw} onPointerUp={() => { drawing.current = false }} onPointerCancel={() => { drawing.current = false }} onLostPointerCapture={() => { drawing.current = false }} className="h-[40dvh] min-h-48 w-full touch-none rounded-2xl border-2 border-dashed border-slate-300 bg-white" />
      <div className="mt-4 flex flex-wrap justify-end gap-2">
        <Button onClick={() => { const pad = canvas.current; if (pad) pad.getContext('2d')?.clearRect(0, 0, pad.width, pad.height); setHasInk(false) }}>ล้าง</Button>
        <Button onClick={() => setTarget(null)}>ยกเลิก</Button>
        <Button variant="primary" disabled={!hasInk || Boolean(isWitness && !name.trim())} onClick={() => {
          if (!target || !canvas.current) return
          const currentPerson = people.find(item => item.signer === target)
          onChange([...value.filter(item => !(item.signer === target && item.documentStage === stage)), { signer: target, documentStage: stage, signatureData: canvas.current.toDataURL('image/png'), ...(isWitness ? { witnessName: name.trim() } : target === 'PROVIDER' || target === 'CUSTODIAN' ? { signerName: currentPerson?.name } : {}) }])
          setTarget(null)
        }}>ใช้ลายเซ็นนี้</Button>
      </div>
    </dialog>
  </section>
}
