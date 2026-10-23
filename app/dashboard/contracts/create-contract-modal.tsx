'use client'

import { useEffect, useRef } from 'react'
import { X } from 'lucide-react'
import { ContractBorrowerStep } from './contract-borrower-step'

export function CreateContractModal({ onClose }: { onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    const element = dialog.current
    const previousOverflow = document.body.style.overflow
    element?.showModal()
    document.body.style.overflow = 'hidden'
    return () => {
      element?.close()
      document.body.style.overflow = previousOverflow
    }
  }, [])

  return <dialog ref={dialog} aria-labelledby="create-contract-title" aria-describedby="create-contract-description"
    onCancel={event => { event.preventDefault(); onClose() }}
    onClick={event => { if (event.target === event.currentTarget) onClose() }}
    className="fixed inset-0 m-auto max-h-[90dvh] w-[calc(100%-2rem)] max-w-5xl overflow-y-auto rounded-[28px] border border-white/80 bg-[#f3f6fa] p-0 text-[#26354d] shadow-2xl backdrop:bg-[#182238]/30 backdrop:backdrop-blur-sm">
    <div className="p-5 sm:p-7">
      <header className="mb-5 flex items-start justify-between gap-4">
        <div><p className="m-0 text-xs font-semibold uppercase tracking-wider text-slate-500">Contracts</p>
          <h2 id="create-contract-title" className="mb-0 mt-1 text-xl font-semibold">สร้างสัญญา</h2>
          <p id="create-contract-description" className="mb-0 mt-2 text-sm text-slate-500">ค้นหาและเลือกผู้กู้ยืมเพื่อเริ่มต้นสร้างสัญญา</p>
        </div>
        <button type="button" onClick={onClose} aria-label="ปิดหน้าต่างสร้างสัญญา" className="grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-slate-200 bg-white hover:bg-slate-100 focus-visible:outline-2"><X size={18} aria-hidden="true" /></button>
      </header>
      <ContractBorrowerStep />
    </div>
  </dialog>
}
