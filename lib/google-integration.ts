import 'server-only'

import { createHash } from 'node:crypto'

export type GoogleSheetRow = {
  sheetName: string
  keyHeader: string
  keyValue: string
  values?: Record<string, string | number | boolean | null>
  delete?: boolean
}

function getBridgeConfig() {
  const url = process.env.GOOGLE_APPS_SCRIPT_URL?.trim()
  const token = process.env.GOOGLE_SYNC_TOKEN?.trim()
  if (!url || !token) return null
  return { url, token }
}

export function isGoogleBridgeConfigured() { return getBridgeConfig() !== null }

export async function postGoogleBridge<T>(action: string, payload: Record<string, unknown>): Promise<T | null> {
  const config = getBridgeConfig()
  if (!config) return null
  const response = await fetch(config.url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ action, token: config.token, ...payload }),
    cache: 'no-store',
    signal: AbortSignal.timeout(25_000),
  })
  const result = await response.json() as { ok?: boolean; result?: T; error?: string }
  if (!response.ok || result.ok !== true) throw new Error(`Google integration failed (${result.error ?? response.status})`)
  return result.result ?? null
}

export async function syncGoogleSheetRow(row: GoogleSheetRow) {
  return postGoogleBridge<{ sheetName: string; row?: number; deleted?: boolean; key: string }>('syncRows', { rows: [row] })
}

export async function syncGoogleSheetRows(rows: GoogleSheetRow[]) {
  const result: unknown[] = []
  for (let offset = 0; offset < rows.length; offset += 200) {
    const batch = rows.slice(offset, offset + 200)
    const response = await postGoogleBridge<{ count: number }>('syncRows', { rows: batch })
    if (response) result.push(response)
  }
  return result
}

export async function archiveGoogleContractPdf(input: {
  contractCode: string
  documentType: 'loan' | 'guarantee' | 'collateral'
  createdAt: Date
  bytes: Uint8Array
}) {
  const pdfBase64 = Buffer.from(input.bytes).toString('base64')
  const sha256 = createHash('sha256').update(input.bytes).digest('hex')
  return postGoogleBridge<{ fileId: string; fileUrl: string; folderUrl: string; name: string }>('archiveContractPdf', {
    contractCode: input.contractCode,
    documentType: input.documentType,
    year: String(input.createdAt.getFullYear() + 543),
    sha256,
    pdfBase64,
  })
}

export async function archiveGoogleLedgerFile(input: {
  entryCode: string
  fileType: 'slip' | 'collateral'
  originalName: string
  mimeType: string
  createdAt: Date
  bytes: Uint8Array
}) {
  const fileBase64 = Buffer.from(input.bytes).toString('base64')
  const sha256 = createHash('sha256').update(input.bytes).digest('hex')
  return postGoogleBridge<{ fileId: string; fileUrl: string; folderUrl: string; name: string }>('archiveLedgerFile', {
    entryCode: input.entryCode,
    fileType: input.fileType,
    originalName: input.originalName,
    mimeType: input.mimeType,
    year: String(input.createdAt.getFullYear() + 543),
    sha256,
    fileBase64,
  })
}

export function reportGoogleSyncError(context: string, error: unknown) {
  const code = error instanceof Error ? error.message : 'unknown'
  console.error(`Google sync ${context} failed: ${code.slice(0, 120)}`)
}

export function thaiYear(dateValue: string | Date) {
  const date = dateValue instanceof Date ? dateValue : new Date(`${dateValue.slice(0, 10)}T00:00:00.000Z`)
  return Number.isFinite(date.getTime()) ? date.getUTCFullYear() + 543 : ''
}

export function isoDate(value: string | Date | null | undefined) {
  if (!value) return ''
  return value instanceof Date ? value.toISOString() : value.slice(0, 10)
}
