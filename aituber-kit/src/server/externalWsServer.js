import { WebSocketServer, WebSocket } from "ws"
import dotenv from "dotenv"
dotenv.config()

// external server は 7645 を使う（8765 は Python に譲る）
const PORT = process.env.EXTERNAL_WS_PORT || 7645

// Next.js 全クライアント
const clients = new Set()

// Python simple_ws_server.py (8765) に接続
const pythonWs = new WebSocket("ws://localhost:8765/AB")

pythonWs.on("open", () => {
    console.log("[external] → Connected to Python (8765/AB)")
})

pythonWs.on("message", (msg) => {
    console.log("[external] ← from Python:", msg.toString())

    // Next.js の A と B へ broadcast
    for (const c of clients) {
        if (c.readyState === WebSocket.OPEN) {
            c.send(msg.toString())
        }
    }
})

// external WS server（7645）
const wss = new WebSocketServer({ port: PORT })
console.log(`[external] Running on ws://localhost:${PORT}`)

wss.on("connection", (ws) => {
    console.log("[external] Next.js connected")
    clients.add(ws)

    ws.on("message", (msg) => {
        console.log("[external] → from Next.js:", msg.toString())

        // Python へ転送
        if (pythonWs.readyState === WebSocket.OPEN) {
            pythonWs.send(msg.toString())
        }
    })

    ws.on("close", () => {
        clients.delete(ws)
        console.log("[external] Next.js disconnected")
    })
})
