'use client'

import { useEffect, useRef } from 'react'
import { X } from 'lucide-react'
import { ContractBorrowerStep } from './contract-borrower-step'

export function CreateContractModal({ onClose, onSaved }: { onClose: () => void; onSaved?: (code: string, contractId: number, signingMethod: string | null, limitApprovalRequired: boolean, pdfSaved: boolean | null) => void }) {
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
    className="fixed inset-0 m-auto flex h-[88dvh] w-[calc(100%-1.5rem)] max-w-6xl flex-col overflow-hidden rounded-2xl border border-white/80 bg-[#f3f6fa] p-0 text-[#26354d] shadow-2xl backdrop:bg-[#182238]/30 backdrop:backdrop-blur-sm">
    <div className="flex min-h-0 flex-1 flex-col p-3.5 sm:p-5">
      <header className="mb-3 flex shrink-0 items-start justify-between gap-3">
        <div><p className="m-0 text-[10px] font-semibold uppercase tracking-wider text-slate-500">Contracts</p>
          <h2 id="create-contract-title" className="mb-0 mt-0.5 text-lg font-semibold">สร้างสัญญา</h2>
          <p id="create-contract-description" className="mb-0 mt-1 text-xs text-slate-500">ค้นหาและเลือกผู้กู้ยืมเพื่อเริ่มต้นสร้างสัญญา</p>
        </div>
        <button type="button" onClick={onClose} aria-label="ปิดหน้าต่างสร้างสัญญา" className="grid h-8 w-8 shrink-0 place-items-center rounded-lg border border-slate-200 bg-white hover:bg-slate-100 focus-visible:outline-2"><X size={16} aria-hidden="true" /></button>
      </header>
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain pr-1">
        <ContractBorrowerStep onSaved={onSaved} />
      </div>
    </div>
  </dialog>
}
