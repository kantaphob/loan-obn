import { spawnSync } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const directory = path.join(root, 'private/postgres')
const command = '/opt/homebrew/opt/postgresql@18/bin/pg_ctl'
const args = ['-D', path.join(directory,'data')]
if (spawnSync(command, [...args,'status'], {stdio:'ignore'}).status !== 0) {
  const result=spawnSync(command,[...args,'-l',path.join(directory,'server.log'),'-o',`-p 55432 -h 127.0.0.1 -k ${path.join(directory,'socket')}`,'start'], {stdio:'inherit'})
  process.exitCode = result.status ?? 1
}
