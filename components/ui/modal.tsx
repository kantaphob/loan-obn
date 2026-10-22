'use client'

import { useEffect, useId, type ReactNode } from 'react'

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

  useEffect(() => {
    if (!open) return
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [open, onClose])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center overflow-y-auto bg-[#182238]/25 p-4 backdrop-blur-md" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}>
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descriptionId : undefined}
        className={`relative my-auto w-full max-w-lg rounded-[28px] border border-white/80 bg-white/70 p-6 text-[#26354d] shadow-[inset_0_1px_0_#ffffff,0_28px_80px_#17243b40] backdrop-blur-2xl ${className}`}
      >
        <button type="button" onClick={onClose} className="absolute right-4 top-4 grid h-9 w-9 place-items-center rounded-xl border border-white/80 bg-white/60 text-xl leading-none text-[#708096] transition hover:bg-white hover:text-[#26354d]" aria-label="ปิดหน้าต่าง">×</button>
        <header className="mb-5 pr-10">
          <h2 id={titleId} className="text-lg font-semibold tracking-tight">{title}</h2>
          {description && <p id={descriptionId} className="mt-1.5 text-sm leading-6 text-[#748197]">{description}</p>}
        </header>
        {children}
      </section>
    </div>
  )
}
