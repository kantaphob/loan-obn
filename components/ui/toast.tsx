'use client'

import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { FileTransferCard, type FileTransfer } from './file-transfer'

export type ToastOptions = {
  title: string
  description?: string
  variant?: 'default' | 'success' | 'error'
  duration?: number
  transfer?: FileTransfer
}

type ToastItem = ToastOptions & { id: number }
type ToastContextValue = { toast: (options: ToastOptions) => number; update: (id: number, options: Partial<ToastOptions>) => void; dismiss: (id: number) => void }

const ToastContext = createContext<ToastContextValue | null>(null)

const accents = {
  default: 'bg-[#4f7de8]',
  success: 'bg-[#25a46f]',
  error: 'bg-[#e15b64]',
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toastHost, setToastHost] = useState<HTMLElement | null>(null)
  const [toasts, setToasts] = useState<ToastItem[]>([])
  const layerRef = useRef<HTMLDivElement>(null)
  const nextId = useRef(0)
  const timers = useRef(new Map<number, ReturnType<typeof setTimeout>>())

  const dismiss = useCallback((id: number) => {
    const timer = timers.current.get(id)
    if (timer) clearTimeout(timer)
    timers.current.delete(id)
    setToasts((current) => current.filter((item) => item.id !== id))
  }, [])

  const toast = useCallback((options: ToastOptions) => {
    const dialogs = document.querySelectorAll<HTMLDialogElement>('dialog:modal')
    setToastHost(dialogs.length ? dialogs[dialogs.length - 1] : document.body)
    const id = nextId.current++
    setToasts((current) => [...current, { ...options, id }])
    if (options.duration !== 0) {
      const timer = setTimeout(() => dismiss(id), options.duration ?? 4000)
      timers.current.set(id, timer)
    }
    return id
  }, [dismiss])

  const update = useCallback((id: number, options: Partial<ToastOptions>) => {
    setToasts((current) => current.map((item) => item.id === id ? { ...item, ...options } : item))
  }, [])

  useEffect(() => () => {
    timers.current.forEach(clearTimeout)
    timers.current.clear()
  }, [])

  useEffect(() => {
    const layer = layerRef.current
    if (!layer || typeof layer.showPopover !== 'function') return
    // A native modal sits above every z-index. Put notifications in the top layer too.
    if (layer.matches(':popover-open')) layer.hidePopover()
    if (toasts.length) layer.showPopover()
  }, [toasts, toastHost])

  useEffect(() => {
    if (!(toastHost instanceof HTMLDialogElement)) return
    const moveToBody = () => setToastHost(document.body)
    toastHost.addEventListener('close', moveToBody)
    return () => toastHost.removeEventListener('close', moveToBody)
  }, [toastHost])

  return (
    <ToastContext.Provider value={{ toast, update, dismiss }}>
      {children}
      {toastHost && createPortal(<div ref={layerRef} popover="manual" style={{ margin: 0, left: 'auto', bottom: 'auto', padding: 0, border: 0, background: 'transparent', overflow: 'visible' }} className="pointer-events-none fixed right-5 top-5 z-[100] flex w-[min(380px,calc(100vw-2.5rem))] flex-col gap-3 max-[640px]:right-3 max-[640px]:top-3 max-[640px]:w-[calc(100vw-1.5rem)]" aria-live="polite" aria-relevant="additions" aria-label="การแจ้งเตือน">
        {toasts.map((item) => item.transfer ? (
          <FileTransferCard key={item.id} transfer={item.transfer} onClose={() => dismiss(item.id)} />
        ) : (
          <div key={item.id} role={item.variant === 'error' ? 'alert' : 'status'} className="pointer-events-auto relative flex overflow-hidden rounded-2xl border border-white/80 bg-white/75 p-4 pr-10 text-[#26354d] shadow-[inset_0_1px_0_#ffffff,0_16px_40px_#27364b24] backdrop-blur-2xl transition-all">
            <span className={`mr-3 mt-1 h-2.5 w-2.5 shrink-0 rounded-full ${accents[item.variant ?? 'default']}`} />
            <div className="min-w-0"><p className="text-sm font-semibold">{item.title}</p>{item.description && <p className="mt-1 text-xs leading-5 text-[#748197]">{item.description}</p>}</div>
            <button type="button" onClick={() => dismiss(item.id)} className="absolute right-3 top-3 grid h-7 w-7 place-items-center rounded-lg text-lg leading-none text-[#7c8799] transition hover:bg-white/80 hover:text-[#26354d]" aria-label="ปิดการแจ้งเตือน">×</button>
          </div>
        ))}
      </div>, toastHost)}
    </ToastContext.Provider>
  )
}

export function useToast() {
  const context = useContext(ToastContext)
  if (!context) throw new Error('useToast must be used within a ToastProvider')
  return context
}
