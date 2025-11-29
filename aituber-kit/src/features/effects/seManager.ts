/**
 * SE管理（Web Audio API）
 */

import { SEEffect } from './effectTypes'

/**
 * SEを再生
 */
export const playSE = async (se: SEEffect): Promise<void> => {
  try {
    const audio = new Audio(`/audio/se/${se.filePath}`)
    audio.volume = se.volume ?? 0.7
    
    // 再生
    await audio.play()
    
    console.log('[seManager] SEを再生:', se.id, se.name)
    
    // 再生完了後に自動的にクリーンアップ（メモリリーク防止）
    audio.addEventListener('ended', () => {
      audio.remove()
    })
  } catch (error) {
    console.error('[seManager] SE再生エラー:', error)
  }
}

/**
 * 複数のSEを同時に再生
 */
export const playMultipleSE = async (seList: SEEffect[]): Promise<void> => {
  await Promise.all(seList.map(se => playSE(se)))
}

