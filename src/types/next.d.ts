// src/types/next.d.ts
import { WebSocketServer } from "ws";

declare module "http" {
  interface Server {
    wss?: WebSocketServer;
  }
}

export interface NextApiResponseServerIO extends NextApiResponse {
  socket: NextApiResponse["socket"] & {
    server: {
      wss?: WebSocketServer;
    };
  };
}
