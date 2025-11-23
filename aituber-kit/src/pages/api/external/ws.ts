// src/pages/api/external/ws.ts
import { WebSocketServer } from "ws"
import type { NextApiRequest, NextApiResponse } from "next"

export const config = {
  api: { bodyParser: false },
}

// ルーム保持
const rooms: Record<string, Set<any>> = {
  wsA: new Set(),
  wsB: new Set(),
  wsAB: new Set(),
}

function getRoom(entry: string) {
  return rooms[entry] ? entry : "wsA"
}

let wss: WebSocketServer | null = null

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  if (!res.socket.server.wss) {
    console.log("[external/ws] Initializing WebSocket server...")

    const wssInstance = new WebSocketServer({ noServer: true })

    // upgrade を拾う
    res.socket.server.on("upgrade", (request, socket, head) => {
      const { url } = request

      // URL 例： /api/external/ws?room=wsA
      if (url?.startsWith("/api/external/ws")) {
        const search = new URL(url, "http://localhost")
        const roomParam = search.searchParams.get("room") || "wsA"
        const room = getRoom(roomParam)

        wssInstance.handleUpgrade(request, socket, head, (ws) => {
          ws["room"] = room
          rooms[room].add(ws)

          console.log(`[WS] Connected → ${room}`)

          ws.on("message", (data) => {
            console.log(`[${room}] Received:`, String(data))
          })

          ws.on("close", () => {
            rooms[room].delete(ws)
            console.log(`[WS] Disconnected → ${room}`)
          })
        })
      }
    })

    res.socket.server.wss = wssInstance
    wss = wssInstance

    console.log("[external/ws] WebSocket server ready.")
  }

  res.status(200).end("WS OK")
}
