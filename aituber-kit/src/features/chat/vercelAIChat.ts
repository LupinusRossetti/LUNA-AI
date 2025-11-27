import settingsStore from '@/features/stores/settings'
import { Message } from '@/features/messages/messages'
import { defaultModel } from '@/features/constants/aiModels'

const API_ENDPOINT = '/api/ai/vercel'

type RequestPayload = {
  messages: Message[]
  apiKey: string
  model: string
  stream: boolean
  useSearchGrounding: boolean
  dynamicRetrievalThreshold?: number
  temperature: number
  maxTokens: number
}

const buildRequestPayload = (messages: Message[], stream: boolean): RequestPayload => {
  const ss = settingsStore.getState()
  
  // メッセージの最後に「サーチ」や「search」があるかチェック
  let forceSearchGrounding = false
  if (!ss.slideMode) { // 企画中は使用不可
    const lastUserMessage = messages
      .slice()
      .reverse()
      .find((msg) => msg.role === 'user')
    
    if (lastUserMessage) {
      const messageText = typeof lastUserMessage.content === 'string'
        ? lastUserMessage.content
        : lastUserMessage.content
            .filter((part) => part.type === 'text')
            .map((part) => part.text)
            .join(' ')
      
      // 最後に「サーチ」や「search」があるかチェック（大文字小文字、ひらがなカタカナ問わず）
      // 空白や改行を考慮して、確実に検出する
      const trimmedMessage = messageText.trim()
      const searchPattern = /(サーチ|さーち|search|Search|SEARCH)(\s*)$/i
      if (searchPattern.test(trimmedMessage)) {
        forceSearchGrounding = true
        console.log('[vercelAIChat] ✅ メッセージ末尾に「サーチ」検出、サーチグラウンディングを強制有効化', {
          messageText: trimmedMessage.substring(Math.max(0, trimmedMessage.length - 30)),
          fullMessage: trimmedMessage,
          matchedPattern: trimmedMessage.match(searchPattern)?.[0]
        })
      } else {
        console.log('[vercelAIChat] ℹ️ メッセージ末尾に「サーチ」なし:', {
          messageText: trimmedMessage.substring(Math.max(0, trimmedMessage.length - 30)),
          lastChars: trimmedMessage.slice(-10)
        })
      }
    }
  }
  
  const finalUseSearchGrounding = forceSearchGrounding || ss.useSearchGrounding
  
  console.log('[vercelAIChat] 📊 サーチグラウンディング設定:', {
    forceSearchGrounding,
    settingsUseSearchGrounding: ss.useSearchGrounding,
    finalUseSearchGrounding,
    slideMode: ss.slideMode
  })
  
  return {
    messages,
    apiKey: ss.googleKey,
    model: process.env.NEXT_PUBLIC_GOOGLE_MODEL || defaultModel,
    stream,
    useSearchGrounding: finalUseSearchGrounding,
    dynamicRetrievalThreshold: ss.dynamicRetrievalThreshold,
    temperature: ss.temperature,
    maxTokens: ss.maxTokens,
  }
}

const sendRequest = async (payload: RequestPayload) => {
  const response = await fetch(API_ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  })

  if (!response.ok) {
    const errorBody = await response.text()
    throw new Error(
      `Gemini API error (${response.status}): ${errorBody || 'Unknown'}`
    )
  }

  return response
}

export async function getVercelAIChatResponse(messages: Message[]) {
  const payload = buildRequestPayload(messages, false)
  const response = await sendRequest(payload)
  const data = await response.json()
  return { text: data.text }
}

export async function getVercelAIChatResponseStream(
  messages: Message[]
): Promise<ReadableStream<string>> {
  const payload = buildRequestPayload(messages, true)
  const response = await sendRequest(payload)
  if (!response.body) {
    throw new Error('Response body is empty')
  }
  
  // ReadableStream<Uint8Array> を ReadableStream<string> に変換
  const decoder = new TextDecoder()
  const reader = response.body.getReader()
  
  return new ReadableStream<string>({
    async start(controller) {
      try {
        let allReceivedData = ''
        while (true) {
          const { done, value } = await reader.read()
          if (done) {
            console.log('[vercelAIChat] ストリーム終了。受信した全データ:', {
              length: allReceivedData.length,
              preview: allReceivedData.substring(0, 500)
            })
            controller.close()
            break
          }
          const text = decoder.decode(value, { stream: true })
          allReceivedData += text
          console.log('[vercelAIChat] チャンク受信:', {
            length: text.length,
            preview: text.substring(0, 200),
            totalLength: allReceivedData.length,
            fullText: text // デバッグ用に全文を表示
          })
          controller.enqueue(text)
        }
      } catch (error) {
        console.error('[vercelAIChat] ストリーム読み取りエラー:', error)
        controller.error(error)
      } finally {
        reader.releaseLock()
      }
    },
  })
}

