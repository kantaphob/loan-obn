'use client'

import Image from 'next/image'
import { useEffect, useRef, useState } from 'react'
import { Camera, X } from 'lucide-react'
import { Modal } from '@/components/ui/modal'
import type { WorkPhoto } from '../../_shared/model'

const photoUrl = (photo: WorkPhoto) => `/api/thing/work-photos/${photo.id}`

export function WorkPhotoGallery({ photos = [], title }: { photos?: WorkPhoto[]; title: string }) {
 const [selected, setSelected] = useState<WorkPhoto | null>(null)
 if (!photos.length) return null
 return <><div className="mt-3 flex flex-wrap gap-2">{photos.map((photo, index) => <button key={photo.id} type="button" className="overflow-hidden rounded-lg border border-slate-200 bg-white focus-visible:outline-2 focus-visible:outline-blue-600" aria-label={`ดูรูป ${title} รูปที่ ${index + 1}`} onClick={() => setSelected(photo)}><Image unoptimized src={photoUrl(photo)} width={80} height={80} alt={`${title} รูปที่ ${index + 1}`} className="h-20 w-20 object-cover" /></button>)}</div><Modal open={Boolean(selected)} title={`รูป · ${title}`} onClose={() => setSelected(null)} className="!max-w-4xl">{selected && <><Image unoptimized src={photoUrl(selected)} width={1200} height={900} alt={`${title} · ${selected.name}`} className="max-h-[70dvh] w-full rounded-xl object-contain" /><p className="mb-0 break-words text-sm text-slate-600">{selected.name}</p></>}</Modal></>
}

export function WorkPhotoField({ photos = [], title, disabled = false, onChange, onUploadingChange }: { photos?: WorkPhoto[]; title: string; disabled?: boolean; onChange: (photos: WorkPhoto[]) => void; onUploadingChange?: (uploading: boolean) => void }) {
 const [uploading, setUploading] = useState(false)
 const [error, setError] = useState('')
 const controller = useRef<AbortController | null>(null)
 useEffect(() => () => controller.current?.abort(), [])
 async function upload(files: File[]) {
  if (!files.length || disabled || uploading) return
  if (photos.length + files.length > 6) { setError('แนบได้สูงสุด 6 รูปต่อรายการ'); return }
  if (files.some(file => !file.size || file.size > 5 * 1024 * 1024 || !['image/jpeg','image/png'].includes(file.type))) { setError('เลือก JPG / PNG ขนาดไม่เกิน 5 MB ต่อรูป'); return }
  const abort = new AbortController(); controller.current = abort
  setUploading(true); onUploadingChange?.(true); setError('')
  try {
   const added: WorkPhoto[] = []
   for (const file of files) {
    const form = new FormData(); form.set('file', file)
    const response = await fetch('/api/thing/work-photos', { method: 'POST', body: form, signal: abort.signal })
    const result = await response.json()
    if (!response.ok) throw new Error(result.error || 'แนบรูปไม่สำเร็จ')
    added.push(result as WorkPhoto)
   }
   if (!abort.signal.aborted) onChange([...photos, ...added])
  } catch (caught) { if (!abort.signal.aborted) setError(caught instanceof Error ? caught.message : 'แนบรูปไม่สำเร็จ') }
  finally { setUploading(false); onUploadingChange?.(false) }
 }
 return <section className="rounded-xl border border-blue-200 bg-blue-50/30 p-4"><label className="block text-sm font-semibold text-slate-800"><span className="flex items-center gap-2"><Camera size={17} />รูปสินค้า / รูปหน้างาน · {photos.length}/6 รูป</span><input className="mt-3 block w-full min-w-0 text-sm" type="file" multiple accept="image/jpeg,image/png,.jpg,.jpeg,.png" disabled={disabled || uploading || photos.length >= 6} onChange={event => { const files = [...(event.target.files ?? [])]; event.target.value = ''; void upload(files) }} /></label><p className="mb-0 mt-2 text-xs text-slate-600">JPG / PNG ไม่เกิน 5 MB ต่อรูป · เลือกได้หลายรูป · แยกจากบิลและเอกสาร · กดบันทึกแบบฟอร์มเพื่อเก็บรูปกับรายการ</p>{uploading && <p role="status" className="text-sm text-blue-800">กำลังแนบรูป… กรุณารอให้เสร็จก่อนบันทึก</p>}{error && <p role="alert" className="text-sm text-rose-700">{error}</p>}<WorkPhotoGallery photos={photos} title={title} />{photos.length > 0 && <div className="mt-2 space-y-1">{photos.map(photo => <div key={photo.id} className="flex items-center justify-between gap-3 text-xs"><span className="min-w-0 truncate text-slate-600">{photo.name}</span><button type="button" className="flex shrink-0 items-center gap-1 rounded-lg px-2 py-2 text-rose-700 hover:bg-rose-50" disabled={disabled || uploading} onClick={() => onChange(photos.filter(row => row.id !== photo.id))} aria-label={`นำรูป ${photo.name} ออกจากรายการ`}><X size={14} />นำรูปออก</button></div>)}</div>}</section>
}
