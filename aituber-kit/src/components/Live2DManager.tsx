'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { Application, Ticker, DisplayObject } from 'pixi.js'
// Live2DModelはスクリプトロード後に動的にインポート
// import { Live2DModel } from 'pixi-live2d-display-lipsyncpatch/cubism4'
import homeStore from '@/features/stores/home'
import settingsStore from '@/features/stores/settings'
import { Live2DHandler } from '@/features/messages/live2dHandler'
import { debounce } from 'lodash'
import Script from 'next/script'

type Live2DManagerProps = {
  characterAPath?: string
  characterBPath?: string
}

// Live2DModelの型を後で定義（動的インポートのため）
type Live2DModelType = any

const setModelPosition = (
  app: Application,
  model: Live2DModelType,
  characterId: 'A' | 'B'
) => {
  const settings = settingsStore.getState()
  const isDialogueMode = process.env.NEXT_PUBLIC_DIALOGUE_MODE === 'true'
  
  let position: { x: number; y: number; scale: number }
  
  if (isDialogueMode && characterId) {
    // 掛け合いモード: A/B別々の位置を使用
    const charPosition = characterId === 'A' ? settings.characterPositionA : settings.characterPositionB
    position = charPosition
  } else {
    // 単体モード: レガシーのcharacterPositionを使用
    position = settings.characterPosition
  }

  // If position is fixed and saved, restore it
  if (
    settings.fixedCharacterPosition &&
    (position.x !== 0 ||
      position.y !== 0 ||
      position.scale !== 1)
  ) {
    model.scale.set(position.scale)
    model.x = position.x
    model.y = position.y
  } else {
    // Default positioning
    const scale = 0.3
    model.scale.set(scale)
    // 掛け合いモード: 左右に配置（画面全体を基準に）
    if (isDialogueMode && characterId) {
      // 画面全体のサイズを基準に配置
      const screenWidth = window.innerWidth
      const screenHeight = window.innerHeight
      
      if (characterId === 'A') {
        // キャラA（アイリス）: 画面中央より少し左に配置
        model.x = screenWidth * 0.35 // 画面の35%の位置（中央より左）
        model.y = screenHeight * 0.4 // 画面の中央より上にずらす
      } else {
        // キャラB（フィオナ）: 画面中央より少し右に配置
        model.x = screenWidth * 0.65 // 画面の65%の位置（中央より右）
        model.y = screenHeight * 0.4 // 画面の中央より上にずらす
      }
    } else {
      // 単体モード: 画面中央に配置
      model.x = app.renderer.width / 2
      model.y = app.renderer.height / 2
    }
  }
}

export const Live2DManager = ({ characterAPath, characterBPath }: Live2DManagerProps) => {
  console.log('Live2DManager rendering', { characterAPath, characterBPath })
  
  const canvasContainerRef = useRef<HTMLCanvasElement>(null)
  const [app, setApp] = useState<Application | null>(null)
  const [modelA, setModelA] = useState<Live2DModelType | null>(null)
  const [modelB, setModelB] = useState<Live2DModelType | null>(null)
  const modelARef = useRef<Live2DModelType | null>(null)
  const modelBRef = useRef<Live2DModelType | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 })
  const [draggingModel, setDraggingModel] = useState<'A' | 'B' | null>(null)
  const currentModelRef = useRef<Live2DModelType | null>(null)
  const currentCharacterIdRef = useRef<'A' | 'B' | null>(null)
  const [isMounted, setIsMounted] = useState(false)
  const [isCubismCoreLoaded, setIsCubismCoreLoaded] = useState(false)

  const isDialogueMode = process.env.NEXT_PUBLIC_DIALOGUE_MODE === 'true'
  const selectedLive2DPathA = settingsStore((s) => s.selectedLive2DPathA)
  const selectedLive2DPathB = settingsStore((s) => s.selectedLive2DPathB)
  
  const modelPathA = characterAPath || selectedLive2DPathA
  const modelPathB = characterBPath || selectedLive2DPathB

  console.log('Live2DManager: model paths', { modelPathA, modelPathB, isDialogueMode })

  useEffect(() => {
    console.log('Live2DManager: mounted')
    setIsMounted(true)
  }, [])

  const setIsCubismCoreLoadedGlobal = homeStore((s) => s.setIsCubismCoreLoaded)
  
  // 既にロードされている場合はそれを使用
  const isCubismCoreLoadedGlobal = homeStore((s) => s.isCubismCoreLoaded)
  
  useEffect(() => {
    if (isCubismCoreLoadedGlobal) {
      console.log('Live2DManager: cubismcore already loaded globally')
      setIsCubismCoreLoaded(true)
    }
  }, [isCubismCoreLoadedGlobal])

  // Applicationの初期化
  const initApp = useCallback(() => {
    if (!canvasContainerRef.current) return

    const container = canvasContainerRef.current.parentElement
    let containerWidth = container?.clientWidth || canvasContainerRef.current.clientWidth || window.innerWidth
    let containerHeight = container?.clientHeight || canvasContainerRef.current.clientHeight || window.innerHeight
    
    if (!containerWidth || containerWidth <= 0) {
      containerWidth = window.innerWidth
    }
    if (!containerHeight || containerHeight <= 0) {
      containerHeight = window.innerHeight
    }
    
    containerWidth = Math.max(containerWidth, 1)
    containerHeight = Math.max(containerHeight, 1)

    try {
      const newApp = new Application({
        width: containerWidth,
        height: containerHeight,
        view: canvasContainerRef.current,
        backgroundAlpha: 0,
        antialias: true,
        autoDensity: true,
        resolution: window.devicePixelRatio || 1,
        powerPreference: 'high-performance',
        preserveDrawingBuffer: false,
      })

      console.log('Live2DManager: PixiJS Application created (single instance)', { 
        width: containerWidth, 
        height: containerHeight,
        webglContext: newApp.renderer.gl
      })

      setApp(newApp)
    } catch (error) {
      console.error('Failed to initialize PixiJS Application:', error)
    }
  }, [])

  // Application初期化のuseEffect
  useEffect(() => {
    // cubismcoreがロードされていない場合はスキップ
    if (!isCubismCoreLoaded && !isCubismCoreLoadedGlobal) {
      console.log('Live2DManager: waiting for cubismcore to load')
      return
    }
    
    if (!canvasContainerRef.current) {
      console.log('Live2DManager: canvas container not ready')
      return
    }

    console.log('Live2DManager: initializing Application', { 
      hasCanvas: !!canvasContainerRef.current,
      isCubismCoreLoaded,
      isCubismCoreLoadedGlobal
    })

    const checkAndInit = () => {
      const container = canvasContainerRef.current?.parentElement
      const width = container?.clientWidth || canvasContainerRef.current?.clientWidth || 0
      const height = container?.clientHeight || canvasContainerRef.current?.clientHeight || 0

      console.log('Live2DManager: checking container size', { width, height })

      if (width > 0 && height > 0) {
        console.log('Live2DManager: container size OK, initializing app')
        initApp()
      } else {
        console.log('Live2DManager: container size is 0, retrying...')
        let retries = 0
        const maxRetries = 10
        const checkInterval = setInterval(() => {
          retries++
          const w = container?.clientWidth || canvasContainerRef.current?.clientWidth || 0
          const h = container?.clientHeight || canvasContainerRef.current?.clientHeight || 0
          if (w > 0 && h > 0) {
            clearInterval(checkInterval)
            console.log('Live2DManager: container size OK after retry, initializing app')
            initApp()
          } else if (retries >= maxRetries) {
            clearInterval(checkInterval)
            console.warn('Live2DManager: container size is still 0 after retries, using default size')
            initApp()
          }
        }, 100)
        return () => clearInterval(checkInterval)
      }
    }

    const timeoutId = setTimeout(() => {
      checkAndInit()
    }, 100)

    return () => {
      clearTimeout(timeoutId)
      if (app) {
        app.destroy(true)
      }
    }
  }, [initApp, isCubismCoreLoaded, isCubismCoreLoadedGlobal])

  // モデルAの読み込み
  const loadModelA = useCallback(async (currentApp: Application, modelPath: string) => {
    if (!canvasContainerRef.current || !modelPath || modelPath.trim() === '') return

    try {
      console.log('Live2DManager: Loading model A...', { modelPath })
      
      // 既存のモデルAがある場合は削除
      if (modelARef.current) {
        try {
          currentApp.stage.removeChild(modelARef.current as unknown as DisplayObject)
          modelARef.current.destroy()
        } catch (error) {
          console.error('Error destroying model A:', error)
        }
        modelARef.current = null
        setModelA(null)
      }

      // スクリプトロード後に動的にインポート
      const { Live2DModel } = await import('pixi-live2d-display-lipsyncpatch/cubism4')
      
      const newModel = await Live2DModel.fromSync(modelPath, {
        ticker: Ticker.shared,
        autoHitTest: false,
        autoFocus: false,
      })

      await new Promise((resolve, reject) => {
        newModel.once('load', () => resolve(true))
        newModel.once('error', (e) => reject(e))
        setTimeout(() => reject(new Error('Model load timeout')), 10000)
      })

      currentApp.stage.addChild(newModel as unknown as DisplayObject)
      newModel.anchor.set(0.5, 0.5)
      setModelPosition(currentApp, newModel, 'A')

      modelARef.current = newModel
      setModelA(newModel)
      console.log('Live2DManager: Model A added to stage', { modelPath })

      await Live2DHandler.resetToIdle('A')
    } catch (error) {
      console.error('Failed to load Live2D model A:', error, { modelPath })
    }
  }, [])

  // モデルBの読み込み
  const loadModelB = useCallback(async (currentApp: Application, modelPath: string) => {
    if (!canvasContainerRef.current || !modelPath || modelPath.trim() === '') return

    try {
      console.log('Live2DManager: Loading model B...', { modelPath })
      
      // 既存のモデルBがある場合は削除
      if (modelBRef.current) {
        try {
          currentApp.stage.removeChild(modelBRef.current as unknown as DisplayObject)
          modelBRef.current.destroy()
        } catch (error) {
          console.error('Error destroying model B:', error)
        }
        modelBRef.current = null
        setModelB(null)
      }

      // スクリプトロード後に動的にインポート
      const { Live2DModel } = await import('pixi-live2d-display-lipsyncpatch/cubism4')
      
      const newModel = await Live2DModel.fromSync(modelPath, {
        ticker: Ticker.shared,
        autoHitTest: false,
        autoFocus: false,
      })

      await new Promise((resolve, reject) => {
        newModel.once('load', () => resolve(true))
        newModel.once('error', (e) => reject(e))
        setTimeout(() => reject(new Error('Model load timeout')), 10000)
      })

      currentApp.stage.addChild(newModel as unknown as DisplayObject)
      newModel.anchor.set(0.5, 0.5)
      setModelPosition(currentApp, newModel, 'B')

      modelBRef.current = newModel
      setModelB(newModel)
      console.log('Live2DManager: Model B added to stage', { modelPath })

      await Live2DHandler.resetToIdle('B')
    } catch (error) {
      console.error('Failed to load Live2D model B:', error, { modelPath })
    }
  }, [])

  // モデル読み込みのuseEffect
  useEffect(() => {
    if (!app) {
      console.log('Live2DManager: app not ready yet')
      return
    }

    console.log('Live2DManager: app ready, loading models', { modelPathA, modelPathB, isDialogueMode })

    if (modelPathA && modelPathA.trim() !== '') {
      loadModelA(app, modelPathA)
    }
    if (isDialogueMode && modelPathB && modelPathB.trim() !== '') {
      loadModelB(app, modelPathB)
    }
  }, [app, modelPathA, modelPathB, isDialogueMode, loadModelA, loadModelB])

  // homeStoreにviewerを保存
  useEffect(() => {
    if (modelA && app) {
      const viewerA = Object.assign(modelA, {
        fixPosition: () => {
          settingsStore.setState({ fixedCharacterPosition: true })
        },
        unfixPosition: () => {
          settingsStore.setState({ fixedCharacterPosition: false })
        },
        resetPosition: () => {
          settingsStore.setState({
            fixedCharacterPosition: false,
            characterPositionA: { x: 0, y: 0, z: 0, scale: 1 },
            characterRotationA: { x: 0, y: 0, z: 0 },
          })
          setModelPosition(app, modelA, 'A')
        },
      })
      homeStore.setState({ live2dViewerA: viewerA })
    }
    if (modelB && app) {
      const viewerB = Object.assign(modelB, {
        fixPosition: () => {
          settingsStore.setState({ fixedCharacterPosition: true })
        },
        unfixPosition: () => {
          settingsStore.setState({ fixedCharacterPosition: false })
        },
        resetPosition: () => {
          settingsStore.setState({
            fixedCharacterPosition: false,
            characterPositionB: { x: 0, y: 0, z: 0, scale: 1 },
            characterRotationB: { x: 0, y: 0, z: 0 },
          })
          setModelPosition(app, modelB, 'B')
        },
      })
      homeStore.setState({ live2dViewerB: viewerB })
    }
  }, [modelA, modelB, app])

  // リサイズ処理
  useEffect(() => {
    if (!app || (!modelA && !modelB)) return

    const onResize = debounce(() => {
      if (!canvasContainerRef.current) return
      
      const container = canvasContainerRef.current.parentElement
      const newWidth = container?.clientWidth || canvasContainerRef.current.clientWidth || window.innerWidth
      const newHeight = container?.clientHeight || canvasContainerRef.current.clientHeight || window.innerHeight

      app.renderer.resize(newWidth, newHeight)

      if (modelA) {
        setModelPosition(app, modelA, 'A')
      }
      if (modelB) {
        setModelPosition(app, modelB, 'B')
      }
    }, 250)

    window.addEventListener('resize', onResize)
    onResize()

    return () => {
      window.removeEventListener('resize', onResize)
      onResize.cancel()
    }
  }, [app, modelA, modelB])

  // ドラッグ処理
  useEffect(() => {
    if (!canvasContainerRef.current || !app || (!modelA && !modelB)) return

    const canvas = canvasContainerRef.current

    const handlePointerDown = (e: PointerEvent) => {
      const { fixedCharacterPosition } = settingsStore.getState()
      if (!app || (!modelA && !modelB) || fixedCharacterPosition) return

      const rect = canvas.getBoundingClientRect()
      // キャンバス座標系に変換（PixiJSの座標系は左上が原点）
      const x = e.clientX - rect.left
      const y = e.clientY - rect.top

      console.log('Live2DManager: pointer down', { x, y, modelAX: modelA?.x, modelAY: modelA?.y, modelBX: modelB?.x, modelBY: modelB?.y })

      // モデルAとBの位置を取得して、どちらがクリックされたか判定
      if (modelA) {
        // PixiJSの座標系では、モデルの位置はステージの中心からの相対位置
        const modelAX = modelA.x
        const modelAY = modelA.y
        const modelWidth = (modelA.width || 500) * modelA.scale.x
        const modelHeight = (modelA.height || 500) * modelA.scale.y
        const distanceA = Math.sqrt(Math.pow(x - modelAX, 2) + Math.pow(y - modelAY, 2))
        if (distanceA < Math.max(modelWidth, modelHeight) / 2) {
          console.log('Live2DManager: model A clicked')
          currentModelRef.current = modelA
          currentCharacterIdRef.current = 'A'
          setIsDragging(true)
          setDraggingModel('A')
          setDragOffset({ x: x - modelA.x, y: y - modelA.y })
          if (e.button !== 2) {
            modelA.tap(e.clientX, e.clientY)
          }
          e.preventDefault()
          return
        }
      }
      if (modelB) {
        const modelBX = modelB.x
        const modelBY = modelB.y
        const modelWidth = (modelB.width || 500) * modelB.scale.x
        const modelHeight = (modelB.height || 500) * modelB.scale.y
        const distanceB = Math.sqrt(Math.pow(x - modelBX, 2) + Math.pow(y - modelBY, 2))
        if (distanceB < Math.max(modelWidth, modelHeight) / 2) {
          console.log('Live2DManager: model B clicked')
          currentModelRef.current = modelB
          currentCharacterIdRef.current = 'B'
          setIsDragging(true)
          setDraggingModel('B')
          setDragOffset({ x: x - modelB.x, y: y - modelB.y })
          if (e.button !== 2) {
            modelB.tap(e.clientX, e.clientY)
          }
          e.preventDefault()
          return
        }
      }
    }

    const handlePointerMove = (e: PointerEvent) => {
      if (!isDragging || !currentModelRef.current || !app) return

      const rect = canvas.getBoundingClientRect()
      const screenWidth = window.innerWidth
      const screenHeight = window.innerHeight
      
      const modelWidth = (currentModelRef.current.width || 500) * currentModelRef.current.scale.x
      const modelHeight = (currentModelRef.current.height || 500) * currentModelRef.current.scale.y
      
      const minX = -modelWidth / 2
      const maxX = screenWidth + modelWidth / 2
      const minY = -modelHeight / 2
      const maxY = screenHeight + modelHeight / 2
      
      // キャンバス座標系に変換
      const x = e.clientX - rect.left
      const y = e.clientY - rect.top
      
      let newX = x - dragOffset.x
      let newY = y - dragOffset.y
      
      newX = Math.max(minX, Math.min(maxX, newX))
      newY = Math.max(minY, Math.min(maxY, newY))

      currentModelRef.current.x = newX
      currentModelRef.current.y = newY

      // 位置を保存
      if (currentCharacterIdRef.current === 'A') {
        settingsStore.setState({
          characterPositionA: { x: newX, y: newY, z: 0, scale: currentModelRef.current.scale.x },
        })
      } else if (currentCharacterIdRef.current === 'B') {
        settingsStore.setState({
          characterPositionB: { x: newX, y: newY, z: 0, scale: currentModelRef.current.scale.x },
        })
      }
    }

    const handlePointerUp = () => {
      setIsDragging(false)
      setDraggingModel(null)
      currentModelRef.current = null
      currentCharacterIdRef.current = null
    }

    const handleWheel = (e: WheelEvent) => {
      const { fixedCharacterPosition } = settingsStore.getState()
      if (fixedCharacterPosition || (!modelA && !modelB)) return

      const rect = canvas.getBoundingClientRect()
      const x = e.clientX - rect.left
      const y = e.clientY - rect.top

      // どちらのモデルがホイール操作の対象か判定
      let targetModel: Live2DModelType | null = null
      let targetCharacterId: 'A' | 'B' | null = null

      if (modelA) {
        const modelAX = modelA.x
        const modelAY = modelA.y
        const modelWidth = (modelA.width || 500) * modelA.scale.x
        const modelHeight = (modelA.height || 500) * modelA.scale.y
        const distanceA = Math.sqrt(Math.pow(x - modelAX, 2) + Math.pow(y - modelAY, 2))
        if (distanceA < Math.max(modelWidth, modelHeight) / 2) {
          targetModel = modelA
          targetCharacterId = 'A'
        }
      }
      if (!targetModel && modelB) {
        const modelBX = modelB.x
        const modelBY = modelB.y
        const modelWidth = (modelB.width || 500) * modelB.scale.x
        const modelHeight = (modelB.height || 500) * modelB.scale.y
        const distanceB = Math.sqrt(Math.pow(x - modelBX, 2) + Math.pow(y - modelBY, 2))
        if (distanceB < Math.max(modelWidth, modelHeight) / 2) {
          targetModel = modelB
          targetCharacterId = 'B'
        }
      }

      if (targetModel) {
        e.preventDefault()
        const scaleChange = e.deltaY * -0.0002
        const newScale = targetModel.scale.x + scaleChange
        if (newScale >= 0.1 && newScale <= 2.0) {
          targetModel.scale.set(newScale)
          // 位置を保存
          if (targetCharacterId === 'A') {
            settingsStore.setState({
              characterPositionA: { x: targetModel.x, y: targetModel.y, z: 0, scale: newScale },
            })
          } else if (targetCharacterId === 'B') {
            settingsStore.setState({
              characterPositionB: { x: targetModel.x, y: targetModel.y, z: 0, scale: newScale },
            })
          }
        }
      }
    }

    canvas.addEventListener('pointerdown', handlePointerDown)
    window.addEventListener('pointermove', handlePointerMove)
    window.addEventListener('pointerup', handlePointerUp)
    canvas.addEventListener('wheel', handleWheel, { passive: false })

    return () => {
      canvas.removeEventListener('pointerdown', handlePointerDown)
      window.removeEventListener('pointermove', handlePointerMove)
      window.removeEventListener('pointerup', handlePointerUp)
      canvas.removeEventListener('wheel', handleWheel)
    }
  }, [app, modelA, modelB, isDragging, dragOffset])

  if (!isMounted) {
    console.log('Live2DManager: not mounted yet')
    return null
  }

  console.log('Live2DManager: rendering canvas', { isCubismCoreLoaded, isCubismCoreLoadedGlobal })

  return (
    <>
      {!isCubismCoreLoadedGlobal && (
        <Script
          src="/scripts/live2dcubismcore.min.js"
          strategy="afterInteractive"
          onLoad={() => {
            console.log('Live2DManager: cubismcore loaded')
            setIsCubismCoreLoaded(true)
            setIsCubismCoreLoadedGlobal(true)
          }}
          onError={() => {
            console.error('Live2DManager: Failed to load cubism core')
          }}
        />
      )}
      {(isCubismCoreLoaded || isCubismCoreLoadedGlobal) && (
        <div className="fixed inset-0 w-full h-full" style={{ zIndex: 0.5 }}>
          <canvas
            ref={canvasContainerRef}
            className="w-full h-full"
            onContextMenu={(e) => e.preventDefault()}
          />
        </div>
      )}
    </>
  )
}

