/**
 * なぞなぞ企画用エフェクト定義
 */

import { Effect } from '@/features/effects/effectTypes'
import { effectManager } from '@/features/effects/effectBase'

/**
 * なぞなぞ企画用エフェクトを登録
 */
export const registerNZProjectEffects = () => {
  // 企画開始時のSE
  const projectStartSE: Effect = {
    id: 'nz-project-start',
    name: '企画開始',
    type: 'se',
    se: {
      id: 'nz-project-start',
      name: '企画開始',
      filePath: 'project-start.mp3', // public/audio/se/project-start.mp3 に配置
      volume: 0.8,
    },
  }

  // 正解時のSE
  const correctSE: Effect = {
    id: 'nz-correct',
    name: '正解',
    type: 'se',
    se: {
      id: 'nz-correct',
      name: '正解',
      filePath: 'correct.mp3', // public/audio/se/correct.mp3 に配置
      volume: 0.9,
    },
  }

  // 不正解時のSE
  const incorrectSE: Effect = {
    id: 'nz-incorrect',
    name: '不正解',
    type: 'se',
    se: {
      id: 'nz-incorrect',
      name: '不正解',
      filePath: 'incorrect.mp3', // public/audio/se/incorrect.mp3 に配置
      volume: 0.7,
    },
  }

  // 企画開始時の画面エフェクト
  const projectStartScreen: Effect = {
    id: 'nz-project-start-screen',
    name: '企画開始（画面）',
    type: 'screen',
    screen: {
      id: 'nz-project-start-screen',
      name: '企画開始（画面）',
      type: 'flash',
      duration: 500,
      intensity: 0.3,
      config: {
        color: '#FFD700',
      },
    },
  }

  // 正解時の画面エフェクト
  const correctScreen: Effect = {
    id: 'nz-correct-screen',
    name: '正解（画面）',
    type: 'screen',
    screen: {
      id: 'nz-correct-screen',
      name: '正解（画面）',
      type: 'particle',
      duration: 2000,
      intensity: 0.8,
      config: {
        color: '#00FF00',
      },
    },
  }

  // 不正解時の画面エフェクト
  const incorrectScreen: Effect = {
    id: 'nz-incorrect-screen',
    name: '不正解（画面）',
    type: 'screen',
    screen: {
      id: 'nz-incorrect-screen',
      name: '不正解（画面）',
      type: 'shake',
      duration: 500,
      intensity: 0.5,
    },
  }

  // エフェクトを登録
  effectManager.registerEffect(projectStartSE)
  effectManager.registerEffect(correctSE)
  effectManager.registerEffect(incorrectSE)
  effectManager.registerEffect(projectStartScreen)
  effectManager.registerEffect(correctScreen)
  effectManager.registerEffect(incorrectScreen)

  console.log('[nzProject/effects] なぞなぞ企画用エフェクトを登録しました')
}

/**
 * 企画開始時のエフェクトを実行
 */
export const playProjectStartEffects = async () => {
  const { executeEffect } = await import('@/features/effects/effectBase')
  const projectStartSE = effectManager.getEffect('nz-project-start')
  const projectStartScreen = effectManager.getEffect('nz-project-start-screen')
  
  if (projectStartSE) {
    await executeEffect(projectStartSE)
  }
  if (projectStartScreen) {
    await executeEffect(projectStartScreen)
  }
}

/**
 * 正解時のエフェクトを実行
 */
export const playCorrectEffects = async () => {
  const { executeEffect } = await import('@/features/effects/effectBase')
  const correctSE = effectManager.getEffect('nz-correct')
  const correctScreen = effectManager.getEffect('nz-correct-screen')
  
  if (correctSE) {
    await executeEffect(correctSE)
  }
  if (correctScreen) {
    await executeEffect(correctScreen)
  }
}

/**
 * 不正解時のエフェクトを実行
 */
export const playIncorrectEffects = async () => {
  const { executeEffect } = await import('@/features/effects/effectBase')
  const incorrectSE = effectManager.getEffect('nz-incorrect')
  const incorrectScreen = effectManager.getEffect('nz-incorrect-screen')
  
  if (incorrectSE) {
    await executeEffect(incorrectSE)
  }
  if (incorrectScreen) {
    await executeEffect(incorrectScreen)
  }
}


