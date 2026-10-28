'use client'

import { DataLoading } from '@/components/ui/data-loading'
import { useFeedbackToast } from '@/components/ui/use-feedback-toast'
import { useEffect, useRef, useState, type PointerEvent } from 'react'
import { Eraser, PenLine } from 'lucide-react'
import NextImage from 'next/image'
import { Button } from '@/components/ui/button'
import { Modal } from '@/components/ui/modal'
import { LoanAgreementTemplate } from './loan-agreement-template'
import { GuaranteeAgreementTemplate } from './guarantee-agreement-template'
import { CollateralAgreementTemplate } from './collateral-agreement-template'
import { contractCode, formatContractMoney, formatContractDate, contractDocumentSignaturesComplete, contractSignaturesComplete, collateralAgreementSigners, type ContractDocumentSigner, type ContractDocumentStage } from '@/lib/contracts'
import { getContractSignatureRecords, signContract, type listContracts } from './actions'

type Contract = Awaited<ReturnType<typeof listContracts>>[number]
type Signer = ContractDocumentSigner
type DocumentStage = ContractDocumentStage

export function ContractSignatureModal({ contract, onClose, onSigned }: { contract: Contract; onClose: () => void; onSigned: () => Promise<void> }) {
  const initialStage: DocumentStage = contract.documentPackage === 'LOAN_GUARANTEE_COLLATERAL' && contractDocumentSignaturesComplete(contract, 'LOAN') && contractDocumentSignaturesComplete(contract, 'GUARANTEE') ? 'COLLATERAL' : contract.documentPackage !== 'LOAN' && contractDocumentSignaturesComplete(contract, 'LOAN') ? 'GUARANTEE' : 'LOAN'
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const drawing = useRef(false)
  const hasInkRef = useRef(false)
  const [documentStage, setDocumentStage] = useState<DocumentStage>(initialStage)
  const [signer, setSigner] = useState<Signer>(initialStage === 'GUARANTEE' ? 'GUARANTOR' : 'BORROWER')
  const [hasInk, setHasInk] = useState(false)
  const [sheetOpen, setSheetOpen] = useState(false)
  const [signaturePreview, setSignaturePreview] = useState<string | null>(null)
  const [accepted, setAccepted] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  useFeedbackToast({ error, success: notice })
  const [typedName, setTypedName] = useState('')
  const [witnessName, setWitnessName] = useState('')
  const [records, setRecords] = useState<Awaited<ReturnType<typeof getContractSignatureRecords>>>(null)
  const [recordsError, setRecordsError] = useState('')
  const witnessRevision = contract.witnesses.map(witness => witness.signedAt).join(',')
  const documentSignatureRevision = contract.documentSignatures.map(signature => `${signature.documentStage}:${signature.signer}:${signature.signedAt}`).join(',')

  useEffect(() => {
    let cancelled = false
    getContractSignatureRecords(contract.id)
      .then(value => { if (!cancelled) setRecords(value) })
      .catch(() => { if (!cancelled) setRecordsError('โหลดหลักฐานลายมือชื่อไม่สำเร็จ') })
    return () => { cancelled = true }
  }, [contract.id, contract.borrowerSignedAt, contract.lenderSignedAt, witnessRevision, documentSignatureRevision])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const context = canvas.getContext('2d')
    if (!context) return
    const resize = () => {
      const bounds = canvas.getBoundingClientRect()
      if (!bounds.width) return
      const previous = hasInkRef.current ? canvas.toDataURL('image/png') : null
      const ratio = Math.max(1, window.devicePixelRatio || 1)
      canvas.width = Math.round(bounds.width * ratio)
      canvas.height = Math.round(bounds.height * ratio)
      context.setTransform(ratio, 0, 0, ratio, 0, 0)
      context.lineWidth = 2.5
      context.lineCap = 'round'
      context.lineJoin = 'round'
      context.strokeStyle = '#183b35'
      if (previous) {
        const image = new Image()
        image.onload = () => {
          const scale = Math.min(bounds.width / image.width, bounds.height / image.height)
          const drawnWidth = image.width * scale, drawnHeight = image.height * scale
          context.drawImage(image, (bounds.width - drawnWidth) / 2, (bounds.height - drawnHeight) / 2, drawnWidth, drawnHeight)
        }
        image.src = previous
      }
    }
    resize()
    const observer = new ResizeObserver(resize)
    observer.observe(canvas)
    return () => observer.disconnect()
  }, [signer])

  function point(event: PointerEvent<HTMLCanvasElement>) {
    const bounds = event.currentTarget.getBoundingClientRect()
    return { x: event.clientX - bounds.left, y: event.clientY - bounds.top }
  }

  function startDrawing(event: PointerEvent<HTMLCanvasElement>) {
    event.currentTarget.setPointerCapture(event.pointerId)
    const context = event.currentTarget.getContext('2d')
    const position = point(event)
    context?.beginPath()
    context?.moveTo(position.x, position.y)
    setAccepted(false)
    drawing.current = true
  }

  function draw(event: PointerEvent<HTMLCanvasElement>) {
    if (!drawing.current) return
    const context = event.currentTarget.getContext('2d')
    const position = point(event)
    context?.lineTo(position.x, position.y)
    context?.stroke()
    hasInkRef.current = true
    setHasInk(true)
  }

  function stopDrawing() {
    drawing.current = false
    if (hasInkRef.current) setSignaturePreview(canvasRef.current?.toDataURL('image/png') ?? null)
  }

  function clearSignature() {
    const canvas = canvasRef.current
    const context = canvas?.getContext('2d')
    if (canvas && context) context.clearRect(0, 0, canvas.width, canvas.height)
    hasInkRef.current = false
    setHasInk(false)
    setSignaturePreview(null)
    setAccepted(false)
  }

  function useTypedName() {
    const canvas = canvasRef.current
    const context = canvas?.getContext('2d')
    const name = typedName.trim()
    if (!canvas || !context || !name) return
    clearSignature()
    const bounds = canvas.getBoundingClientRect()
    context.font = 'italic 34px Georgia, serif'
    context.fillStyle = '#183b35'
    context.fillText(name, 24, bounds.height / 2, bounds.width - 48)
    hasInkRef.current = true
    setHasInk(true)
    setSignaturePreview(canvas.toDataURL('image/png'))
    setAccepted(false)
  }

  async function submit() {
    if (!hasInk || !accepted || saving) return
    const signatureData = canvasRef.current?.toDataURL('image/png')
    if (!signatureData) return
    setSaving(true)
    setError('')
    try {
      const result = await signContract({ contractId: contract.id, documentStage, signer, signatureData, accepted, witnessName })
      if (result.error) { setError(result.error); return }
      setNotice('บันทึกลายมือชื่อแล้ว')
      try { await onSigned() }
      catch { setError('ลงนามแล้ว แต่โหลดสถานะล่าสุดไม่สำเร็จ กรุณาปิดและเปิดหน้าต่างอีกครั้ง') }
    } catch { setError('เชื่อมต่อไม่สำเร็จ กรุณาลองบันทึกลายมือชื่ออีกครั้ง') }
    finally { setSaving(false) }
  }

  const guaranteeSignatures = contract.documentSignatures.filter(signature => signature.documentStage === 'GUARANTEE')
  const collateralSignatures = contract.documentSignatures.filter(signature => signature.documentStage === 'COLLATERAL')
  const signers: { value: Signer; name: string; signedAt: string | null; label: string }[] = documentStage === 'LOAN'
    ? [
        { value: 'BORROWER', name: contract.borrowerName, signedAt: contract.borrowerSignedAt, label: 'ผู้กู้' },
        { value: 'LENDER', name: contract.lenderName, signedAt: contract.lenderSignedAt, label: 'ผู้ให้กู้' },
        ...Array.from({ length: contract.witnessCount }, (_, index) => {
          const witness = contract.witnesses.find(item => item.position === index + 1)
          return { value: `WITNESS_${index + 1}` as Signer, name: witness?.name ?? `พยานคนที่ ${index + 1}`, signedAt: witness?.signedAt ?? null, label: `พยานคนที่ ${index + 1}` }
        }),
      ]
    : documentStage === 'GUARANTEE' ? [
        ...(contract.guarantorName ? [{ value: 'GUARANTOR' as Signer, name: contract.guarantorName, signedAt: guaranteeSignatures.find(signature => signature.signer === 'GUARANTOR')?.signedAt ?? null, label: 'ผู้ค้ำประกัน' }] : []),
        { value: 'LENDER', name: contract.lenderName, signedAt: guaranteeSignatures.find(signature => signature.signer === 'LENDER')?.signedAt ?? null, label: 'ผู้ให้กู้' },
        ...Array.from({ length: contract.guaranteeWitnessCount }, (_, index) => {
          const position = index + 1
          const documentWitness = guaranteeSignatures.find(signature => signature.signer === `WITNESS_${position}`)
          return { value: `WITNESS_${position}` as Signer, name: documentWitness?.name ?? `พยานคนที่ ${position}`, signedAt: documentWitness?.signedAt ?? null, label: `พยานคนที่ ${position}` }
        }),
      ] : collateralAgreementSigners(contract).map(person => {
        const signature = collateralSignatures.find(item => item.signer === person.signer)
        return { value: person.signer, name: signature?.name ?? person.name, signedAt: signature?.signedAt ?? null, label: person.label }
      })
  const current = signers.find(item => item.value === signer) ?? signers[0]
  const next = signers.find(item => item.value !== signer && !item.signedAt)
  const currentSignedAt = current?.signedAt ?? null
  const signerName = current?.name ?? ''
  const isWitness = signer.startsWith('WITNESS_')

  return <Modal open title={sheetOpen ? `แผ่นเซ็นลายมือชื่อ · ${isWitness ? witnessName || signerName : signerName}` : `ลงนามสัญญา ${contractCode(contract.id)}`}  description="บันทึกลายมือชื่อและผูกกับรายละเอียดสัญญาที่แสดง" onClose={() => { if (saving) return; if (sheetOpen) setSheetOpen(false); else onClose() }} className={sheetOpen ? 'max-w-5xl' : 'max-w-2xl'}>
    <div className="space-y-5">
      <div hidden={sheetOpen}>
      <div className="grid gap-3 rounded-2xl border border-slate-200 bg-white/40 p-4 text-sm sm:grid-cols-2">
        <div><span className="block text-xs text-slate-500">ผู้กู้</span><strong>{contract.borrowerName}</strong><span className="ml-2 text-xs text-slate-500">{contract.borrowerSignedAt ? 'ลงนามแล้ว' : 'รอลงนาม'}</span></div>
        <div><span className="block text-xs text-slate-500">ผู้ให้กู้</span><strong>{contract.lenderName}</strong><span className="ml-2 text-xs text-slate-500">{contract.lenderSignedAt ? 'ลงนามแล้ว' : 'รอลงนาม'}</span></div>
        <div><span className="block text-xs text-slate-500">ชุดเอกสาร</span>{({ LOAN: 'สัญญาเงินกู้', LOAN_GUARANTEE: 'สัญญาเงินกู้และสัญญาค้ำประกัน', LOAN_GUARANTEE_COLLATERAL: 'สัญญาเงินกู้ สัญญาค้ำประกัน และสัญญาหลักประกัน' } as Record<string, string>)[contract.documentPackage ?? ''] ?? '—'}</div>
        <div><span className="block text-xs text-slate-500">กำหนดจ่ายเงิน</span>{formatContractDate(contract.scheduledDisbursementDate)}</div>
        <div><span className="block text-xs text-slate-500">ครบกำหนดรับชำระ</span>{formatContractDate(contract.repaymentDueDate)}</div>
        <div className="sm:col-span-2"><span className="block text-xs text-slate-500">รายละเอียดหลักประกัน</span>{contract.collateralDescription || 'เว้นว่างตามแบบเดิม'}</div>
        <div><span className="block text-xs text-slate-500">เงินต้น</span>{formatContractMoney(contract.principalSatang)} บาท</div>
        <div><span className="block text-xs text-slate-500">ดอกเบี้ยอ้างอิงภายในต่อเดือน</span>{contract.internalInterestPercent ?? 'ไม่ระบุ'}% · {formatContractMoney(contract.interestSatang)} บาท</div>
        <div><span className="block text-xs text-slate-500">วิธีจ่ายและคำนวณยอด</span>{contract.interestMethod === 'INTEREST_UPFRONT' ? 'หักดอกเบี้ย 1 เดือนก่อนจ่าย · คืนเงินต้น' : 'รับเงินต้นเต็มจำนวน · คืนเงินต้นพร้อมดอกเบี้ย 1 เดือน'}</div>
        <div><span className="block text-xs text-slate-500">ยอดรับเงินจริง</span>{formatContractMoney(contract.netSatang)} บาท</div>
        <div><span className="block text-xs text-slate-500">ยอดชำระคืน</span>{formatContractMoney(contract.repaymentSatang)} บาท</div>
      </div>

      <LoanAgreementTemplate contractId={contract.id} witnessCount={contract.witnessCount} witnesses={contract.witnesses} signingMethod={contract.signingMethod} borrowerSignedAt={contract.borrowerSignedAt} lenderSignedAt={contract.lenderSignedAt} guarantorSignedAt={contract.guarantorSignedAt} documentPackage={contract.documentPackage} />
      {contract.documentPackage !== 'LOAN' && <GuaranteeAgreementTemplate contractId={contract.id} signingMethod={contract.signingMethod} borrowerSignedAt={contract.borrowerSignedAt} lenderSignedAt={contract.lenderSignedAt} guarantorSignedAt={contract.guarantorSignedAt} witnessCount={contract.guaranteeWitnessCount} witnesses={contract.witnesses} documentSignatures={contract.documentSignatures} />}
      {contract.documentPackage === 'LOAN_GUARANTEE_COLLATERAL' && <CollateralAgreementTemplate contractId={contract.id} signingMethod={contract.signingMethod} signaturesComplete={contractSignaturesComplete(contract)} />}

      {(contract.borrowerSignedAt || contract.lenderSignedAt || contract.witnesses.length > 0 || contract.documentSignatures.length > 0) && <section aria-label="หลักฐานการลงนาม" className="space-y-3 rounded-2xl border border-slate-200 bg-white/40 p-4">
        <h3 className="m-0 text-sm font-semibold">หลักฐานการลงนาม</h3>
        {recordsError && <p role="alert" className="mb-0 text-xs text-red-700">{recordsError}</p>}
        {!records && !recordsError && <DataLoading compact label="กำลังโหลดหลักฐาน…" />}
        {records && <>
          <div className="grid gap-3 sm:grid-cols-2">{([
            { name: 'ผู้กู้', record: records.borrower },
            { name: 'ผู้ให้กู้', record: records.lender },
            ...(records.guarantor ? [{ name: 'ผู้ค้ำประกัน', record: records.guarantor }] : []),
            ...records.witnesses.map(witness => ({ name: `พยานคนที่ ${witness.position}: ${witness.name}`, record: witness })),
            ...records.documentSignatures.map(signature => ({ name: `${signature.documentStage === 'GUARANTEE' ? '3.2 · สัญญาค้ำ' : signature.documentStage === 'COLLATERAL' ? '3.3 · สัญญาหลักประกัน' : '3.1 · สัญญาเงินกู้'} · ${signature.signer === 'LENDER' ? 'ผู้ให้กู้' : signature.signer === 'GUARANTOR' ? 'ผู้ค้ำประกัน' : signature.signer === 'PROVIDER' ? 'ผู้ให้หลักประกัน' : signature.signer === 'CUSTODIAN' ? 'ผู้รับมอบ/ผู้เก็บรักษา' : signature.signer.startsWith('WITNESS_') ? `พยานคนที่ ${signature.signer.slice(-1)}: ${signature.name}` : signature.name}`, record: { image: signature.signatureData, signedAt: signature.signedAt, consentAt: signature.consentAt, capturedBy: signature.capturedBy } })),
          ] as const).filter(item => item.record.image).map(item => <figure key={item.name} className="m-0 rounded-xl border border-slate-200 bg-white p-3">
            <figcaption className="mb-2 text-xs font-medium">{item.name} · {item.record.signedAt ? new Intl.DateTimeFormat('th-TH', { timeZone: 'Asia/Bangkok', dateStyle: 'medium', timeStyle: 'short' }).format(new Date(item.record.signedAt)) : ''}</figcaption>
            <NextImage src={item.record.image!} alt={`ลายมือชื่อ${item.name}`} width={500} height={120} unoptimized className="h-20 w-full object-contain" />
            {item.record.consentAt && <p className="mb-0 mt-2 text-[10px] text-slate-500">ยืนยันความเป็นเจ้าของลายมือชื่อและเจตนาลงนามเมื่อ {new Intl.DateTimeFormat('th-TH', { timeZone: 'Asia/Bangkok', dateStyle: 'medium', timeStyle: 'short' }).format(new Date(item.record.consentAt))}</p>}
            <p className="mb-0 mt-2 break-all text-[10px] text-slate-500">บันทึกโดยบัญชี {item.record.capturedBy}</p>
          </figure>)}</div>
          {records.termsHash && <div><span className="block text-xs text-slate-500">ค่าแฮชเงื่อนไขสัญญา (SHA‑256)</span><code className="mt-1 block break-all text-[10px] text-slate-700">{records.termsHash}</code></div>}
        </>}
      </section>}

      </div>
      {notice && <p role="status" className="mb-0 rounded-xl bg-emerald-50 p-3 text-sm text-emerald-900">{notice}</p>}
      <>
        <fieldset hidden={sheetOpen} className="m-0 border-0 p-0" disabled={saving}>
          {contract.documentPackage !== 'LOAN' && <><p className="mb-2 text-sm font-medium">เลือกเอกสารที่ต้องการลงนาม</p><div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-3">
            {(['LOAN', 'GUARANTEE', ...(contract.documentPackage === 'LOAN_GUARANTEE_COLLATERAL' ? ['COLLATERAL' as const] : [])] as const).map(stage => <button key={stage} type="button" onClick={() => { setDocumentStage(stage); setError(''); setAccepted(false); setSigner(stage === 'LOAN' || stage === 'COLLATERAL' ? 'BORROWER' : 'GUARANTOR'); clearSignature(); setTypedName(''); setWitnessName('') }} className={`rounded-xl border p-3 text-sm ${documentStage === stage ? 'border-emerald-700 bg-emerald-50/80 font-semibold text-emerald-950' : 'border-slate-200 bg-white/50'}`}>
              {stage === 'LOAN' ? '3.1 · สัญญาเงินกู้' : stage === 'GUARANTEE' ? '3.2 · สัญญาค้ำประกัน' : '3.3 · สัญญาหลักประกัน'}
              <span className="mt-1 block text-xs font-normal text-slate-500">{contractDocumentSignaturesComplete(contract, stage) ? 'ลงนามครบ' : 'ยังลงนามไม่ครบ'}</span>
            </button>)}
          </div></>}
          <legend className="mb-2 text-sm font-medium">ผู้ลงนาม</legend>
          <div className="grid grid-cols-2 gap-2">
            {signers.map(item => <button key={item.value} type="button" disabled={Boolean(item.signedAt)} onClick={() => { setSigner(item.value); setWitnessName(''); clearSignature(); setTypedName(''); setAccepted(false); setError('') }} className={`rounded-xl border p-3 text-left text-sm transition ${signer === item.value ? 'border-emerald-700 bg-emerald-50/80 text-emerald-950' : 'border-slate-200 bg-white/50'} disabled:cursor-not-allowed disabled:opacity-60`}>
              <span className="block text-xs text-slate-500">{item.label}{item.signedAt ? ' · ลงนามแล้ว' : ''}</span><span className="mt-1 block font-medium">{item.name}</span>
            </button>)}
          </div>
        </fieldset>

        {isWitness && !currentSignedAt && <label className="block text-sm font-medium">ชื่อ-นามสกุลพยาน
          <input value={witnessName} onChange={event => setWitnessName(event.target.value)} maxLength={150} disabled={saving} className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-3 py-2" placeholder="ระบุชื่อผู้ลงนามเป็นพยาน" />
        </label>}
        {currentSignedAt ? <div className="rounded-xl bg-emerald-50 p-4 text-sm text-emerald-900">ผู้ลงนามรายนี้ลงนามแล้ว</div> : <>
          <div>
            <div className="mb-2 flex items-center justify-between gap-2"><label htmlFor="contract-signature-pad" className="text-sm font-medium"><PenLine size={15} className="mr-2 inline" aria-hidden="true" />ลายมือชื่อของ {signerName}</label><div className="flex flex-wrap gap-2">{!sheetOpen && <Button onClick={() => setSheetOpen(true)} disabled={saving}>เปิดแผ่นเซ็นขนาดใหญ่</Button>}<Button onClick={clearSignature} disabled={!hasInk || saving}><Eraser size={14} aria-hidden="true" />ล้างลายมือชื่อ</Button></div></div>
            <canvas id="contract-signature-pad" ref={canvasRef} onPointerDown={startDrawing} onPointerMove={draw} onPointerUp={stopDrawing} onPointerCancel={stopDrawing} onLostPointerCapture={stopDrawing} aria-label={`พื้นที่ลงลายมือชื่อ ${signerName}`} className={`${sheetOpen ? 'h-[45dvh] min-h-60' : 'h-44'} w-full touch-none rounded-xl border border-dashed border-slate-400 bg-white`} />
            <p className="mb-0 mt-1 text-xs text-slate-500">ใช้นิ้ว เมาส์ หรือปากกาเซ็นในกรอบนี้</p>
            <div className="mt-3 flex flex-wrap items-end gap-2">
              <label className="min-w-0 flex-1 text-xs text-slate-600">หรือพิมพ์ชื่อผู้ลงนาม
                <input value={typedName} onChange={event => setTypedName(event.target.value)} maxLength={100} autoComplete="name" className="mt-1 w-full rounded-lg border border-slate-300 bg-white/80 px-3 py-2 text-sm" />
              </label>
              <Button onClick={useTypedName} disabled={!typedName.trim() || saving}>ใช้ชื่อนี้</Button>
            </div>
          </div>
          {sheetOpen && <div className="flex justify-end gap-3"><Button onClick={() => setSheetOpen(false)}>กลับ</Button><Button variant="primary" disabled={!hasInk} onClick={() => { setSignaturePreview(canvasRef.current?.toDataURL('image/png') ?? null); setSheetOpen(false) }}>ใช้ลายเซ็นนี้</Button></div>}
          {!sheetOpen && signaturePreview && <figure className="m-0 rounded-xl border border-slate-200 bg-white p-4"><figcaption className="mb-2 text-xs text-slate-500">ตัวอย่างลายเซ็นสำหรับประทับในเอกสาร</figcaption><NextImage src={signaturePreview} alt="ตัวอย่างลายเซ็นก่อนบันทึก" width={500} height={160} unoptimized className="h-24 w-full object-contain" /></figure>}
          <label hidden={sheetOpen} className="flex cursor-pointer items-start gap-3 rounded-xl border border-slate-200 bg-white/40 p-3 text-sm leading-6">
            <input type="checkbox" checked={accepted} onChange={event => setAccepted(event.target.checked)} className="mt-1 h-4 w-4 accent-emerald-700" />
            <span>ข้าพเจ้ายืนยันว่าลายมือชื่อข้างต้นเป็นของข้าพเจ้า ได้ตรวจสอบและยอมรับรายละเอียดสัญญานี้ และประสงค์ใช้ลายมือชื่ออิเล็กทรอนิกส์นี้เพื่อแสดงเจตนาลงนามและยอมรับข้อความในสัญญา โดยรับทราบว่าการลงนามอาจมีผลผูกพันตามกฎหมาย</span>
          </label>
          <p hidden={sheetOpen} className="mb-0 text-xs leading-5 text-slate-500">เจ้าหน้าที่ที่เข้าสู่ระบบจะเป็นผู้บันทึกการลงนาม ระบบเก็บเวลาและข้อมูลกำกับการบันทึกไว้ในประวัติสัญญา</p>
        </>}
        {error && <p role="alert" className="mb-0 text-sm text-red-700">{error}</p>}
        <div hidden={sheetOpen} className="flex justify-end gap-2 border-t border-slate-200 pt-4">
          <Button onClick={onClose}>ปิด</Button>
          {!currentSignedAt && <Button variant="primary" disabled={!hasInk || !accepted || saving || (isWitness && !witnessName.trim())} onClick={submit}>{saving ? 'กำลังบันทึก…' : 'ยืนยันและบันทึกลายมือชื่อ'}</Button>}
          {currentSignedAt && next && <Button variant="primary" onClick={() => { setSigner(next.value); setWitnessName(''); clearSignature(); setTypedName(''); setAccepted(false); setError('') }}>ให้{next.name}ลงนามต่อ</Button>}
        </div>
      </>
    </div>
  </Modal>
}
