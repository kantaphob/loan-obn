import 'dotenv/config'
import { syncRecordFiles } from './lib/record-files.mjs'
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
await syncRecordFiles(recordDatabaseUrl)
const server = createServer((request, response) => {
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
server.on('error', (error) => {
  if (error.code === 'EADDRINUSE') {
    console.error(`Port ${port} is already in use. Stop the other server or run with a different PORT.`)
  } else {
    console.error('HTTP server failed to start:', error)
  }
  process.exit(1)
})

let shuttingDown = false
function shutdown() {
  // Allow a second Ctrl+C to force-stop if graceful shutdown gets stuck.
  if (shuttingDown) process.exit(130)
  shuttingDown = true
  clearInterval(heartbeat)

  // WebSocketServer.close() waits for existing clients; terminate them so the
  // HTTP server can finish closing instead of leaving Ctrl+C hanging forever.
  for (const socket of sockets.clients) socket.terminate()
  sockets.close()

  const forceExit = setTimeout(() => process.exit(130), 5_000)
  forceExit.unref()
  server.close(() => {
    clearTimeout(forceExit)
    process.exit(0)
  })
  server.closeAllConnections?.()
}

process.on('SIGINT', shutdown)
process.on('SIGTERM', shutdown)
