'use client'

import { useEffect, useState } from 'react'
import { isAgentEvent, isAgentSnapshot, type AgentSnapshot } from '@/lib/agent-village/protocol'

export function useAgentStream() {
  const [snapshot, setSnapshot] = useState<AgentSnapshot | null>(null)
  const [connection, setConnection] = useState<'connecting' | 'online' | 'offline'>('connecting')

  useEffect(() => {
    let disposed = false, retry = 1000
    let socket: WebSocket | null = null
    let timer: ReturnType<typeof setTimeout> | undefined
    let sessionId = '', sequence = -1
    const controller = new AbortController()

    function acceptSnapshot(value: unknown) {
      if (disposed || !isAgentSnapshot(value)) return
      if (sessionId === value.sessionId && value.sequence < sequence) return
      sessionId = value.sessionId
      sequence = value.sequence
      setSnapshot(value)
    }
    async function resync() {
      try {
        const response = await fetch('/api/agent-village/run', { cache: 'no-store', signal: controller.signal })
        if (response.ok) acceptSnapshot(await response.json())
      } catch { /* The reconnect snapshot is authoritative if the HTTP read fails. */ }
    }
    function connect() {
      if (disposed) return
      const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:'
      const client = new WebSocket(`${protocol}//${location.host}/api/agent-village`)
      socket = client
      client.onopen = () => { if (!disposed) { retry = 1000; setConnection('online') } }
      client.onmessage = message => {
        if (disposed) return
        let value: unknown
        try { value = JSON.parse(String(message.data)) } catch { return }
        if (isAgentSnapshot(value)) { acceptSnapshot(value); return }
        if (!isAgentEvent(value)) return
        if (value.sessionId !== sessionId || value.sequence > sequence + 1) { void resync(); return }
        if (value.sequence <= sequence) return
        sequence = value.sequence
        setSnapshot(previous => previous ? {
          ...previous, sequence: value.sequence,
          current: { agentId: 'coder', state: value.state, task: value.task, taskId: value.taskId, station: value.station, at: value.at },
          active: !['success','error','idle'].includes(value.state),
          report: previous.current.taskId === value.taskId ? previous.report : null,
          history: [...previous.history, value].slice(-80),
        } : previous)
        if (value.resultAvailable) void resync()
      }
      client.onerror = () => client.close()
      client.onclose = () => {
        if (disposed) return
        setConnection('offline')
        timer = setTimeout(connect, retry)
        retry = Math.min(retry * 2, 15_000)
      }
    }
    connect()
    return () => { disposed = true; controller.abort(); clearTimeout(timer); socket?.close() }
  }, [])
  return { snapshot, connection }
}
