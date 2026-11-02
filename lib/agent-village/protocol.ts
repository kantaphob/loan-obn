export const agentStates = ['idle', 'thinking', 'working', 'tool_calling', 'handoff', 'success', 'error'] as const
export type AgentState = typeof agentStates[number]
export type AgentStation = 'tea' | 'planning' | 'desk' | 'tools' | 'review'
export type AgentCurrent = { agentId: 'coder'; state: AgentState; task: string; taskId: string | null; station: AgentStation; at: string }
export type AgentEvent = AgentCurrent & { type: 'agent.event'; sessionId: string; sequence: number; tool?: string; targetAgentId?: string; resultAvailable?: boolean }
export type AgentReport = { taskId: string; startedAt: string; finishedAt: string; project: string; passed: boolean; files: { file: string; found: boolean; bytes: number }[]; typeCheck: { passed: boolean; exitCode: number | null; timedOut: boolean; diagnostics: string }; summary: string }
export type AgentSnapshot = { type: 'agent.snapshot'; sessionId: string; sequence: number; current: AgentCurrent; active: boolean; report: AgentReport | null; history: AgentEvent[] }

const stations: AgentStation[] = ['tea','planning','desk','tools','review']
export function isAgentEvent(value: unknown): value is AgentEvent {
  if (!value || typeof value !== 'object') return false
  const e = value as Partial<AgentEvent>
  return e.type === 'agent.event' && e.agentId === 'coder' && typeof e.sessionId === 'string'
    && Number.isSafeInteger(e.sequence) && e.sequence! > 0 && agentStates.includes(e.state!)
    && stations.includes(e.station!) && typeof e.task === 'string' && e.task.length <= 1000
    && (e.taskId === null || typeof e.taskId === 'string') && typeof e.at === 'string'
}
export function isAgentSnapshot(value: unknown): value is AgentSnapshot {
  if (!value || typeof value !== 'object') return false
  const s = value as Partial<AgentSnapshot>
  return s.type === 'agent.snapshot' && typeof s.sessionId === 'string' && Number.isSafeInteger(s.sequence)
    && s.sequence! >= 0 && typeof s.active === 'boolean' && !!s.current
    && s.current.agentId === 'coder' && agentStates.includes(s.current.state) && stations.includes(s.current.station)
    && typeof s.current.task === 'string' && typeof s.current.at === 'string'
    && Array.isArray(s.history) && s.history.length <= 80 && s.history.every(isAgentEvent)
    && (s.report === null || (!!s.report && typeof s.report.summary === 'string' && Array.isArray(s.report.files) && !!s.report.typeCheck && typeof s.report.typeCheck.diagnostics === 'string'))
}

declare global {
  var __agentVillage: { snapshot(): AgentSnapshot; startRun(): { accepted: boolean; taskId?: string } } | undefined
}
