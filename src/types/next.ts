import type { Server as HTTPServer } from 'http'
import type { Socket } from 'net'
import type { WebSocketServer } from 'ws'

export type NextApiResponseServerIO = {
  socket: Socket & {
    server: HTTPServer & {
      wss?: WebSocketServer
    }
  }
} & {
  end: (...args: any[]) => void
}
