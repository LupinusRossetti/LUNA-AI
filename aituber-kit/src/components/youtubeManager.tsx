import { FC, useEffect } from 'react'
import useYoutube from './useYoutube'
import { handleSendChatFn } from '@/features/chat/handlers'
import settingsStore from '@/features/stores/settings'

export const YoutubeManager: FC = () => {
  const handleSendChat = handleSendChatFn()

  useEffect(() => {
    const ss = settingsStore.getState()
    console.log('[YoutubeManager] コンポーネントマウント:', {
      youtubeMode: ss.youtubeMode,
      youtubePlaying: ss.youtubePlaying,
      youtubeLiveId: ss.youtubeLiveId ? `${ss.youtubeLiveId.substring(0, 10)}...` : 'なし',
      youtubeApiKey: ss.youtubeApiKey ? '設定済み' : 'なし'
    })
  }, [])

  useYoutube({ handleSendChat })

  return null
}
