'use client'

import { ArrowDownToLine, ArrowUpFromLine, Check, CircleAlert, FileText, LoaderCircle, X } from 'lucide-react'
import { useToast } from './toast'

export type FileTransfer = {
  name: string
  size?: number
  direction: 'upload' | 'download'
  progress?: number
  status?: 'transferring' | 'complete' | 'error'
  message?: string
}

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 ** 2) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1024 ** 2).toFixed(1)} MB`
}

export function FileTransferCard({ transfer, onClose }: { transfer: FileTransfer; onClose: () => void }) {
  const status = transfer.status ?? 'transferring'
  const progress = status === 'complete' ? 100 : typeof transfer.progress === 'number' && Number.isFinite(transfer.progress) ? Math.round(Math.max(0, Math.min(100, transfer.progress))) : undefined
  const label = status === 'complete' ? 'เสร็จสิ้น' : status === 'error' ? 'ไม่สำเร็จ' : transfer.direction === 'upload' ? 'กำลังอัปโหลด…' : 'กำลังดาวน์โหลด…'
  const DirectionIcon = transfer.direction === 'upload' ? ArrowUpFromLine : ArrowDownToLine
  const StateIcon = status === 'complete' ? Check : status === 'error' ? CircleAlert : LoaderCircle

  return (
    <article className="file-transfer-card" data-status={status} aria-label={`${transfer.direction === 'upload' ? 'อัปโหลด' : 'ดาวน์โหลด'} ${transfer.name}`}>
      <button type="button" className="file-transfer-close" onClick={onClose} aria-label="ซ่อนสถานะการรับส่งไฟล์"><X size={14} /></button>
      <div className="file-transfer-heading">
        <span className="file-transfer-icon" aria-hidden="true"><FileText size={25} /><DirectionIcon size={12} /></span>
        <div className="min-w-0">
          <p className="file-transfer-name" title={transfer.name}>{transfer.name}</p>
          <p className="file-transfer-size">{transfer.direction === 'upload' ? 'Upload' : 'Download'}{transfer.size !== undefined ? ` · ${formatSize(transfer.size)}` : ''}</p>
        </div>
      </div>
      <div className="file-transfer-meter">
        <div className="file-transfer-caption"><span><StateIcon size={14} className={status === 'transferring' ? 'file-transfer-spinner' : ''} aria-hidden="true" />{label}</span><span>{progress !== undefined ? `${progress}%` : ''}</span></div>
        <div className="file-transfer-track" role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress}>
          <span className={progress === undefined ? 'is-indeterminate' : ''} style={{ width: progress === undefined ? '35%' : `${progress}%` }} />
        </div>
        {transfer.message ? <p className="file-transfer-message">{transfer.message}</p> : null}
      </div>
    </article>
  )
}

/** Update with real network progress; hiding a notification does not cancel its request. */
export function useFileTransfer() {
  const { toast, update, dismiss } = useToast()
  return {
    start: (transfer: FileTransfer) => toast({ title: transfer.name, duration: 0, transfer }),
    update: (id: number, transfer: FileTransfer) => update(id, { title: transfer.name, transfer }),
    dismiss,
  }
}
