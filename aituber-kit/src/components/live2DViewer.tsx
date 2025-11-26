'use client'

import { useEffect, useRef, useState } from 'react'
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

  // スクリプトの再読み込み処理
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

  useEffect(() => {
    console.log('Live2DViewer mounted')
    setIsMounted(true)
  }, [])

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
  return (
    <div className={`fixed ${positionClass} bottom-0 w-1/2 h-screen z-0`}>
      <Script
        key={`cubismcore-${scriptLoadRetries.cubismcore}`}
        src="/scripts/live2dcubismcore.min.js"
        strategy="afterInteractive"
        onLoad={() => {
          console.log('cubismcore loaded')
          setIsCubismCoreLoaded(true)
        }}
        onError={() => {
          console.error('Failed to load cubism core')
          if (retryLoadScript('cubismcore')) {
            console.log('Retrying cubismcore load...')
          } else {
            console.error('Max retries reached for cubismcore')
          }
        }}
      />
      {isCubismCoreLoaded && (
        <Live2DComponent 
          characterId={characterId} 
          modelPath={modelPath} 
        />
      )}
    </div>
  )
}
