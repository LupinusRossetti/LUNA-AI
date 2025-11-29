/**
 * エフェクトボタン用アコーディオンメニュー
 */

import { useState } from 'react'
import { effectManager } from '@/features/effects/effectBase'
import { executeEffect, stopEffect } from '@/features/effects/effectBase'
import { EffectType } from '@/features/effects/effectTypes'

export const EffectButtonMenu = () => {
  const [isOpen, setIsOpen] = useState(false)
  const [activeTab, setActiveTab] = useState<EffectType | null>(null)
  const allEffects = effectManager.getAllEffects()

  // エフェクトを実行
  const handleEffectClick = async (effectId: string) => {
    console.log('[EffectButtonMenu] エフェクトボタンをクリック:', effectId)
    
    const effect = effectManager.getEffect(effectId)
    if (!effect) {
      console.error('[EffectButtonMenu] エフェクトが見つかりません:', effectId)
      return
    }
    
    await executeEffect(effect)
  }

  // エフェクトを停止
  const handleStopEffect = async (effectId: string) => {
    console.log('[EffectButtonMenu] エフェクトを停止:', effectId)
    
    const effect = effectManager.getEffect(effectId)
    if (!effect) {
      console.error('[EffectButtonMenu] エフェクトが見つかりません:', effectId)
      return
    }
    
    await stopEffect(effect)
  }

  // タブ別にエフェクトを取得
  const bgmEffects = effectManager.getEffectsByType('bgm')
  const seEffects = effectManager.getEffectsByType('se')
  const screenEffects = effectManager.getEffectsByType('screen')

  // メニューが空の場合は表示しない
  if (allEffects.length === 0) {
    return null
  }

  return (
    <div className="fixed bottom-4 right-20 z-30">
      {/* メインボタン */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-12 h-12 rounded-full bg-primary text-theme shadow-lg flex items-center justify-center hover:bg-primary-dark transition-colors"
        aria-label="エフェクトメニュー"
        aria-expanded={isOpen}
        aria-controls="effect-menu"
      >
        {isOpen ? (
          <span className="text-lg font-bold">×</span>
        ) : (
          <span className="text-lg font-bold">エ</span>
        )}
      </button>

      {/* エフェクトメニュー */}
      {isOpen && (
        <div
          id="effect-menu"
          className="absolute bottom-16 right-0 bg-white border border-gray-300 rounded-lg shadow-lg p-2 min-w-[250px] max-h-[500px] overflow-y-auto"
        >
          {/* タブ */}
          <div className="flex gap-2 mb-2 border-b border-gray-200 pb-2">
            <button
              onClick={() => setActiveTab(activeTab === 'bgm' ? null : 'bgm')}
              className={`px-3 py-1 text-sm rounded transition-colors ${
                activeTab === 'bgm' ? 'bg-primary text-white' : 'bg-gray-100 hover:bg-gray-200'
              }`}
            >
              BGM
            </button>
            <button
              onClick={() => setActiveTab(activeTab === 'se' ? null : 'se')}
              className={`px-3 py-1 text-sm rounded transition-colors ${
                activeTab === 'se' ? 'bg-primary text-white' : 'bg-gray-100 hover:bg-gray-200'
              }`}
            >
              SE
            </button>
            <button
              onClick={() => setActiveTab(activeTab === 'screen' ? null : 'screen')}
              className={`px-3 py-1 text-sm rounded transition-colors ${
                activeTab === 'screen' ? 'bg-primary text-white' : 'bg-gray-100 hover:bg-gray-200'
              }`}
            >
              画面
            </button>
          </div>

          {/* エフェクトリスト */}
          <div className="space-y-1">
            {activeTab === 'bgm' && (
              <div>
                <div className="text-xs font-semibold mb-1 px-2 py-1 text-gray-500">
                  BGM
                </div>
                {bgmEffects.map((effect) => (
                  <div key={effect.id} className="flex items-center gap-2">
                    <button
                      onClick={() => handleEffectClick(effect.id)}
                      className="flex-1 text-left px-3 py-2 text-sm hover:bg-gray-100 rounded transition-colors"
                    >
                      ▶ {effect.name}
                    </button>
                    <button
                      onClick={() => handleStopEffect(effect.id)}
                      className="px-2 py-2 text-sm hover:bg-gray-100 rounded transition-colors"
                      title="停止"
                    >
                      ⏹
                    </button>
                  </div>
                ))}
              </div>
            )}
            {activeTab === 'se' && (
              <div>
                <div className="text-xs font-semibold mb-1 px-2 py-1 text-gray-500">
                  SE
                </div>
                {seEffects.map((effect) => (
                  <button
                    key={effect.id}
                    onClick={() => handleEffectClick(effect.id)}
                    className="w-full text-left px-3 py-2 text-sm hover:bg-gray-100 rounded transition-colors"
                  >
                    ▶ {effect.name}
                  </button>
                ))}
              </div>
            )}
            {activeTab === 'screen' && (
              <div>
                <div className="text-xs font-semibold mb-1 px-2 py-1 text-gray-500">
                  画面エフェクト
                </div>
                {screenEffects.map((effect) => (
                  <button
                    key={effect.id}
                    onClick={() => handleEffectClick(effect.id)}
                    className="w-full text-left px-3 py-2 text-sm hover:bg-gray-100 rounded transition-colors"
                  >
                    ✨ {effect.name}
                  </button>
                ))}
              </div>
            )}
            {activeTab === null && (
              <div className="text-sm text-gray-500 px-2 py-4 text-center">
                タブを選択してください
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

