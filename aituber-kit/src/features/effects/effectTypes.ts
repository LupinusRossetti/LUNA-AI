/**
 * エフェクトシステムの型定義
 */

/**
 * エフェクトの種類
 */
export type EffectType = 'bgm' | 'se' | 'screen'

/**
 * BGMエフェクト
 */
export interface BGMEffect {
  id: string
  name: string
  filePath: string // public/audio/bgm/ からの相対パス
  volume?: number // 0.0 - 1.0 (デフォルト: 0.5)
  loop?: boolean // ループ再生するか (デフォルト: true)
}

/**
 * SEエフェクト
 */
export interface SEEffect {
  id: string
  name: string
  filePath: string // public/audio/se/ からの相対パス
  volume?: number // 0.0 - 1.0 (デフォルト: 0.7)
}

/**
 * 画面エフェクト
 */
export interface ScreenEffect {
  id: string
  name: string
  type: 'particle' | 'shake' | 'color' | 'flash' | 'custom'
  duration?: number // エフェクトの持続時間（ミリ秒、デフォルト: 1000）
  intensity?: number // エフェクトの強度（0.0 - 1.0、デフォルト: 0.5）
  config?: Record<string, any> // エフェクト固有の設定
}

/**
 * エフェクトの基本インターフェース
 */
export interface Effect {
  id: string
  name: string
  type: EffectType
  bgm?: BGMEffect
  se?: SEEffect
  screen?: ScreenEffect
}

/**
 * エフェクトマネージャーのインターフェース
 */
export interface EffectManager {
  registerEffect: (effect: Effect) => void
  unregisterEffect: (effectId: string) => void
  getEffect: (effectId: string) => Effect | undefined
  getAllEffects: () => Effect[]
  getEffectsByType: (type: EffectType) => Effect[]
}

