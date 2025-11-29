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

    console.log('[vercel.ts] 🔍 サーチグラウンディング条件チェック:', {
      useSearchGrounding,
      effectiveModel,
      isInGoogleSearchGroundingModels: googleSearchGroundingModels.includes(effectiveModel),
      googleSearchGroundingModels: googleSearchGroundingModels
    })

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
      // サーチグラウンディングが必要そうなキーワードを検出する関数
      const shouldForceSearchGrounding = (messageText: string): boolean => {
        const trimmedMessage = messageText.trim().toLowerCase()

        // 明示的な「サーチ」検出
        const searchPattern = /(サーチ|さーち|search)(\s*)$/i
        if (searchPattern.test(trimmedMessage)) {
          console.log('[vercel.ts] ✅ 明示的な「サーチ」検出')
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
            console.log('[vercel.ts] ✅ キーワード検出:', keyword)
            return true
          }
        }

        console.log('[vercel.ts] ❌ キーワード未検出')
        return false
      }

      // 語尾に「サーチ」がついている場合、または内容からサーチグラウンディングが必要と判定された場合は、dynamicRetrievalConfigを削除して確実にサーチグラウンディングを使用
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
        const shouldForce = shouldForceSearchGrounding(messageText)
        console.log('[vercel.ts] 🔍 サーチグラウンディング判定:', {
          messageText: messageText.trim().substring(Math.max(0, messageText.trim().length - 50)),
          shouldForce,
          hasDynamicRetrievalConfig: !!options.dynamicRetrievalConfig
        })
        if (shouldForce) {
          // サーチグラウンディングが必要と判定された場合は、dynamicRetrievalConfigを削除して確実にサーチグラウンディングを使用
          delete options.dynamicRetrievalConfig
          console.log('[vercel.ts] ✅ サーチグラウンディング必要と判定、dynamicRetrievalConfigを削除して確実にサーチグラウンディングを使用', {
            messageText: messageText.trim().substring(Math.max(0, messageText.trim().length - 50)),
            options: JSON.stringify(options)
          })
        }
      }
      console.log('[vercel.ts] 📊 最終的なoptions:', {
        useSearchGrounding: options.useSearchGrounding,
        hasDynamicRetrievalConfig: !!options.dynamicRetrievalConfig,
        dynamicRetrievalConfig: options.dynamicRetrievalConfig
      })
    }

    // ------------------------------------------------------------------
    // [TWO-STAGE PROCESSING] Search Grounding + Dialogue Generation
    // ------------------------------------------------------------------
    // 掛け合いモード時の2段階処理：
    // ケース1: サーチグラウンディング確実に使用 → Stage 1: 情報取得、Stage 2: 掛け合い生成
    // ケース2: サーチグラウンディング確実に不使用 → Stage 1: 掛け合い生成（1段階のみ）
    // ケース3: サーチグラウンディング動的判定 → Stage 1: 使用時は情報取得、不使用時は掛け合い生成、Stage 2: 使用時のみ実行
    // ------------------------------------------------------------------

    // 掛け合いモードの判定
    const isDialogueMode = process.env.NEXT_PUBLIC_DIALOGUE_MODE === 'true'
    
    // サーチグラウンディングの使用状況を判定
    const hasDynamicRetrievalConfig = !!options.dynamicRetrievalConfig
    const willUseSearchGrounding = options.useSearchGrounding && !hasDynamicRetrievalConfig // dynamicRetrievalConfigがない場合は確実に使用
    const mightUseSearchGrounding = options.useSearchGrounding && hasDynamicRetrievalConfig // dynamicRetrievalConfigがある場合は動的判定
    
    console.log('[vercel.ts] 🔍 2段階処理条件チェック:', {
      useSearchGrounding: options.useSearchGrounding,
      hasDynamicRetrievalConfig,
      willUseSearchGrounding,
      mightUseSearchGrounding,
      isDialogueMode,
      stream
    })

    // XMLタグを除去する関数
    const removeXmlTags = (text: string): string => {
      // XMLタグ（<A>...</A>, <B>...</B>など）を除去
      return text
        .replace(/<[^>]+>/g, '') // 開始タグと終了タグを除去
        .replace(/&lt;/g, '<') // HTMLエンティティを復元
        .replace(/&gt;/g, '>')
        .replace(/&amp;/g, '&')
        .trim()
    }

    // 掛け合いモードかつストリーミングの場合のみ2段階処理を検討
    if (isDialogueMode && stream) {
      // 元のユーザーメッセージを取得
      const lastUserMessageIndex = messages
        .slice()
        .reverse()
        .findIndex((msg: any) => msg.role === 'user')

      if (lastUserMessageIndex !== -1) {
        const realIndex = messages.length - 1 - lastUserMessageIndex
        const lastUserMessage = messages[realIndex]

        const originalContent = typeof lastUserMessage.content === 'string'
          ? lastUserMessage.content
          : (Array.isArray(lastUserMessage.content)
            ? lastUserMessage.content.map((c: any) => c.text || '').join('')
            : '')

        try {
          // === ケース1: サーチグラウンディング確実に使用 ===
          if (willUseSearchGrounding) {
            console.log('[vercel.ts] 🔄 ケース1: サーチグラウンディング確実に使用 → 2段階処理')

            // Stage 1: サーチグラウンディングで情報取得（プレーンテキストのみ）
            console.log('[vercel.ts] 📡 Stage 1: 検索で最新情報を取得中...')

            const stage1SystemPrompt = `あなたは最新情報を取得するアシスタントです。
ユーザーの質問に対して、Google Search Groundingを使用して最新の正確な情報を取得し、プレーンテキストで簡潔にまとめてください。
キャラクター設定や掛け合い形式は不要です。純粋に情報のみを提供してください。`

            const stage1Messages: CoreMessage[] = [
              { role: 'system', content: stage1SystemPrompt },
              { role: 'user', content: originalContent }
            ]

            const searchResponse = await generateText({
              model: aiInstance(effectiveModel, { useSearchGrounding: true }),
              messages: stage1Messages,
              temperature: 0.7,
              maxTokens: 2048,
            })

            let searchResult = searchResponse.text
            // XMLタグが含まれていた場合は除去
            searchResult = removeXmlTags(searchResult)

            console.log('[vercel.ts] ✅ Stage 1 完了: 情報取得成功', {
              length: searchResult.length,
              preview: searchResult.substring(0, 100)
            })

            // Stage 2: 掛け合い生成（キャラクター設定を適用）
            console.log('[vercel.ts] 🎭 Stage 2: 掛け合いを生成中...')

            const { SYSTEM_PROMPT } = await import('@/features/constants/systemPromptConstants')
            const { getCharacterNames } = await import('@/utils/characterNames')
            const systemPromptA = process.env.NEXT_PUBLIC_SYSTEM_PROMPT_A || SYSTEM_PROMPT
            const systemPromptB = process.env.NEXT_PUBLIC_SYSTEM_PROMPT_B || SYSTEM_PROMPT
            const characterNames = getCharacterNames()
            const characterAName = characterNames.characterA.fullName
            const characterBName = characterNames.characterB.fullName
            const characterANickname = characterNames.characterA.nickname
            const characterBNickname = characterNames.characterB.nickname

            const stage2SystemPrompt = `[${characterAName}（A）の設定]
${systemPromptA}

[${characterBName}（B）の設定]
${systemPromptB}

[掛け合いモード]
- ${characterAName}（A）と${characterBName}（B）の掛け合いを生成
- 必ず交互に話す（${characterANickname}から開始）
- XML形式のみ出力（前置き不要）`

            const dialoguePrompt = `最新情報を元に、${characterAName}（A）と${characterBName}（B）の掛け合いをXML形式で作成。

【最新情報】
${searchResult}

【出力例】
<A emotion="happy">セリフ</A>
<B emotion="relaxed">セリフ</B>
<A emotion="excited">セリフ</A>
<B emotion="happy">セリフ</B>
<A emotion="relaxed">セリフ</A>
<B emotion="surprised">セリフ</B>
<A emotion="happy">セリフ</A>

【ルール】
1. 最低7ターン以上（A→B→A→B→A→B→A）
2. 交互に話す
3. 感情タグ（emotion）を付ける
4. 最新情報を自然に会話に織り込む
5. 500文字以内で7ターン以上生成

【重要】
- XMLタグのみ出力（マークダウン不可）
- 最初は「<A」で開始`

            const stage2Messages: CoreMessage[] = [
              { role: 'system', content: stage2SystemPrompt },
              { role: 'user', content: dialoguePrompt }
            ]

            const response = await streamText({
              model: aiInstance(effectiveModel, {}),
              messages: stage2Messages,
              temperature,
              maxTokens: 500, // 500文字以内の制約を厳守
            })

            console.log('[vercel.ts] ✅ Stage 2 開始: 掛け合いをストリーミング中')

            const textStream = response.textStream
            const encoder = new TextEncoder()

            const dataStream = new ReadableStream({
              async start(controller) {
                try {
                  const reader = textStream.getReader()
                  let messageId = 0

                  const responseMetadata: any = {
                    messageId: messageId++,
                    hasSearchGrounding: true,
                    twoStageProcessing: true,
                    debug: {
                      stage1Length: searchResult.length,
                      stage1Preview: searchResult.substring(0, 50)
                    }
                  }
                  controller.enqueue(encoder.encode(`f:${JSON.stringify(responseMetadata)}\n`))

                  while (true) {
                    const { done, value } = await reader.read()
                    if (done) {
                      controller.enqueue(encoder.encode(`d:{}\n`))
                      controller.close()
                      break
                    }

                    // 文字化けを防ぐため、エスケープ処理を改善
                    // JSON.stringifyを使用して正しくエスケープ
                    const escapedValue = JSON.stringify(value)
                    controller.enqueue(encoder.encode(`0:${escapedValue}\n`))
                  }
                } catch (error) {
                  console.error('[vercel.ts] 2段階処理エラー:', error)
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
          }

          // === ケース2: サーチグラウンディング確実に不使用 ===
          // 掛け合いを1段階で生成（7ターン以上500文字以内）
          if (!willUseSearchGrounding && !mightUseSearchGrounding) {
            console.log('[vercel.ts] 🔄 ケース2: サーチグラウンディング確実に不使用 → 1段階で掛け合い生成')
            
            // 通常の処理（callAI）にフォールバック
            // callAI内で掛け合いモードのプロンプトが適用される
          }

          // === ケース3: サーチグラウンディング動的判定 ===
          if (mightUseSearchGrounding) {
            console.log('[vercel.ts] 🔄 ケース3: サーチグラウンディング動的判定 → 条件付き2段階処理')

            // Stage 1: サーチグラウンディングを使用して実行（動的判定）
            const stage1SystemPrompt = `あなたは最新情報を取得するアシスタントです。
ユーザーの質問に対して、必要に応じてGoogle Search Groundingを使用して最新の正確な情報を取得し、プレーンテキストで簡潔にまとめてください。
キャラクター設定や掛け合い形式は不要です。純粋に情報のみを提供してください。`

            const stage1Messages: CoreMessage[] = [
              { role: 'system', content: stage1SystemPrompt },
              { role: 'user', content: originalContent }
            ]

            // generateTextを使用してメタデータを取得
            const stage1Response = await generateText({
              model: aiInstance(effectiveModel, options), // dynamicRetrievalConfigを含む
              messages: stage1Messages,
              temperature: 0.7,
              maxTokens: 2048,
            })

            let stage1Result = stage1Response.text

            // サーチグラウンディングが使用されたか判定
            let hasSearchGroundingUsed = false
            if (stage1Response.experimental_providerMetadata?.google?.groundingMetadata) {
              hasSearchGroundingUsed = true
            } else if (stage1Response.usage?.searchQueriesCount && stage1Response.usage.searchQueriesCount > 0) {
              hasSearchGroundingUsed = true
            }

            console.log('[vercel.ts] 📊 Stage 1 結果:', {
              hasSearchGroundingUsed,
              resultLength: stage1Result.length,
              preview: stage1Result.substring(0, 100)
            })

            // サーチグラウンディングが使用された場合のみStage 2を実行
            if (hasSearchGroundingUsed) {
              console.log('[vercel.ts] ✅ サーチグラウンディング使用を検出 → Stage 2実行')

              // XMLタグが含まれていた場合は除去
              let cleanedResult = removeXmlTags(stage1Result)

              // Stage 2: 掛け合い生成
              console.log('[vercel.ts] 🎭 Stage 2: 掛け合いを生成中...')

              const { SYSTEM_PROMPT } = await import('@/features/constants/systemPromptConstants')
              const { getCharacterNames } = await import('@/utils/characterNames')
              const systemPromptA = process.env.NEXT_PUBLIC_SYSTEM_PROMPT_A || SYSTEM_PROMPT
              const systemPromptB = process.env.NEXT_PUBLIC_SYSTEM_PROMPT_B || SYSTEM_PROMPT
              const characterNames = getCharacterNames()
              const characterAName = characterNames.characterA.fullName
              const characterBName = characterNames.characterB.fullName
              const characterANickname = characterNames.characterA.nickname
              const characterBNickname = characterNames.characterB.nickname

              const stage2SystemPrompt = `[${characterAName}（A）の設定]
${systemPromptA}

[${characterBName}（B）の設定]
${systemPromptB}

[掛け合いモード]
- ${characterAName}（A）と${characterBName}（B）の掛け合いを生成
- 必ず交互に話す（${characterANickname}から開始）
- XML形式のみ出力（前置き不要）`

              const dialoguePrompt = `最新情報を元に、${characterAName}（A）と${characterBName}（B）の掛け合いをXML形式で作成。

【最新情報】
${cleanedResult}

【出力例】
<A emotion="happy">セリフ</A>
<B emotion="relaxed">セリフ</B>
<A emotion="excited">セリフ</A>
<B emotion="happy">セリフ</B>
<A emotion="relaxed">セリフ</A>
<B emotion="surprised">セリフ</B>
<A emotion="happy">セリフ</A>

【ルール】
1. 最低7ターン以上（A→B→A→B→A→B→A）
2. 交互に話す
3. 感情タグ（emotion）を付ける
4. 最新情報を自然に会話に織り込む
5. 500文字以内で7ターン以上生成

【重要】
- XMLタグのみ出力（マークダウン不可）
- 最初は「<A」で開始`

              const stage2Messages: CoreMessage[] = [
                { role: 'system', content: stage2SystemPrompt },
                { role: 'user', content: dialoguePrompt }
              ]

              const response = await streamText({
                model: aiInstance(effectiveModel, {}),
                messages: stage2Messages,
                temperature,
                maxTokens: 800,
              })

              console.log('[vercel.ts] ✅ Stage 2 開始: 掛け合いをストリーミング中')

              const textStream = response.textStream
              const encoder = new TextEncoder()

              const dataStream = new ReadableStream({
                async start(controller) {
                  try {
                    const reader = textStream.getReader()
                    let messageId = 0

                    const responseMetadata: any = {
                      messageId: messageId++,
                      hasSearchGrounding: true,
                      twoStageProcessing: true,
                      debug: {
                        stage1Length: cleanedResult.length,
                        stage1Preview: cleanedResult.substring(0, 50),
                        hasSearchGroundingUsed
                      }
                    }
                    controller.enqueue(encoder.encode(`f:${JSON.stringify(responseMetadata)}\n`))

                    while (true) {
                      const { done, value } = await reader.read()
                      if (done) {
                        controller.enqueue(encoder.encode(`d:{}\n`))
                        controller.close()
                        break
                      }

                      const escapedValue = JSON.stringify(value)
                      controller.enqueue(encoder.encode(`0:${escapedValue}\n`))
                    }
                  } catch (error) {
                    console.error('[vercel.ts] 2段階処理エラー:', error)
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
            } else {
              // サーチグラウンディングが使用されなかった場合、通常の処理にフォールバック
              // Stage 1の結果は掛け合い形式で返ってきている可能性があるが、通常の処理で処理される
              console.log('[vercel.ts] ℹ️ サーチグラウンディング未使用 → 通常処理にフォールバック')
            }
          }

        } catch (error) {
          console.error('[vercel.ts] 2段階処理でエラーが発生:', error)
          console.log('[vercel.ts] ⚠️ 通常処理にフォールバック')
        }
      }
    }

    // ケース2（サーチグラウンディング確実に不使用）や
    // ケース3でサーチグラウンディングが使用されなかった場合は、
    // 通常の処理（callAI）にフォールバック


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
          console.log('[vercel.ts] responseオブジェクト:', {
            hasExperimentalProviderMetadata: !!(response as any).experimental_providerMetadata,
            hasUsage: !!(response as any).usage,
            responseType: typeof response,
            responseKeys: Object.keys(response || {})
          })

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

                // サーチグラウンディングの検出を待つ（最大5秒）
                let metadata: any = null
                let usage: any = null
                if (opts.useSearchGrounding) {
                  try {
                    // メタデータとusageを並行して取得
                    // responseオブジェクトから直接取得を試みる
                    console.log('[vercel.ts] メタデータ取得開始:', {
                      hasExperimentalProviderMetadata: !!(response as any).experimental_providerMetadata,
                      hasUsage: !!(response as any).usage,
                      responseKeys: Object.keys(response || {})
                    })

                    // 少し待ってからメタデータを取得（ストリームが開始されるまで待つ）
                    await new Promise(resolve => setTimeout(resolve, 1000))

                    const metadataPromise = Promise.resolve((response as any).experimental_providerMetadata).catch(() => null)
                    const usagePromise = Promise.resolve((response as any).usage).catch(() => null)

                    const [metadataResult, usageResult] = await Promise.race([
                      Promise.all([metadataPromise, usagePromise]),
                      new Promise<[any, any]>((resolve) => setTimeout(() => resolve([null, null]), 5000))
                    ])
                    metadata = metadataResult
                    usage = usageResult

                    console.log('[vercel.ts] メタデータ取得結果:', {
                      metadata: metadata ? 'あり' : 'なし',
                      usage: usage ? 'あり' : 'なし',
                      metadataKeys: metadata ? Object.keys(metadata) : [],
                      usageKeys: usage ? Object.keys(usage) : []
                    })

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
                // デバッグ情報も含める
                const responseMetadata: any = {
                  messageId: messageId++,
                  hasSearchGrounding: hasSearchGrounding,
                  debug: {
                    useSearchGrounding: opts.useSearchGrounding,
                    optsKeys: Object.keys(opts),
                    optsFull: JSON.stringify(opts).substring(0, 500),
                    hasGroundingMetadata: !!metadata?.google?.groundingMetadata,
                    hasWebSearchQueries: !!(metadata?.google?.groundingMetadata?.webSearchQueries && metadata.google.groundingMetadata.webSearchQueries.length > 0),
                    webSearchQueriesCount: metadata?.google?.groundingMetadata?.webSearchQueries?.length || 0,
                    searchQueriesCount: usage?.searchQueriesCount,
                    hasDynamicRetrievalConfig: !!opts.dynamicRetrievalConfig
                  }
                }
                controller.enqueue(encoder.encode(`f:${JSON.stringify(responseMetadata)}\n`))
                if (hasSearchGrounding) {
                  console.log('[vercel.ts] サーチグラウンディング成功、メタデータを送信')
                } else {
                  console.log('[vercel.ts] サーチグラウンディング未検出、メタデータを送信（デバッグ情報含む）')
                  console.log('[vercel.ts] optsオブジェクト:', JSON.stringify(opts, null, 2))
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

