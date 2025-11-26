import { NextRequest } from 'next/server'
import { streamText, generateText, CoreMessage } from 'ai'
import { createGoogleGenerativeAI } from '@ai-sdk/google'
import { googleSearchGroundingModels } from '@/features/constants/aiModels'

export const config = {
  runtime: 'edge',
}

export default async function handler(req: NextRequest) {
  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({
        error: 'Method Not Allowed',
        errorCode: 'METHOD_NOT_ALLOWED',
      }),
      {
        status: 405,
        headers: { 'Content-Type': 'application/json' },
      }
    )
  }

  const {
    messages,
    apiKey: apiKeyFromRequest,
    model = 'gemini-2.0-flash',
    stream = false,
    useSearchGrounding = true,
    dynamicRetrievalThreshold,
    temperature = 1.0,
    maxTokens = 4096,
  } = await req.json()

  // サーバー側の環境変数から直接読み込む（優先）
  // リクエストから来たAPIキーはフォールバックとして使用
  const apiKey = process.env.GOOGLE_API_KEY || apiKeyFromRequest

  if (!apiKey) {
    return new Response(
      JSON.stringify({ error: 'Empty API Key', errorCode: 'EmptyAPIKey' }),
      {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      }
    )
  }

  if (!Array.isArray(messages)) {
    return new Response(
      JSON.stringify({
        error: 'Messages must be an array',
        errorCode: 'InvalidMessages',
      }),
      {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      }
    )
  }

  try {
    const aiInstance = createGoogleGenerativeAI({ apiKey })
    const effectiveModel = model || 'gemini-2.0-flash'
    const options: Record<string, any> = {}

    if (
      useSearchGrounding &&
      googleSearchGroundingModels.includes(effectiveModel)
    ) {
      options.useSearchGrounding = true
      if (dynamicRetrievalThreshold !== undefined) {
        options.dynamicRetrievalConfig = {
          dynamicThreshold: dynamicRetrievalThreshold,
        }
      }
    }

    const callAI = async (opts: any) => {
      if (stream) {
        const response = await streamText({
          model: aiInstance(effectiveModel, opts),
          messages: messages as CoreMessage[],
          temperature,
          maxTokens,
        })
        return response.toDataStreamResponse()
      }

      const result = await generateText({
        model: aiInstance(effectiveModel, opts),
        messages: messages as CoreMessage[],
        temperature,
        maxTokens,
      })

      return new Response(JSON.stringify({ text: result.text }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    try {
      return await callAI(options)
    } catch (firstError) {
      // Search Grounding が有効だった場合のみ、無効にして再試行
      if (options.useSearchGrounding) {
        console.warn('Search Grounding failed, retrying without search...', firstError)
        delete options.useSearchGrounding
        delete options.dynamicRetrievalConfig
        return await callAI(options)
      }
      throw firstError
    }

  } catch (error) {
    console.error('Error in Gemini API call:', error)

    return new Response(
      JSON.stringify({
        error: 'Unexpected Error',
        errorCode: 'AIAPIError',
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    )
  }
}

