// =============================================================
// useExternalLinkage.tsx (完全最終版 / 妹ちゃんの甘やかし仕様♡)
// =============================================================
import { useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'

import settingsStore from '@/features/stores/settings'
import webSocketStore from '@/features/stores/websocketStore'
import { EmotionType } from '@/features/messages/messages'
import { setExternalWs } from '@/features/messages/speakQueue'

// -------------------------------------------------------------
// WebSocket から受け取るメッセージ形式
// -------------------------------------------------------------
interface TmpMessage {
  text?: string
  role?: string
  emotion?: EmotionType
  type?: string
  target?: string
  turnId?: number
  log?: boolean
}

interface Params {
  handleReceiveTextFromWs: (
    text: string,
    role?: string,
    emotion?: EmotionType,
    type?: string,
    turnId?: number,
    target?: string
  ) => Promise<void>
}

// =============================================================
// メイン Hook
// =============================================================
const useExternalLinkage = ({ handleReceiveTextFromWs }: Params) => {
  const { t } = useTranslation()
  const externalLinkageMode = settingsStore((s) => s.externalLinkageMode)

  const queueRef = useRef<TmpMessage[]>([])
  const isProcessing = useRef(false)
  const lastReconnect = useRef(0)

  // ============================================================
  // キューを安全に処理するよ…♡
  // ============================================================
  const processQueue = async () => {
    if (isProcessing.current) return
    isProcessing.current = true

    while (queueRef.current.length > 0) {
      const msg = queueRef.current.shift()
      if (!msg) continue

      // コード系 role を AItuberKit 用に変換
      if (msg.role === 'output' || msg.role === 'executing' || msg.role === 'console') {
        msg.role = 'code'
      }

      await handleReceiveTextFromWs(
        msg.text ?? '',
        msg.role,
        msg.emotion,
        msg.type,
        msg.turnId,
        msg.target
      )
    }

    isProcessing.current = false
  }

  // ============================================================
  // メッセージ受信時の処理だよ
  // ============================================================
  const handleMessage = async (event: MessageEvent) => {
    try {
      const json: TmpMessage = JSON.parse(event.data)

      const appId = process.env.NEXT_PUBLIC_APP_ID
      const type = json.type

      // XML タグ除去（A<emotion>とか全部消しちゃうね…♡）
      if (type === 'message' && json.text) {
        json.text = json.text.replace(/<[^>]+>/g, '')
      }

      // ---------------------------------------------------------
      // ログ（start, message, end）は全タブへ
      // それ以外（speech）は target のタブだけが処理
      // ---------------------------------------------------------
      const isLogEvent =
        type === 'start' ||
        type === 'message' ||
        type === 'end'

      // meta から turnId / target を取り出す（Python側の仕様に合わせる）
      const meta = (json as any).meta || {};
      const turnId = json.turnId ?? meta.turnId;
      const target = json.target ?? meta.character; // Python側は meta.character に入れている場合もある

      // target がトップレベルにない場合は meta から補完
      if (!json.target && target) {
        json.target = target;
      }
      // turnId も同様
      if (json.turnId === undefined && turnId !== undefined) {
        json.turnId = turnId;
      }

      if (!isLogEvent) {
        if (json.target && appId && json.target !== appId) {
          return  // ← 他の子の音声は無視！
        }
      }

      queueRef.current.push(json)
      processQueue()

    } catch {
      console.log('[WS] non-JSON:', event.data)
    }
  }

  // ============================================================
  // WebSocket 初期化処理だよ…♡
  // ============================================================
  useEffect(() => {
    const ss = settingsStore.getState()
    if (!ss.externalLinkageMode) return

    // 多重初期化防止
    const wsState = webSocketStore.getState()
    if (wsState.wsManager) {
      console.log('[useExternalLinkage] WS already exists → skip')
      return
    }

    const handlers = {
      onOpen: () => console.log('[WS] connected'),
      onMessage: handleMessage,
      onError: () => { },
      onClose: () => { }
    }

    // ---------------------------------------------------------
    // WebSocket の接続 URL を作るよ
    // ---------------------------------------------------------
    const connectWebsocket = () => {
      const wsUrl = process.env.NEXT_PUBLIC_EXTERNAL_WS_URL
      const mode = process.env.NEXT_PUBLIC_APP_MODE
      const appId = process.env.NEXT_PUBLIC_APP_ID

      if (!wsUrl || !mode || !appId) {
        console.error("❌ Missing env:", { wsUrl, mode, appId })
        return null
      }

      let wsPath = ""

      if (mode === "AB") {
        wsPath = process.env.NEXT_PUBLIC_WS_PATH_AB ?? ""
      } else {
        if (mode === "A" && appId === "A") {
          wsPath = process.env.NEXT_PUBLIC_WS_PATH_A ?? ""
        } else if (mode === "B" && appId === "B") {
          wsPath = process.env.NEXT_PUBLIC_WS_PATH_B ?? ""
        } else {
          console.error("❌ Invalid mode/appId combination:", { mode, appId })
          return null
        }
      }

      if (!wsPath) {
        console.error("❌ wsPath is empty")
        return null
      }

      const url = `${wsUrl.replace(/\/$/, "")}/${wsPath}`
      console.log("[connectWebsocket] →", url)

      try {
        const ws = new WebSocket(url)
        setExternalWs(ws)
        return ws
      } catch (e) {
        console.error("❌ WebSocket init error:", e)
        return null
      }
    }

    // 初回接続
    webSocketStore.getState().initializeWebSocket(t, handlers, connectWebsocket)

    // ---------------------------------------------------------
    // 再接続ロジック（ふぇぇ…暴走しないように優しくするね）
    // ---------------------------------------------------------
    const interval = setInterval(() => {
      const ss = settingsStore.getState()
      const wsManager = webSocketStore.getState().wsManager

      if (
        ss.externalLinkageMode &&
        wsManager?.websocket &&
        wsManager.websocket.readyState !== WebSocket.OPEN &&
        wsManager.websocket.readyState !== WebSocket.CONNECTING
      ) {
        const now = Date.now()
        if (now - lastReconnect.current < 3000) return

        lastReconnect.current = now
        console.log('[WS] reconnecting...')

        webSocketStore.getState().disconnect()
        webSocketStore.getState().initializeWebSocket(t, handlers, connectWebsocket)
      }
    }, 1000)

    return () => {
      clearInterval(interval)
      webSocketStore.getState().disconnect()
    }
  }, [externalLinkageMode, t, handleReceiveTextFromWs])

  return null
}

export default useExternalLinkage
