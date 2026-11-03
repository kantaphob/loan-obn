'use client'

import { useEffect, useSyncExternalStore } from 'react'
import { Focus } from 'lucide-react'

let sessionFocus = false
function readFocus() {
  try { return localStorage.getItem('obn-focus-mode') === 'true' } catch { return sessionFocus }
}
function subscribe(callback: () => void) {
  window.addEventListener('obn-focus-change', callback)
  window.addEventListener('storage', callback)
  return () => {
    window.removeEventListener('obn-focus-change', callback)
    window.removeEventListener('storage', callback)
  }
}

export function FocusMode() {
  const focused = useSyncExternalStore(subscribe, readFocus, () => false)
  useEffect(() => { document.documentElement.dataset.workspaceFocus = String(focused) }, [focused])
  function toggle() {
    sessionFocus = !focused
    try { localStorage.setItem('obn-focus-mode', String(sessionFocus)) } catch { /* Session state still works when storage is unavailable. */ }
    window.dispatchEvent(new Event('obn-focus-change'))
  }
  return <button type="button" className="workspace-focus-toggle" aria-label="โฟกัสงาน" aria-pressed={focused} onClick={toggle} title="ลดพื้นหลังและหยุดไฟวิ่งเพื่อโฟกัสข้อมูล"><Focus size={15} aria-hidden="true" /><span>{focused ? 'โฟกัสอยู่' : 'โฟกัสงาน'}</span></button>
}
