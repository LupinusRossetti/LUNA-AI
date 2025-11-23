import { useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'

import settingsStore from '@/features/stores/settings'
import webSocketStore from '@/features/stores/websocketStore'
import { EmotionType } from '@/features/messages/messages'

interface TmpMessage {
  text: string
  role: string
  emotion?: EmotionType
  type?: string
}

interface Params {
  handleReceiveTextFromWs: (
    text: string,
    role?: string,
    emotion?: EmotionType,
    type?: string
  ) => Promise<void>
}

const useExternalLinkage = ({ handleReceiveTextFromWs }: Params) => {
  const { t } = useTranslation()
  const externalLinkageMode = settingsStore((s) => s.externalLinkageMode)

  // Queue
  const queueRef = useRef<TmpMessage[]>([])
  const isProcessing = useRef(false)

  const processQueue = async () => {
    if (isProcessing.current) return
    isProcessing.current = true

    while (queueRef.current.length > 0) {
      const msg = queueRef.current.shift()
      if (!msg) continue

      if (
        msg.role === 'output' ||
        msg.role === 'executing' ||
        msg.role === 'console'
      ) {
        msg.role = 'code'
      }

      await handleReceiveTextFromWs(
        msg.text,
        msg.role,
        msg.emotion,
        msg.type
      )
    }

    isProcessing.current = false
  }

  const handleMessage = async (event: MessageEvent) => {
    try {
      const json = JSON.parse(event.data)
      queueRef.current.push(json)
      processQueue()
    } catch (e) {
      console.log("[WS] non-JSON:", event.data)
    }
  }

  useEffect(() => {
    const ss = settingsStore.getState()
    if (!ss.externalLinkageMode) return

    // ★★★ 多重初期化を完全禁止 ★★★
    const wsState = webSocketStore.getState()
    if (wsState.wsManager) {
      console.log("[useExternalLinkage] active WS exists → init SKIP")
      return
    }

    const handleOpen = () => {
      console.log("[WS] connected")
    }

    const handlers = {
      onOpen: handleOpen,
      onMessage: handleMessage,
      onError: () => {},
      onClose: () => {},
    }

    function connectWebsocket() {
      const winEnv = (window as any).__env ?? {}
      const wsUrl  = winEnv.NEXT_PUBLIC_EXTERNAL_WS_URL
      const wsPath = winEnv.NEXT_PUBLIC_EXTERNAL_WS_PATH

      const url = `${wsUrl.replace(/\/$/, "")}/${wsPath}`
      console.log("[connectWebsocket] →", url)

      return new WebSocket(url)
    }

    // 初期化（1回だけ）
    webSocketStore.getState().initializeWebSocket(t, handlers, connectWebsocket)

    // 定期再接続監視
    const interval = setInterval(() => {
      const state = webSocketStore.getState()
      const wsManager = state.wsManager

      if (
        ss.externalLinkageMode &&
        wsManager?.websocket &&
        wsManager.websocket.readyState !== WebSocket.OPEN &&
        wsManager.websocket.readyState !== WebSocket.CONNECTING
      ) {
        console.log("[WS] reconnecting...")
        state.disconnect()
        state.initializeWebSocket(t, handlers, connectWebsocket)
      }
    }, 2000)

    return () => {
      clearInterval(interval)
      webSocketStore.getState().disconnect()
    }
  }, [externalLinkageMode, t, handleReceiveTextFromWs])

  return null
}

export default useExternalLinkage
