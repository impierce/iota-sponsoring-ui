import { createServer } from 'http'
import next from 'next'
import { parse } from 'url'
import WebSocket from 'ws'
import { WebSocketServer } from 'ws'

const dev = process.env.NODE_ENV !== 'production'
const hostname = process.env.HOSTNAME || 'localhost'
const port = parseInt(process.env.PORT || '3000', 10)
const backendWsUrl = process.env.GRAPHQL_BACKEND_WS_URL
const apiKey = process.env.X_API_KEY

// Prepare Next.js app
const app = next({ dev, hostname, port })
const handle = app.getRequestHandler()

app.prepare().then(() => {
  const server = createServer(async (req, res) => {
    try {
      const parsedUrl = parse(req.url!, true)
      await handle(req, res, parsedUrl)
    } catch (err) {
      console.error('Error occurred handling', req.url, err)
      res.statusCode = 500
      res.end('internal server error')
    }
  })

  // Only set up WebSocket proxy if backend URL and API key are configured
  if (backendWsUrl && apiKey) {
    const wss = new WebSocketServer({ noServer: true })

    server.on('upgrade', (request, socket, head) => {
      const { pathname } = parse(request.url || '')

      // Only proxy WebSocket connections to /api/graphql/ws
      if (pathname === '/api/graphql/ws') {
        wss.handleUpgrade(request, socket, head, (ws) => {
          // Create connection to backend with X-API-Key header
          const backendWs = new WebSocket(backendWsUrl, {
            headers: {
              'X-API-Key': apiKey
            }
          })

          // Forward messages from client to backend
          ws.on('message', (data) => {
            if (backendWs.readyState === WebSocket.OPEN) {
              backendWs.send(data)
            }
          })

          // Forward messages from backend to client
          backendWs.on('message', (data) => {
            if (ws.readyState === WebSocket.OPEN) {
              ws.send(data)
            }
          })

          // Handle backend connection open
          backendWs.on('open', () => {
            // Connection established
          })

          // Handle backend errors
          backendWs.on('error', (error) => {
            console.error('Backend WebSocket error:', error)
            ws.close(1011, 'Backend connection error')
          })

          // Handle backend close
          backendWs.on('close', () => {
            // Backend connection closed
            ws.close()
          })

          // Handle client close
          ws.on('close', () => {
            // Client connection closed
            backendWs.close()
          })

          // Handle client errors
          ws.on('error', (error) => {
            console.error('Client WebSocket error:', error)
            backendWs.close()
          })
        })
      } else {
        socket.destroy()
      }
    })
  } else {
    console.warn(
      'WebSocket proxy not configured. Set GRAPHQL_BACKEND_WS_URL and X_API_KEY environment variables.'
    )
  }

  server.once('error', (err) => {
    console.error(err)
    process.exit(1)
  })

  server.listen(port, () => {
    // eslint-disable-next-line no-console
    console.log(`> Ready on http://${hostname}:${port}`)
  })
})
