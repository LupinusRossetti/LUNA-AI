import { useEffect, useState, useCallback } from 'react'
import { useTranslation } from 'react-i18next'

import homeStore from '@/features/stores/home'
import settingsStore from '@/features/stores/settings'
import webSocketStore from '@/features/stores/websocketStore'
import { EmotionType } from '@/features/messages/messages'

interface TmpMessage {
  text: string
  role: string
  emotion: EmotionType
  type: string
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
  const [receivedMessages, setTmpMessages] = useState<TmpMessage[]>([])

  const processMessage = useCallback(
    async (message: TmpMessage) => {
      await handleReceiveTextFromWs(
        message.text,
        message.role,
        message.emotion,
        message.type
      )
    },
    [handleReceiveTextFromWs]
  )

  // -----------------------------
  // 受信メッセージ処理
  // -----------------------------
  useEffect(() => {
    if (receivedMessages.length > 0) {
      const message = receivedMessages[0]
      if (
        message.role === 'output' ||
        message.role === 'executing' ||
        message.role === 'console'
      ) {
        message.role = 'code'
      }
      setTmpMessages((prev) => prev.slice(1))
      processMessage(message)
    }
  }, [receivedMessages, processMessage])

  // -----------------------------
  // WebSocket 接続部分
  // -----------------------------
  useEffect(() => {
    const ss = settingsStore.getState()
    if (!ss.externalLinkageMode) return

    const handleOpen = (_event: Event) => {}
    const handleMessage = async (event: MessageEvent) => {
      try {
        const jsonData = JSON.parse(event.data)
        setTmpMessages((prevMessages) => [...prevMessages, jsonData])
      } catch (err) {
        console.error("[WS] JSON parse error", err)
      }
    }
    const handleError = (event: Event) => {
      console.error("[WS ERROR]", event)
    }
    const handleClose = (event: Event) => {
      console.warn("[WS CLOSED]", event)
    }

    const handlers = {
      onOpen: handleOpen,
      onMessage: handleMessage,
      onError: handleError,
      onClose: handleClose,
    }

    // ---- Next.js の APP_MODE を参照 ----
    const envMode = process.env.APP_MODE?.toUpperCase() || "A"

    function connectWebsocket() {
      const ss = settingsStore.getState()
      const { wsUrlA, wsUrlB, wsUrlAB } = ss

      let target = ""

      if (envMode === "A") target = wsUrlA
      else if (envMode === "B") target = wsUrlB
      else target = wsUrlAB

      console.log("[WebSocket] Connect to:", target)
      return new WebSocket(target)
    }

    // ★ initializeWebSocket() のたびに最新の wsManager を取得
    const wsManager = webSocketStore.getState().wsManager

    webSocketStore.getState().initializeWebSocket(t, handlers, connectWebsocket)

    // 自動再接続
    const reconnectInterval = setInterval(() => {
      const st = settingsStore.getState()
      const manager = webSocketStore.getState().wsManager

      if (
        st.externalLinkageMode &&
        manager?.websocket &&
        manager.websocket.readyState !== WebSocket.OPEN &&
        manager.websocket.readyState !== WebSocket.CONNECTING
      ) {
        console.log("[WebSocket] try reconnecting...")
        homeStore.setState({ chatProcessing: false })
        manager.disconnect()
        webSocketStore
          .getState()
          .initializeWebSocket(t, handlers, connectWebsocket)
      }
    }, 2000)

    return () => {
      clearInterval(reconnectInterval)
      webSocketStore.getState().disconnect()
    }
  }, [externalLinkageMode, t])

  return null
}

export default useExternalLinkage
