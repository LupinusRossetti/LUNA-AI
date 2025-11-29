import { useCallback, useEffect } from 'react'
import homeStore from '@/features/stores/home'
import settingsStore from '@/features/stores/settings'
import { fetchAndProcessComments } from '@/features/youtube/youtubeComments'

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
      hs.chatProcessing ||
      hs.chatProcessingCount > 0 ||
      !ss.youtubeMode ||
      !ss.youtubePlaying
    ) {
      console.log('[useYoutube] 条件を満たさないため、コメント取得をスキップ')
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
