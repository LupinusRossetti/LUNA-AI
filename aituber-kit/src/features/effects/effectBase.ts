/**
 * エフェクトシステムの基本実装
 */

import { Effect, EffectManager, EffectType } from './effectTypes'

/**
 * エフェクトマネージャーの実装
 */
class EffectManagerImpl implements EffectManager {
  private effects: Map<string, Effect> = new Map()

  registerEffect(effect: Effect): void {
    this.effects.set(effect.id, effect)
    console.log('[effectBase] エフェクトを登録:', effect.id, effect.name, effect.type)
  }

  unregisterEffect(effectId: string): void {
    this.effects.delete(effectId)
    console.log('[effectBase] エフェクトを登録解除:', effectId)
  }

  getEffect(effectId: string): Effect | undefined {
    return this.effects.get(effectId)
  }

  getAllEffects(): Effect[] {
    return Array.from(this.effects.values())
  }

  getEffectsByType(type: EffectType): Effect[] {
    return Array.from(this.effects.values()).filter(e => e.type === type)
  }
}

// シングルトンインスタンス
export const effectManager = new EffectManagerImpl()

/**
 * エフェクトを実行する（共通処理）
 */
export const executeEffect = async (effect: Effect): Promise<void> => {
  console.log('[effectBase] エフェクトを実行:', effect.id, effect.name, effect.type)
  
  switch (effect.type) {
    case 'bgm':
      if (effect.bgm) {
        const { playBGM } = await import('./bgmManager')
        await playBGM(effect.bgm)
      }
      break
    case 'se':
      if (effect.se) {
        const { playSE } = await import('./seManager')
        await playSE(effect.se)
      }
      break
    case 'screen':
      if (effect.screen) {
        const { playScreenEffect } = await import('./screenEffectManager')
        await playScreenEffect(effect.screen)
      }
      break
  }
}

/**
 * エフェクトを停止する（共通処理）
 */
export const stopEffect = async (effect: Effect): Promise<void> => {
  console.log('[effectBase] エフェクトを停止:', effect.id, effect.name, effect.type)
  
  switch (effect.type) {
    case 'bgm':
      if (effect.bgm) {
        const { stopBGM } = await import('./bgmManager')
        await stopBGM(effect.bgm.id)
      }
      break
    case 'se':
      // SEは自動的に停止するため、停止処理は不要
      break
    case 'screen':
      if (effect.screen) {
        const { stopScreenEffect } = await import('./screenEffectManager')
        await stopScreenEffect(effect.screen.id)
      }
      break
  }
}

/**
 * 全てのエフェクトを停止する
 */
export const stopAllEffects = async (): Promise<void> => {
  console.log('[effectBase] 全てのエフェクトを停止')
  
  const { stopAllBGM } = await import('./bgmManager')
  await stopAllBGM()
  
  const { stopAllScreenEffects } = await import('./screenEffectManager')
  await stopAllScreenEffects()
}

