'use client'

import { useEffect, useState, useMemo, useRef } from 'react'
import dynamic from 'next/dynamic'
import Script from 'next/script'
import homeStore from '@/features/stores/home'
import settingsStore from '@/features/stores/settings'
import type { ComponentType } from 'react'

type Live2DComponentProps = {
  characterId?: 'A' | 'B'
  modelPath?: string
}

const Live2DComponent = dynamic(
  () => {
    console.log('Loading Live2DComponent...')
    return import('./Live2DComponent')
      .then((mod) => mod.default)
      .then((mod) => {
        console.log('Live2DComponent loaded successfully')
        return mod
      })
      .catch((err) => {
        console.error('Failed to load Live2DComponent:', err)
        throw err
      })
  },
  {
    ssr: false,
    loading: () => {
      console.log('Live2DComponent is loading...')
      return null
    },
  }
) as ComponentType<Live2DComponentProps>

type Live2DViewerProps = {
  characterId?: 'A' | 'B'
  modelPath?: string
  position?: 'left' | 'right' | 'top' | 'bottom'
}

export default function Live2DViewer(props: Live2DViewerProps = {}) {
  const { 
    characterId, 
    modelPath: modelPathProp,
    position = 'right'
  } = props
  
  // modelPathがpropsで指定されていない場合、settingsStoreから取得
  const selectedLive2DPathA = settingsStore((s) => s.selectedLive2DPathA)
  const selectedLive2DPathB = settingsStore((s) => s.selectedLive2DPathB)
  const modelPath = modelPathProp || (characterId === 'A' ? selectedLive2DPathA : characterId === 'B' ? selectedLive2DPathB : selectedLive2DPathA)
  
  // デバッグ用：modelPathの変更を追跡
  const prevModelPathRef = useRef<string | undefined>(modelPath)
  useEffect(() => {
    if (prevModelPathRef.current !== modelPath) {
      console.log('Live2DViewer modelPath changed', { 
        characterId, 
        prev: prevModelPathRef.current, 
        current: modelPath,
        selectedLive2DPathA,
        selectedLive2DPathB,
        modelPathProp
      })
      prevModelPathRef.current = modelPath
    }
  }, [modelPath, characterId, selectedLive2DPathA, selectedLive2DPathB, modelPathProp])
  const [isMounted, setIsMounted] = useState(false)
  const [scriptLoadRetries, setScriptLoadRetries] = useState({
    cubismcore: 0,
    live2d: 0,
  })
  const MAX_RETRIES = 3

  const isCubismCoreLoaded = homeStore((s) => s.isCubismCoreLoaded)
  const setIsCubismCoreLoaded = homeStore((s) => s.setIsCubismCoreLoaded)
  const isLive2dLoaded = homeStore((s) => s.isLive2dLoaded)
  const setIsLive2dLoaded = homeStore((s) => s.setIsLive2dLoaded)

  // フックは常に同じ順序で呼び出す必要があるため、早期リターンの前にすべてのフックを呼び出す
  const isDialogueMode = process.env.NEXT_PUBLIC_DIALOGUE_MODE === 'true'
  const isSpeaking = homeStore((s) => s.isSpeaking)
  const live2dBounceEnabled = settingsStore((s) => s.live2dBounceEnabled)
  const live2dBounceSpeed = settingsStore((s) => s.live2dBounceSpeed)
  const live2dBounceAmount = settingsStore((s) => s.live2dBounceAmount)

  // 跳ねるアニメーションのスタイルを計算（フックなので早期リターンの前に配置）
  const bounceStyle = useMemo(() => {
    if (!live2dBounceEnabled || !isSpeaking) return {}
    
    const duration = 1 / live2dBounceSpeed // 速度が速いほど短い期間
    
    return {
      animation: `live2dBounce ${duration}s ease-in-out infinite`,
      transformOrigin: 'center bottom',
    } as React.CSSProperties
  }, [live2dBounceEnabled, isSpeaking, live2dBounceSpeed, live2dBounceAmount])

  useEffect(() => {
    console.log('Live2DViewer mounted')
    setIsMounted(true)
  }, [])

  // スクリプトの再読み込み処理（フックではないので早期リターンの後でもOK）
  const retryLoadScript = (scriptName: 'cubismcore' | 'live2d') => {
    if (scriptLoadRetries[scriptName] < MAX_RETRIES) {
      setScriptLoadRetries((prev) => ({
        ...prev,
        [scriptName]: prev[scriptName] + 1,
      }))
      // 強制的に再読み込みするためにキーを変更
      return true
    }
    return false
  }

  if (!isMounted) {
    console.log('Live2DViewer not mounted yet')
    return null
  }

  // 位置に応じたクラス名
  const positionClass = 
    position === 'left' ? 'left-0' :
    position === 'right' ? 'right-0' :
    position === 'top' ? 'top-0' :
    'bottom-0'

  console.log('Rendering Live2DViewer', { characterId, modelPath, position })
  
  // z-indexを設定（チャット欄のz-index 1-2より背面にいかないように、0.5に設定）
  const zIndex = 0.5 // チャット欄（z-index 1-2）より背面だが、背景より前面
  
  const containerClass = isDialogueMode
    ? 'fixed inset-0 w-full h-full' // 画面全体（z-indexはstyleで設定）
    : `fixed ${positionClass} bottom-0 w-1/2 h-screen z-0` // 単体モードは従来通り
  
  return (
    <>
      <style jsx>{`
        @keyframes live2dBounce {
          0%, 100% {
            transform: translateY(0);
          }
          50% {
            transform: translateY(-${live2dBounceAmount * 100}px);
          }
        }
      `}</style>
      <div className={containerClass} style={{ ...bounceStyle, zIndex }}>
      {/* スクリプトは一度だけロードされるため、characterId='A'の時のみロード */}
      {(!isDialogueMode || characterId === 'A') && (
        <Script
          key={`cubismcore-${characterId || 'default'}-${scriptLoadRetries.cubismcore}`}
          src="/scripts/live2dcubismcore.min.js"
          strategy="afterInteractive"
          onLoad={() => {
            console.log('cubismcore loaded', { characterId })
            setIsCubismCoreLoaded(true)
          }}
          onError={() => {
            console.error('Failed to load cubism core', { characterId })
            if (retryLoadScript('cubismcore')) {
              console.log('Retrying cubismcore load...', { characterId })
            } else {
              console.error('Max retries reached for cubismcore', { characterId })
            }
          }}
        />
      )}
      {/* スクリプトがロードされたら、両方のコンポーネントをレンダリング */}
      {/* アイリスが一瞬しか表示されない問題を解消するため、modelPathのチェックを緩和 */}
      {isCubismCoreLoaded && (
        <Live2DComponent 
          characterId={characterId} 
          modelPath={modelPath} 
        />
      )}
    </div>
    </>
  )
}
