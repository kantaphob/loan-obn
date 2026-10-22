'use client'

import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react'

export type ToastOptions = {
  title: string
  description?: string
  variant?: 'default' | 'success' | 'error'
  duration?: number
}

type ToastItem = ToastOptions & { id: number }
type ToastContextValue = { toast: (options: ToastOptions) => void; dismiss: (id: number) => void }

const ToastContext = createContext<ToastContextValue | null>(null)

const accents = {
  default: 'bg-[#4f7de8]',
  success: 'bg-[#25a46f]',
  error: 'bg-[#e15b64]',
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([])
  const nextId = useRef(0)
  const timers = useRef(new Map<number, ReturnType<typeof setTimeout>>())

  const dismiss = useCallback((id: number) => {
    const timer = timers.current.get(id)
    if (timer) clearTimeout(timer)
    timers.current.delete(id)
    setToasts((current) => current.filter((item) => item.id !== id))
  }, [])

  const toast = useCallback((options: ToastOptions) => {
    const id = nextId.current++
    setToasts((current) => [...current, { ...options, id }])
    const timer = setTimeout(() => dismiss(id), options.duration ?? 4000)
    timers.current.set(id, timer)
  }, [dismiss])

  useEffect(() => () => {
    timers.current.forEach(clearTimeout)
    timers.current.clear()
  }, [])

  return (
    <ToastContext.Provider value={{ toast, dismiss }}>
      {children}
      <div className="pointer-events-none fixed right-5 top-5 z-[100] flex w-[min(380px,calc(100vw-2.5rem))] flex-col gap-3 max-[640px]:right-3 max-[640px]:top-3 max-[640px]:w-[calc(100vw-1.5rem)]" aria-live="polite" aria-relevant="additions">
        {toasts.map((item) => (
          <div key={item.id} role={item.variant === 'error' ? 'alert' : 'status'} className="pointer-events-auto relative flex overflow-hidden rounded-2xl border border-white/80 bg-white/75 p-4 pr-10 text-[#26354d] shadow-[inset_0_1px_0_#ffffff,0_16px_40px_#27364b24] backdrop-blur-2xl transition-all">
            <span className={`mr-3 mt-1 h-2.5 w-2.5 shrink-0 rounded-full ${accents[item.variant ?? 'default']}`} />
            <div className="min-w-0"><p className="text-sm font-semibold">{item.title}</p>{item.description && <p className="mt-1 text-xs leading-5 text-[#748197]">{item.description}</p>}</div>
            <button type="button" onClick={() => dismiss(item.id)} className="absolute right-3 top-3 grid h-7 w-7 place-items-center rounded-lg text-lg leading-none text-[#7c8799] transition hover:bg-white/80 hover:text-[#26354d]" aria-label="ปิดการแจ้งเตือน">×</button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}

export function useToast() {
  const context = useContext(ToastContext)
  if (!context) throw new Error('useToast must be used within a ToastProvider')
  return context
}
