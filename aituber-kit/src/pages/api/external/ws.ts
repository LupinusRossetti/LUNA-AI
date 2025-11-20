// src/pages/api/external/ws.ts
import { WebSocketServer } from "ws";
import type { NextApiRequest } from "next";
import homeStore from "@/features/stores/home";

// Next.js 用設定（bodyParser 無効化）
export const config = {
  api: {
    bodyParser: false,
  },
};

let wss: WebSocketServer | null = null;

export default function handler(req: NextApiRequest, res: any) {
  // 既に WS が作成されているなら再利用
  if (!res.socket.server.wss) {
    console.log("[external/ws] WebSocketServer starting...");

    // Next.js 内の server をそのまま使って WS を立ち上げる
    const wssInstance = new WebSocketServer({
      noServer: true,
    });

    res.socket.server.on("upgrade", (req, socket, head) => {
      if (req.url === "/api/external/ws") {
        wssInstance.handleUpgrade(req, socket, head, (ws) => {
          wssInstance.emit("connection", ws, req);
        });
      }
    });

    // AI からの返信を外部へブロードキャスト
    homeStore.getState().onAIAssistantReply((msg) => {
      const data = JSON.stringify({
        role: msg.role,
        content: msg.content,
      });

      wssInstance.clients.forEach((client: any) => {
        try {
          client.send(data);
        } catch (e) {
          console.error("WS send error:", e);
        }
      });
    });

    res.socket.server.wss = wssInstance;
    wss = wssInstance;

    console.log("[external/ws] WebSocketServer initialized");
  }

  res.end("WS ready");
}
