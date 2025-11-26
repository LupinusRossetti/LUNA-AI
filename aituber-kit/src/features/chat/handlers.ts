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
import { SYSTEM_PROMPT } from '@/features/constants/systemPromptConstants'
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
 * 声再生とUI同期処理（従来の感情タグ形式用）
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
 * 声再生とUI同期処理（XML形式用、キャラクター指定）
 */
const handleSpeakAndStateUpdateForCharacter = (
  sessionId: string,
  sentence: string,
  emotion: EmotionType,
  character: 'A' | 'B',
  currentSlideMessagesRef: { current: string[] }
) => {
  const hs = homeStore.getState()

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

  // キャラクターA/B別々の音声設定を使用
  speakCharacter(
    sessionId,
    { message: sentence, emotion, characterId: character },
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

  try {
    while (true) {
      const { done, value } = await reader.read()

      if (value) {
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
          receivedChunksForXML += value
          // XMLタグの処理は後でまとめて行う
        } else {
          // 従来の感情タグ形式の処理
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
      }

      // ======== XML形式の処理 ========
      if (isXMLMode && receivedChunksForXML) {
        const { completeTags, remainingText } = extractCompleteXMLTags(receivedChunksForXML)
        
        // 完全なXMLタグを処理
        for (const dialogue of completeTags) {
          const character = dialogue.character
          const emotion = dialogue.emotion as EmotionType
          const text = dialogue.text
          
          // メッセージIDの初期化
          if (character === 'A' && currentMessageIdA === null) {
            currentMessageIdA = generateMessageId()
            homeStore.getState().upsertMessage({
              id: currentMessageIdA,
              role: 'assistant-A',
              content: '',
            })
          }
          if (character === 'B' && currentMessageIdB === null) {
            currentMessageIdB = generateMessageId()
            homeStore.getState().upsertMessage({
              id: currentMessageIdB,
              role: 'assistant-B',
              content: '',
            })
          }
          
          // メッセージ内容を更新
          if (character === 'A') {
            currentMessageContentA += text
            homeStore.getState().upsertMessage({
              id: currentMessageIdA!,
              role: 'assistant-A',
              content: currentMessageContentA,
            })
          } else {
            currentMessageContentB += text
            homeStore.getState().upsertMessage({
              id: currentMessageIdB!,
              role: 'assistant-B',
              content: currentMessageContentB,
            })
          }
          
          // 音声合成（各キャラクター別々に）
          if (text.trim()) {
            handleSpeakAndStateUpdateForCharacter(
              sessionId,
              text,
              emotion,
              character,
              currentSlideMessagesRef
            )
          }
        }
        
        // 残りのテキストを保持
        receivedChunksForXML = remainingText
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
        if (isXMLMode) {
          // XML形式の最終処理
          if (receivedChunksForXML.length > 0) {
            const { completeTags } = extractCompleteXMLTags(receivedChunksForXML)
            for (const dialogue of completeTags) {
              const character = dialogue.character
              const emotion = dialogue.emotion as EmotionType
              const text = dialogue.text
              
              if (character === 'A') {
                if (currentMessageIdA === null) {
                  currentMessageIdA = generateMessageId()
                  homeStore.getState().upsertMessage({
                    id: currentMessageIdA,
                    role: 'assistant-A',
                    content: text,
                  })
                } else {
                  currentMessageContentA += text
                  homeStore.getState().upsertMessage({
                    id: currentMessageIdA,
                    role: 'assistant-A',
                    content: currentMessageContentA,
                  })
                }
                handleSpeakAndStateUpdateForCharacter(
                  sessionId,
                  text,
                  emotion,
                  'A',
                  currentSlideMessagesRef
                )
              } else {
                if (currentMessageIdB === null) {
                  currentMessageIdB = generateMessageId()
                  homeStore.getState().upsertMessage({
                    id: currentMessageIdB,
                    role: 'assistant-B',
                    content: text,
                  })
                } else {
                  currentMessageContentB += text
                  homeStore.getState().upsertMessage({
                    id: currentMessageIdB,
                    role: 'assistant-B',
                    content: currentMessageContentB,
                  })
                }
                handleSpeakAndStateUpdateForCharacter(
                  sessionId,
                  text,
                  emotion,
                  'B',
                  currentSlideMessagesRef
                )
              }
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
  if (isXMLMode) {
    // XML形式の場合は既に処理済み
    if (currentMessageContentA.trim() && currentMessageIdA) {
      homeStore.getState().upsertMessage({
        id: currentMessageIdA,
        role: 'assistant-A',
        content: currentMessageContentA.trim(),
      })
    }
    if (currentMessageContentB.trim() && currentMessageIdB) {
      homeStore.getState().upsertMessage({
        id: currentMessageIdB,
        role: 'assistant-B',
        content: currentMessageContentB.trim(),
      })
    }
  } else {
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

  // ---- スライドモードなど内部の特殊処理 ----
  let systemPrompt = ss.systemPrompt || SYSTEM_PROMPT
  
  // ---- 掛け合いモード判定（暫定: 環境変数で判定） ----
  // TODO: より適切な判定方法を実装（タスク3で実装予定）
  const isDialogueMode = process.env.NEXT_PUBLIC_DIALOGUE_MODE === 'true'
  
  // ---- XML形式の指示を追加（掛け合いモード時） ----
  if (isDialogueMode) {
    const xmlInstruction = `

[掛け合い形式]
あなたはアイリス（A）とフィオナ（B）の2人のキャラクターとして、掛け合い形式で応答してください。

出力形式（XML形式）:
<A emotion="happy">アイリスのセリフ</A>
<B emotion="relaxed">フィオナのセリフ</B>
<A emotion="surprised">アイリスのセリフ</A>

重要:
- 必ずXML形式で出力すること
- <A>タグはアイリス（元気でハイテンション）のセリフ
- <B>タグはフィオナ（丁寧で優しい）のセリフ
- emotion属性は "neutral", "happy", "angry", "sad", "relaxed", "surprised" のいずれか
- 掛け合いは最大500文字以内（A+B合計）
- ターン数は制限なし（500文字以内であれば）
- 自然な会話の流れを保つこと

例:
<A emotion="happy">やっほー！お姉ちゃん、今日はどんな話する？</A>
<B emotion="relaxed">ふふ、アイリスちゃん、楽しみですねぇ。</B>
<A emotion="surprised">えぇ！？フィオナ、何か企んでるの！？</A>
`
    systemPrompt = systemPrompt + xmlInstruction
  }

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

