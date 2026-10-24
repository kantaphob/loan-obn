'use client'

import { useEffect } from 'react'
import { useToast } from '@/components/ui/toast'
import type { CreditBureauChangedEvent, LoanApplicationStatus, LoanStatusChangedEvent } from '@/lib/realtime'

const statusLabels: Record<LoanApplicationStatus, string> = {
  DRAFT: 'ฉบับร่าง',
  SUBMITTED: 'ส่งคำขอแล้ว',
  UNDER_REVIEW: 'กำลังพิจารณา',
  NEEDS_DOCUMENTS: 'รอเอกสารเพิ่มเติม',
  APPROVED: 'อนุมัติแล้ว',
  REJECTED: 'ไม่อนุมัติ',
  DISBURSED: 'จ่ายเงินแล้ว',
}

function isStatusChangedEvent(value: unknown): value is LoanStatusChangedEvent {
  if (!value || typeof value !== 'object') return false
  const event = value as Partial<LoanStatusChangedEvent>
  return event.type === 'loan.status.changed'
    && typeof event.applicationNumber === 'string'
    && typeof event.status === 'string'
    && event.status in statusLabels
    && typeof event.changedAt === 'string'
}

function isCreditBureauChangedEvent(value: unknown): value is CreditBureauChangedEvent {
  if (!value || typeof value !== 'object') return false
  const event = value as Partial<CreditBureauChangedEvent>
  return event.type === 'credit-bureau.changed' && typeof event.changedAt === 'string'
}

export function LoanNotifications() {
  const { toast } = useToast()

  useEffect(() => {
    let socket: WebSocket | undefined
    let reconnectTimer: ReturnType<typeof setTimeout> | undefined
    let retryDelay = 1000
    let disposed = false

    function connect() {
      if (disposed) return
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
      socket = new WebSocket(`${protocol}//${window.location.host}/api/realtime`)

      socket.addEventListener('open', () => {
        retryDelay = 1000
      })

      socket.addEventListener('message', (message) => {
        try {
          const event: unknown = JSON.parse(String(message.data))
          if (isStatusChangedEvent(event)) {
            toast({
              title: `สถานะคำขอ ${event.applicationNumber} เปลี่ยนแล้ว`,
              description: `สถานะใหม่: ${statusLabels[event.status]}`,
              variant: event.status === 'REJECTED' ? 'error' : 'success',
              duration: 6000,
            })
            window.dispatchEvent(new CustomEvent('loan-status-changed', { detail: event }))
          } else if (isCreditBureauChangedEvent(event)) {
            toast({ title: 'ประวัติเครดิตมีการอัปเดต', description: 'กำลังโหลดข้อมูลสัญญาและรายการรับ–จ่ายล่าสุด', variant: 'success' })
            window.dispatchEvent(new CustomEvent('credit-bureau-changed', { detail: event }))
          }
        } catch {
          // Ignore malformed messages so a bad event cannot break reconnection.
        }
      })

      socket.addEventListener('close', scheduleReconnect)
      socket.addEventListener('error', () => socket?.close())
    }

    function scheduleReconnect() {
      if (disposed) return
      reconnectTimer = setTimeout(connect, retryDelay)
      retryDelay = Math.min(retryDelay * 2, 30_000)
    }

    connect()
    return () => {
      disposed = true
      if (reconnectTimer) clearTimeout(reconnectTimer)
      socket?.close()
    }
  }, [toast])

  return null
}
