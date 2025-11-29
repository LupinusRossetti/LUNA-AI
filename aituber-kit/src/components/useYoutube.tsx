import { useCallback, useEffect, useRef } from 'react'
import homeStore from '@/features/stores/home'
import settingsStore from '@/features/stores/settings'
import { fetchAndProcessComments } from '@/features/youtube/youtubeComments'
import { processNextCommentFromQueue } from '@/features/youtube/commentQueue'
import { commentQueueStore } from '@/features/stores/commentQueueStore'

const INTERVAL_MILL_SECONDS_RETRIEVING_COMMENTS = 10000 // 10秒

interface Params {
  handleSendChat: (text: string, characterId?: 'A' | 'B', options?: { isYouTubeComment?: boolean, listenerName?: string }) => Promise<void>
}

const useYoutube = ({ handleSendChat }: Params) => {
  const youtubePlaying = settingsStore((s) => s.youtubePlaying)
  const youtubeMode = settingsStore((s) => s.youtubeMode)

  // 初期化時のログ
  useEffect(() => {
    const ss = settingsStore.getState()
    console.log('[useYoutube] 初期化:', {
      youtubeMode: ss.youtubeMode,
      youtubePlaying: ss.youtubePlaying,
      youtubeLiveId: ss.youtubeLiveId ? `${ss.youtubeLiveId.substring(0, 10)}...` : 'なし',
      youtubeApiKey: ss.youtubeApiKey ? '設定済み' : 'なし'
    })
    
    if (ss.youtubeMode && !ss.youtubePlaying) {
      console.warn('[useYoutube] ⚠️ YouTubeモードは有効ですが、youtubePlayingがfalseです。')
      console.warn('[useYoutube] ⚠️ メニューのYouTube再生ボタンをクリックして有効にしてください。')
    }
  }, [])

  // キュー処理中のフラグ（無限ループ防止）
  const isProcessingQueueRef = useRef(false)

  const fetchAndProcessCommentsCallback = useCallback(async () => {
    const ss = settingsStore.getState()
    const hs = homeStore.getState()

    console.log('[useYoutube] fetchAndProcessCommentsCallback 呼び出し')
    console.log('[useYoutube] 条件チェック:', {
      youtubeLiveId: ss.youtubeLiveId ? 'あり' : 'なし',
      youtubeApiKey: ss.youtubeApiKey ? 'あり' : 'なし',
      chatProcessing: hs.chatProcessing,
      chatProcessingCount: hs.chatProcessingCount,
      youtubeMode: ss.youtubeMode,
      youtubePlaying: ss.youtubePlaying
    })

    if (
      !ss.youtubeLiveId ||
      !ss.youtubeApiKey ||
      !ss.youtubeMode ||
      !ss.youtubePlaying
    ) {
      console.log('[useYoutube] 条件を満たさないため、コメント取得をスキップ')
      return
    }

    // 対応中モードの判定
    const isProcessingComment = hs.chatProcessing || hs.chatProcessingCount > 0

    // 対応受付中モードの場合、キューから処理
    if (!isProcessingComment && !isProcessingQueueRef.current) {
      const { commentQueue, projectQueue } = commentQueueStore.getState()
      
      if (commentQueue.length > 0 || projectQueue.length > 0) {
        console.log('[useYoutube] 対応受付中モード: キューから処理を開始', {
          commentQueueLength: commentQueue.length,
          projectQueueLength: projectQueue.length
        })
        
        isProcessingQueueRef.current = true
        
        try {
          // キューが空になるまで処理
          let processedCount = 0
          const maxProcessPerCycle = 10 // 1回のサイクルで処理する最大数
          
          while (processedCount < maxProcessPerCycle) {
            const nextComment = processNextCommentFromQueue()
            
            if (!nextComment) {
              console.log('[useYoutube] キューが空になりました')
              break
            }
            
            console.log('[useYoutube] キューからコメントを処理:', {
              userName: nextComment.userName,
              comment: nextComment.comment.substring(0, 50),
              type: nextComment.prefixType,
              priority: nextComment.priority
            })
            
            // メッセージが空の場合はスキップ
            if (!nextComment.message || nextComment.message.trim() === '') {
              console.log('[useYoutube] メッセージが空のためスキップします')
              processedCount++
              continue
            }
            
            // handleSendChatにYouTubeコメント情報を渡す
            await handleSendChat(nextComment.message, nextComment.characterId, {
              isYouTubeComment: true,
              listenerName: nextComment.userName
            })
            
            processedCount++
            
            // 処理開始後はループを抜ける（次のサイクルで続きを処理）
            break
          }
        } finally {
          isProcessingQueueRef.current = false
        }
        
        // キューから処理した場合は、新しいコメント取得はスキップ（次のサイクルで）
        return
      }
    }

    // 対応中モードの場合は、新しいコメント取得をスキップ
    if (isProcessingComment) {
      console.log('[useYoutube] 対応中モードのため、コメント取得をスキップ')
      return
    }

    console.log('[useYoutube] fetchAndProcessComments を呼び出します')
    await fetchAndProcessComments(handleSendChat)
  }, [handleSendChat])

  useEffect(() => {
    console.log('[useYoutube] useEffect 実行:', {
      youtubePlaying,
      youtubeMode
    })
    
    if (!youtubePlaying) {
      console.log('[useYoutube] youtubePlayingがfalseのため、コメント取得を開始しません')
      console.log('[useYoutube] メニューのYouTube再生ボタンをクリックして有効にしてください')
      return
    }
    
    console.log('[useYoutube] コメント取得を開始します（初回実行）')
    fetchAndProcessCommentsCallback()

    console.log('[useYoutube] インターバルを設定します（10秒ごと）')
    const intervalId = setInterval(() => {
      fetchAndProcessCommentsCallback()
    }, INTERVAL_MILL_SECONDS_RETRIEVING_COMMENTS)

    return () => {
      console.log('[useYoutube] インターバルをクリアします')
      clearInterval(intervalId)
    }
  }, [youtubePlaying, fetchAndProcessCommentsCallback])
}

export default useYoutube
