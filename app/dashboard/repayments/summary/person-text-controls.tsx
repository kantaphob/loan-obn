'use client'

import { useState } from 'react'
import { Check, ClipboardCopy } from 'lucide-react'
import { Button } from '@/components/ui/button'

export function PersonTextControls({ text, name }: { text: string; name: string }) {
  const [copiedText, setCopiedText] = useState('')
  const [copying, setCopying] = useState(false)
  const [failed, setFailed] = useState(false)
  const copied = copiedText === text
  async function copy() {
    setCopying(true); setFailed(false)
    try {
      await navigator.clipboard.writeText(text)
      setCopiedText(text)
    } catch { setCopiedText(''); setFailed(true) }
    finally { setCopying(false) }
  }
  return <div className="loan-person-text-controls">
    <div className="loan-person-text-buttons"><Button disabled={copying} onClick={copy} aria-label={`คัดลอกสรุปของ ${name}`}>{copied ? <Check size={15} aria-hidden="true" /> : <ClipboardCopy size={15} aria-hidden="true" />}{copying ? 'กำลังคัดลอก…' : copied ? 'คัดลอกแล้ว' : 'คัดลอกสรุป'}</Button></div>
    <span role="status" className="sr-only">{copied ? `คัดลอกสรุปของ ${name} แล้ว` : ''}</span>
    {failed && <div className="loan-person-copy-fallback"><p role="alert">คัดลอกอัตโนมัติไม่ได้ เลือกข้อความด้านล่างเพื่อคัดลอก</p><textarea readOnly aria-label={`ข้อความสรุปของ ${name}`} rows={7} value={text} onFocus={event => event.currentTarget.select()} /></div>}
  </div>
}
