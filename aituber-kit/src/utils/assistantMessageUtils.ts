import { Message } from '@/features/messages/messages'

/**
 * chatLogから最新のアシスタントメッセージのコンテンツを取得する
 * @param chatLog メッセージログ
 * @returns 最新のアシスタントメッセージの文字列コンテンツ、存在しない場合は空文字
 */
export const getLatestAssistantMessage = (
  chatLog: Message[] | null | undefined
): string => {
  const result = getLatestAssistantMessageWithRole(chatLog)
  return result.content
}

/**
 * chatLogから最新のアシスタントメッセージのコンテンツとroleを取得する
 * @param chatLog メッセージログ
 * @returns 最新のアシスタントメッセージのコンテンツとrole、存在しない場合は空文字とnull
 */
export const getLatestAssistantMessageWithRole = (
  chatLog: Message[] | null | undefined
): { content: string; role: 'assistant' | 'assistant-A' | 'assistant-B' | null } => {
  if (!chatLog || chatLog.length === 0) {
    return { content: '', role: null }
  }

  // 配列の末尾から逆順に検索してパフォーマンスを向上
  for (let i = chatLog.length - 1; i >= 0; i--) {
    const msg = chatLog[i]
    // AB モード対応: assistant, assistant-A, assistant-B をすべて認識
    if (msg.role === 'assistant' || msg.role === 'assistant-A' || msg.role === 'assistant-B') {
      let content = ''
      if (typeof msg.content === 'string') {
        content = msg.content
      } else if (Array.isArray(msg.content)) {
        const textContent = msg.content.find(
          (item: { type: string }) => item.type === 'text'
        )
        content = textContent && 'text' in textContent ? textContent.text : ''
      }
      return {
        content,
        role: msg.role as 'assistant' | 'assistant-A' | 'assistant-B',
      }
    }
  }

  return { content: '', role: null }
}
