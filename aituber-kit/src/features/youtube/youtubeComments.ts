import { Message } from '@/features/messages/messages'
import settingsStore from '@/features/stores/settings'
import {
  getBestComment,
  getMessagesForSleep,
  getAnotherTopic,
  getMessagesForNewTopic,
  checkIfResponseContinuationIsRequired,
  getMessagesForContinuation,
} from '@/features/youtube/conversationContinuityFunctions'
import { processAIResponse } from '../chat/handlers'
import homeStore from '@/features/stores/home'
import { messageSelectors } from '../messages/messageSelectors'
import { v4 as uuidv4 } from 'uuid'
import { commentQueueStore, QueuedComment } from '@/features/stores/commentQueueStore'
import { projectModeStore } from '@/features/stores/projectModeStore'
import {
  enqueueCommentByMode,
  processNextCommentFromQueue,
} from './commentQueue'
import { projectManager } from '@/features/projects/projectBase'
import { handleProjectProposal, handleProjectCommand } from '@/features/projects/projectBase'

export const getLiveChatId = async (
  liveId: string,
  youtubeKey: string
): Promise<string> => {
  console.log('[youtubeComments] getLiveChatId 開始')
  console.log('[youtubeComments] liveId:', liveId)
  
  const params = {
    part: 'liveStreamingDetails',
    id: liveId,
    key: youtubeKey,
  }
  const query = new URLSearchParams(params)
  
  try {
    const response = await fetch(
      `https://youtube.googleapis.com/youtube/v3/videos?${query}`,
      {
        method: 'get',
        headers: {
          'Content-Type': 'application/json',
        },
      }
    )
    
    console.log('[youtubeComments] getLiveChatId APIレスポンスステータス:', response.status, response.statusText)
    
    if (!response.ok) {
      const errorText = await response.text()
      console.error('[youtubeComments] getLiveChatId APIエラー:', {
        status: response.status,
        statusText: response.statusText,
        error: errorText
      })
      
      // クォータ超過エラーの確認
      if (response.status === 403 || response.status === 429) {
        try {
          const errorJson = JSON.parse(errorText)
          if (errorJson.error?.message?.includes('quota') || 
              errorJson.error?.message?.includes('Quota') ||
              errorJson.error?.message?.includes('exceeded')) {
            console.error('[youtubeComments] ⚠️ YouTube API クォータ超過エラーが発生しました（getLiveChatId）')
            console.error('[youtubeComments] エラー詳細:', errorJson.error)
          }
        } catch (e) {
          // JSONパースエラーは無視
        }
      }
      
      return ''
    }
    
    const json = await response.json()
    
    // エラーレスポンスの確認
    if (json.error) {
      console.error('[youtubeComments] getLiveChatId APIエラーレスポンス:', json.error)
      if (json.error.code === 403 || json.error.code === 429) {
        if (json.error.message?.includes('quota') || 
            json.error.message?.includes('Quota') ||
            json.error.message?.includes('exceeded')) {
          console.error('[youtubeComments] ⚠️ YouTube API クォータ超過エラーが発生しました（getLiveChatId）')
        }
      }
      return ''
    }
    
    if (json.items == undefined || json.items.length == 0) {
      console.warn('[youtubeComments] getLiveChatId: 動画情報が見つかりませんでした')
      return ''
    }
    
    const liveChatId = json.items[0].liveStreamingDetails?.activeLiveChatId
    console.log('[youtubeComments] getLiveChatId 成功:', liveChatId ? `${liveChatId.substring(0, 10)}...` : 'なし')
    
    if (!liveChatId) {
      console.warn('[youtubeComments] getLiveChatId: activeLiveChatIdが取得できませんでした（配信が開始されていない可能性があります）')
    }
    
    return liveChatId || ''
  } catch (error) {
    console.error('[youtubeComments] getLiveChatId エラー:', error)
    return ''
  }
}

type YouTubeComment = {
  userName: string
  userIconUrl: string
  userComment: string
}

type YouTubeComments = YouTubeComment[]

/**
 * 接頭辞解析結果の型定義
 */
export interface ParsedComment {
  characterId?: 'A' | 'B'
  message: string
  type: 'chat' | 'project-proposal' | 'project-command' | 'other'
  priority: 'high' | 'low'
  prefix: string // 検出された接頭辞（例: "IR", "#NZ", "/NZ"）
}

/**
 * コメントの接頭辞を判定して、キャラクターID、メッセージ、タイプ、優先度を返す
 * @param comment コメントテキスト
 * @returns ParsedComment 解析結果
 */
const parseCommentPrefix = (comment: string): ParsedComment => {
  // 全角を半角に変換（I, R, F, #, /）
  const normalizedComment = comment.replace(/[ＩＲＦ＃／]/g, (char) => {
    if (char === 'Ｉ') return 'I'
    if (char === 'Ｒ') return 'R'
    if (char === 'Ｆ') return 'F'
    if (char === '＃') return '#'
    if (char === '／') return '/'
    return char
  })
  
  // 先頭の空白（全角スペース、半角スペース、タブなど）を除去
  const trimmedComment = normalizedComment.trim()
  
  // 大文字に変換して判定
  const upperComment = trimmedComment.toUpperCase()
  
  // 環境変数からキャラクター名を取得
  const { getCharacterNames } = require('@/utils/characterNames')
  const characterNames = getCharacterNames()
  const characterAPrefix = characterNames.characterA.nickname.substring(0, 2).toUpperCase()
  const characterBPrefix = characterNames.characterB.nickname.substring(0, 2).toUpperCase()
  
  // IR/FI 接頭辞（キャラクターコメント）
  if (upperComment.startsWith(characterAPrefix)) {
    const afterPrefix = trimmedComment.substring(characterAPrefix.length)
    const message = afterPrefix.replace(/^[\s\u3000]+/, '').trim()
    return {
      characterId: 'A',
      message,
      type: 'chat',
      priority: 'high',
      prefix: characterAPrefix,
    }
  }
  
  if (upperComment.startsWith(characterBPrefix)) {
    const afterPrefix = trimmedComment.substring(characterBPrefix.length)
    const message = afterPrefix.replace(/^[\s\u3000]+/, '').trim()
    return {
      characterId: 'B',
      message,
      type: 'chat',
      priority: 'high',
      prefix: characterBPrefix,
    }
  }
  
  // 企画提案 (#xx) - アルファベット2文字 + 任意の文字
  if (trimmedComment.startsWith('#')) {
    const match = trimmedComment.match(/^#([A-Za-z]{2})(.*)$/i)
    if (match) {
      const prefix = `#${match[1].toUpperCase()}`
      const message = match[2].trim()
      return {
        characterId: undefined,
        message,
        type: 'project-proposal',
        priority: 'low',
        prefix,
      }
    }
    // #の後にアルファベット2文字がない場合も企画提案として扱う（互換性のため）
    const parts = trimmedComment.split(/\s+/, 2)
    const prefix = parts[0].toUpperCase()
    const message = parts.length > 1 ? parts[1] : ''
    return {
      characterId: undefined,
      message,
      type: 'project-proposal',
      priority: 'low',
      prefix,
    }
  }
  
  // 企画コマンド (/xx) - アルファベット2文字 + 任意の文字
  if (trimmedComment.startsWith('/')) {
    const match = trimmedComment.match(/^\/([A-Za-z]{2})(.*)$/i)
    if (match) {
      const prefix = `/${match[1].toUpperCase()}`
      const message = match[2].trim()
      return {
        characterId: undefined,
        message,
        type: 'project-command',
        priority: 'low',
        prefix,
      }
    }
    // /の後にアルファベット2文字がない場合も企画コマンドとして扱う（互換性のため）
    const parts = trimmedComment.split(/\s+/, 2)
    const prefix = parts[0].toUpperCase()
    const message = parts.length > 1 ? parts[1] : ''
    return {
      characterId: undefined,
      message,
      type: 'project-command',
      priority: 'low',
      prefix,
    }
  }
  
  // 接頭辞がない場合
  return {
    characterId: undefined,
    message: normalizedComment,
    type: 'other',
    priority: 'low',
    prefix: '',
  }
}

const retrieveLiveComments = async (
  activeLiveChatId: string,
  youtubeKey: string,
  youtubeNextPageToken: string,
  setYoutubeNextPageToken: (token: string) => void
): Promise<YouTubeComments> => {
  console.log('[youtubeComments] retrieveLiveComments 開始')
  console.log('[youtubeComments] activeLiveChatId:', activeLiveChatId ? `${activeLiveChatId.substring(0, 10)}...` : 'なし')
  console.log('[youtubeComments] youtubeNextPageToken:', youtubeNextPageToken ? 'あり' : 'なし')
  
  let url =
    'https://youtube.googleapis.com/youtube/v3/liveChat/messages?liveChatId=' +
    activeLiveChatId +
    '&part=authorDetails%2Csnippet&key=' +
    youtubeKey
  if (youtubeNextPageToken !== '' && youtubeNextPageToken !== undefined) {
    url = url + '&pageToken=' + youtubeNextPageToken
  }
  
  try {
    const response = await fetch(url, {
      method: 'get',
      headers: {
        'Content-Type': 'application/json',
      },
    })
    
    console.log('[youtubeComments] APIレスポンスステータス:', response.status, response.statusText)
    
    if (!response.ok) {
      const errorText = await response.text()
      console.error('[youtubeComments] APIエラー:', {
        status: response.status,
        statusText: response.statusText,
        error: errorText
      })
      
      // クォータ超過エラーの確認
      if (response.status === 403 || response.status === 429) {
        try {
          const errorJson = JSON.parse(errorText)
          if (errorJson.error?.message?.includes('quota') || 
              errorJson.error?.message?.includes('Quota') ||
              errorJson.error?.message?.includes('exceeded')) {
            console.error('[youtubeComments] ⚠️ YouTube API クォータ超過エラーが発生しました')
            console.error('[youtubeComments] エラー詳細:', errorJson.error)
          }
        } catch (e) {
          // JSONパースエラーは無視
        }
      }
      
      return []
    }
    
    const json = await response.json()
    
    // エラーレスポンスの確認
    if (json.error) {
      console.error('[youtubeComments] APIエラーレスポンス:', json.error)
      if (json.error.code === 403 || json.error.code === 429) {
        if (json.error.message?.includes('quota') || 
            json.error.message?.includes('Quota') ||
            json.error.message?.includes('exceeded')) {
          console.error('[youtubeComments] ⚠️ YouTube API クォータ超過エラーが発生しました')
        }
      }
      return []
    }
    
    const items = json.items || []
    console.log('[youtubeComments] 取得したコメント数:', items.length)
    
    if (json.nextPageToken) {
      console.log('[youtubeComments] nextPageTokenを設定:', json.nextPageToken.substring(0, 20) + '...')
      setYoutubeNextPageToken(json.nextPageToken)
    } else {
      console.log('[youtubeComments] nextPageTokenなし（全てのコメントを取得済み）')
    }

    const comments = items
      .map((item: any) => ({
        userName: item.authorDetails.displayName,
        userIconUrl: item.authorDetails.profileImageUrl,
        userComment:
          item.snippet.textMessageDetails?.messageText ||
          item.snippet.superChatDetails?.userComment ||
          '',
      }))
      .filter(
        (comment: any) =>
          comment.userComment !== '' && !comment.userComment.startsWith('#')
      )

    console.log('[youtubeComments] フィルタ後のコメント数:', comments.length)
    if (comments.length > 0) {
      console.log('[youtubeComments] コメント例:', comments.slice(0, 3).map(c => ({
        userName: c.userName,
        comment: c.userComment.substring(0, 50)
      })))
    }

    return comments
  } catch (error) {
    console.error('[youtubeComments] retrieveLiveComments エラー:', error)
    return []
  }
}

export const fetchAndProcessComments = async (
  handleSendChat: (text: string, characterId?: 'A' | 'B', options?: { isYouTubeComment?: boolean, listenerName?: string }) => void | Promise<void>
): Promise<void> => {
  const ss = settingsStore.getState()
  const hs = homeStore.getState()
  const chatLog = messageSelectors.getTextAndImageMessages(hs.chatLog)

  try {
    console.log('[youtubeComments] fetchAndProcessComments 開始')
    console.log('[youtubeComments] 設定確認:', {
      youtubeLiveId: ss.youtubeLiveId ? `${ss.youtubeLiveId.substring(0, 10)}...` : 'なし',
      youtubeApiKey: ss.youtubeApiKey ? '設定済み' : 'なし',
      youtubeMode: ss.youtubeMode,
      youtubePlaying: ss.youtubePlaying,
      chatProcessing: hs.chatProcessing
    })
    
    const liveChatId = await getLiveChatId(ss.youtubeLiveId, ss.youtubeApiKey)

    if (liveChatId) {
      console.log('[youtubeComments] liveChatId取得成功、コメント取得を開始')
      // 会話の継続が必要かどうかを確認
      if (
        !ss.youtubeSleepMode &&
        ss.youtubeContinuationCount < 1 &&
        ss.conversationContinuityMode
      ) {
        const isContinuationNeeded =
          await checkIfResponseContinuationIsRequired(chatLog)
        if (isContinuationNeeded) {
          const continuationMessage = await getMessagesForContinuation(
            ss.systemPrompt,
            chatLog
          )
          processAIResponse(continuationMessage)
          settingsStore.setState({
            youtubeContinuationCount: ss.youtubeContinuationCount + 1,
          })
          if (ss.youtubeNoCommentCount < 1) {
            settingsStore.setState({ youtubeNoCommentCount: 1 })
          }
          return
        }
      }
      settingsStore.setState({ youtubeContinuationCount: 0 })

      // コメントを取得
      const youtubeComments = await retrieveLiveComments(
        liveChatId,
        ss.youtubeApiKey,
        ss.youtubeNextPageToken,
        (token: string) =>
          settingsStore.setState({ youtubeNextPageToken: token })
      )
      // コメントを処理
      if (youtubeComments.length > 0) {
        settingsStore.setState({ youtubeNoCommentCount: 0 })
        settingsStore.setState({ youtubeSleepMode: false })
        
        const { currentMode, projectState } = projectModeStore.getState()
        const isProcessingComment = hs.chatProcessing || hs.chatProcessingCount > 0
        
        console.log('[youtubeComments] モード状態:', {
          currentMode,
          projectState,
          isProcessingComment,
          chatProcessing: hs.chatProcessing,
          chatProcessingCount: hs.chatProcessingCount
        })
        
        // 各コメントを解析してキューに追加または処理
        for (const ytComment of youtubeComments) {
          const parsed = parseCommentPrefix(ytComment.userComment)
          const listenerName = ytComment.userName || '不明なリスナー'
          
          console.log('[youtubeComments] コメント解析:', {
            userName: listenerName,
            comment: ytComment.userComment.substring(0, 50),
            parsed
          })
          
          // メッセージが空の場合は無視
          if (!parsed.message || parsed.message.trim() === '') {
            console.log('[youtubeComments] メッセージが空のため無視します')
            continue
          }
          
          // キューアイテムを作成
          const queuedComment: QueuedComment = {
            id: uuidv4(),
            timestamp: Date.now(),
            userName: listenerName,
            userIconUrl: ytComment.userIconUrl,
            comment: ytComment.userComment,
            characterId: parsed.characterId,
            message: parsed.message,
            priority: parsed.priority,
            prefixType: parsed.type === 'chat' ? 'character' : 
                       parsed.type === 'project-proposal' ? 'project-proposal' :
                       parsed.type === 'project-command' ? 'project-command' : 'none',
            prefix: parsed.prefix,
          }
          
          // 企画提案の場合
          if (parsed.type === 'project-proposal' && !isProcessingComment) {
            const project = projectManager.findProjectByProposalPrefix(parsed.prefix)
            if (project) {
              console.log('[youtubeComments] 企画提案を処理:', project.id, listenerName)
              await handleProjectProposal(project, listenerName, parsed.message)
              continue
            }
          }
          
          // 企画コマンドの場合（企画実行中のみ）
          if (parsed.type === 'project-command' && projectState === 'projectRunning') {
            const project = projectManager.findProjectByCommandPrefix(parsed.prefix)
            if (project) {
              console.log('[youtubeComments] 企画コマンドを処理:', project.id, listenerName, parsed.prefix)
              // キューに追加（企画実行中はキューで管理）
              enqueueCommentByMode(queuedComment)
              continue
            }
          }
          
          // モード別のルールに従ってキューに追加または破棄
          const enqueued = enqueueCommentByMode(queuedComment)
          
          if (enqueued) {
            console.log('[youtubeComments] コメントをキューに追加:', {
              userName: listenerName,
              comment: ytComment.userComment.substring(0, 50),
              type: parsed.type,
              priority: parsed.priority
            })
          } else {
            console.log('[youtubeComments] コメントを破棄（モード別ルール）:', {
              userName: listenerName,
              comment: ytComment.userComment.substring(0, 50),
              type: parsed.type,
              currentMode,
              projectState
            })
          }
        }
        
        // 対応受付中モードの場合、キューから処理
        if (!isProcessingComment) {
          console.log('[youtubeComments] 対応受付中モード: キューから処理を開始')
          
          // キューが空になるまで処理
          let processedCount = 0
          const maxProcessPerCycle = 10 // 1回のサイクルで処理する最大数（無限ループ防止）
          
          while (processedCount < maxProcessPerCycle) {
            const nextComment = processNextCommentFromQueue()
            
            if (!nextComment) {
              console.log('[youtubeComments] キューが空になりました')
              break
            }
            
            console.log('[youtubeComments] キューからコメントを処理:', {
              userName: nextComment.userName,
              comment: nextComment.comment.substring(0, 50),
              type: nextComment.prefixType,
              priority: nextComment.priority
            })
            
            // メッセージが空の場合はスキップ
            if (!nextComment.message || nextComment.message.trim() === '') {
              console.log('[youtubeComments] メッセージが空のためスキップします')
              processedCount++
              continue
            }
            
            // 企画コマンドの場合
            if (nextComment.prefixType === 'project-command') {
              const project = projectManager.findProjectByCommandPrefix(nextComment.prefix)
              if (project && project.onCommand) {
                await project.onCommand(nextComment.userName, nextComment.prefix, nextComment.message)
                processedCount++
                continue
              }
            }
            
            // 通常のコメントの場合
            // handleSendChatにYouTubeコメント情報を渡す
            await handleSendChat(nextComment.message, nextComment.characterId, {
              isYouTubeComment: true,
              listenerName: nextComment.userName
            })
            
            processedCount++
            
            // 処理開始後はループを抜ける（次のサイクルで続きを処理）
            break
          }
        } else {
          console.log('[youtubeComments] 対応中モード: コメントはキューに追加済み、処理は後で実行されます')
        }
    } else {
      console.log('[youtubeComments] コメントが取得できませんでした（コメント数: 0）')
      const noCommentCount = ss.youtubeNoCommentCount + 1
        if (ss.conversationContinuityMode) {
          if (
            noCommentCount < 3 ||
            (3 < noCommentCount && noCommentCount < 6)
          ) {
            // 会話の続きを生成
            const continuationMessage = await getMessagesForContinuation(
              ss.systemPrompt,
              chatLog
            )
            processAIResponse(continuationMessage)
          } else if (noCommentCount === 3) {
            // 新しいトピックを生成
            const anotherTopic = await getAnotherTopic(chatLog)
            console.log('anotherTopic:', anotherTopic)
            const newTopicMessage = await getMessagesForNewTopic(
              ss.systemPrompt,
              chatLog,
              anotherTopic
            )
            processAIResponse(newTopicMessage)
          } else if (noCommentCount === 6) {
            // スリープモードにする
            const messagesForSleep = await getMessagesForSleep(
              ss.systemPrompt,
              chatLog
            )
            processAIResponse(messagesForSleep)
            settingsStore.setState({ youtubeSleepMode: true })
          }
        }
        console.log('YoutubeNoCommentCount:', noCommentCount)
        settingsStore.setState({ youtubeNoCommentCount: noCommentCount })
      }
    } else {
      console.warn('[youtubeComments] liveChatIdが取得できませんでした（配信が開始されていない、またはAPIエラーの可能性があります）')
    }
  } catch (error) {
    console.error('[youtubeComments] fetchAndProcessComments エラー:', error)
    if (error instanceof Error) {
      console.error('[youtubeComments] エラー詳細:', {
        message: error.message,
        stack: error.stack
      })
    }
  }
}
