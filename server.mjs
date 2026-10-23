import 'dotenv/config'
import { syncRecordFiles } from './lib/record-files.mjs'
import { createAutomaticBackup } from './lib/automatic-backups.mjs'
import { createServer } from 'node:http'
import next from 'next'
import { WebSocket, WebSocketServer } from 'ws'

const dev = process.env.NODE_ENV !== 'production'
// The app intentionally has no login for its single-user workflow. Keep it
// private to this machine unless the operator explicitly configures a host.
const hostname = process.env.LOAN_HOSTNAME ?? '127.0.0.1'
const port = Number.parseInt(process.env.PORT ?? '3000', 10)
const app = next({ dev, hostname, port })
const handle = app.getRequestHandler()

await app.prepare()
const handleUpgrade = app.getUpgradeHandler()

const recordDatabaseUrl = process.env.DATABASE_URL ?? 'file:./private/database/ProgressSQL.db'
syncRecordFiles(recordDatabaseUrl)
const server = createServer((request, response) => {
  if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(request.method) && request.url?.startsWith('/api/')) {
    response.once('finish', () => {
      if (response.statusCode >= 400) return
      try { syncRecordFiles(recordDatabaseUrl) }
      catch (error) { console.error('Record file sync failed; run npm run storage:sync to repair:', error.code ?? error.name) }
      createAutomaticBackup().catch((error) => {
        console.error('Automatic database backup failed; the primary database is unchanged:', error.code ?? error.name ?? 'Unknown error')
      })
    })
  }
  return handle(request, response)
})
const sockets = new WebSocketServer({ noServer: true, maxPayload: 1024 })

server.on('upgrade', (request, socket, head) => {
  const pathname = new URL(request.url ?? '/', `http://${request.headers.host}`).pathname
  if (pathname !== '/api/realtime') {
    handleUpgrade(request, socket, head).catch((error) => {
      console.error('Next.js WebSocket upgrade error:', error)
      socket.destroy()
    })
    return
  }

  const origin = request.headers.origin
  if (origin) {
    try {
      if (new URL(origin).host !== request.headers.host) {
        socket.destroy()
        return
      }
    } catch {
      socket.destroy()
      return
    }
  }

  sockets.handleUpgrade(request, socket, head, (websocket) => {
    sockets.emit('connection', websocket)
  })
})

sockets.on('connection', (socket) => {
  socket.send(JSON.stringify({ type: 'connected', at: new Date().toISOString() }))
  socket.on('error', (error) => console.error('WebSocket client error:', error))
})

globalThis.__loanNotificationHub = {
  publish(event) {
    const message = JSON.stringify(event)
    for (const socket of sockets.clients) {
      if (socket.readyState === WebSocket.OPEN) socket.send(message)
    }
  },
}

const heartbeat = setInterval(() => {
  for (const socket of sockets.clients) {
    if (socket.readyState === WebSocket.OPEN) socket.ping()
  }
}, 30_000)

server.listen(port, hostname, () => {
  console.log(`> Ready on http://localhost:${port} (${dev ? 'development' : 'production'})`)
  console.log('> WebSocket endpoint: /api/realtime')
})

function shutdown() {
  clearInterval(heartbeat)
  sockets.close()
  server.close(() => process.exit(0))
}

process.on('SIGINT', shutdown)
process.on('SIGTERM', shutdown)
