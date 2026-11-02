'use client'

import { useEffect, useState } from 'react'
import { RuntimeLoader, useRive } from '@rive-app/react-canvas'

// Bundle WASM locally: animation rendering sends no data or requests to a CDN.
RuntimeLoader.setWasmUrl('/ai-sect/rive/rive.wasm')
RuntimeLoader.setWasmFallbackUrl('/ai-sect/rive/rive_fallback.wasm')

export function CoderCharacter({ pose, paused }: { pose: number; paused: boolean }) {
  const [failed, setFailed] = useState(false)
  const { rive, RiveComponent } = useRive({ src: '/ai-sect/rive/coder.riv', stateMachines: 'CoderController', autoplay: true, autoBind: true, onLoadError: () => setFailed(true) })
  // Read the auto-bound instance from its owning Rive runtime. Keeping a
  // separate ViewModel handle across Fast Refresh can retain a freed WASM pointer.
  useEffect(() => {
    const property = rive?.viewModelInstance?.number('pose')
    if (property) property.value = pose
  }, [rive, pose])
  useEffect(() => {
    if (!rive) return
    if (paused) rive.pause()
    else rive.play('CoderController')
  }, [rive, paused])

  if (failed) return <div className="village-riveError">โหลด Rive ไม่สำเร็จ<br />ตรวจสถานะได้จากบันทึกด้านข้าง</div>
  return <div className="village-rig" data-pose={pose} data-rive-ready={!!rive} aria-hidden="true"><RiveComponent />{!rive && <span className="village-loading">กำลังโหลดตัวละคร…</span>}</div>
}
