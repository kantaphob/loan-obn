'use client'

import { useEffect, useState, type ReactNode } from 'react'
import { Download, ZoomIn, ZoomOut, RotateCcw } from 'lucide-react'
import { Modal } from './modal'
import { Button } from './button'
import { DataLoading } from './data-loading'

export function SlipPreview({ entryId, children = 'ดูสลิป', className = '', filename }: { entryId: number; children?: ReactNode; className?: string; filename?: string }) {
  const [open, setOpen] = useState(false)
  return <><button type="button" className={className} onClick={() => setOpen(true)} aria-label={`ดูสลิป TX-${String(entryId).padStart(6, '0')}`}>{children}</button>{open && <SlipViewer entryId={entryId} filename={filename} onClose={() => setOpen(false)} />}</>
}
function SlipViewer({ entryId, filename, onClose }: { entryId: number; filename?: string; onClose: () => void }) {
  const [file, setFile] = useState<{ url: string; type: string } | null>(null)
  const [error, setError] = useState('')
  const [zoom, setZoom] = useState(1)
  const source = `/api/repayments/${entryId}/slip`
  useEffect(() => {
    const controller = new AbortController()
    let objectUrl: string | undefined
    fetch(source, { signal: controller.signal, cache: 'no-store' }).then(async response => {
      if (!response.ok) throw new Error(response.status === 404 ? 'ไม่พบไฟล์สลิป' : 'ไม่สามารถเปิดสลิปได้')
      const blob = await response.blob()
      if (controller.signal.aborted) return
      if (!['image/jpeg', 'image/png', 'application/pdf'].includes(blob.type)) throw new Error('ชนิดไฟล์สลิปไม่รองรับ')
      objectUrl = URL.createObjectURL(blob)
      setFile({ url: objectUrl, type: blob.type })
    }).catch(error => { if (!controller.signal.aborted) setError(error instanceof Error ? error.message : 'โหลดสลิปไม่สำเร็จ') })
    return () => { controller.abort(); if (objectUrl) URL.revokeObjectURL(objectUrl) }
  }, [source])
  return <Modal open title={`สลิป TX-${String(entryId).padStart(6, '0')}`} onClose={onClose} className="!max-w-4xl !bg-white">
    <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
      <p className="min-w-0 flex-1 truncate text-xs text-slate-500" title={filename}>{filename || 'หลักฐานการโอนเงิน'}</p>
      <div className="flex items-center gap-2">{file && file.type !== 'application/pdf' && <><Button aria-label="ย่อสลิป" disabled={zoom <= 1} onClick={() => setZoom(z => Math.max(1, z - .5))}><ZoomOut size={16} /></Button><span className="text-xs tabular-nums">{Math.round(zoom * 100)}%</span><Button aria-label="ขยายสลิป" disabled={zoom >= 3} onClick={() => setZoom(z => Math.min(3, z + .5))}><ZoomIn size={16} /></Button><Button aria-label="คืนขนาดสลิป" disabled={zoom === 1} onClick={() => setZoom(1)}><RotateCcw size={15} /></Button></>}{file && <a href={file.url} download={filename || `TX-${String(entryId).padStart(6, '0')}.${file.type === 'application/pdf' ? 'pdf' : file.type === 'image/png' ? 'png' : 'jpg'}`} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-xs text-blue-700"><Download size={15} />ดาวน์โหลด</a>}</div>
    </div>
    <div className="h-[min(65dvh,720px)] overflow-auto rounded-xl border border-slate-200 bg-slate-100" aria-label="ภาพสลิป" tabIndex={0}>
      {error ? <p role="alert" className="p-10 text-center text-sm text-rose-700">{error}</p> : !file ? <DataLoading variant="document" label="กำลังโหลดสลิป…" /> : file.type === 'application/pdf' ? <iframe title="เอกสารสลิป PDF" src={file.url} className="h-full w-full border-0" /> : <div className="min-h-full" style={{ width: `${zoom * 100}%` }}>
        {/* The authenticated original is shown locally without image optimization. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={file.url} alt={`หลักฐานการโอน TX-${String(entryId).padStart(6, '0')}`} className="mx-auto block w-full object-contain" style={{ maxHeight: zoom === 1 ? 'min(65dvh,720px)' : undefined }} />
      </div>}
    </div>
    <div className="mt-3 flex justify-end"><Button onClick={onClose}>ปิด</Button></div>
  </Modal>
}
