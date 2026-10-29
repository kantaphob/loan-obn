'use client'

import { Download, Printer } from 'lucide-react'
import { Button } from '@/components/ui/button'

export function SummaryControls({ csv, date, disabled }: { csv: string; date: string; disabled: boolean }) {
  function download() {
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }))
    const link = document.createElement('a')
    link.href = url; link.download = `สรุปยอดผู้กู้-${date}.csv`
    document.body.appendChild(link); link.click(); link.remove()
    window.setTimeout(() => URL.revokeObjectURL(url), 1000)
  }
  return <div className="loan-summary-controls"><Button disabled={disabled} onClick={download}><Download size={16} aria-hidden="true" />ส่งออก CSV</Button><Button onClick={() => window.print()}><Printer size={16} aria-hidden="true" />พิมพ์สรุป</Button></div>
}
