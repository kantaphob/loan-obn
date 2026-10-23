export const socialKeys = ['facebook', 'instagram', 'line'] as const
export type SocialKey = typeof socialKeys[number]
export function socialUrl(value: string): string | null {
  try {
    const url = new URL(value)
    return ['https:', 'http:'].includes(url.protocol) && url.hostname && !url.username && !url.password ? url.href : null
  } catch { return null }
}
export function socialStatus(value: string) {
  if (!value) return '—'
  if (value.toUpperCase() === 'FALSE') return 'ไม่มี'
  if (value.toUpperCase() === 'TRUE') return 'มีช่องทาง · ยังไม่มีลิงก์'
  return 'ยังไม่มีลิงก์'
}
export const maxLineQrBytes = 2 * 1024 * 1024
