import { FC } from 'react'
import useExternalLinkage from './useExternalLinkage'
import useRealtimeAPI from './useRealtimeAPI'
import {
  handleReceiveTextFromWsFn,
  handleReceiveTextFromRtFn,
} from '@/features/chat/handlers'

export const WebSocketManager: FC = () => {
  // ハンドラー関数だけ作る
  const handleReceiveTextFromWs = handleReceiveTextFromWsFn()
  const handleReceiveTextFromRt = handleReceiveTextFromRtFn()

  // 外部連携（Python → AItuberKit）
  useExternalLinkage({ handleReceiveTextFromWs })

  // RealtimeAPI（OpenAI/azure）
  useRealtimeAPI({ handleReceiveTextFromRt })

  return null
}
