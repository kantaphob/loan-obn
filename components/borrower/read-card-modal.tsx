'use client'

import './read-card-modal.css'
import { useEffect, useRef, useId } from 'react'
import Image from 'next/image'
import { CreditCard, RefreshCw, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cardDate, type ThaiIdCard } from '@/lib/thai-id'

type ReadCardModalProps = {
  subjectLabel?: string
  open: boolean
  card: ThaiIdCard | null
  reading: boolean
  detecting: boolean
  error?: string
  pendingSave: boolean
  savedAt: string | null
  readAllowed: boolean
  onClose: () => void
  onRetry: () => void
  onUse: () => void
}

function readDate(value: string) {
  return new Intl.DateTimeFormat('th-TH', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'Asia/Bangkok',
  }).format(new Date(value))
}

export function ReadCardModal({ subjectLabel = 'ผู้กู้ยืม', open, card, reading, detecting, error = '', pendingSave, savedAt, readAllowed, onClose, onRetry, onUse }: ReadCardModalProps) {
  const titleId = useId()
  const descriptionId = useId()
  const state = error ? 'error' : reading ? 'reading' : detecting ? 'detecting' : card ? 'success' : 'idle'
  const status = error ? 'อ่านบัตรไม่สำเร็จ' : reading ? 'กำลังอ่านบัตร…' : detecting ? 'กำลังตรวจจับบัตร…' : card ? pendingSave ? 'อ่านสำเร็จ · รอบันทึก' : 'มีข้อมูลบัตร' : 'รอการตรวจจับบัตร'
  const dialogRef = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return
    if (open && !dialog.open) dialog.showModal()
    if (!open && dialog.open) dialog.close()
  }, [open])

  return (
    <dialog
      ref={dialogRef}
      onCancel={(event) => { if (reading) event.preventDefault(); else onClose() }}
      onClose={onClose}
      onMouseDown={(event) => { if (event.target === event.currentTarget && !reading) onClose() }}
      aria-labelledby={titleId}
      aria-describedby={descriptionId}
      aria-busy={reading}
      data-state={state}
      className="read-card-modal"
    >
      {readAllowed ? <button type="button" aria-label="ตรวจจับบัตรอีกครั้ง" title="ตรวจจับบัตรอีกครั้ง" disabled={reading || detecting} onClick={onRetry} className="read-card-close"><RefreshCw size={17} /></button> : <button type="button" aria-label="ปิดหน้าต่างอ่านบัตร" disabled={reading} onClick={onClose} className="read-card-close"><X size={17} /></button>}
      <header className="mb-5 pr-9">
        <h2 id={titleId} className="read-card-title">อ่านบัตรประชาชน</h2>
        <p id={descriptionId} className="read-card-description">ตรวจสอบข้อมูลจากชิปบัตรก่อนนำไปกรอกในข้อมูล{subjectLabel}</p>
      </header>
      <div className="read-card-status" role="status"><span aria-hidden="true" />{status}</div>
      <div className="space-y-4">
        {error && <div role="alert" className="rounded-xl border border-red-300 bg-red-50 p-4 text-sm text-red-800"><p className="font-medium">{error}</p><p className="mt-2">ตรวจสาย USB หรือฮับ เชื่อมต่อเครื่องอ่านกับ Mac ที่รันระบบ แล้วเสียบบัตรใหม่</p></div>}

        <div className="read-card-device">
          <div className="flex items-center gap-3">
            <span className="read-card-device-icon"><CreditCard size={19} /></span>
            <div>
              <p className="read-card-device-title">เครื่องอ่าน ACS</p>
              <p className="read-card-help">{detecting ? 'ระบบจะเริ่มอ่านให้อัตโนมัติเมื่อเครื่องอ่านตรวจพบบัตร' : 'ระบบจะอ่านข้อมูลจากบัตรโดยอัตโนมัติ'}</p>
            </div>
          </div>
        </div>

        {card ? (
          <div className="read-card-result">
            <div className="grid gap-5 sm:grid-cols-[120px_1fr]">
              <Image unoptimized src={card.photo} width={120} height={152} alt="รูปจากชิปบัตรประชาชน" className="mx-auto h-[152px] w-[120px] rounded-xl border border-white/80 bg-white object-cover shadow-sm sm:mx-0" />
              <dl className="m-0 grid grid-cols-1 gap-x-5 gap-y-3 sm:grid-cols-2">
                {[
                  ['ชื่อภาษาไทย', card.fullNameTh],
                  ['ชื่อภาษาอังกฤษ', card.fullNameEn],
                  ['เลขบัตรประชาชน', card.nationalId],
                  ['วันเกิด', cardDate(card.birthDate)],
                  ['เพศ', card.gender === '1' ? 'ชาย' : card.gender === '2' ? 'หญิง' : card.gender],
                  ['วันที่ออกบัตร', cardDate(card.issueDate)],
                  ['วันหมดอายุ', cardDate(card.expiryDate)],
                  ['ผู้ออกบัตร', card.issuer],
                  ['ที่อยู่ตามบัตร', card.address],
                  ['เครื่องอ่าน', card.reader],
                ].map(([label, value]) => (
                  <div key={label} className="min-w-0">
                    <dt className="read-card-field-label">{label}</dt>
                    <dd className="read-card-field-value">{value || '—'}</dd>
                  </div>
                ))}
              </dl>
            </div>
            <p className="read-card-note">
              ข้อมูลจะบันทึกพร้อมประวัติการอ่านเมื่อกด “บันทึก{subjectLabel}” ในฟอร์มหลัก ยังไม่ได้ยืนยันตัวบุคคลหรือสถานะบัตรกับหน่วยงานผู้ออกบัตร
              {pendingSave ? ' การอ่านครั้งนี้ยังรอบันทึก' : savedAt ? ` อ่านล่าสุด ${readDate(savedAt)}` : ''}
            </p>
          </div>
        ) : (
          <div className="read-card-empty">
            <CreditCard size={26} className="read-card-empty-icon" aria-hidden="true" />
            <p className="read-card-empty-title">ยังไม่มีข้อมูลจากบัตร</p>
            <p className="read-card-help">{error ? 'ยังอ่านข้อมูลไม่ได้ กรุณาตรวจสอบเครื่องอ่านแล้วกดลองใหม่' : detecting ? 'รอการตรวจพบบัตร…' : 'ยังไม่พบบัตรในเครื่องอ่าน'}</p>
          </div>
        )}

        <div className="flex justify-end gap-2 pt-1">
          {readAllowed && !card && <Button type="button" className="read-card-button" disabled={reading || detecting} onClick={onRetry}>ลองตรวจจับอีกครั้ง</Button>}
          <Button type="button" className="read-card-button" disabled={reading} onClick={onClose}>ปิด</Button>
          {card && pendingSave && <Button type="button" variant="primary" className="read-card-button read-card-button-primary" disabled={reading} onClick={onUse}>ใช้ข้อมูลนี้</Button>}
        </div>
      </div>
    </dialog>
  )
}
