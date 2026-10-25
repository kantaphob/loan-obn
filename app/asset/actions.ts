'use server'

import { mkdir, readFile, writeFile, rename, rm } from 'node:fs/promises'
import path from 'node:path'
import { getCurrentUser } from '@/lib/auth/current-user'
import { initialData, type AssetData } from './model'
import { validateAssetData } from './validation'

const directory = process.env.ASSET_DATA_DIRECTORY || path.join(process.cwd(), 'private', 'assets')
async function operator(write = false) {
  const user = await getCurrentUser()
  if (!user || user.status !== 'ACTIVE' || write && user.role === 'REVIEWER') throw new Error('ไม่มีสิทธิ์ทำรายการนี้')
  return user
}
async function read(id: string): Promise<AssetData> {
  try {
    const data = JSON.parse(await readFile(path.join(directory, `${id}.json`), 'utf8')) as AssetData
    // Reference-only fields can be added without invalidating saved payment history.
    if (Array.isArray(data.homes)) for (const home of data.homes) {
      if (Array.isArray(home.rounds)) for (const round of home.rounds) round.referenceInterest ??= 0
    }
    validateAssetData(data)
    return data
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return initialData()
    throw error
  }
}
export async function getAssetWorkspace() {
  const user = await operator()
  return { data: await read(user.id), canWrite: user.role !== 'REVIEWER' }
}
export async function saveAssetWorkspace(input: AssetData): Promise<{ data?: AssetData; error?: string }> {
  let lock = ''; let temporary = ''
  try {
    const user = await operator(true)
    if (JSON.stringify(input).length > 2_000_000) throw new Error('ข้อมูลมีขนาดใหญ่เกินไป')
    validateAssetData(input)
    await mkdir(directory, { recursive: true })
    const lockPath = path.join(directory, `${user.id}.lock`)
    try { await mkdir(lockPath) } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'EEXIST') throw new Error('กำลังบันทึกข้อมูล กรุณาลองอีกครั้ง')
      throw error
    }
    lock = lockPath
    const current = await read(user.id)
    if (input.revision !== current.revision) throw new Error('ข้อมูลถูกแก้ไขจากอีกหน้าต่าง กรุณาโหลดหน้าใหม่ก่อนบันทึก')
    const data: AssetData = { ...input, revision: current.revision + 1 }
    temporary = path.join(directory, `${user.id}-${crypto.randomUUID()}.tmp`)
    await writeFile(temporary, JSON.stringify(data), { mode: 0o600 })
    await rename(temporary, path.join(directory, `${user.id}.json`))
    return { data }
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'บันทึกไม่สำเร็จ' }
  } finally {
    if (temporary) await rm(temporary, { force: true })
    if (lock) await rm(lock, { recursive: true, force: true })
  }
}
