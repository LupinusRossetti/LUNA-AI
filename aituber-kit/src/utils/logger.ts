/**
 * ログシステムの統一ユーティリティ
 */

type LogLevel = 'debug' | 'info' | 'warn' | 'error'

interface LogOptions {
  level?: LogLevel
  prefix?: string
  data?: unknown
}

/**
 * 統一されたログ関数
 */
export function log(message: string, options: LogOptions = {}): void {
  const { level = 'info', prefix = '', data } = options
  const timestamp = new Date().toISOString()
  const logMessage = prefix ? `[${prefix}] ${message}` : message

  switch (level) {
    case 'debug':
      if (process.env.NODE_ENV === 'development') {
        console.log(`[${timestamp}] [DEBUG] ${logMessage}`, data || '')
      }
      break
    case 'info':
      console.log(`[${timestamp}] [INFO] ${logMessage}`, data || '')
      break
    case 'warn':
      console.warn(`[${timestamp}] [WARN] ${logMessage}`, data || '')
      break
    case 'error':
      console.error(`[${timestamp}] [ERROR] ${logMessage}`, data || '')
      break
  }
}

/**
 * デバッグログ（開発環境のみ）
 */
export function debug(message: string, data?: unknown, prefix?: string): void {
  log(message, { level: 'debug', prefix, data })
}

/**
 * 情報ログ
 */
export function info(message: string, data?: unknown, prefix?: string): void {
  log(message, { level: 'info', prefix, data })
}

/**
 * 警告ログ
 */
export function warn(message: string, data?: unknown, prefix?: string): void {
  log(message, { level: 'warn', prefix, data })
}

/**
 * エラーログ
 */
export function error(message: string, data?: unknown, prefix?: string): void {
  log(message, { level: 'error', prefix, data })
}





