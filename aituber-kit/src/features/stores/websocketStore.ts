import { create } from 'zustand'
import { WebSocketManager } from '@/utils/WebSocketManager'
import { TmpMessage } from '@/components/realtimeAPIUtils'
import settingsStore from '@/features/stores/settings'

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
  initializeWebSocket: (t, handlers = {}, connectWebsocket) => {
    // python から取得した設定
    const { wsUrlA, wsUrlB, wsUrlAB } = settingsStore.getState()
    const { appMode } = settingsStore.getState() // A / B / AB どれで起動したか

    let targetUrl = ""
    if (appMode === "A") targetUrl = wsUrlA
    else if (appMode === "B") targetUrl = wsUrlB
    else if (appMode === "AB") targetUrl = wsUrlAB

    const connectFn = () => new WebSocket(targetUrl)

    const defaultHandlers = {
      onOpen: (event: Event) => { },
      onMessage: async (event: MessageEvent) => { },
      onError: (event: Event) => { },
      onClose: (event: Event) => { },
      ...handlers,
    }

    const manager = new WebSocketManager(t, defaultHandlers, connectFn)
    manager.connect()
    set({ wsManager: manager })
  },
  disconnect: () => {
    const { wsManager } = get()
    wsManager?.disconnect()
    set({ wsManager: null })
  },
  reconnect: () => {
    const { wsManager } = get()
    return wsManager ? wsManager.reconnect() : false
  },
}))

export default webSocketStore
