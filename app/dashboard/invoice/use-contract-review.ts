'use client'

import { useState, useRef } from 'react'
import { getPendingContractReview } from './review-actions'
import type { PendingContractReview } from '@/lib/pending-contract-review'

export function useContractReview(id: number) {
  const [open, setOpen] = useState(false), [review, setReview] = useState<PendingContractReview | null>(null)
  const [error, setError] = useState(''), [loading, setLoading] = useState(false)
  const generation = useRef(0)
  async function show() {
    const current = ++generation.current
    setOpen(true); setReview(null); setError(''); setLoading(true)
    try { const data = await getPendingContractReview(id); if (current === generation.current) { setReview(data); return true } return false }
    catch (error) { if (current === generation.current) setError(error instanceof Error ? error.message : 'โหลดข้อมูลไม่สำเร็จ'); return false }
    finally { if (current === generation.current) setLoading(false) }
  }
  function close() { generation.current++; setOpen(false); setReview(null); setLoading(false) }
  return { open, review, error, setError, loading, show, close }
}
