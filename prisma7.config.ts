import { getDatabaseUrl } from './lib/database-config'
import { defineConfig } from 'prisma/config'

const sqlite = getDatabaseUrl().startsWith('file:')

export default defineConfig({
  schema: sqlite ? 'prisma/schema.sqlite.prisma' : 'prisma/schema.prisma',
  migrations: {
    path: sqlite ? 'prisma/migrations' : 'prisma/migrations-postgresql',
    seed: 'tsx prisma/seed.ts',
  },
  datasource: {
    url: getDatabaseUrl(),
  },
})
