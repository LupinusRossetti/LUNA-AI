// ============================================================
// WebSocketManager.ts（外部連携最終版 / window.__ws 完全削除）
// ============================================================

import toastStore from '@/features/stores/toast'
import settingsStore from '@/features/stores/settings'

type TranslationFunction = (key: string, options?: any) => string

export class WebSocketManager {
  private ws: WebSocket | null = null
  private t: TranslationFunction

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
    console.log('[WS] opened:', event)

    this.removeToast()
    toastStore.getState().addToast({
      message: this.t('Toasts.WebSocketConnectionSuccess'),
      type: 'success',
      duration: 3000,
      tag: 'websocket-connection-success',
    })

    this.handlers.onOpen(event)
  }

  private handleMessage = async (event: MessageEvent) => {
    await this.handlers.onMessage(event)
  }

  private handleError = (event: Event) => {
    console.error('[WS] error:', event)

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
    console.log('[WS] closed:', event)

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
  // CONNECT（多重接続防止）
  // ============================================================
  public connect() {
    // すでに OPEN or CONNECTING なら再接続しない
    if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) {
      console.log('[WS] already connected/connecting → skip')
      return
    }

    this.removeToast()

    toastStore.getState().addToast({
      message: this.t('Toasts.WebSocketConnectionAttempt'),
      type: 'info',
      duration: 10000,
      tag: 'websocket-connection-info',
    })

    // ---------------------------
    // 新しい WebSocket を生成
    // ---------------------------
    const newWs = this.connectWebsocket()
    if (!newWs) {
      console.error('❌ connectWebsocket() returned null')
      return
    }

    this.ws = newWs

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
      console.log('[WS] disconnect')
      this.ws.close()
    }
  }

  // ============================================================
  // RECONNECT（AItuberKit仕様に合わせた安全な再接続）
  // ============================================================
  public reconnect(): boolean {
    console.log('[WS] reconnect() called')

    // 一旦完全切断
    if (this.ws) {
      try {
        this.ws.removeEventListener('open', this.handleOpen)
        this.ws.removeEventListener('message', this.handleMessage)
        this.ws.removeEventListener('error', this.handleError)
        this.ws.removeEventListener('close', this.handleClose)
        this.ws.close()
      } catch (e) {
        console.warn('[WS] reconnect close error:', e)
      }
    }

    this.ws = null

    // 即座に connect() を呼ぶ
    this.connect()

    return true
  }

  public get websocket(): WebSocket | null {
    return this.ws
  }

  public isConnected(): boolean {
    return this.ws !== null && this.ws.readyState === WebSocket.OPEN
  }
}
