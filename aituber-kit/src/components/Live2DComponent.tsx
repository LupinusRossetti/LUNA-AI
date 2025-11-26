import { Application, Ticker, DisplayObject } from 'pixi.js'
import { useEffect, useRef, useState, useCallback } from 'react'
import { Live2DModel } from 'pixi-live2d-display-lipsyncpatch/cubism4'
import homeStore from '@/features/stores/home'
import settingsStore from '@/features/stores/settings'
import { Live2DHandler } from '@/features/messages/live2dHandler'
import { debounce } from 'lodash'

console.log('Live2DComponent module loaded')

const setModelPosition = (
  app: Application,
  model: InstanceType<typeof Live2DModel>,
  characterId?: 'A' | 'B'
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
    // 掛け合いモード: 左右に配置
    if (isDialogueMode && characterId) {
      model.x = characterId === 'A' ? app.renderer.width / 4 : app.renderer.width * 3 / 4
    } else {
      model.x = app.renderer.width / 2
    }
    model.y = app.renderer.height / 2
  }
}

type Live2DComponentProps = {
  characterId?: 'A' | 'B'
  modelPath?: string
}

const Live2DComponent = ({ characterId, modelPath }: Live2DComponentProps = {} as Live2DComponentProps): JSX.Element => {
  console.log('Live2DComponent rendering', { characterId, modelPath })

  const canvasContainerRef = useRef<HTMLCanvasElement>(null)
  const [app, setApp] = useState<Application | null>(null)
  const [model, setModel] = useState<InstanceType<typeof Live2DModel> | null>(
    null
  )
  const modelRef = useRef<InstanceType<typeof Live2DModel> | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 })
  
  // キャラクターIDに応じてモデルパスを選択
  const defaultLive2DPath = settingsStore((state) => state.selectedLive2DPath)
  const live2DPathA = settingsStore((state) => state.selectedLive2DPathA)
  const live2DPathB = settingsStore((state) => state.selectedLive2DPathB)
  
  const selectedLive2DPath = modelPath || 
    (characterId === 'A' ? live2DPathA : 
     characterId === 'B' ? live2DPathB : 
     defaultLive2DPath)
  // ピンチジェスチャー用の状態
  const [pinchDistance, setPinchDistance] = useState<number | null>(null)
  const [initialScale, setInitialScale] = useState<number | null>(null)

  // モデルの現在位置を設定に保存する関数
  const saveModelPosition = useCallback(() => {
    if (!model) return

    const settings = settingsStore.getState()
    const isDialogueMode = process.env.NEXT_PUBLIC_DIALOGUE_MODE === 'true'
    
    if (isDialogueMode && characterId) {
      // 掛け合いモード: A/B別々の位置を保存
      const currentPosition = characterId === 'A' ? settings.characterPositionA : settings.characterPositionB
      const currentRotation = characterId === 'A' ? settings.characterRotationA : settings.characterRotationB
      settingsStore.setState({
        [`characterPosition${characterId}`]: {
          x: model.x,
          y: model.y,
          z: currentPosition.z,
          scale: model.scale.x,
        },
        [`characterRotation${characterId}`]: currentRotation,
      })
    } else {
      // 単体モード: レガシーのcharacterPositionを使用
      settingsStore.setState({
        characterPosition: {
          x: model.x,
          y: model.y,
          z: settings.characterPosition.z, // 既存のzを保持（VRM viewerで使用 → viewer.ts:216–221）
          scale: model.scale.x,
        },
        characterRotation: settings.characterRotation, // 既存のrotationを保持（VRM viewerで使用 → viewer.ts:224–226）
      })
    }
  }, [model, characterId])

  // Position management functions that can be called from settings
  const fixPosition = useCallback(() => {
    if (!model) return
    saveModelPosition()
    settingsStore.setState({ fixedCharacterPosition: true })
  }, [model, saveModelPosition])

  const unfixPosition = useCallback(() => {
    settingsStore.setState({ fixedCharacterPosition: false })
  }, [])

  const resetPosition = useCallback(() => {
    if (!model || !app) return
    const isDialogueMode = process.env.NEXT_PUBLIC_DIALOGUE_MODE === 'true'
    
    if (isDialogueMode && characterId) {
      // 掛け合いモード: A/B別々の位置をリセット
      settingsStore.setState({
        fixedCharacterPosition: false,
        [`characterPosition${characterId}`]: { x: 0, y: 0, z: 0, scale: 1 },
        [`characterRotation${characterId}`]: { x: 0, y: 0, z: 0 },
      })
    } else {
      // 単体モード: レガシーのcharacterPositionをリセット
      settingsStore.setState({
        fixedCharacterPosition: false,
        characterPosition: { x: 0, y: 0, z: 0, scale: 1 },
        characterRotation: { x: 0, y: 0, z: 0 },
      })
    }
    setModelPosition(app, model, characterId)
  }, [model, app, characterId])

  // Store position management functions in homeStore for access from settings
  useEffect(() => {
    if (model) {
      // Merge position management functions with the Live2D model instance
      const viewerWithPositionControls = Object.assign(model, {
        fixPosition,
        unfixPosition,
        resetPosition,
      })
      const isDialogueMode = process.env.NEXT_PUBLIC_DIALOGUE_MODE === 'true'
      
      if (isDialogueMode && characterId) {
        // 掛け合いモード: A/B別々のviewerを保存
        homeStore.setState({
          [`live2dViewer${characterId}`]: viewerWithPositionControls,
        })
      } else {
        // 単体モード: レガシーのlive2dViewerを保存
        homeStore.setState({
          live2dViewer: viewerWithPositionControls,
        })
      }
    }
  }, [model, app, fixPosition, unfixPosition, resetPosition])

  useEffect(() => {
    initApp()
    return () => {
      if (modelRef.current) {
        modelRef.current.destroy()
        modelRef.current = null
      }
      if (app) {
        app.destroy(true)
      }
    }
  }, [])

  useEffect(() => {
    if (app && selectedLive2DPath) {
      // 既存のモデルがある場合は先に削除
      if (modelRef.current) {
        app.stage.removeChild(modelRef.current as unknown as DisplayObject)
        modelRef.current.destroy()
        modelRef.current = null
        setModel(null)
      }
      // ステージをクリア
      app.stage.removeChildren()
      // 新しいモデルを読み込む
      loadLive2DModel(app, selectedLive2DPath)
    }
  }, [app, selectedLive2DPath])

  const initApp = () => {
    if (!canvasContainerRef.current) return

    const app = new Application({
      width: window.innerWidth,
      height: window.innerHeight,
      view: canvasContainerRef.current,
      backgroundAlpha: 0,
      antialias: true,
    })

    setApp(app)
  }

  const loadLive2DModel = async (
    currentApp: Application,
    modelPath: string
  ) => {
    if (!canvasContainerRef.current) return
    const hs = homeStore.getState()

    try {
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
      setModelPosition(currentApp, newModel, characterId)

      modelRef.current = newModel
      setModel(newModel)
      // Don't set live2dViewer here, it will be set in the useEffect with position controls

      await Live2DHandler.resetToIdle()
    } catch (error) {
      console.error('Failed to load Live2D model:', error)
    }
  }

  // 2点間の距離を計算する関数
  const getDistance = (touch1: Touch, touch2: Touch): number => {
    const dx = touch1.clientX - touch2.clientX
    const dy = touch1.clientY - touch2.clientY
    return Math.sqrt(dx * dx + dy * dy)
  }

  useEffect(() => {
    if (!canvasContainerRef.current || !model) return

    const canvas = canvasContainerRef.current

    const handlePointerDown = (event: PointerEvent) => {
      const { fixedCharacterPosition } = settingsStore.getState()

      // Don't allow dragging if position is fixed
      if (!fixedCharacterPosition) {
        setIsDragging(true)
        setDragOffset({
          x: event.clientX - model.x,
          y: event.clientY - model.y,
        })
      }

      if (event.button !== 2) {
        model.tap(event.clientX, event.clientY)
      }
    }

    const handlePointerMove = (event: PointerEvent) => {
      if (isDragging) {
        model.x = event.clientX - dragOffset.x
        model.y = event.clientY - dragOffset.y
      }
    }

    const handlePointerUp = () => {
      setIsDragging(false)
      // Save position when dragging ends (if not fixed)
      if (!settingsStore.getState().fixedCharacterPosition) {
        saveModelPosition()
      }
    }

    const handleWheel = (event: WheelEvent) => {
      const { fixedCharacterPosition } = settingsStore.getState()

      // Don't allow scaling if position is fixed
      if (fixedCharacterPosition) return

      event.preventDefault()
      // スケール変更を緩やかにするため、係数を小さくする
      const scaleChange = event.deltaY * -0.0002
      // 現在のスケールに緩やかな変更を適用
      const newScale = model.scale.x + scaleChange
      // スケールの範囲は0.1から2.0に制限
      if (newScale >= 0.1 && newScale <= 2.0) {
        model.scale.set(newScale)
        // Save position when scaling (if not fixed)
        saveModelPosition()
      }
    }

    const handleDragOver = (event: DragEvent) => {
      event.preventDefault()
    }

    const handleDrop = (event: DragEvent) => {
      event.preventDefault()

      const files = event.dataTransfer?.files
      if (!files) {
        return
      }

      const file = files[0]
      if (!file) {
        return
      }

      if (file.type.startsWith('image/')) {
        const reader = new FileReader()
        reader.readAsDataURL(file)
        reader.onload = function () {
          const image = reader.result as string
          image !== '' && homeStore.setState({ modalImage: image })
        }
      }
    }

    // タッチイベント処理
    const handleTouchStart = (event: TouchEvent) => {
      const { fixedCharacterPosition } = settingsStore.getState()

      // Don't allow pinch if position is fixed
      if (fixedCharacterPosition) return

      if (event.touches.length === 2) {
        // ピンチ開始
        const dist = getDistance(event.touches[0], event.touches[1])
        setPinchDistance(dist)
        setInitialScale(model.scale.x)
      }
    }

    const handleTouchMove = (event: TouchEvent) => {
      if (
        event.touches.length === 2 &&
        pinchDistance !== null &&
        initialScale !== null
      ) {
        // ピンチ中
        const currentDistance = getDistance(event.touches[0], event.touches[1])
        const scale = initialScale * (currentDistance / pinchDistance)

        // スケールの範囲制限
        const newScale = Math.min(Math.max(scale, 0.1), 2.0)
        model.scale.set(newScale)
      }
    }

    const handleTouchEnd = () => {
      // ピンチ終了
      setPinchDistance(null)
      setInitialScale(null)
      // Save position when pinch gesture ends (if not fixed)
      if (!settingsStore.getState().fixedCharacterPosition) {
        saveModelPosition()
      }
    }

    // イベントリスナーの登録
    canvas.addEventListener('pointerdown', handlePointerDown)
    canvas.addEventListener('pointermove', handlePointerMove)
    canvas.addEventListener('pointerup', handlePointerUp)
    canvas.addEventListener('wheel', handleWheel, { passive: false })
    canvas.addEventListener('dragover', handleDragOver)
    canvas.addEventListener('drop', handleDrop)

    // タッチイベントリスナーの登録
    canvas.addEventListener('touchstart', handleTouchStart)
    canvas.addEventListener('touchmove', handleTouchMove)
    canvas.addEventListener('touchend', handleTouchEnd)

    // クリーンアップ関数
    return () => {
      canvas.removeEventListener('pointerdown', handlePointerDown)
      canvas.removeEventListener('pointermove', handlePointerMove)
      canvas.removeEventListener('pointerup', handlePointerUp)
      canvas.removeEventListener('wheel', handleWheel)
      canvas.removeEventListener('dragover', handleDragOver)
      canvas.removeEventListener('drop', handleDrop)

      // タッチイベントリスナーの削除
      canvas.removeEventListener('touchstart', handleTouchStart)
      canvas.removeEventListener('touchmove', handleTouchMove)
      canvas.removeEventListener('touchend', handleTouchEnd)
    }
  }, [model, isDragging, dragOffset, pinchDistance, initialScale])

  useEffect(() => {
    if (!app || !model) return

    const onResize = debounce(() => {
      if (!canvasContainerRef.current) return

      app.renderer.resize(
        canvasContainerRef.current.clientWidth,
        canvasContainerRef.current.clientHeight
      )

      setModelPosition(app, model, characterId)
    }, 250)

    window.addEventListener('resize', onResize)

    return () => {
      window.removeEventListener('resize', onResize)
      onResize.cancel() // クリーンアップ時にデバウンスをキャンセル
    }
  }, [app, model])

  return (
    <div className="w-screen h-screen">
      <canvas
        ref={canvasContainerRef}
        className="w-full h-full"
        onContextMenu={(e) => e.preventDefault()}
      />
    </div>
  )
}

export default Live2DComponent
