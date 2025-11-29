/**
 * 企画固定セリフ管理
 */

/**
 * 提案待機中のセリフ（なぞなぞ企画）
 */
export const NZ_PROPOSAL_PENDING_SCRIPT = `<A emotion="surprised">お姉ちゃん！なぞなぞ企画の提案が来てるよ〜！</A>
<B emotion="relaxed">あら、アイリスちゃん。みなさんから企画提案が来たのね。</B>
<A emotion="happy">うんうん！お姉ちゃんにどうするか聞かないと！</A>
<B emotion="happy">お姉ちゃん、どうしますか？なぞなぞ企画、楽しそうですね。</B>
<A emotion="happy">お姉ちゃん、やる？やるよね？</A>
<B emotion="relaxed">お姉ちゃんの判断を待ちましょうね。</B>
<A emotion="surprised">うん！お姉ちゃん、お願い！</A>`

/**
 * 企画紹介中のセリフ（なぞなぞ企画）
 */
export const NZ_INTRO_SCRIPT = `<A emotion="happy">よーし！なぞなぞ企画スタートだよ〜！</A>
<B emotion="relaxed">みなさん、なぞなぞ企画を始めますね。</B>
<A emotion="surprised">あ、そうそう！みんなに大事なこと伝えないと！</A>
<B emotion="neutral">はい、アイリスちゃん。みなさん、この企画では回答接頭辞のコメントで回答してくださいね。</B>
<A emotion="happy">そうそう！/NZって書いてから回答してね！</A>
<B emotion="relaxed">企画中は回答接頭辞以外のコメントは受け付けられませんので、ご注意くださいね。</B>
<A emotion="happy">それじゃあ、なぞなぞ出すよ〜！</A>
<B emotion="relaxed">それでは、なぞなぞを出題します。</B>`

/**
 * 企画リザルトのセリフ（なぞなぞ企画）
 */
export const NZ_RESULT_SCRIPT = `<A emotion="surprised">おっ！時間だね！</A>
<B emotion="relaxed">はい、それでは結果発表をしますね。</B>
<A emotion="happy">みんなの回答、見てみよう！</A>
<B emotion="neutral">それでは、正解と不正解を判定していきますね。</B>
<A emotion="happy">正解した人、おめでとう〜！</A>
<B emotion="happy">不正解だった方も、次回は頑張ってくださいね。</B>
<A emotion="happy">みんな、ありがとう！楽しかった〜！</A>
<B emotion="relaxed">みなさん、お疲れ様でした。また次回もお楽しみに。</B>`

/**
 * 否定時のセリフ（共通）
 */
export const REJECTION_SCRIPT = `<A emotion="sad">あ〜、お姉ちゃんが断ったかぁ…</A>
<B emotion="relaxed">アイリスちゃん、残念だけど、お姉ちゃんの判断を尊重しましょうね。</B>
<A emotion="neutral">うん、わかった。また今度やろう！</A>
<B emotion="happy">そうですね、また別の機会に企画を楽しみましょう。</B>
<A emotion="happy">みんな、ごめんね！また今度ね！</A>
<B emotion="relaxed">みなさん、また次回お楽しみにしていてくださいね。</B>`

/**
 * XML形式の固定セリフを送信
 * processAIResponseに渡すことで、XML形式として処理され、音声合成・UI表示が行われる
 */
export const sendScript = async (script: string): Promise<void> => {
  // XML形式の文字列をパース
  const { extractCompleteXMLTags } = await import('@/features/chat/xmlParser')
  const { speakCharacter } = await import('@/features/messages/speakCharacter')
  const { generateMessageId } = await import('@/utils/messageUtils')
  const { EmotionType } = await import('@/features/messages/messages')
  const homeStore = (await import('@/features/stores/home')).default
  
  const { completeTags } = extractCompleteXMLTags(script)
  
  console.log('[projectScripts] 固定セリフを送信:', {
    scriptLength: script.length,
    tagsCount: completeTags.length
  })
  
  // 各XMLタグを順番に処理
  for (const dialogue of completeTags) {
    const character = dialogue.character
    const emotion = (dialogue.emotion || 'neutral') as EmotionType
    const text = dialogue.text.trim()
    
    if (!text) {
      continue
    }
    
    const messageId = generateMessageId()
    const messageRole = character === 'A' ? 'assistant-A' : 'assistant-B'
    const sessionId = generateMessageId()
    
    // メッセージを会話ログに追加（音声再生前に追加）
    homeStore.getState().upsertMessage({
      id: messageId,
      role: messageRole,
      content: text,
      hasSearchGrounding: dialogue.hasSearchGrounding || false,
    })
    
    // 音声合成とLive2Dアニメーション
    // 各セリフを順番に処理（前のセリフが終わるまで待つ）
    await new Promise<void>((resolve) => {
      speakCharacter(
        sessionId,
        { message: text, emotion, characterId: character },
        () => {
          // 音声合成開始時
          homeStore.getState().incrementChatProcessingCount()
        },
        () => {
          // 音声合成終了時
          homeStore.getState().decrementChatProcessingCount()
          resolve()
        },
        () => {
          // 実際に音声が再生される前にメッセージを追加（speakQueueから呼ばれる）
          // 既に追加済みなので何もしない
        }
      )
    })
  }
}

/**
 * 固定セリフをXML形式の文字列から処理可能な形式に変換
 * （必要に応じて使用）
 */
export const parseScript = (script: string): string => {
  // そのまま返す（XML形式の文字列として使用）
  return script
}

