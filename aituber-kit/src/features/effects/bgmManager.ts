/**
 * BGM管理（Web Audio API）
 */

import { BGMEffect } from './effectTypes'

// 再生中のBGMを管理
const activeBGMs = new Map<string, {
  audio: HTMLAudioElement
  source: MediaElementAudioSourceNode | null
  gainNode: GainNode | null
}>()

/**
 * BGMを再生
 */
export const playBGM = async (bgm: BGMEffect): Promise<void> => {
  try {
    // 既に再生中の場合は停止
    if (activeBGMs.has(bgm.id)) {
      await stopBGM(bgm.id)
    }
    
    const audio = new Audio(`/audio/bgm/${bgm.filePath}`)
    audio.loop = bgm.loop !== false // デフォルトはtrue
    audio.volume = bgm.volume ?? 0.5
    
    // Web Audio APIを使用して音量制御
    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)()
    const source = audioContext.createMediaElementSource(audio)
    const gainNode = audioContext.createGain()
    
    gainNode.gain.value = bgm.volume ?? 0.5
    source.connect(gainNode)
    gainNode.connect(audioContext.destination)
    
    // 再生
    await audio.play()
    
    // 管理用に保存
    activeBGMs.set(bgm.id, {
      audio,
      source,
      gainNode,
    })
    
    console.log('[bgmManager] BGMを再生:', bgm.id, bgm.name)
  } catch (error) {
    console.error('[bgmManager] BGM再生エラー:', error)
  }
}

/**
 * BGMを停止
 */
export const stopBGM = async (bgmId: string): Promise<void> => {
  const bgmData = activeBGMs.get(bgmId)
  if (bgmData) {
    bgmData.audio.pause()
    bgmData.audio.currentTime = 0
    activeBGMs.delete(bgmId)
    console.log('[bgmManager] BGMを停止:', bgmId)
  }
}

/**
 * 全てのBGMを停止
 */
export const stopAllBGM = async (): Promise<void> => {
  for (const bgmId of activeBGMs.keys()) {
    await stopBGM(bgmId)
  }
}

/**
 * BGMの音量を変更
 */
export const setBGMVolume = (bgmId: string, volume: number): void => {
  const bgmData = activeBGMs.get(bgmId)
  if (bgmData) {
    bgmData.audio.volume = volume
    if (bgmData.gainNode) {
      bgmData.gainNode.gain.value = volume
    }
  }
}

