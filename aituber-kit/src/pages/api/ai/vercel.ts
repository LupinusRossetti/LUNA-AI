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
      // 語尾に「サーチ」がついている場合は、確実にサーチグラウンディングを使用する
      // dynamicRetrievalConfigを設定しないことで、常にサーチグラウンディングを使用
      if (dynamicRetrievalThreshold !== undefined && dynamicRetrievalThreshold !== null && dynamicRetrievalThreshold !== '') {
        options.dynamicRetrievalConfig = {
          dynamicThreshold: dynamicRetrievalThreshold,
        }
      }
      // 語尾に「サーチ」がついている場合は、dynamicRetrievalConfigを設定しない
      // （これにより、常にサーチグラウンディングが使用される）
      const lastUserMessage = messages
        .slice()
        .reverse()
        .find((msg: any) => msg.role === 'user')
      if (lastUserMessage) {
        const messageText = typeof lastUserMessage.content === 'string'
          ? lastUserMessage.content
          : lastUserMessage.content
              ?.filter((part: any) => part.type === 'text')
              ?.map((part: any) => part.text)
              ?.join(' ') || ''
        const trimmedMessage = messageText.trim()
        const searchPattern = /(サーチ|さーち|search|Search|SEARCH)(\s*)$/i
        if (searchPattern.test(trimmedMessage)) {
          // 語尾に「サーチ」がついている場合は、dynamicRetrievalConfigを削除して確実にサーチグラウンディングを使用
          delete options.dynamicRetrievalConfig
          console.log('[vercel.ts] ✅ 語尾に「サーチ」検出、dynamicRetrievalConfigを削除して確実にサーチグラウンディングを使用', {
            messageText: trimmedMessage.substring(Math.max(0, trimmedMessage.length - 30))
          })
        }
      }
    }

    const callAI = async (opts: any) => {
      if (stream) {
        try {
          console.log('[vercel.ts] streamText呼び出し開始', {
            model: effectiveModel,
            messagesCount: messages.length,
            temperature,
            maxTokens,
            useSearchGrounding: opts.useSearchGrounding
          })
          const response = await streamText({
            model: aiInstance(effectiveModel, opts),
            messages: messages as CoreMessage[],
            temperature,
            maxTokens,
          })
          console.log('[vercel.ts] streamText成功、textStreamを直接使用')
          
          // textStreamを直接使用して、カスタムストリームを作成
          const textStream = response.textStream
          const encoder = new TextEncoder()
          
          // Vercel AI SDKのData Stream形式に変換
          const dataStream = new ReadableStream({
            async start(controller) {
              try {
                const reader = textStream.getReader()
                let messageId = 0
                let fullText = ''
                let hasSearchGrounding = false
                
                // サーチグラウンディングの検出を待つ（最大3秒）
                if (opts.useSearchGrounding) {
                  try {
                    // メタデータとusageを並行して取得
                    const metadataPromise = Promise.resolve((response as any).experimental_providerMetadata).catch(() => null)
                    const usagePromise = Promise.resolve((response as any).usage).catch(() => null)
                    
                    const [metadata, usage] = await Promise.race([
                      Promise.all([metadataPromise, usagePromise]),
                      new Promise<[any, any]>((resolve) => setTimeout(() => resolve([null, null]), 3000))
                    ])
                    
                    // groundingMetadataが存在するか、または空のオブジェクトでも検出する
                    // webSearchQueriesが存在する場合も検出
                    const hasGroundingMetadata = !!metadata?.google?.groundingMetadata
                    const hasWebSearchQueries = !!(metadata?.google?.groundingMetadata?.webSearchQueries && metadata.google.groundingMetadata.webSearchQueries.length > 0)
                    const hasSearchQueriesCount = !!(usage && usage.searchQueriesCount !== undefined && usage.searchQueriesCount > 0)
                    
                    hasSearchGrounding = hasGroundingMetadata || hasWebSearchQueries || hasSearchQueriesCount
                    
                    // デバッグ用：詳細を文字列で出力
                    console.log(`[vercel.ts] 🔍 サーチグラウンディング検出詳細:`, {
                      hasGroundingMetadata,
                      hasWebSearchQueries,
                      hasSearchQueriesCount,
                      hasSearchGrounding,
                      useSearchGrounding: opts.useSearchGrounding
                    })
                    if (metadata?.google?.groundingMetadata) {
                      console.log(`[vercel.ts] 📊 groundingMetadata存在:`, {
                        metadata: JSON.stringify(metadata.google.groundingMetadata).substring(0, 500),
                        webSearchQueries: metadata.google.groundingMetadata.webSearchQueries
                      })
                    }
                    if (usage) {
                      console.log(`[vercel.ts] 📊 usage存在:`, {
                        searchQueriesCount: usage.searchQueriesCount,
                        usage: JSON.stringify(usage).substring(0, 300)
                      })
                    }
                    
                    if (hasSearchGrounding) {
                      console.log('[vercel.ts] ✅ サーチグラウンディング検出成功（ストリーム開始時）:', {
                        useSearchGrounding: opts.useSearchGrounding,
                        hasSearchGrounding,
                        hasGroundingMetadata: !!metadata?.google?.groundingMetadata,
                        hasWebSearchQueries: !!(metadata?.google?.groundingMetadata?.webSearchQueries && metadata.google.groundingMetadata.webSearchQueries.length > 0),
                        webSearchQueriesCount: metadata?.google?.groundingMetadata?.webSearchQueries?.length || 0,
                        searchQueriesCount: usage?.searchQueriesCount
                      })
                    } else {
                      console.log('[vercel.ts] ❌ サーチグラウンディング未検出（ストリーム開始時）:', {
                        useSearchGrounding: opts.useSearchGrounding,
                        hasSearchGrounding: false,
                        hasGroundingMetadata: !!metadata?.google?.groundingMetadata,
                        hasWebSearchQueries: !!(metadata?.google?.groundingMetadata?.webSearchQueries && metadata.google.groundingMetadata.webSearchQueries.length > 0),
                        webSearchQueriesCount: metadata?.google?.groundingMetadata?.webSearchQueries?.length || 0,
                        searchQueriesCount: usage?.searchQueriesCount
                      })
                    }
                  } catch (error) {
                    console.error('[vercel.ts] サーチグラウンディング検出エラー（ストリーム開始時）:', error)
                  }
                }
                
                // サーチグラウンディングの情報をメタデータとして送信
                if (hasSearchGrounding) {
                  controller.enqueue(encoder.encode(`f:{"messageId":"${messageId++}","hasSearchGrounding":true}\n`))
                  console.log('[vercel.ts] サーチグラウンディング成功、メタデータを送信')
                } else {
                  controller.enqueue(encoder.encode(`f:{"messageId":"${messageId++}"}\n`))
                }
                
                while (true) {
                  const { done, value } = await reader.read()
                  if (done) {
                    // 終了メッセージを送信
                    controller.enqueue(encoder.encode(`d:{}\n`))
                    controller.close()
                    break
                  }
                  
                  // テキストチャンクをData Stream形式で送信
                  fullText += value
                  const escapedValue = value.replace(/\\/g, '\\\\').replace(/"/g, '\\"')
                  controller.enqueue(encoder.encode(`0:"${escapedValue}"\n`))
                }
              } catch (error) {
                console.error('[vercel.ts] textStream処理エラー:', error)
                // エラーメッセージを送信
                const errorMessage = error instanceof Error ? error.message : 'An error occurred.'
                controller.enqueue(encoder.encode(`3:"${errorMessage}"\n`))
                controller.close()
              }
            }
          })
          
          return new Response(dataStream, {
            headers: {
              'Content-Type': 'text/plain; charset=utf-8',
            },
          })
        } catch (streamError: any) {
          console.error('[vercel.ts] streamTextエラー:', streamError)
          console.error('[vercel.ts] エラー詳細:', {
            message: streamError?.message,
            stack: streamError?.stack,
            cause: streamError?.cause,
            name: streamError?.name
          })
          // ストリーミングエラーの場合、エラーメッセージをストリーム形式で返す
          const errorMessage = streamError?.message || 'An error occurred.'
          return new Response(
            `3:"${errorMessage}"\n`,
            {
              status: 200,
              headers: {
                'Content-Type': 'text/plain; charset=utf-8',
              },
            }
          )
        }
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
        console.warn('[vercel.ts] Search Grounding failed, retrying without search...', firstError)
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

