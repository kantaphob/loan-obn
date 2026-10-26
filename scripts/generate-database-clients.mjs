import { readFileSync, writeFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
const main = readFileSync('prisma/schema.prisma', 'utf8')
writeFileSync('prisma/schema.sqlite.prisma', main.replace('provider = "postgresql"', 'provider = "sqlite"').replace('../generated/prisma"', '../generated/prisma-sqlite"'))
for (const schema of ['prisma/schema.prisma', 'prisma/schema.sqlite.prisma']) {
  const result = spawnSync(process.execPath, ['node_modules/prisma/build/index.js', 'generate', '--schema', schema, '--config', 'prisma7.config.ts'], { stdio: 'inherit' })
  if (result.status !== 0) process.exit(result.status ?? 1)
}
