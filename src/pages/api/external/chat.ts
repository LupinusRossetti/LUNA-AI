// src/pages/api/external/chat.ts
import type { NextApiRequest, NextApiResponse } from 'next'
import homeStore from '@/features/stores/home'
import { handleSendChatFn } from '@/features/chat/handlers'   // ← 重要！

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { text } = req.body
  if (!text) {
    return res.status(400).json({ error: 'Missing text field' })
  }

  // ★外部メッセージ → 内部チャット処理に渡す
  const sendChat = handleSendChatFn()
  await sendChat(text)

  return res.status(200).json({ ok: true })
}
