// ============================================================
// WebSocketManager.ts (完全修正版 / window.__ws 安定保証)
// ============================================================

import toastStore from '@/features/stores/toast'
import settingsStore from '@/features/stores/settings'

type TranslationFunction = (key: string, options?: any) => string

export class WebSocketManager {
  private ws: WebSocket | null = null
  private t: TranslationFunction
  private isTextBlockStarted: boolean = false

  private handlers: {
    onOpen: (event: Event) => void
    onMessage: (event: MessageEvent) => Promise<void>
    onError: (event: Event) => void
    onClose: (event: Event) => void
  }

  private connectWebsocket: () => WebSocket | null

  constructor(
    t: TranslationFunction,
    handlers: {
      onOpen: (event: Event) => void
      onMessage: (event: MessageEvent) => Promise<void>
      onError: (event: Event) => void
      onClose: (event: Event) => void
    },
    connectWebsocket: () => WebSocket | null
  ) {
    this.t = t
    this.handlers = handlers
    this.connectWebsocket = connectWebsocket
  }

  // ============================================================
  // WebSocket OPEN
  // ============================================================
  private handleOpen = (event: Event) => {
    console.log('WebSocket connection opened:', event)

    // ------------------------------------------------------------
    // ★ create() の後ではなく open イベント発火時に必ず登録する
    // ------------------------------------------------------------
    if (this.ws) {
      (window as any).__ws = this.ws
    } else {
      console.warn('⚠ window.__ws 代入失敗（ws == null）')
    }

    this.removeToast()
    toastStore.getState().addToast({
      message: this.t('Toasts.WebSocketConnectionSuccess'),
      type: 'success',
      duration: 3000,
      tag: 'websocket-connection-success',
    })

    this.handlers.onOpen(event)
  }

  // ============================================================
  private handleMessage = async (event: MessageEvent) => {
    console.log('WebSocket received message:', event)
    await this.handlers.onMessage(event)
  }

  private handleError = (event: Event) => {
    console.error('WebSocket error:', event)
    this.removeToast()
    toastStore.getState().addToast({
      message: this.t('Toasts.WebSocketConnectionError'),
      type: 'error',
      duration: 5000,
      tag: 'websocket-connection-error',
    })
    this.handlers.onError(event)
  }

  private handleClose = (event: Event) => {
    console.log('WebSocket connection closed:', event)
    this.removeToast()
    toastStore.getState().addToast({
      message: this.t('Toasts.WebSocketConnectionClosed'),
      type: 'error',
      duration: 3000,
      tag: 'websocket-connection-close',
    })
    this.handlers.onClose(event)
  }

  // ============================================================
  // WebSocket CONNECT
  // ============================================================
  public connect() {
    this.removeToast()

    toastStore.getState().addToast({
      message: this.t('Toasts.WebSocketConnectionAttempt'),
      type: 'info',
      duration: 10000,
      tag: 'websocket-connection-info',
    })

    // 新しく生成
    const newWs = this.connectWebsocket()
    this.ws = newWs

    if (!newWs) {
      console.error('❌ connectWebsocket() が null を返しました')
      return
    }

    // ------------------------------------------------------------
    // ★ open が来る前にも window.__ws を仮登録（予備）
    // ------------------------------------------------------------
    ;(window as any).__ws = newWs

    newWs.addEventListener('open', this.handleOpen)
    newWs.addEventListener('message', this.handleMessage)
    newWs.addEventListener('error', this.handleError)
    newWs.addEventListener('close', this.handleClose)
  }

  // ============================================================
  public removeToast() {
    toastStore.getState().removeToast('websocket-connection-error')
    toastStore.getState().removeToast('websocket-connection-success')
    toastStore.getState().removeToast('websocket-connection-close')
    toastStore.getState().removeToast('websocket-connection-info')
  }

  public disconnect() {
    if (this.ws) {
      this.ws.close()
    }
  }

  public get websocket(): WebSocket | null {
    return this.ws
  }

  public get textBlockStarted(): boolean {
    return this.isTextBlockStarted
  }

  setTextBlockStarted(value: boolean) {
    this.isTextBlockStarted = value
  }

  public reconnect(): boolean {
    const ss = settingsStore.getState()
    if (!ss.realtimeAPIMode || !ss.selectAIService) return false

    this.disconnect()
    this.connect()
    return true
  }

  public isConnected(): boolean {
    return this.ws !== null && this.ws.readyState === WebSocket.OPEN
  }
}
