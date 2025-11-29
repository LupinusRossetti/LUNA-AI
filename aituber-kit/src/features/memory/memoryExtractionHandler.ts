/**
 * 記憶抽出のハンドラー
 * 会話から記憶を抽出して保存する処理を管理
 */

import homeStore from '@/features/stores/home'
import { extractMemoriesFromConversation } from './memoryExtractor'
import { info, error as logError } from '@/utils/logger'

/**
 * 会話から記憶を抽出して保存（非同期実行）
 * processAIResponseの完了を待つため、遅延実行する
 */
export function extractMemoriesFromChat(
  userMessage: string,
  delayMs: number = 2000
): void {
  if (typeof window === 'undefined') {
    return
  }

  setTimeout(async () => {
    try {
      const currentChatLog = homeStore.getState().chatLog

      // 最新のアシスタントメッセージを取得
      const latestAssistantMessage = currentChatLog
        .filter(
          (msg) =>
            msg.role === 'assistant' ||
            msg.role === 'assistant-A' ||
            msg.role === 'assistant-B'
        )
        .slice(-1)[0]

      if (!latestAssistantMessage) {
        return
      }

      const assistantText =
        typeof latestAssistantMessage.content === 'string'
          ? latestAssistantMessage.content
          : latestAssistantMessage.content?.[0]?.text || ''

      if (!assistantText) {
        return
      }

      const extractedMemories = await extractMemoriesFromConversation(
        userMessage,
        assistantText
      )

      if (extractedMemories.length > 0) {
        info('会話から記憶を抽出', {
          count: extractedMemories.length,
          memories: extractedMemories.map((m) => ({
            type: m.type,
            content: m.content.substring(0, 30),
          })),
        }, 'memoryExtractionHandler')
      }
    } catch (error) {
      logError('記憶抽出に失敗', error, 'memoryExtractionHandler')
    }
  }, delayMs)
}



