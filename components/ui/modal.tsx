'use client'

import { useEffect, useId, useRef, type ReactNode } from 'react'

type ModalProps = {
  open: boolean
  title: string
  description?: string
  onClose: () => void
  children: ReactNode
  className?: string
}

export function Modal({ open, title, description, onClose, children, className = '' }: ModalProps) {
  const titleId = useId()
  const descriptionId = useId()
  const dialog = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    if (!open) return
    const element = dialog.current
    element?.showModal()
    return () => element?.close()
  }, [open])

  if (!open) return null

  return (
      <dialog ref={dialog}
        onCancel={(event) => { event.preventDefault(); onClose() }}
        onMouseDown={(event) => {
          if (event.target !== event.currentTarget) return
          const rect = event.currentTarget.getBoundingClientRect()
          if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) onClose()
        }}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descriptionId : undefined}
        className={`workspace-modal fixed inset-0 m-auto max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] max-w-lg overflow-y-auto overscroll-contain rounded-2xl border border-white/80 bg-white/95 p-5 text-[#26354d] shadow-[0_20px_60px_#17243b30] backdrop:bg-[#182238]/25 backdrop:backdrop-blur-sm ${className}`}
      >
        <button type="button" onClick={onClose} className="absolute right-4 top-4 grid h-9 w-9 place-items-center rounded-xl border border-white/80 bg-white/60 text-xl leading-none text-[#708096] transition hover:bg-white hover:text-[#26354d]" aria-label="ปิดหน้าต่าง">×</button>
        <header className="mb-5 pr-10">
          <h2 id={titleId} className="text-lg font-semibold tracking-tight">{title}</h2>
          {description && <p id={descriptionId} className="mt-1.5 text-sm leading-6 text-[#748197]">{description}</p>}
        </header>
        {children}
      </dialog>
  )
}
