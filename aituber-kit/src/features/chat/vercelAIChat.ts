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

// サーチグラウンディングが必要そうなキーワードを検出する関数
const shouldUseSearchGrounding = (messageText: string): boolean => {
  const trimmedMessage = messageText.trim().toLowerCase()
  
  // 明示的な「サーチ」検出
  const searchPattern = /(サーチ|さーち|search)(\s*)$/i
  if (searchPattern.test(trimmedMessage)) {
    return true
  }
  
  // サーチグラウンディングが必要そうなキーワードパターン
  const searchKeywords = [
    // 最新情報関連
    '最新', '最新情報', 'アップデート', 'update', '新機能', '新情報',
    // 攻略情報関連
    '攻略', '攻略法', '攻略方法', '攻略情報', '攻略ガイド',
    // ゲーム情報関連
    'ドラクエ', 'ドラゴンクエスト', 'dq', 'dragon quest',
    'ポケモン', 'pokemon', 'ファイナルファンタジー', 'ff', 'final fantasy',
    'モンスターハンター', 'mh', 'monster hunter',
    // アニメ情報関連
    'アニメ', 'anime', '放送', 'キャスト', 'cast',
    // 流行・トレンド関連
    '流行', 'トレンド', 'trend', '話題', 'バズ', 'buzz',
    // コスメ関連
    'コスメ', 'cosme', '化粧品', 'メイク', 'makeup',
    // 時事関連
    'ニュース', 'news', '時事', '社会情勢',
    // 情報取得を求める表現
    '教えて', '知りたい', '情報', '詳しく', '詳細',
    'いつ', 'どこ', '誰', '何', 'どう', 'なぜ', 'なんで',
    // 固有名詞の検索が必要そうな表現
    'とは', 'って何', 'について', 'について教えて'
  ]
  
  // キーワードが含まれているかチェック
  for (const keyword of searchKeywords) {
    if (trimmedMessage.includes(keyword.toLowerCase())) {
      console.log('[vercelAIChat] ✅ サーチグラウンディング必要キーワード検出:', {
        keyword,
        messageText: trimmedMessage.substring(Math.max(0, trimmedMessage.length - 50))
      })
      return true
    }
  }
  
  return false
}

const buildRequestPayload = (messages: Message[], stream: boolean): RequestPayload => {
  const ss = settingsStore.getState()
  
  // メッセージの最後に「サーチ」や「search」があるかチェック、または内容から自動判定
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
      
      // サーチグラウンディングが必要か判定
      forceSearchGrounding = shouldUseSearchGrounding(messageText)
      
      if (forceSearchGrounding) {
        console.log('[vercelAIChat] ✅ サーチグラウンディングを強制有効化', {
          messageText: messageText.trim().substring(Math.max(0, messageText.trim().length - 50)),
          fullMessage: messageText.trim()
        })
      } else {
        console.log('[vercelAIChat] ℹ️ サーチグラウンディング不要と判定:', {
          messageText: messageText.trim().substring(Math.max(0, messageText.trim().length - 50)),
          lastChars: messageText.trim().slice(-20)
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
    model: ss.selectAiModel || process.env.NEXT_PUBLIC_GOOGLE_MODEL || defaultModel,
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

