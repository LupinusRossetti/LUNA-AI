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
import { isMultiModalAvailable } from '@/features/constants/aiModels'
import { SYSTEM_PROMPT } from '@/features/constants/systemPromptConstants'
import { SpeakQueue } from '@/features/messages/speakQueue';

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
 * 感情タグ [happy] などを UI 表示用に削除する
 */
const stripEmotionTagsForDisplay = (text: string): string => {
  return text.replace(/\[[^\]]+?\]/g, '').trim()
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
 * 声再生とUI同期処理
 */
const handleSpeakAndStateUpdate = (
  sessionId: string,
  sentence: string,
  emotionTag: string,
  currentSlideMessagesRef: { current: string[] }
) => {
  const hs = homeStore.getState()
  const emotion = emotionTag.includes('[')
    ? (emotionTag.slice(1, -1).toLowerCase() as EmotionType)
    : 'neutral'

  // 発話不要な記号列は無視
  if (
    sentence === '' ||
    sentence.replace(
      /^[\s\u3000\t\n\r\[\(\{「［（【『〈《〔｛«‹〘〚〛〙›»〕》〉』】）］」\}\)\]'"''""・、。,.!?！？:：;；\-_=+~～*＊@＠#＃$＄%％^＾&＆|｜\\＼/／`｀]+$/gu,
      ''
    ) === ''
  ) {
    return
  }

  speakCharacter(
    sessionId,
    { message: sentence, emotion },
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
        currentSlideMessagesRef
      )
      localRemaining = afterSentence
      if (!afterSentence) currentEmotionTag = ''
    } else {
      if (localRemaining.trim().length > 0) {
        handleSpeakAndStateUpdate(
          sessionId,
          localRemaining,
          currentEmotionTag,
          currentSlideMessagesRef
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
// マルチモーダル判定（内部AI用）
// ============================================================

const askAIForMultiModalDecision = async (
  userMessage: string,
  image: string,
  decisionPrompt: string
): Promise<boolean> => {
  try {
    const currentChatLog = homeStore.getState().chatLog
    const recentMessages = currentChatLog.slice(-3)

    let conversationHistory = ''
    if (recentMessages.length > 0) {
      conversationHistory = '\n\n直近の会話履歴:\n'
      const textOnlyMessages = messageSelectors.cutImageMessage(recentMessages)
      textOnlyMessages.forEach((msg, index) => {
        const content = msg.content || ''
        conversationHistory += `${index + 1}. ${msg.role === 'user' ? 'ユーザー' : 'アシスタント'
          }: ${content}\n`
      })
    }

    const decisionMessage: Message = {
      role: 'user',
      content: [
        {
          type: 'text',
          text: `Conversation History:\n${conversationHistory}\n\nUser Message: "${userMessage}"`,
        },
        { type: 'image', image },
      ],
      timestamp: new Date().toISOString(),
    }

    const systemMessage: Message = {
      role: 'system',
      content: decisionPrompt,
    }

    const response = await getAIChatResponseStream([
      systemMessage,
      decisionMessage,
    ])

    if (!response) return false

    const reader = response.getReader()
    let result = ''

    try {
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        result += value
      }
    } finally {
      reader.releaseLock()
    }

    const decision = result.trim().toLowerCase()
    const affirmativeResponses = [
      'はい',
      'yes',
      'oui',
      'sí',
      'ja',
      '是',
      '예',
      'tak',
      'da',
      'sim',
    ]

    return affirmativeResponses.some((v) => decision.includes(v))
  } catch (error) {
    console.error('AI判断でエラー:', error)
    return false
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

export const processAIResponse = async (messages: Message[]) => {
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
  let currentMessageId: string | null = null
  let currentMessageContent = ''
  let currentEmotionTag = ''
  let isCodeBlock = false
  let codeBlockContent = ''

  try {
    while (true) {
      const { done, value } = await reader.read()

      if (value) {
        let textToAdd = value

        if (!isCodeBlock) {
          const delimiterIdx = value.indexOf(CODE_DELIMITER)
          if (delimiterIdx !== -1) {
            textToAdd = value.substring(0, delimiterIdx)
          }
        }

        if (currentMessageId === null) {
          currentMessageId = generateMessageId()
          currentMessageContent = textToAdd

          if (currentMessageContent) {
            homeStore.getState().upsertMessage({
              id: currentMessageId,
              role: 'assistant',
              content: stripEmotionTagsForDisplay(currentMessageContent),
            })
          }
        } else if (!isCodeBlock) {
          currentMessageContent += textToAdd
          if (textToAdd) {
            homeStore.getState().upsertMessage({
              id: currentMessageId,
              role: 'assistant',
              content: stripEmotionTagsForDisplay(currentMessageContent),
            })
          }
        }

        receivedChunksForSpeech += value
      }

      let processable = receivedChunksForSpeech
      receivedChunksForSpeech = ''

      // ======== 音声処理ループ ========
      while (processable.length > 0) {
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
                currentSlideMessagesRef
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
            currentSlideMessagesRef
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
              currentSlideMessagesRef
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

        break
      }
    }
  } catch (e) {
    console.error('Error processing AI response stream:', e)
  } finally {
    reader.releaseLock()
  }

  homeStore.setState({ chatProcessing: false })

  if (currentMessageContent.trim()) {
    homeStore.getState().upsertMessage({
      id: currentMessageId ?? generateMessageId(),
      role: 'assistant',
      content: stripEmotionTagsForDisplay(currentMessageContent.trim()),
    })
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
// 画面からの送信処理（YouTube コメントもここに流す想定）
// ============================================================

export const handleSendChatFn = () => async (text: string) => {
  const newMessage = text
  const timestamp = new Date().toISOString()
  if (newMessage === null) return

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

  if (ss.realtimeAPIMode) {
    if (ws && ws.readyState === WebSocket.OPEN) {
      homeStore.getState().upsertMessage({
        role: 'user',
        content: newMessage,
        timestamp,
      })
    }
    return
  }

  // ---- スライドモードなど内部の特殊処理 ----
  let systemPrompt = ss.systemPrompt || SYSTEM_PROMPT

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

  // ========================================================
  // マルチモーダル判断（内部AIモード）
  // ========================================================
  if (
    modalImage &&
    !isMultiModalAvailable(
      ss.selectAIService,
      ss.selectAIModel,
      ss.enableMultiModal,
      ss.multiModalMode,
      ss.customModel
    )
  ) {
    toastStore.getState().addToast({
      message: i18next.t('MultiModalNotSupported'),
      type: 'error',
      tag: 'multimodal-not-supported',
    })
    homeStore.setState({
      chatProcessing: false,
      modalImage: '',
    })
    return
  }

  let userMessageContent: Message['content'] = newMessage
  let shouldUseImage = false

  if (modalImage) {
    switch (ss.multiModalMode) {
      case 'always':
        shouldUseImage = true
        break
      case 'never':
        shouldUseImage = false
        break
      case 'ai-decide':
        shouldUseImage = await askAIForMultiModalDecision(
          newMessage,
          modalImage,
          ss.multiModalAiDecisionPrompt
        )
        break
    }

    if (shouldUseImage) {
      userMessageContent = [
        { type: 'text' as const, text: newMessage },
        { type: 'image' as const, image: modalImage },
      ]
    }
  }

  // === 内部AIログ更新 ===
  homeStore.getState().upsertMessage({
    role: 'user',
    content: userMessageContent,
    timestamp,
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
    await processAIResponse(messages)
  } catch (e) {
    console.error(e)
    homeStore.setState({ chatProcessing: false })
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
      target?: string
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
      // 外部AI → AItuberKit
      // ========================================================
      if (role === 'assistant') {
        // -------------------------------
        // type=start（新規レスポンス開始）
        // -------------------------------
        if (type === 'start') {
          SpeakQueue.getInstance().setTurnId(turnId ?? null);
          console.log('WS: start')

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
          console.log("WS: message");

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

          // 自分向けではない → ログだけ更新、発話しない
          if (targetTab && appId && targetTab !== appId) {
            const displayText = stripEmotionTagsForDisplay(text || "");
            const hs = homeStore.getState();
            const log = [...hs.chatLog];

            const idx = log.findIndex((m) => m.id === externalAssistantMessageId);
            if (idx !== -1) {
              const prev = typeof log[idx].content === "string"
                ? (log[idx].content as string)
                : "";
              log[idx] = {
                ...log[idx],
                content: (prev + displayText).trim(),
              };
              homeStore.setState({ chatLog: log });
            } else {
              homeStore.getState().upsertMessage({
                id: externalAssistantMessageId,
                role: "assistant",
                content: displayText,
              });
            }

            return; // ← 他タブ向けなので発話しない
          }

          // --------------------------------------
          // ★ 自分向けのメッセージだけ発話する
          // --------------------------------------
          if (text && text.trim().length > 0) {
            speakWholeTextWithEmotions(text);
          }

          // === チャットログ更新（自分向け）
          const displayText = stripEmotionTagsForDisplay(text || "");
          const hs = homeStore.getState();
          const log = [...hs.chatLog];
          const idx = log.findIndex((m) => m.id === externalAssistantMessageId);

          if (idx !== -1) {
            const prev = typeof log[idx].content === "string"
              ? (log[idx].content as string)
              : "";
            log[idx] = {
              ...log[idx],
              content: (prev + displayText).trim(),
            };
            homeStore.setState({ chatLog: log });
          } else {
            homeStore.getState().upsertMessage({
              id: externalAssistantMessageId,
              role: "assistant",
              content: displayText,
            });
          }

          return;
        }

        // -------------------------------
        // type=end（会話ブロック終了）
        // -------------------------------
        if (type === 'end') {
          console.log('WS: end')

          externalAssistantMessageId = null
          homeStore.setState({ chatProcessing: false })
          return
        }

        // -------------------------------
        // type が無い（単発メッセージ）
        // -------------------------------
        console.log('WS: single message (no type)')

        const displayText = stripEmotionTagsForDisplay(text || '')
        const messageId = generateMessageId()

        homeStore.getState().upsertMessage({
          id: messageId,
          role: 'assistant',
          content: displayText,
        })

        speakWholeTextWithEmotions(text || '')
        homeStore.setState({ chatProcessing: false })
        return
      }

      // ========================================================
      // role=user（将来の拡張用途）
      // ========================================================
      if (role === 'user') {
        homeStore.getState().upsertMessage({
          role: 'user',
          content: text,
          timestamp: new Date().toISOString(),
        })
        homeStore.setState({ chatProcessing: false })
        return
      }

      homeStore.setState({ chatProcessing: false })
    }
// ============================================================
// Realtime API / Audio モード（外部AIとの共存に最適化）
// ============================================================

/**
 * RealtimeAPI からのテキストまたは音声データを受信したときの処理
 * - response.audio → バイナリ音声
 * - response.content_part.done → テキスト完了
 *
 * ※ 外部AI（orchestrator）と同時使用できるように
 *    完全に独立したコードにしてある
 */
export const handleReceiveTextFromRtFn = () => {
  // 音声連続イベント用のセッションID
  let currentSessionId: string | null = null

  return async (
    text?: string,
    role?: string,
    type?: string,
    buffer?: ArrayBuffer
  ) => {
    const ss = settingsStore.getState()

    // RealtimeAPI / Audio モード “以外” なら無視
    if (!ss.realtimeAPIMode && !ss.audioMode) {
      console.log('realtime/audio mode disabled → ignore RT message')
      return
    }

    // == セッションID（連続イベントを 1 会話として扱う） ==
    if (currentSessionId === null) {
      currentSessionId = generateSessionId()
    }
    const sessionId = currentSessionId

    homeStore.setState({ chatProcessing: true })

    // ========================================================
    // ① アシスタントからの音声（response.audio）
    // ========================================================
    if (role === 'assistant' && type?.includes('response.audio') && buffer) {
      console.log('RT: response.audio')

      try {
        speakCharacter(
          sessionId,
          {
            emotion: 'neutral',
            message: '',
            buffer,        // 直接音声バッファを渡す
          },
          () => { },       // onStart
          () => { }        // onComplete
        )
      } catch (e) {
        console.error('Error in speakCharacter (audio-mode):', e)
      }

      homeStore.setState({ chatProcessing: false })
      return
    }

    // ========================================================
    // ② アシスタントのテキスト出力（response.content_part.done）
    // ========================================================
    if (role === 'assistant' && type === 'response.content_part.done') {
      console.log('RT: response.content_part.done')

      if (text && text.trim().length > 0) {
        // チャットログへの追加（リアルタイムモードは UI 表示のみ）
        homeStore.getState().upsertMessage({
          role: 'assistant',
          content: text,
        })
      }

      homeStore.setState({ chatProcessing: false })

      // 完了したのでセッションIDリセット
      currentSessionId = null
      return
    }

    // ========================================================
    // ③ その他（未想定のイベントは安全に破棄）
    // ========================================================
    console.log('RT: unknown event', { role, type })
    homeStore.setState({ chatProcessing: false })
  }
}
