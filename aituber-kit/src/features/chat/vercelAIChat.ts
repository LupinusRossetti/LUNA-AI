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
  return {
    messages,
    apiKey: ss.googleKey,
    model: process.env.NEXT_PUBLIC_GOOGLE_MODEL || defaultModel,
    stream,
    useSearchGrounding: ss.useSearchGrounding,
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
        while (true) {
          const { done, value } = await reader.read()
          if (done) {
            controller.close()
            break
          }
          const text = decoder.decode(value, { stream: true })
          controller.enqueue(text)
        }
      } catch (error) {
        controller.error(error)
      } finally {
        reader.releaseLock()
      }
    },
  })
}

