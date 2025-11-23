// ============================================================
// websocketStore.ts  ← 重複接続完全防止版
// ============================================================

import { create } from 'zustand'
import { WebSocketManager } from '@/utils/WebSocketManager'

interface WebSocketState {
  wsManager: WebSocketManager | null
  initializeWebSocket: (
    t: (key: string, options?: any) => string,
    handlers: {
      onOpen?: (event: Event) => void
      onMessage?: (event: MessageEvent) => Promise<void>
      onError?: (event: Event) => void
      onClose?: (event: Event) => void
    },
    connectWebsocket: () => WebSocket | null
  ) => void
  disconnect: () => void
  reconnect: () => boolean
}

const webSocketStore = create<WebSocketState>((set, get) => ({
  wsManager: null,

  // -----------------------------------------
  // WebSocket 初期化（重複接続を完全に禁止）
  // -----------------------------------------
  initializeWebSocket: (t, handlers = {}, connectWebsocket) => {
    const existing = get().wsManager
    if (existing) {
      console.warn("[WS] initializeWebSocket → SKIP（既に接続中です）")
      return
    }

    const defaultHandlers = {
      onOpen: handlers.onOpen || (() => {}),
      onMessage: handlers.onMessage || (async () => {}),
      onError: handlers.onError || (() => {}),
      onClose: handlers.onClose || (() => {}),
    }

    const manager = new WebSocketManager(
      t,
      defaultHandlers,
      connectWebsocket
    )

    manager.connect()
    set({ wsManager: manager })
  },

  // -----------------------------------------
  // 切断
  // -----------------------------------------
  disconnect: () => {
    const { wsManager } = get()
    wsManager?.disconnect()
    set({ wsManager: null })
  },

  // -----------------------------------------
  // 再接続
  // -----------------------------------------
  reconnect: () => {
    const { wsManager } = get()
    return wsManager ? wsManager.reconnect() : false
  },
}))

export default webSocketStore
