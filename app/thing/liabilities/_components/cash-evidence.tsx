'use client'
import Image from 'next/image'
import { FileText, Download, ExternalLink } from 'lucide-react'
export type CashEvidenceInfo = { entryId: number; originalName: string; mimeType: string; sizeBytes: number }
export function CashEvidence({ evidence }: { evidence?: CashEvidenceInfo }) {
  if (!evidence) return <span className="text-slate-400">ไม่มีเอกสารแนบ</span>
  const url = `/api/repayments/${evidence.entryId}/slip`
  return <div className="flex min-w-44 items-start gap-3"><a href={url} target="_blank" rel="noreferrer" aria-label={`เปิดหลักฐาน ${evidence.originalName}`} className="flex h-16 w-14 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-slate-200 bg-slate-50">{evidence.mimeType === 'application/pdf' ? <FileText size={24} className="text-rose-500" aria-hidden="true" /> : <Image unoptimized width={56} height={64} src={url} alt={`หลักฐาน ${evidence.originalName}`} loading="lazy" className="h-full w-full object-cover" />}</a><div className="min-w-0"><p className="m-0 max-w-36 truncate text-xs font-medium" title={evidence.originalName}>{evidence.originalName}</p><p className="mb-2 mt-1 text-[11px] text-slate-400">{evidence.mimeType === 'application/pdf' ? 'PDF' : 'รูปภาพ'} · {(evidence.sizeBytes/1024).toFixed(0)} KB</p><div className="flex gap-3 text-[11px] text-blue-700"><a className="inline-flex items-center gap-1 underline" href={url} target="_blank" rel="noreferrer"><ExternalLink size={12} aria-hidden="true" />เปิดดู</a><a className="inline-flex items-center gap-1 underline" href={`${url}?download=1`} download><Download size={12} aria-hidden="true" />ดาวน์โหลด</a></div></div></div>
}
