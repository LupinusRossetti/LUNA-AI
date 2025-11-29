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
 * コメントの接頭辞を判定して、キャラクターIDとメッセージを返す
 * @param comment コメントテキスト
 * @returns { characterId: 'A' | 'B' | undefined, message: string } キャラクターIDと接頭辞を除去したメッセージ
 */
const parseCommentPrefix = (comment: string): { characterId: 'A' | 'B' | undefined, message: string } => {
  // 全角を半角に変換（I, R, F）
  const normalizedComment = comment.replace(/[ＩＲＦ]/g, (char) => {
    if (char === 'Ｉ') return 'I'
    if (char === 'Ｒ') return 'R'
    if (char === 'Ｆ') return 'F'
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
  
  // キャラクターAのプレフィックスで始まる場合
  if (upperComment.startsWith(characterAPrefix)) {
    const afterPrefix = trimmedComment.substring(characterAPrefix.length)
    const message = afterPrefix.replace(/^[\s\u3000]+/, '').trim()
    return { characterId: 'A', message }
  }
  
  // キャラクターBのプレフィックスで始まる場合
  if (upperComment.startsWith(characterBPrefix)) {
    const afterPrefix = trimmedComment.substring(characterBPrefix.length)
    const message = afterPrefix.replace(/^[\s\u3000]+/, '').trim()
    return { characterId: 'B', message }
  }
  
  // 接頭辞がない場合
  return { characterId: undefined, message: normalizedComment }
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
      // ランダムなコメントを選択して送信
      if (youtubeComments.length > 0) {
        settingsStore.setState({ youtubeNoCommentCount: 0 })
        settingsStore.setState({ youtubeSleepMode: false })
        
        // IR/FI接頭辞を持つコメントを優先的に選択
        const commentsWithPrefix = youtubeComments.filter(c => {
          const { characterId } = parseCommentPrefix(c.userComment)
          return characterId !== undefined
        })
        
        console.log('[youtubeComments] 接頭辞を持つコメント数:', commentsWithPrefix.length)
        if (commentsWithPrefix.length > 0) {
          console.log('[youtubeComments] 接頭辞を持つコメント例:', commentsWithPrefix.slice(0, 3).map(c => ({
            userName: c.userName,
            comment: c.userComment.substring(0, 50),
            parsed: parseCommentPrefix(c.userComment)
          })))
        }
        
        let selectedComment = ''
        let selectedCommentObj: YouTubeComment | undefined
        
        // 接頭辞を持つコメントがある場合は、その中から選択
        if (commentsWithPrefix.length > 0) {
          if (ss.conversationContinuityMode) {
            selectedComment = await getBestComment(chatLog, commentsWithPrefix)
          } else {
            selectedComment =
              commentsWithPrefix[Math.floor(Math.random() * commentsWithPrefix.length)]
                .userComment
          }
          selectedCommentObj = commentsWithPrefix.find(c => c.userComment === selectedComment)
        } else {
          // 接頭辞がないコメントは無視（通常モードではIR/FIのみ反応）
          console.log('[youtubeComments] IR/FI接頭辞がないコメントは無視されます')
          console.log('[youtubeComments] 取得したコメント（接頭辞なし）:', youtubeComments.slice(0, 5).map(c => ({
            userName: c.userName,
            comment: c.userComment.substring(0, 50)
          })))
          settingsStore.setState({ youtubeNoCommentCount: ss.youtubeNoCommentCount + 1 })
          return
        }
        
        console.log('selectedYoutubeComment:', selectedComment)
        
        // 選択されたコメントのリスナー名を取得
        const listenerName = selectedCommentObj?.userName || '不明なリスナー'
        
        // 接頭辞を解析
        const { characterId, message } = parseCommentPrefix(selectedComment)
        
        console.log('[youtubeComments] コメント解析結果:', {
          listenerName,
          originalComment: selectedComment.substring(0, 50),
          characterId,
          message: message.substring(0, 50)
        })
        
        // メッセージが空の場合は無視
        if (!message || message.trim() === '') {
          console.log('[youtubeComments] メッセージが空のため無視します')
          return
        }

        // handleSendChatにYouTubeコメント情報を渡す
        if (typeof handleSendChat === 'function') {
          // characterIdとoptionsを指定して送信
          await handleSendChat(message, characterId, {
            isYouTubeComment: true,
            listenerName: listenerName
          })
        } else {
          // handleSendChatが関数でない場合（非同期関数など）
          await handleSendChat(message, characterId, {
            isYouTubeComment: true,
            listenerName: listenerName
          })
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
