// ============================================================
// handlers.ts  外部AI完全同期 + 感情タグ非表示 + 将来マルチモーダル対応版
// ============================================================

import { getAIChatResponseStream } from '@/features/chat/aiChatFactory'
import { Message, EmotionType } from '@/features/messages/messages'
import { speakCharacter } from '@/features/messages/speakCharacter'
import { judgeSlide } from '@/features/slide/slideAIHelpers'
import homeStore from '@/features/stores/home'
import settingsStore from '@/features/stores/settings'
import slideStore from '@/features/stores/slide'
import { goToSlide } from '@/components/slides'
import { messageSelectors } from '../messages/messageSelectors'
import webSocketStore from '@/features/stores/websocketStore'
import i18next from 'i18next'
import toastStore from '@/features/stores/toast'
import { generateMessageId } from '@/utils/messageUtils'
import { info, error as logError } from '@/utils/logger'
import { SpeakQueue, notifySpeechEnd } from '@/features/messages/speakQueue'
import { extractCompleteXMLTags, ParsedDialogue } from '@/features/chat/xmlParser'

// ============================================================
// 共通定数・ユーティリティ
// ============================================================

// セッションIDを生成する関数
const generateSessionId = () => generateMessageId()

// コードブロックのデリミネーター
const CODE_DELIMITER = '```'

// 外部AIからの現在のアシスタントメッセージID（ログ重複防止用）
let externalAssistantMessageId: string | null = null

/**
 * Vercel AI SDKのメタデータを除去し、テキストコンテンツを抽出する関数
 * f:{"messageId":"..."}, e:{...}, d:{...} などの形式を除去
 * 0:"テキスト" 形式からは、テキストコンテンツを抽出
 */
const stripVercelMetadata = (text: string): string => {
  if (!text) return text
  
  // エラーメッセージのパターンをチェック
  // 3:"An error occurred." のような形式はエラーメッセージ
  if (/^\d+:"An error occurred\."/.test(text.trim())) {
    console.warn('[handlers] AIからエラーメッセージを受信:', text)
    return '' // エラーメッセージは除去
  }
  
  // 行に分割して処理
  const lines = text.split('\n')
  const cleanedLines: string[] = []
  
  for (const line of lines) {
    const trimmedLine = line.trim()
    
    // メタデータ行をスキップ
    // f:{"messageId":"..."} 形式
    if (/^f:\{/.test(trimmedLine)) continue
    // e:{...} 形式
    if (/^e:\{/.test(trimmedLine)) continue
    // d:{...} 形式
    if (/^d:\{/.test(trimmedLine)) continue
    
    // 0:"テキスト" 形式からテキストコンテンツを抽出
    // 注意: テキスト内に改行やエスケープ文字が含まれる可能性がある
    const textMatch = trimmedLine.match(/^\d+:"(.+)"$/)
    if (textMatch) {
      // エスケープされた文字を復元
      let extractedText = textMatch[1]
      extractedText = extractedText.replace(/\\"/g, '"')
      extractedText = extractedText.replace(/\\\\/g, '\\')
      extractedText = extractedText.replace(/\\n/g, '\n')
      cleanedLines.push(extractedText)
      continue
    }
    
    // 0:"テキスト（途中）" 形式（閉じ引用符がない場合）
    const partialTextMatch = trimmedLine.match(/^\d+:"(.+)$/)
    if (partialTextMatch) {
      let extractedText = partialTextMatch[1]
      extractedText = extractedText.replace(/\\"/g, '"')
      extractedText = extractedText.replace(/\\\\/g, '\\')
      extractedText = extractedText.replace(/\\n/g, '\n')
      cleanedLines.push(extractedText)
      continue
    }
    
    // メタデータでない行は保持
    cleanedLines.push(line)
  }
  
  // 行を結合（空白を入れずに結合）
  let cleaned = cleanedLines.join('')
  // 連続する空白を整理（ただし、改行は保持）
  cleaned = cleaned.replace(/[ \t]+/g, ' ').trim()
  return cleaned
}

/**
 * 感情タグ [happy] などを UI 表示用に削除する
 */
const stripEmotionTagsForDisplay = (text: string): string => {
  // まずVercel AI SDKのメタデータを除去
  let cleaned = stripVercelMetadata(text)
  // 次に感情タグを除去
  cleaned = cleaned.replace(/\[[^\]]+?\]/g, '').trim()
  return cleaned
}

/**
 * テキストから感情タグ `[...]` を抽出
 */
const extractEmotion = (
  text: string
): { emotionTag: string; remainingText: string } => {
  const emotionMatch = text.match(/^\s*\[(.*?)\]/)
  if (emotionMatch?.[0]) {
    return {
      emotionTag: emotionMatch[0].trim(),
      remainingText: text
        .slice(text.indexOf(emotionMatch[0]) + emotionMatch[0].length)
        .trimStart(),
    }
  }
  return { emotionTag: '', remainingText: text }
}

/**
 * テキストから文として区切れる部分だけ取り出す
 */
const extractSentence = (
  text: string
): { sentence: string; remainingText: string } => {
  const sentenceMatch = text.match(
    /^(.{1,19}?(?:[。．.!?！？\n]|(?=\[))|.{20,}?(?:[、,。．.!?！？\n]|(?=\[)))/
  )
  if (sentenceMatch?.[0]) {
    return {
      sentence: sentenceMatch[0],
      remainingText: text.slice(sentenceMatch[0].length).trimStart(),
    }
  }
  return { sentence: '', remainingText: text }
}

/**
 * 声再生とUI同期処理（従来の感情タグ形式用）
 */
const handleSpeakAndStateUpdate = (
  sessionId: string,
  sentence: string,
  emotionTag: string,
  currentSlideMessagesRef: { current: string[] },
  characterId?: 'A' | 'B' // 掛け合いモード用
) => {
  const hs = homeStore.getState()
  const emotion = emotionTag.includes('[')
    ? (emotionTag.slice(1, -1).toLowerCase() as EmotionType)
    : 'neutral'

  // Vercel AI SDKのメタデータを除去
  const cleanedSentence = stripVercelMetadata(sentence)

  // 「※検索したよ！」は読み上げなしで、会話ログにシステムメッセージとして追加
  if (cleanedSentence.trim() === '※検索したよ！') {
    // 会話ログにシステムメッセージとして追加
    homeStore.getState().upsertMessage({
      role: 'system',
      content: '※検索したよ！',
    })
    // 読み上げはスキップ
    return
  }

  // 発話不要な記号列は無視
  if (
    cleanedSentence === '' ||
    cleanedSentence.replace(
      /^[\s\u3000\t\n\r\[\(\{「［（【『〈《〔｛«‹〘〚〛〙›»〕》〉』】）］」\}\)\]'"''""・、。,.!?！？:：;；\-_=+~～*＊@＠#＃$＄%％^＾&＆|｜\\＼/／`｀]+$/gu,
      ''
    ) === ''
  ) {
    return
  }

  speakCharacter(
    sessionId,
    { message: cleanedSentence, emotion, characterId },
    () => {
      hs.incrementChatProcessingCount()
      currentSlideMessagesRef.current.push(sentence)
      homeStore.setState({
        slideMessages: [...currentSlideMessagesRef.current],
      })
    },
    () => {
      hs.decrementChatProcessingCount()
      currentSlideMessagesRef.current.shift()
      homeStore.setState({
        slideMessages: [...currentSlideMessagesRef.current],
      })
    }
  )
}

/**
 * 声再生とUI同期処理（XML形式用、キャラクター指定）
 */
const handleSpeakAndStateUpdateForCharacter = (
  sessionId: string,
  sentence: string,
  emotion: EmotionType,
  character: 'A' | 'B',
  currentSlideMessagesRef: { current: string[] },
  hasSearchGrounding: boolean = false // サーチグラウンディング情報
) => {
  const hs = homeStore.getState()

  // XMLタグを除去（<A emotion="...">や<B emotion="...">などの形式）
  let cleanedSentence = sentence
  cleanedSentence = cleanedSentence.replace(/<[AB](?:\s+emotion=["'][^"']*["'])?>/gi, '')
  cleanedSentence = cleanedSentence.replace(/<\/[AB]>/gi, '')
  
  // Vercel AI SDKのメタデータを除去
  cleanedSentence = stripVercelMetadata(cleanedSentence)
  
  // 残っている可能性のある引用符を除去
  // 1. 先頭・末尾の引用符を除去
  cleanedSentence = cleanedSentence.replace(/^["']+|["']+$/g, '')
  // 2. 数字+"形式（0:"や1:"など）の残骸を除去
  cleanedSentence = cleanedSentence.replace(/^\d+["']/g, '')
  // 3. 日本語テキスト内に不自然に入っている引用符を除去
  // パターン: 文字列の直後に引用符が来る場合（例: "はい"、バージョン7."6、それ"じゃあ）
  // ただし、日本語の句読点の前後や、通常の引用符の使用は保持
  cleanedSentence = cleanedSentence.replace(/([あ-んア-ン一-龯ー])(["'])([あ-んア-ン一-龯ー])/g, '$1$3') // 日本語文字間の引用符（例: それ"じゃあ → それじゃあ）
  cleanedSentence = cleanedSentence.replace(/([あ-んア-ン一-龯ー])(["'])([、。！？])/g, '$1$3') // 日本語文字と句読点の間の引用符
  cleanedSentence = cleanedSentence.replace(/([、。！？])(["'])([あ-んア-ン一-龯ー])/g, '$1$3') // 句読点と日本語文字の間の引用符
  cleanedSentence = cleanedSentence.replace(/(\d)(["'])(\d)/g, '$1$3') // 数字間の引用符（例: 7."6 → 7.6）
  cleanedSentence = cleanedSentence.replace(/([あ-んア-ン一-龯ー])(["'])([「」『』])/g, '$1$3') // 日本語文字と日本語引用符の間の引用符
  cleanedSentence = cleanedSentence.replace(/([「」『』])(["'])([あ-んア-ン一-龯ー])/g, '$1$3') // 日本語引用符と日本語文字の間の引用符
  // 4. 文末の引用符を除去（例: 調べてみますね。" → 調べてみますね。）
  cleanedSentence = cleanedSentence.replace(/([あ-んア-ン一-龯ー。！？])(["'])$/g, '$1')

  // 「※検索したよ！」は読み上げなしでスキップ
  if (cleanedSentence.trim() === '※検索したよ！') {
    return
  }

  // 発話不要な記号列は無視
  if (
    cleanedSentence === '' ||
    cleanedSentence.replace(
      /^[\s\u3000\t\n\r\[\(\{「［（【『〈《〔｛«‹〘〚〛〙›»〕》〉』】）］」\}\)\]'"''""・、。,.!?！？:：;；\-_=+~～*＊@＠#＃$＄%％^＾&＆|｜\\＼/／`｀]+$/gu,
      ''
    ) === ''
  ) {
    return
  }

  // 各XMLタグごとに新しいメッセージIDを生成
  const messageId = generateMessageId()
  const messageRole = character === 'A' ? 'assistant-A' : 'assistant-B'
  
  // キャラクターA/B別々の音声設定を使用
  // メッセージは実際に音声が再生される前に追加（読み上げと同期）
  // onStartは音声合成開始時、実際の再生はspeakQueueで行われる
  speakCharacter(
    sessionId,
    { message: cleanedSentence, emotion, characterId: character },
    () => {
      // 音声合成開始時（まだ再生されていない）
      hs.incrementChatProcessingCount()
      currentSlideMessagesRef.current.push(cleanedSentence)
      homeStore.setState({
        slideMessages: [...currentSlideMessagesRef.current],
      })
    },
    () => {
      hs.decrementChatProcessingCount()
      currentSlideMessagesRef.current.shift()
      homeStore.setState({
        slideMessages: [...currentSlideMessagesRef.current],
      })
    },
    () => {
      // 実際に音声が再生される前にメッセージを追加（speakQueueから呼ばれる）
      console.log('[handlers] メッセージを追加します', {
        messageId,
        role: messageRole,
        content: cleanedSentence.trim().substring(0, 50),
        hasSearchGrounding,
        character
      })
      // デバッグ用：詳細を個別に出力
      console.log('[handlers] メッセージ追加詳細:', 
        `messageId=${messageId}, ` +
        `role=${messageRole}, ` +
        `hasSearchGrounding=${hasSearchGrounding}, ` +
        `character=${character}`
      )
      homeStore.getState().upsertMessage({
        id: messageId,
        role: messageRole,
        content: cleanedSentence.trim(),
        hasSearchGrounding, // サーチグラウンディング情報を保存
      })
    }
  )
}

/**
 * コードブロック削除
 */
const removeCodeBlocks = (input: string): string => {
  if (!input.includes(CODE_DELIMITER)) return input
  const parts = input.split(CODE_DELIMITER)
  return parts.filter((_, idx) => idx % 2 === 0).join('')
}

/**
 * 感情タグ付きテキストを順番にしゃべる
 */
const speakWholeTextWithEmotions = (text: string) => {
  const sessionId = generateSessionId()
  const currentSlideMessagesRef = { current: [] as string[] }

  const withoutCode = removeCodeBlocks(text)
  let localRemaining = withoutCode.trimStart()
  let currentEmotionTag = ''

  while (localRemaining.length > 0) {
    const prev = localRemaining

    const { emotionTag, remainingText: afterEmotion } =
      extractEmotion(localRemaining)
    if (emotionTag) currentEmotionTag = emotionTag

    const { sentence, remainingText: afterSentence } =
      extractSentence(afterEmotion)

    if (sentence) {
      handleSpeakAndStateUpdate(
        sessionId,
        sentence,
        currentEmotionTag,
        currentSlideMessagesRef,
        defaultCharacterId
      )
      localRemaining = afterSentence
      if (!afterSentence) currentEmotionTag = ''
    } else {
      if (localRemaining.trim().length > 0) {
        handleSpeakAndStateUpdate(
          sessionId,
          localRemaining,
          currentEmotionTag,
          currentSlideMessagesRef,
          defaultCharacterId
        )
      }
      break
    }

    if (localRemaining === prev) {
      console.warn('speakWholeTextWithEmotions stuck, breaking:', prev)
      break
    }
  }
}
// ============================================================
// speakMessageHandler
// ============================================================

export const speakMessageHandler = async (receivedMessage: string) => {
  speakWholeTextWithEmotions(receivedMessage)
}

// ============================================================
// 内部 AI（AItuberKit モード）
// ============================================================

export const processAIResponse = async (messages: Message[], initialCharacterId?: 'A' | 'B') => {
  const ss = settingsStore.getState()

  if (ss.externalLinkageMode) {
    console.log('ExternalLinkage Mode → 内部AI停止')
    homeStore.setState({ chatProcessing: false })
    return
  }

  const sessionId = generateSessionId()
  homeStore.setState({ chatProcessing: true })

  let stream
  const currentSlideMessagesRef = { current: [] as string[] }

  try {
    stream = await getAIChatResponseStream(messages)
  } catch (e) {
    console.error(e)
    homeStore.setState({ chatProcessing: false })
    return
  }

  if (!stream) {
    homeStore.setState({ chatProcessing: false })
    return
  }

  const reader = stream.getReader()
  let receivedChunksForSpeech = ''
  let receivedChunksForXML = '' // XML形式用のバッファ
  let currentMessageId: string | null = null
  let currentMessageIdA: string | null = null // アイリス用メッセージID
  let currentMessageIdB: string | null = null // フィオナ用メッセージID
  let currentMessageContent = ''
  let currentMessageContentA = '' // アイリス用メッセージ内容
  let currentMessageContentB = '' // フィオナ用メッセージ内容
  let currentEmotionTag = ''
  let isCodeBlock = false
  let codeBlockContent = ''
  let isXMLMode = false // XML形式モードかどうか
  let hasReceivedActualContent = false // 実際のコンテンツが来たかどうか
  let allReceivedChunks = '' // デバッグ用：全てのチャンクを保存
  let hasSearchGrounding = false // サーチグラウンディングが使用されたかどうか
  let lastProcessedCharacter: 'A' | 'B' | null = null // 最後に処理したキャラクター（交互チェック用）
  let pendingDialogue: { character: 'A' | 'B', emotion: EmotionType, text: string, hasSearchGrounding: boolean } | null = null // 同じキャラクターの連続セリフをまとめるためのバッファ
  let dialogueTurnCount = 0 // 掛け合いのターン数をカウント
  
  // 掛け合いモードの場合、initialCharacterIdを使用、なければデフォルトでキャラクターAとして処理
  const isDialogueMode = process.env.NEXT_PUBLIC_DIALOGUE_MODE === 'true'
  const defaultCharacterId: 'A' | 'B' | undefined = isDialogueMode ? (initialCharacterId || 'A') : undefined
  
  console.log('[handlers] processAIResponse開始', {
    isDialogueMode,
    initialCharacterId,
    defaultCharacterId
  })

  try {
    while (true) {
      const { done, value } = await reader.read()
      
      // デバッグ用：全てのチャンクを保存
      if (value) {
        allReceivedChunks += value
      }

      if (value) {
        // メタデータ行をチェック（サーチグラウンディング情報）
        // f:{"messageId":"0","hasSearchGrounding":true}\n の形式
        const lines = value.split('\n')
        for (const line of lines) {
          const trimmedLine = line.trim()
          if (trimmedLine.startsWith('f:{')) {
            try {
              const metadataStr = trimmedLine.substring(2) // "f:"を除去
              const metadata = JSON.parse(metadataStr)
              if (metadata.hasSearchGrounding === true) {
                hasSearchGrounding = true
                console.log('[handlers] ✅ サーチグラウンディング検出（メタデータから）', {
                  hasSearchGrounding: true,
                  metadata,
                  line: trimmedLine
                })
              } else {
                console.log('[handlers] ℹ️ サーチグラウンディング未検出（メタデータから）', {
                  hasSearchGrounding: false,
                  metadata,
                  line: trimmedLine
                })
              }
            } catch (e) {
              // パースエラーは無視
            }
          }
        }
        
        let textToAdd = value

        // XML形式の検出（最初のチャンクで判定）
        if (!isXMLMode && (value.includes('<A') || value.includes('<B'))) {
          isXMLMode = true
          console.log('[XML Mode] XML形式を検出、XMLパーサーを使用します')
        }

        if (!isCodeBlock) {
          const delimiterIdx = value.indexOf(CODE_DELIMITER)
          if (delimiterIdx !== -1) {
            textToAdd = value.substring(0, delimiterIdx)
          }
        }

        // XML形式の場合は別処理
        if (isXMLMode) {
          // XMLモードでは、valueからメタデータを除去してから追加
          // valueは0:"..."形式なので、stripVercelMetadataで処理
          const cleanedChunk = stripVercelMetadata(value)
          if (cleanedChunk) {
            receivedChunksForXML += cleanedChunk
            // 実際のコンテンツが来たことを記録
            hasReceivedActualContent = true
          }
          // XMLタグの処理は後でまとめて行う
        } else {
          // 従来の感情タグ形式の処理
          // 掛け合いモードの場合、デフォルトでキャラクターAとして処理
          const messageRole = isDialogueMode ? 'assistant-A' : 'assistant'
          
          // メタデータのみのチャンクをスキップ
          const cleanedText = stripVercelMetadata(textToAdd)
          if (!cleanedText.trim()) {
            // メタデータのみの場合はスキップ（ただし、receivedChunksForSpeechには追加）
            console.log('[handlers] メタデータのみのチャンクをスキップ', {
              textToAdd: textToAdd.substring(0, 200),
              textToAddLength: textToAdd.length,
              fullTextToAdd: textToAdd // デバッグ用に全文を表示
            })
            // エラーメッセージの場合は、receivedChunksForSpeechには追加しない
            if (!textToAdd.includes('An error occurred')) {
              receivedChunksForSpeech += value
            }
            continue
          }
          
          // 実際のコンテンツが来たことを記録
          hasReceivedActualContent = true
          
          console.log('[handlers] テキストチャンク処理', {
            textToAdd: textToAdd.substring(0, 100),
            cleanedText: cleanedText.substring(0, 100),
            isDialogueMode,
            messageRole
          })
          
          if (currentMessageId === null) {
            currentMessageId = generateMessageId()
            currentMessageContent = cleanedText

            if (currentMessageContent.trim()) {
              const displayContent = stripEmotionTagsForDisplay(currentMessageContent)
              console.log('[handlers] 新規メッセージ追加', {
                id: currentMessageId,
                role: messageRole,
                content: displayContent.substring(0, 100),
                contentLength: displayContent.length
              })
              homeStore.getState().upsertMessage({
                id: currentMessageId,
                role: messageRole,
                content: displayContent,
              })
            }
          } else if (!isCodeBlock) {
            currentMessageContent += cleanedText
            if (cleanedText.trim()) {
              const displayContent = stripEmotionTagsForDisplay(currentMessageContent)
              console.log('[handlers] メッセージ更新', {
                id: currentMessageId,
                role: messageRole,
                content: displayContent.substring(0, 100),
                contentLength: displayContent.length
              })
              homeStore.getState().upsertMessage({
                id: currentMessageId,
                role: messageRole,
                content: displayContent,
              })
            }
          }

          receivedChunksForSpeech += value
        }
      }

      // ======== XML形式の処理 ========
      if (isXMLMode && receivedChunksForXML) {
        console.log('[handlers] XML形式の処理開始', {
          receivedChunksForXML: receivedChunksForXML.substring(0, 500),
          receivedChunksForXMLLength: receivedChunksForXML.length
        })
        // Vercel AI SDKのメタデータを除去してからXMLパース
        // receivedChunksForXMLには既にメタデータが除去されているはずだが、念のため再度処理
        let cleanedXML = receivedChunksForXML
        // XML内に残っている可能性のある0:"..."形式も除去
        cleanedXML = cleanedXML.replace(/\d+:"([^"]*)"?/g, (match, content) => {
          // エスケープされた文字を復元
          let extracted = content || ''
          extracted = extracted.replace(/\\"/g, '"')
          extracted = extracted.replace(/\\\\/g, '\\')
          extracted = extracted.replace(/\\n/g, '\n')
          return extracted
        })
        // エスケープされた引用符を処理
        cleanedXML = cleanedXML.replace(/emotion=\\"([^"]+)\\"\\>/g, 'emotion="$1">')
        cleanedXML = cleanedXML.replace(/emotion=\\"([^"]+)\\"\\s/g, 'emotion="$1" ')
        cleanedXML = cleanedXML.replace(/<(A|B)\s+emotion=\\"([^"]+)\\"\\>/g, '<$1 emotion="$2">')
        cleanedXML = cleanedXML.replace(/\\\\"/g, '"')
        cleanedXML = cleanedXML.replace(/\\\\/g, '\\')
        
        console.log('[handlers] メタデータ除去後のXML', {
          cleanedXML: cleanedXML.substring(0, 500),
          cleanedXMLLength: cleanedXML.length
        })
        const { completeTags, remainingText } = extractCompleteXMLTags(cleanedXML)
        console.log('[handlers] XMLパース結果', {
          completeTagsCount: completeTags.length,
          remainingText: remainingText.substring(0, 200)
        })
        // デバッグ用：各XMLタグの詳細を文字列で出力
        console.log('[handlers] 📋 XMLタグパース結果:', {
          totalTags: completeTags.length,
          tags: completeTags.map((tag, index) => ({
            index,
            character: tag.character,
            emotion: tag.emotion,
            hasSearchGrounding: tag.hasSearchGrounding,
            textLength: tag.text.length,
            textPreview: tag.text.substring(0, 50)
          }))
        })
        
        // 完全なXMLタグを処理
        // 各XMLタグごとに個別のメッセージを作成（同じキャラクターの複数セリフも分離）
        // ただし、メッセージは読み上げ開始時に追加する（読み上げと同期）
        console.log('[handlers] XMLタグ処理開始', {
          completeTagsCount: completeTags.length,
          completeTags: completeTags.map(d => ({ character: d.character, text: d.text.substring(0, 50) }))
        })
        for (const dialogue of completeTags) {
          const character = dialogue.character
          const emotion = dialogue.emotion as EmotionType
          let text = dialogue.text
          // サーチグラウンディング情報の決定
          // 優先順位: 実際のサーチグラウンディング検出結果（hasSearchGrounding）を最優先
          // XMLタグのsearch="true"は参考程度（AIが「サーチグラウンディングを使った」と判断した場合）
          // 実際のサーチグラウンディングが使われていない場合、XMLタグにsearch="true"が含まれていても(サーチ)を表示しない
          const xmlTagHasSearch = dialogue.hasSearchGrounding === true
          // 実際のサーチグラウンディング検出結果を優先（実際に使われた場合のみtrue）
          const dialogueHasSearchGrounding = hasSearchGrounding
          
          console.log('[handlers] 🔍 サーチグラウンディング情報の決定:', {
            character,
            xmlTagHasSearch,
            actualHasSearchGrounding: hasSearchGrounding,
            finalDialogueHasSearchGrounding: dialogueHasSearchGrounding,
            willShowSearchLabel: dialogueHasSearchGrounding
          })
          
          // XMLパーサーで抽出されたテキストにも引用符が残っている可能性があるので除去
          // stripVercelMetadataで処理（0:"..."形式の残骸を除去）
          text = stripVercelMetadata(text)
          // 追加の引用符除去処理
          text = text.replace(/^["']+|["']+$/g, '') // 先頭・末尾の引用符
          text = text.replace(/^\d+["']/g, '') // 数字+"形式
          text = text.replace(/([あ-んア-ン一-龯ー])(["'])([あ-んア-ン一-龯ー])/g, '$1$3') // 日本語文字間（例: それ"じゃあ → それじゃあ）
          text = text.replace(/([あ-んア-ン一-龯ー])(["'])([、。！？])/g, '$1$3') // 日本語文字と句読点
          text = text.replace(/([、。！？])(["'])([あ-んア-ン一-龯ー])/g, '$1$3') // 句読点と日本語文字
          text = text.replace(/(\d)(["'])(\d)/g, '$1$3') // 数字間
          text = text.replace(/([あ-んア-ン一-龯ー])(["'])([「」『』])/g, '$1$3') // 日本語文字と日本語引用符
          text = text.replace(/([「」『』])(["'])([あ-んア-ン一-龯ー])/g, '$1$3') // 日本語引用符と日本語文字
          text = text.replace(/([あ-んア-ン一-龯ー。！？])(["'])$/g, '$1') // 文末の引用符（例: 調べてみますね。" → 調べてみますね。）
          
          // 同じキャラクターが連続する場合、前のセリフにまとめる
          if (lastProcessedCharacter === character && pendingDialogue) {
            // 同じキャラクターの連続セリフをまとめる
            pendingDialogue.text += text
            pendingDialogue.hasSearchGrounding = pendingDialogue.hasSearchGrounding || dialogueHasSearchGrounding
            console.log('[handlers] 同じキャラクターの連続セリフをまとめます', {
              character,
              combinedText: pendingDialogue.text.substring(0, 100),
              hasSearchGrounding: pendingDialogue.hasSearchGrounding
            })
            continue // 次のセリフまで待つ
          }
          
          // 前のキャラクターのセリフを処理（まとめたセリフがある場合）
          if (pendingDialogue && pendingDialogue.character !== character) {
            console.log('[handlers] 前のキャラクターのセリフを処理します', {
              character: pendingDialogue.character,
              text: pendingDialogue.text.substring(0, 50),
              textLength: pendingDialogue.text.length,
              hasSearchGrounding: pendingDialogue.hasSearchGrounding
            })
            dialogueTurnCount++
            console.log('[handlers] 📊 掛け合いターン数:', {
              turnNumber: dialogueTurnCount,
              character: pendingDialogue.character,
              hasSearchGrounding: pendingDialogue.hasSearchGrounding || hasSearchGrounding,
              isSearchGrounded: hasSearchGrounding,
              minimumRequired: hasSearchGrounding ? 7 : 0
            })
            handleSpeakAndStateUpdateForCharacter(
              sessionId,
              pendingDialogue.text,
              pendingDialogue.emotion,
              pendingDialogue.character,
              currentSlideMessagesRef,
              pendingDialogue.hasSearchGrounding || hasSearchGrounding
            )
            pendingDialogue = null
          }
          
          // 現在のセリフをバッファに保存
          pendingDialogue = {
            character,
            emotion,
            text,
            hasSearchGrounding: dialogueHasSearchGrounding
          }
          lastProcessedCharacter = character
          
          console.log('[handlers] XMLタグ処理中', {
            character,
            emotion,
            text: text.substring(0, 50),
            textLength: text.length,
            hasSearchGrounding: dialogueHasSearchGrounding,
            dialogueHasSearchGrounding: dialogueHasSearchGrounding,
            dialogueObject: dialogue,
            searchAttribute: dialogue.hasSearchGrounding,
            rawDialogue: JSON.stringify(dialogue),
            willPassToSpeak: dialogueHasSearchGrounding || hasSearchGrounding
          })
          // デバッグ用：詳細を個別に出力
          console.log('[handlers] XMLタグ詳細:', 
            `character=${character}, ` +
            `emotion=${emotion}, ` +
            `dialogueHasSearchGrounding=${dialogueHasSearchGrounding}, ` +
            `dialogue.hasSearchGrounding=${dialogue.hasSearchGrounding}, ` +
            `hasSearchGrounding(global)=${hasSearchGrounding}, ` +
            `willPassToSpeak=${dialogueHasSearchGrounding || hasSearchGrounding}`
          )
        }
        
        // 残りのテキストを保持
        receivedChunksForXML = remainingText
        
        // チャンク処理後に残っているセリフを処理（次のチャンクが来る前に処理）
        // ただし、まだストリームが続く可能性があるので、ここでは処理しない
        // 最終処理でまとめて処理する
      }

      let processable = receivedChunksForSpeech
      receivedChunksForSpeech = ''

      // ======== 音声処理ループ（従来の感情タグ形式） ========
      while (processable.length > 0 && !isXMLMode) {
        const prevText = processable

        // --- コードブロック中 ---
        if (isCodeBlock) {
          codeBlockContent += processable
          processable = ''

          const lastDelimiter = codeBlockContent.lastIndexOf(CODE_DELIMITER)
          if (
            lastDelimiter !== -1 &&
            lastDelimiter >=
            codeBlockContent.length -
            (prevText.length + CODE_DELIMITER.length - 1)
          ) {
            const actualCode = codeBlockContent.substring(0, lastDelimiter)
            const remainder = codeBlockContent.substring(
              lastDelimiter + CODE_DELIMITER.length
            )

            if (actualCode.trim()) {
              homeStore.getState().upsertMessage({
                role: 'code',
                content: actualCode,
              })
            }

            codeBlockContent = ''
            isCodeBlock = false
            currentEmotionTag = ''

            currentMessageId = generateMessageId()
            currentMessageContent = ''

            processable = remainder.trimStart()
            continue
          } else {
            receivedChunksForSpeech =
              codeBlockContent + receivedChunksForSpeech
            codeBlockContent = ''
            break
          }
        }

        // --- 通常テキスト ---
        const delimiterIdx = processable.indexOf(CODE_DELIMITER)
        if (delimiterIdx !== -1) {
          const before = processable.substring(0, delimiterIdx)
          const afterRaw = processable.substring(
            delimiterIdx + CODE_DELIMITER.length
          )

          // コード前のテキストを処理
          let beforeText = before.trimStart()
          while (beforeText.length > 0) {
            const copy = beforeText

            const { emotionTag, remainingText: afterEmotion } =
              extractEmotion(beforeText)
            if (emotionTag) currentEmotionTag = emotionTag

            const { sentence, remainingText: afterSentence } =
              extractSentence(afterEmotion)

            if (sentence) {
              handleSpeakAndStateUpdate(
                sessionId,
                sentence,
                currentEmotionTag,
                currentSlideMessagesRef,
                defaultCharacterId
              )

              beforeText = afterSentence
              if (!afterSentence) currentEmotionTag = ''
            } else {
              receivedChunksForSpeech =
                beforeText + receivedChunksForSpeech
              beforeText = ''
              break
            }

            if (beforeText === copy) break
          }

          // --- コードブロックスイッチ ---
          isCodeBlock = true
          codeBlockContent = ''

          const langMatch = afterRaw.match(/^ *(\w+)? *\n/)
          let remainder = afterRaw
          if (langMatch) {
            remainder = afterRaw.substring(langMatch[0].length)
          }

          processable = remainder
          continue
        }

        // --- 最終通常テキスト ---
        const { emotionTag, remainingText: afterEmotion } =
          extractEmotion(processable)
        if (emotionTag) currentEmotionTag = emotionTag

        const { sentence, remainingText: afterSentence } =
          extractSentence(afterEmotion)

        if (sentence) {
          handleSpeakAndStateUpdate(
            sessionId,
            sentence,
            currentEmotionTag,
            currentSlideMessagesRef,
            defaultCharacterId
          )
          processable = afterSentence
          if (!afterSentence) currentEmotionTag = ''
        } else {
          receivedChunksForSpeech = processable + receivedChunksForSpeech
          processable = ''
          break
        }

        if (prevText === processable) break
      }

      if (done) {
        // ===== ストリーム終了処理 =====
        // デバッグ：全てのチャンクをログに出力
        if (!hasReceivedActualContent && allReceivedChunks) {
          console.error('[handlers] 実際のコンテンツが来ませんでした。受信した全てのチャンク:', {
            allChunks: allReceivedChunks.substring(0, 500),
            allChunksLength: allReceivedChunks.length,
            receivedChunksForSpeech: receivedChunksForSpeech.substring(0, 500),
            receivedChunksForSpeechLength: receivedChunksForSpeech.length
          })
        }
        
        if (isXMLMode) {
          // XML形式の最終処理
          if (receivedChunksForXML.length > 0) {
            console.log('[handlers] XML形式の最終処理開始', {
              receivedChunksForXML: receivedChunksForXML.substring(0, 500),
              receivedChunksForXMLLength: receivedChunksForXML.length
            })
            // receivedChunksForXMLには既にメタデータが除去されているはずだが、念のため再度処理
            // ただし、XML内に残っている可能性のある0:"..."形式も除去
            let cleanedXML = receivedChunksForXML
            // XML内に残っている0:"..."形式を除去（再帰的に処理）
            cleanedXML = cleanedXML.replace(/\d+:"([^"]*)"?/g, (match, content) => {
              // エスケープされた文字を復元
              let extracted = content || ''
              extracted = extracted.replace(/\\"/g, '"')
              extracted = extracted.replace(/\\\\/g, '\\')
              extracted = extracted.replace(/\\n/g, '\n')
              return extracted
            })
            console.log('[handlers] メタデータ除去後のXML（最終処理）', {
              cleanedXML: cleanedXML.substring(0, 500),
              cleanedXMLLength: cleanedXML.length
            })
            const { completeTags } = extractCompleteXMLTags(cleanedXML)
            console.log('[handlers] XMLパース結果（最終処理）', {
              completeTagsCount: completeTags.length
            })
            // デバッグ用：各XMLタグの詳細を文字列で出力
            completeTags.forEach((tag, index) => {
              console.log(`[handlers] XMLタグ[${index}]（最終処理）: character=${tag.character}, emotion=${tag.emotion}, hasSearchGrounding=${tag.hasSearchGrounding}, text=${tag.text.substring(0, 50)}`)
            })
            // 各XMLタグごとに個別のメッセージを作成（同じキャラクターの複数セリフも分離）
            // ただし、メッセージは読み上げ開始時に追加する（読み上げと同期）
            console.log('[handlers] XMLタグ処理開始（最終処理）', {
              completeTagsCount: completeTags.length,
              completeTags: completeTags.map(d => ({ character: d.character, text: d.text.substring(0, 50) }))
            })
            for (const dialogue of completeTags) {
              const character = dialogue.character
              const emotion = dialogue.emotion as EmotionType
              let text = dialogue.text
              // サーチグラウンディング情報の決定
              // 優先順位: 実際のサーチグラウンディング検出結果（hasSearchGrounding）を最優先
              // XMLタグのsearch="true"は参考程度（AIが「サーチグラウンディングを使った」と判断した場合）
              // 実際のサーチグラウンディングが使われていない場合、XMLタグにsearch="true"が含まれていても(サーチ)を表示しない
              const xmlTagHasSearch = dialogue.hasSearchGrounding === true
              // 実際のサーチグラウンディング検出結果を優先（実際に使われた場合のみtrue）
              const dialogueHasSearchGrounding = hasSearchGrounding
              
              // XMLパーサーで抽出されたテキストにも引用符が残っている可能性があるので除去
              // stripVercelMetadataで処理（0:"..."形式の残骸を除去）
              text = stripVercelMetadata(text)
              // 追加の引用符除去処理
              text = text.replace(/^["']+|["']+$/g, '') // 先頭・末尾の引用符
              text = text.replace(/^\d+["']/g, '') // 数字+"形式
              text = text.replace(/([あ-んア-ン一-龯ー])(["'])([あ-んア-ン一-龯ー])/g, '$1$3') // 日本語文字間
              text = text.replace(/([あ-んア-ン一-龯ー])(["'])([、。！？])/g, '$1$3') // 日本語文字と句読点
              text = text.replace(/([、。！？])(["'])([あ-んア-ン一-龯ー])/g, '$1$3') // 句読点と日本語文字
              text = text.replace(/(\d)(["'])(\d)/g, '$1$3') // 数字間
              text = text.replace(/([あ-んア-ン一-龯ー])(["'])([「」『』])/g, '$1$3') // 日本語文字と日本語引用符
              text = text.replace(/([「」『』])(["'])([あ-んア-ン一-龯ー])/g, '$1$3') // 日本語引用符と日本語文字
              
              // 同じキャラクターが連続する場合、前のセリフにまとめる
              if (lastProcessedCharacter === character && pendingDialogue) {
                // 同じキャラクターの連続セリフをまとめる
                pendingDialogue.text += text
                pendingDialogue.hasSearchGrounding = pendingDialogue.hasSearchGrounding || dialogueHasSearchGrounding
                console.log('[handlers] 同じキャラクターの連続セリフをまとめます（最終処理）', {
                  character,
                  combinedText: pendingDialogue.text.substring(0, 100),
                  hasSearchGrounding: pendingDialogue.hasSearchGrounding
                })
                continue // 次のセリフまで待つ
              }
              
              // 前のキャラクターのセリフを処理（まとめたセリフがある場合）
              if (pendingDialogue && pendingDialogue.character !== character) {
                console.log('[handlers] 前のキャラクターのセリフを処理します（最終処理）', {
                  character: pendingDialogue.character,
                  text: pendingDialogue.text.substring(0, 50),
                  textLength: pendingDialogue.text.length,
                  hasSearchGrounding: pendingDialogue.hasSearchGrounding
                })
                handleSpeakAndStateUpdateForCharacter(
                  sessionId,
                  pendingDialogue.text,
                  pendingDialogue.emotion,
                  pendingDialogue.character,
                  currentSlideMessagesRef,
                  pendingDialogue.hasSearchGrounding || hasSearchGrounding
                )
                pendingDialogue = null
              }
              
              // 現在のセリフをバッファに保存
              pendingDialogue = {
                character,
                emotion,
                text,
                hasSearchGrounding: dialogueHasSearchGrounding
              }
              lastProcessedCharacter = character
              
              console.log('[handlers] XMLタグ処理中（最終処理）', {
                character,
                hasSearchGrounding: dialogueHasSearchGrounding,
                emotion,
                text: text.substring(0, 50),
                textLength: text.length,
                rawDialogue: JSON.stringify(dialogue)
              })
            }
            
            // 最後に残っているセリフを処理
            if (pendingDialogue) {
              dialogueTurnCount++
              console.log('[handlers] 📝 最後のセリフを処理します:', {
                character: pendingDialogue.character,
                emotion: pendingDialogue.emotion,
                hasSearchGrounding: pendingDialogue.hasSearchGrounding,
                textLength: pendingDialogue.text.length,
                textPreview: pendingDialogue.text.substring(0, 100),
                turnNumber: dialogueTurnCount,
                isSearchGrounded: hasSearchGrounding,
                minimumRequired: hasSearchGrounding ? 7 : 0,
                meetsMinimumRequirement: hasSearchGrounding ? dialogueTurnCount >= 7 : true
              })
              handleSpeakAndStateUpdateForCharacter(
                sessionId,
                pendingDialogue.text,
                pendingDialogue.emotion,
                pendingDialogue.character,
                currentSlideMessagesRef,
                pendingDialogue.hasSearchGrounding || hasSearchGrounding
              )
              pendingDialogue = null
            }
            
            // 掛け合いの最終統計
            if (isDialogueMode && dialogueTurnCount > 0) {
              console.log('[handlers] 📊 掛け合いの最終統計:', {
                totalTurns: dialogueTurnCount,
                hasSearchGrounding,
                minimumRequired: hasSearchGrounding ? 7 : 0,
                meetsMinimumRequirement: hasSearchGrounding ? dialogueTurnCount >= 7 : true,
                status: hasSearchGrounding && dialogueTurnCount < 7 ? '❌ ターン数不足' : '✅ OK'
              })
            }
          }
        } else {
          // 従来の感情タグ形式の最終処理
          if (receivedChunksForSpeech.length > 0) {
            if (!isCodeBlock) {
              const finalSentence = receivedChunksForSpeech
              const { emotionTag, remainingText: finalText } =
                extractEmotion(finalSentence)

              if (emotionTag) currentEmotionTag = emotionTag

              handleSpeakAndStateUpdate(
                sessionId,
                finalText,
                currentEmotionTag,
                currentSlideMessagesRef,
                defaultCharacterId
              )
            } else {
              codeBlockContent += receivedChunksForSpeech
              if (codeBlockContent.trim()) {
                homeStore.getState().upsertMessage({
                  role: 'code',
                  content: codeBlockContent,
                })
              }
              codeBlockContent = ''
              isCodeBlock = false
            }
          }
        }

        break
      }
    }
  } catch (e) {
    console.error('Error processing AI response stream:', e)
  } finally {
    reader.releaseLock()
  }

  homeStore.setState({ chatProcessing: false })

  // 最終メッセージの処理
  // XML形式の場合は既に各タグごとに処理済みなので、ここでは何もしない
  if (!isXMLMode) {
    // 従来の感情タグ形式
    if (currentMessageContent.trim()) {
      homeStore.getState().upsertMessage({
        id: currentMessageId ?? generateMessageId(),
        role: 'assistant',
        content: stripEmotionTagsForDisplay(currentMessageContent.trim()),
      })
    }
  }

  // 内部 AI → 外部通知 hook
  try {
    await fetch('/api/external/broadcast', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: currentMessageContent.trim() }),
    })
  } catch (e) {
    console.error('broadcast error', e)
  }
}

// ============================================================
// WebSocket からのテキスト受信（外部AI用のメイン入口）
// ============================================================

/**
 * WebSocketからのテキストを受信したときの処理
 * 外部AIからの JSON:
 * {
 *   type: "start" | "message" | "end",
 *   role: "assistant",
 *   text: string,
 *   emotion: EmotionType,
 *   source: "iris" | "fiona" | など（任意）
 * }
 */
export const handleReceiveTextFromWsFn =
  () =>
    async (
      text: string,
      role?: string,
      emotion: EmotionType = 'neutral',
      type?: string,
      turnId?: number,
      target?: string,
      source?: string
    ) => {

      if (text === null || role === undefined) return

      const ss = settingsStore.getState()

      // 外部連携モード以外では無視
      if (!ss.externalLinkageMode) {
        console.log('ExternalLinkage Mode: false (ignore WS message)')
        return
      }

      homeStore.setState({ chatProcessing: true })

      // ========================================================
      // type=user_message（ユーザー入力の同期表示）
      // ========================================================
      // ========================================================
      // type=user_message（ユーザー入力の同期表示）
      // ========================================================
      if (type === 'user_message') {
        console.log(`[WS] ユーザーメッセージ受信: ${text?.substring(0, 30)}...`)

        const appId = process.env.NEXT_PUBLIC_APP_ID
        const messageSource = source

        console.log(`[WS Debug] appId=${appId}, source=${messageSource}`)

        // 自分のメッセージは handleSendChatFn で既に表示済みなのでスキップ
        // 他のタブ（相手）からのメッセージのみ表示する
        if (messageSource && messageSource !== appId) {
          console.log(`[WS] 他のタブからのメッセージとしてログに追加`)
          homeStore.getState().upsertMessage({
            role: 'user',
            content: text,
            timestamp: new Date().toISOString(),
          })
        } else {
          console.log(`[WS] 自分が送信したメッセージのためスキップ (source=${messageSource}, myAppId=${appId})`)
        }

        homeStore.setState({ chatProcessing: false })
        return
      }

      // ========================================================
      // 外部AI → AItuberKit
      // ========================================================
      if (role === 'assistant') {
        // -------------------------------
        // type=start（新規レスポンス開始）
        // -------------------------------
        if (type === 'start') {
          // ★ このタブが実際にしゃべるターゲットのときだけ、ターンIDを登録する
          //   （相方タブまで setTurnId すると、両方から speech_end が飛んでしまう）
          const appId = process.env.NEXT_PUBLIC_APP_ID
          const targetTab = target
          if (targetTab && appId && targetTab === appId && turnId) {
            SpeakQueue.getInstance().setTurnId(turnId ?? null)
          }
          console.log(`[WS] 開始: ターン=${turnId}, ターゲット=${target}`)

          // 新しいレスポンス用 ID を発行
          externalAssistantMessageId = generateMessageId()

          // チャットログに空のメッセージを作成
          homeStore.getState().upsertMessage({
            id: externalAssistantMessageId,
            role: 'assistant',
            content: '',
          })
          return
        }

        // -------------------------------
        // type=message（区間メッセージ）
        // -------------------------------
        if (type === "message") {
          console.log(`[WS] メッセージ: ターン=${turnId}, ターゲット=${target}`);

          // start が来ていない場合の保険処理
          if (!externalAssistantMessageId) {
            externalAssistantMessageId = generateMessageId();
            homeStore.getState().upsertMessage({
              id: externalAssistantMessageId,
              role: "assistant",
              content: "",
            });
          }

          // --------------------------------------
          //  ★ ここで A/B のタブを仕分ける
          // --------------------------------------
          const appId = process.env.NEXT_PUBLIC_APP_ID!
          const targetTab = target // ← 引数で受け取った target を使う

          // role を target に応じて設定
          const messageRole = targetTab === "A" ? "assistant-A" : "assistant-B";

          // === チャットログ更新（全タブ共通）
          const displayText = stripEmotionTagsForDisplay(text || "");
          const hs = homeStore.getState();
          const log = [...hs.chatLog];
          const idx = log.findIndex((m) => m.id === externalAssistantMessageId);

          if (idx !== -1) {
            // 既存メッセージ更新
            const prev = typeof log[idx].content === "string" ? (log[idx].content as string) : "";
            log[idx] = { ...log[idx], content: (prev + displayText).trim(), role: messageRole };
            homeStore.setState({ chatLog: log });
          } else {
            // 新規メッセージ
            homeStore.getState().upsertMessage({
              id: externalAssistantMessageId,
              role: messageRole,
              content: displayText,
            });
          }

          // --------------------------------------
          // ★ 自分向けのメッセージだけ発話する
          // --------------------------------------
          if (targetTab && appId && targetTab === appId) {
            if (text && text.trim().length > 0) {
              console.log(`[発話] ターゲット=${targetTab}, ターンID=${turnId || '不明'}に対して発話開始`);
              speakWholeTextWithEmotions(text);
            }
          } else {
            console.log(`[スキップ] ターゲット=${targetTab} (自分は${appId})のためスキップ`);

            // --------------------------------------
            // ★ 相方のメッセージは字幕のみ表示（音声なし）
            // --------------------------------------
            if (text && text.trim().length > 0) {
              const displayText = text.replace(/\[([a-zA-Z]*?)\]/g, ''); // 感情タグ除去
              homeStore.setState({
                slideMessages: [displayText]
              });

              // 3秒後に自動で消す
              setTimeout(() => {
                const current = homeStore.getState().slideMessages;
                if (current[0] === displayText) {
                  homeStore.setState({ slideMessages: [] });
                }
              }, 3000);
            }
          }

          return;
        }

        // -------------------------------
        // type=end（会話ブロック終了）
        // -------------------------------
        if (type === 'end') {
          console.log(`[WS] 終了: ターンID=${turnId || '不明'}, ターゲット=${target}`)

          // speech_end は、自キャラの音声再生完了時に SpeakQueue（speakQueue.ts）が
          // notifySpeechEnd を送信するため、ここでは送信しない。
          // （相方タブからの二重送信を防ぐ）

          externalAssistantMessageId = null
          homeStore.setState({ chatProcessing: false })
          return
        }
      }

      homeStore.setState({ chatProcessing: false })
    }

// ============================================================
// 画面からの送信処理（YouTube コメントもここに流す想定）
// ============================================================

export const handleSendChatFn = () => async (
  text: string, 
  characterId?: 'A' | 'B',
  options?: {
    isYouTubeComment?: boolean
    listenerName?: string
  }
) => {
  const newMessage = text
  const timestamp = new Date().toISOString()
  if (newMessage === null) return
  
  const isYouTubeComment = options?.isYouTubeComment || false
  const listenerName = options?.listenerName

  const ss = settingsStore.getState()
  const sls = slideStore.getState()

  // ===== WebSocketStore の形を共通化 =====
  const wsState = webSocketStore.getState() as any
  const ws: WebSocket | null =
    (wsState.ws as WebSocket | null) ??
    (wsState.wsManager?.websocket as WebSocket | null)

  const modalImage = homeStore.getState().modalImage

  // ========================================================
  // 外部AIモード：すべて WebSocket に流す（内部AIは完全停止）
  // ========================================================
  if (ss.externalLinkageMode) {
    homeStore.setState({ chatProcessing: true })

    // ---- UI ログ表示 ----
    const userMessageContent: Message['content'] = modalImage
      ? [
        { type: 'text' as const, text: newMessage },
        { type: 'image' as const, image: modalImage },
      ]
      : newMessage

    homeStore.getState().upsertMessage({
      role: 'user',
      content: userMessageContent,
      timestamp,
    })

    if (ws && ws.readyState === WebSocket.OPEN) {
      // ★ A/B 識別（TAB 固有の appId）
      const appId = process.env.NEXT_PUBLIC_APP_ID!

      const payload: any = {
        type: 'chat',
        role: 'user',
        text: newMessage,
        timestamp,
        source: appId, // ← ★ ここが最重要（A か B を Orchestrator へ伝える）
      }

      if (modalImage) {
        payload.image = modalImage
        homeStore.setState({ modalImage: '' })
      }

      ws.send(JSON.stringify(payload))
    } else {
      toastStore.getState().addToast({
        message: i18next.t('NotConnectedToExternalAssistant'),
        type: 'error',
        tag: 'not-connected-to-external-assistant',
      })
      homeStore.setState({ chatProcessing: false })
    }

    return
  }

  // ========================================================
  // ↓↓↓ ここから従来の「内部AIモード」（AItuberKit の純正 AI） ↓↓↓
  // ========================================================

  const sessionId = generateSessionId()

  // メッセージ末尾に「サーチ」または「search」がある場合、サーチグラウンディングを強制有効化
  // ただし、企画中（slideMode）は無効
  let forceSearchGrounding = false
  if (
    !ss.slideMode &&
    (newMessage.endsWith('サーチ') ||
      newMessage.endsWith('さーち') ||
      newMessage.endsWith('search') ||
      newMessage.endsWith('Search') ||
      newMessage.endsWith('SEARCH'))
  ) {
    forceSearchGrounding = true
    info(
      'メッセージ末尾の「サーチ」検出により、サーチグラウンディングを強制有効化',
      undefined,
      'handleSendChatFn'
    )
  }

  // システムプロンプトを構築
  const { buildSystemPrompt } = await import('./promptBuilder')
  let systemPrompt = await buildSystemPrompt(
    characterId,
    forceSearchGrounding,
    newMessage
  )

  if (ss.slideMode) {
    if (sls.isPlaying) return

    try {
      const scripts = JSON.stringify(
        require(
          `../../../public/slides/${sls.selectedSlideDocs}/scripts.json`
        )
      )
      systemPrompt = systemPrompt.replace('{{SCRIPTS}}', scripts)

      let supplement = ''
      try {
        const response = await fetch(
          `/api/getSupplement?slideName=${sls.selectedSlideDocs}`
        )
        if (!response.ok) throw new Error('Failed to fetch supplement')

        const data = await response.json()
        supplement = data.supplement
        systemPrompt = systemPrompt.replace('{{SUPPLEMENT}}', supplement)
      } catch (e) {
        console.error('supplement.txtの読み込みに失敗:', e)
      }

      const answerString = await judgeSlide(newMessage, scripts, supplement)
      const answer = JSON.parse(answerString)

      if (answer.judge === 'true' && answer.page !== '') {
        goToSlide(Number(answer.page))
        systemPrompt += `\n\nEspecial Page Number is ${answer.page}.`
      }
    } catch (e) {
      console.error(e)
    }
  }

  homeStore.setState({ chatProcessing: true })

  let userMessageContent: Message['content'] = newMessage

  // === 内部AIログ更新 ===
  homeStore.getState().upsertMessage({
    role: 'user',
    content: userMessageContent,
    timestamp,
    youtube: isYouTubeComment, // YouTubeコメントかどうか
  })

  if (modalImage) homeStore.setState({ modalImage: '' })

  // ========================================================
  // 内部AIへメッセージ送信
  // ========================================================
  const currentChatLog = homeStore.getState().chatLog

  const messages: Message[] = [
    { role: 'system', content: systemPrompt },
    ...messageSelectors.getProcessedMessages(
      currentChatLog,
      ss.includeTimestampInUserMessage
    ),
  ]

  try {
    await processAIResponse(messages, characterId)

    // ========================================================
    // 長期記憶システム: 会話から記憶を抽出して保存
    // ========================================================
    const ssAfter = settingsStore.getState()
    const isMemoryEnabled =
      ssAfter.memoryEnabled ||
      process.env.NEXT_PUBLIC_MEMORY_ENABLED === 'true'

    if (isMemoryEnabled) {
      const { extractMemoriesFromChat } = await import(
        '@/features/memory/memoryExtractionHandler'
      )
      extractMemoriesFromChat(newMessage)
    }
  } catch (e) {
    logError('processAIResponseエラー', e, 'handleSendChatFn')
    homeStore.setState({ chatProcessing: false })
  }
}

