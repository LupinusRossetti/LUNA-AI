// src/pages/api/external/broadcast.ts
import type { NextApiRequest, NextApiResponse } from "next";
import { broadcastToClients } from "@/server/externalWsServer";

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { text } = req.body;
  if (!text) {
    return res.status(400).json({ error: "Missing text" });
  }

  broadcastToClients({ text });

  return res.status(200).json({ ok: true });
}
