import 'server-only'

import { execFile } from 'node:child_process'
import path from 'node:path'
import { promisify } from 'node:util'
import type { ThaiIdCard } from '@/lib/thai-id'

const execute = promisify(execFile)
let reading = false

export class ThaiIdReaderError extends Error {
  constructor(message: string, readonly status: 409 | 503 = 503) {
    super(message)
    this.name = 'ThaiIdReaderError'
  }
}

/** Wait briefly for PC/SC to report a card insertion on the connected reader. */
export async function waitForThaiIdCard(signal?: AbortSignal): Promise<boolean> {
  if (process.platform !== 'darwin') {
    throw new ThaiIdReaderError('ระบบตรวจจับบัตรนี้รองรับ macOS ที่เชื่อมต่อเครื่องอ่าน ACS')
  }
  const scriptPath = path.join(process.cwd(), 'scripts/read-thai-id.py')
  try {
    const { stdout } = await execute('/usr/bin/python3', [scriptPath, '--wait'], {
      timeout: 25_000,
      maxBuffer: 8 * 1024,
      signal,
    })
    const result = JSON.parse(stdout) as { cardPresent?: boolean }
    return result.cardPresent === true
  } catch (error) {
    if (error instanceof ThaiIdReaderError) throw error
    throw new ThaiIdReaderError(messageFromReaderError(error) ?? 'ตรวจจับเครื่องอ่านบัตรไม่สำเร็จ')
  }
}

function messageFromReaderError(error: unknown) {
  if (!error || typeof error !== 'object' || !('stdout' in error) || typeof error.stdout !== 'string') return null
  try {
    const result: unknown = JSON.parse(error.stdout)
    if (result && typeof result === 'object' && 'message' in result && typeof result.message === 'string') return result.message
  } catch {
    // Do not return raw process output because it could contain personal card data.
  }
  return null
}

/** Read the inserted Thai ID card from the machine's connected ACS reader. */
export async function readThaiIdCard(): Promise<ThaiIdCard> {
  if (process.platform !== 'darwin') {
    throw new ThaiIdReaderError('ต้องรันระบบบน Mac ที่เชื่อมต่อเครื่องอ่าน ACS')
  }
  if (reading) {
    throw new ThaiIdReaderError('เครื่องอ่านกำลังใช้งาน กรุณารอสักครู่', 409)
  }

  reading = true
  try {
    const scriptPath = path.join(process.cwd(), 'scripts/read-thai-id.py')
    const { stdout } = await execute('/usr/bin/python3', [scriptPath], {
      timeout: 25_000,
      maxBuffer: 128 * 1024,
    })

    let result: { card?: ThaiIdCard }
    try {
      result = JSON.parse(stdout) as { card?: ThaiIdCard }
    } catch {
      throw new ThaiIdReaderError('อ่านข้อมูลบัตรไม่สำเร็จ กรุณาตรวจสอบเครื่องอ่านและลองอีกครั้ง')
    }

    const card = result.card
    if (!card || !/^\d{13}$/.test(card.nationalId) || typeof card.photo !== 'string' || !card.photo.startsWith('data:image/jpeg;base64,')) {
      throw new ThaiIdReaderError('ข้อมูลจากบัตรไม่ครบ กรุณาลองอ่านอีกครั้ง')
    }
    return card
  } catch (error) {
    if (error instanceof ThaiIdReaderError) throw error
    throw new ThaiIdReaderError(
      messageFromReaderError(error) ?? 'อ่านบัตรไม่สำเร็จ กรุณาตรวจสอบเครื่องอ่านและลองอีกครั้ง',
    )
  } finally {
    reading = false
  }
}
