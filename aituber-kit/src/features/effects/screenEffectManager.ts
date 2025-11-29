/**
 * 画面エフェクト管理（CSS/Canvas）
 */

import { ScreenEffect } from './effectTypes'

// アクティブな画面エフェクトを管理
const activeScreenEffects = new Map<string, {
  element: HTMLElement | null
  timeoutId: number | null // ブラウザ環境ではnumber
}>()

/**
 * 画面エフェクトを再生
 */
export const playScreenEffect = async (effect: ScreenEffect): Promise<void> => {
  try {
    // 既に再生中の場合は停止
    if (activeScreenEffects.has(effect.id)) {
      await stopScreenEffect(effect.id)
    }
    
    const duration = effect.duration ?? 1000
    const intensity = effect.intensity ?? 0.5
    
    console.log('[screenEffectManager] 画面エフェクトを再生:', effect.id, effect.name, effect.type)
    
    switch (effect.type) {
      case 'particle':
        await playParticleEffect(effect, duration, intensity)
        break
      case 'shake':
        await playShakeEffect(effect, duration, intensity)
        break
      case 'color':
        await playColorEffect(effect, duration, intensity)
        break
      case 'flash':
        await playFlashEffect(effect, duration, intensity)
        break
      case 'custom':
        await playCustomEffect(effect, duration, intensity)
        break
    }
  } catch (error) {
    console.error('[screenEffectManager] 画面エフェクト再生エラー:', error)
  }
}

/**
 * パーティクルエフェクト
 */
const playParticleEffect = async (effect: ScreenEffect, duration: number, intensity: number): Promise<void> => {
  // パーティクル用のdivを作成
  const particleContainer = document.createElement('div')
  particleContainer.id = `particle-${effect.id}`
  particleContainer.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    pointer-events: none;
    z-index: 9999;
  `
  document.body.appendChild(particleContainer)
  
  // パーティクルを生成
  const particleCount = Math.floor(50 * intensity)
  for (let i = 0; i < particleCount; i++) {
    const particle = document.createElement('div')
    particle.style.cssText = `
      position: absolute;
      width: ${4 + Math.random() * 4}px;
      height: ${4 + Math.random() * 4}px;
      background: ${effect.config?.color || '#FFD700'};
      border-radius: 50%;
      left: ${Math.random() * 100}%;
      top: ${Math.random() * 100}%;
      animation: particle-${effect.id} ${duration}ms ease-out forwards;
      opacity: ${0.5 + Math.random() * 0.5};
    `
    particleContainer.appendChild(particle)
  }
  
  // アニメーションを定義
  const style = document.createElement('style')
  style.textContent = `
    @keyframes particle-${effect.id} {
      0% {
        transform: translate(0, 0) scale(1);
        opacity: 1;
      }
      100% {
        transform: translate(${(Math.random() - 0.5) * 200}px, ${(Math.random() - 0.5) * 200}px) scale(0);
        opacity: 0;
      }
    }
  `
  document.head.appendChild(style)
  
  // タイムアウトで削除
  const timeoutId = setTimeout(() => {
    particleContainer.remove()
    style.remove()
    activeScreenEffects.delete(effect.id)
  }, duration)
  
  activeScreenEffects.set(effect.id, {
    element: particleContainer,
    timeoutId,
  })
}

/**
 * 画面揺れエフェクト
 */
const playShakeEffect = async (effect: ScreenEffect, duration: number, intensity: number): Promise<void> => {
  const shakeAmount = 10 * intensity
  const shakeDuration = duration
  
  // アニメーションを定義
  const style = document.createElement('style')
  style.textContent = `
    @keyframes shake-${effect.id} {
      0%, 100% { transform: translate(0, 0); }
      10%, 30%, 50%, 70%, 90% { transform: translate(-${shakeAmount}px, -${shakeAmount}px); }
      20%, 40%, 60%, 80% { transform: translate(${shakeAmount}px, ${shakeAmount}px); }
    }
  `
  document.head.appendChild(style)
  
  document.body.style.animation = `shake-${effect.id} ${shakeDuration}ms`
  
  const timeoutId = setTimeout(() => {
    document.body.style.animation = ''
    style.remove()
    activeScreenEffects.delete(effect.id)
  }, shakeDuration)
  
  activeScreenEffects.set(effect.id, {
    element: null,
    timeoutId,
  })
}

/**
 * 色変化エフェクト
 */
const playColorEffect = async (effect: ScreenEffect, duration: number, intensity: number): Promise<void> => {
  const overlay = document.createElement('div')
  overlay.id = `color-${effect.id}`
  overlay.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: ${effect.config?.color || 'rgba(255, 0, 0, 0.3)'};
    pointer-events: none;
    z-index: 9998;
    animation: color-${effect.id} ${duration}ms ease-out forwards;
  `
  document.body.appendChild(overlay)
  
  const style = document.createElement('style')
  style.textContent = `
    @keyframes color-${effect.id} {
      0% { opacity: ${intensity}; }
      100% { opacity: 0; }
    }
  `
  document.head.appendChild(style)
  
  const timeoutId = setTimeout(() => {
    overlay.remove()
    style.remove()
    activeScreenEffects.delete(effect.id)
  }, duration)
  
  activeScreenEffects.set(effect.id, {
    element: overlay,
    timeoutId,
  })
}

/**
 * フラッシュエフェクト
 */
const playFlashEffect = async (effect: ScreenEffect, duration: number, intensity: number): Promise<void> => {
  const flash = document.createElement('div')
  flash.id = `flash-${effect.id}`
  flash.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: ${effect.config?.color || '#FFFFFF'};
    pointer-events: none;
    z-index: 9999;
    animation: flash-${effect.id} ${duration}ms ease-out forwards;
  `
  document.body.appendChild(flash)
  
  const style = document.createElement('style')
  style.textContent = `
    @keyframes flash-${effect.id} {
      0% { opacity: ${intensity}; }
      50% { opacity: ${intensity * 0.5}; }
      100% { opacity: 0; }
    }
  `
  document.head.appendChild(style)
  
  const timeoutId = setTimeout(() => {
    flash.remove()
    style.remove()
    activeScreenEffects.delete(effect.id)
  }, duration)
  
  activeScreenEffects.set(effect.id, {
    element: flash,
    timeoutId,
  })
}

/**
 * カスタムエフェクト
 */
const playCustomEffect = async (effect: ScreenEffect, duration: number, intensity: number): Promise<void> => {
  try {
    // カスタムエフェクトの実装は、configに基づいて動的に生成
    console.log('[screenEffectManager] カスタムエフェクト:', effect.config)
    
    // configに基づいてエフェクトタイプを判定
    const effectType = effect.config?.type as string
    
    switch (effectType) {
      case 'particle':
        await playParticleEffect(effect, duration, intensity)
        break
      case 'shake':
        await playShakeEffect(effect, duration, intensity)
        break
      case 'color':
        await playColorEffect(effect, duration, intensity)
        break
      case 'flash':
        await playFlashEffect(effect, duration, intensity)
        break
      default:
        // デフォルトはパーティクルエフェクト
        console.warn('[screenEffectManager] 未知のカスタムエフェクトタイプ:', effectType, 'パーティクルエフェクトを使用します')
        await playParticleEffect(effect, duration, intensity)
    }
  } catch (error) {
    console.error('[screenEffectManager] カスタムエフェクト再生エラー:', error)
  }
}

/**
 * 画面エフェクトを停止
 */
export const stopScreenEffect = async (effectId: string): Promise<void> => {
  const effectData = activeScreenEffects.get(effectId)
  if (effectData) {
    if (effectData.timeoutId) {
      clearTimeout(effectData.timeoutId)
    }
    if (effectData.element) {
      effectData.element.remove()
    }
    activeScreenEffects.delete(effectId)
    console.log('[screenEffectManager] 画面エフェクトを停止:', effectId)
  }
}

/**
 * 全ての画面エフェクトを停止
 */
export const stopAllScreenEffects = async (): Promise<void> => {
  for (const effectId of activeScreenEffects.keys()) {
    await stopScreenEffect(effectId)
  }
}

