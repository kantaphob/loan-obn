'use client'

import { useCallback, useEffect, useState } from 'react'
import { ArrowDownToLine, DatabaseBackup, LoaderCircle, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { useToast } from '@/components/ui/toast'

type Backup = {
  filename: string
  sizeBytes: number
  createdAt: string
}

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`
}

function formatDate(date: string) {
  return new Intl.DateTimeFormat('th-TH', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(date))
}

export function BackupManager() {
  const [backups, setBackups] = useState<Backup[]>([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const { toast } = useToast()

  const loadBackups = useCallback(async () => {
    setLoading(true)
    try {
      const response = await fetch('/api/admin/backups', { cache: 'no-store' })
      const data = await response.json() as { backups?: Backup[]; message?: string }
      if (!response.ok) throw new Error(data.message ?? 'โหลดรายการไม่สำเร็จ')
      setBackups(data.backups ?? [])
    } catch (error) {
      toast({
        title: 'โหลดรายการสำรองข้อมูลไม่สำเร็จ',
        description: error instanceof Error ? error.message : 'กรุณาลองใหม่อีกครั้ง',
        variant: 'error',
      })
    } finally {
      setLoading(false)
    }
  }, [toast])

  useEffect(() => {
    void loadBackups()
  }, [loadBackups])

  async function createBackup() {
    setCreating(true)
    try {
      const response = await fetch('/api/admin/backups', { method: 'POST' })
      const data = await response.json() as { backup?: Backup; message?: string }
      if (!response.ok || !data.backup) throw new Error(data.message ?? 'สร้างไฟล์สำรองไม่สำเร็จ')
      setBackups((current) => [data.backup!, ...current.filter((backup) => backup.filename !== data.backup!.filename)])
      toast({
        title: 'สำรองข้อมูลสำเร็จ',
        description: `${data.backup.filename} · ${formatBytes(data.backup.sizeBytes)}`,
        variant: 'success',
      })
    } catch (error) {
      toast({
        title: 'สำรองข้อมูลไม่สำเร็จ',
        description: error instanceof Error ? error.message : 'กรุณาลองใหม่อีกครั้ง',
        variant: 'error',
      })
    } finally {
      setCreating(false)
    }
  }

  return (
    <div className="space-y-4">
      <Card as="section" className="rounded-[20px] p-5 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex min-w-0 items-start gap-3">
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl border border-white/80 bg-white/55 text-[#343537] shadow-[inset_0_1px_0_white]">
              <DatabaseBackup size={20} aria-hidden="true" />
            </span>
            <div>
              <h2 className="m-0 text-sm font-semibold text-[#292a2c]">ไฟล์สำรองฐานข้อมูล</h2>
              <p className="mb-0 mt-1 max-w-2xl text-xs leading-5 text-[#77787b]">
                รวมข้อมูลผู้กู้และรูปที่เก็บในฐานข้อมูล เช่น QR Line และภาพจากการอ่านบัตร สร้างสำเนาได้โดยไม่หยุดระบบ
              </p>
            </div>
          </div>
          <Button type="button" variant="primary" disabled={creating} onClick={createBackup} className="inline-flex items-center gap-2">
            {creating ? <LoaderCircle size={15} className="animate-spin" /> : <DatabaseBackup size={15} />}
            {creating ? 'กำลังสำรอง…' : 'สำรองตอนนี้'}
          </Button>
        </div>
        <div className="mt-5 rounded-xl border border-amber-300/70 bg-amber-100/45 px-4 py-3 text-[11px] leading-5 text-amber-950">
          ไฟล์อยู่บนเครื่องเซิร์ฟเวอร์เดียวกับฐานข้อมูล ควรดาวน์โหลดสำเนาไปเก็บไว้อีกที่เป็นระยะ · ขณะนี้ระบบยังไม่มีพื้นที่เก็บไฟล์แนบเอกสารสัญญากู้
        </div>
      </Card>

      <Card as="section" className="overflow-hidden rounded-[20px]">
        <div className="flex items-center justify-between gap-3 border-b border-white/75 px-5 py-4">
          <div>
            <h2 className="m-0 text-sm font-semibold text-[#292a2c]">รายการสำรองข้อมูล</h2>
            <p className="mb-0 mt-1 text-[10px] text-[#77787b]">{backups.length} ไฟล์</p>
          </div>
          <Button type="button" onClick={() => void loadBackups()} disabled={loading || creating} aria-label="รีเฟรชรายการ" title="รีเฟรชรายการ" className="grid h-9 w-9 place-items-center !rounded-xl !p-0">
            {loading ? <LoaderCircle size={15} className="animate-spin" /> : <RefreshCw size={15} />}
          </Button>
        </div>

        {loading ? (
          <div className="flex min-h-32 items-center justify-center gap-2 text-xs text-[#77787b]"><LoaderCircle size={15} className="animate-spin" />กำลังโหลดรายการ…</div>
        ) : backups.length === 0 ? (
          <div className="flex min-h-36 flex-col items-center justify-center px-5 py-8 text-center">
            <DatabaseBackup size={24} className="text-[#8b8c8f]" aria-hidden="true" />
            <strong className="mt-3 text-xs font-semibold text-[#343537]">ยังไม่มีไฟล์สำรอง</strong>
            <p className="mb-0 mt-1 text-[10px] text-[#77787b]">กด “สำรองตอนนี้” เพื่อสร้างไฟล์แรก</p>
          </div>
        ) : (
          <ul className="m-0 divide-y divide-white/70 p-0">
            {backups.map((backup) => (
              <li key={backup.filename} className="flex flex-wrap items-center justify-between gap-4 px-5 py-4">
                <div className="min-w-0">
                  <p className="m-0 truncate text-xs font-semibold text-[#343537]">{backup.filename}</p>
                  <p className="mb-0 mt-1 text-[10px] text-[#77787b]">{formatDate(backup.createdAt)} · {formatBytes(backup.sizeBytes)}</p>
                </div>
                <a href={`/api/admin/backups/${encodeURIComponent(backup.filename)}`} className="inline-flex h-9 shrink-0 items-center gap-2 rounded-xl border border-white/90 bg-white/55 px-3 text-[10px] font-semibold text-[#343537] no-underline shadow-[inset_0_1px_0_white] transition hover:bg-white/85">
                  <ArrowDownToLine size={14} aria-hidden="true" />ดาวน์โหลด
                </a>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  )
}
