import { spawnSync } from 'node:child_process'
import { mkdirSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const directory = path.join(root, 'private/postgres')
const data = path.join(directory, 'data')
const socket = path.join(directory, 'socket')
const log = path.join(directory, 'server.log')
const pgCtl = '/opt/homebrew/opt/postgresql@18/bin/pg_ctl'
const statusArgs = ['-D', data, 'status']
const startArgs = ['-D', data, '-l', log, '-o', `-p 55432 -h 127.0.0.1 -k ${socket}`, '-w', '-t', '30', 'start']

mkdirSync(socket, { recursive: true, mode: 0o700 })
let stopping = false
process.on('SIGINT', () => { stopping = true })
process.on('SIGTERM', () => { stopping = true })

while (!stopping) {
  if (spawnSync(pgCtl, statusArgs, { stdio: 'ignore' }).status !== 0) {
    const result = spawnSync(pgCtl, startArgs, { encoding: 'utf8', env: { ...process.env, LC_ALL: 'C', LANG: 'C' } })
    if (result.status === 0) {
      console.log('Local PostgreSQL is ready on 127.0.0.1:55432')
    } else {
      console.error('Could not start local PostgreSQL; will retry:', result.stderr || result.stdout || 'unknown error')
    }
  }
  await new Promise(resolve => setTimeout(resolve, 5000))
}
