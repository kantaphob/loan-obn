'use client'

import { useEffect, useRef } from 'react'
import { useToast } from './toast'

/** Keep inline validation and announce new results through the global toast layer. */
export function useFeedbackToast({ error = '', success = '' }: { error?: string; success?: string }) {
  const { toast } = useToast()
  const previous = useRef({ error: '', success: '' })
  useEffect(() => {
    if (error && error !== previous.current.error) toast({ title: 'ดำเนินการไม่สำเร็จ', description: error, variant: 'error', duration: 7000 })
    if (success && success !== previous.current.success) toast({ title: 'ดำเนินการเรียบร้อย', description: success, variant: 'success' })
    previous.current = { error, success }
  }, [error, success, toast])
}
