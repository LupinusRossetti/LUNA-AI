// src/pages/api/external/broadcast.ts
import type { NextApiRequest, NextApiResponse } from "next";

// 外部WSサーバは独立プロセスで動くので
// Next.js API から broadcast は行わない。
// （存在しない externalWsServer をインポートしない安全版）

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  // ここでは何もせず成功だけ返す
  return res.status(200).json({ ok: true });
}
