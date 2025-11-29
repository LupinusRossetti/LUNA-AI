import { Application, Ticker, DisplayObject } from 'pixi.js'
import { useEffect, useRef, useState, useCallback, useLayoutEffect, useMemo } from 'react'
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
    // 掛け合いモード: 左右に配置（画面全体を基準に）
    if (isDialogueMode && characterId) {
      // 画面全体のサイズを基準に配置
      const screenWidth = window.innerWidth
      const screenHeight = window.innerHeight
      
      // セリフ枠とチャット欄の高さを考慮して上にずらす
      const chatContainerHeight = 150
      const chatGap = 8
      const chatTotalHeight = chatContainerHeight * 2 + chatGap + 10 // チャット欄2つ + 間隔 + 余白
      const assistantTextHeight = 100 // セリフ枠の高さ（概算）
      const offsetY = (chatTotalHeight + assistantTextHeight) / 2 // セリフ枠とチャット欄の分だけ上にずらす
      
      if (characterId === 'A') {
        // キャラA（アイリス）: 画面中央より少し左に配置、セリフ枠にかぶらないように上にずらす
        model.x = screenWidth * 0.35 // 画面の35%の位置（中央より左）
        model.y = screenHeight * 0.5 - offsetY // 画面の中央より上に配置
      } else {
        // キャラB（フィオナ）: 画面中央より少し右に配置、セリフ枠にかぶらないように上にずらす
        model.x = screenWidth * 0.65 // 画面の65%の位置（中央より右）
        model.y = screenHeight * 0.5 - offsetY // 画面の中央より上に配置
      }
    } else {
      // 単体モード: 画面中央に配置
      model.x = app.renderer.width / 2
      model.y = app.renderer.height / 2
    }
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
  
  // キャラクターIDに応じてモデルパスを選択（useMemoでメモ化して不要な再計算を防ぐ）
  const defaultLive2DPath = settingsStore((state) => state.selectedLive2DPath)
  const live2DPathA = settingsStore((state) => state.selectedLive2DPathA)
  const live2DPathB = settingsStore((state) => state.selectedLive2DPathB)
  
  // デバッグ用：各値の変更を追跡
  const prevValuesRef = useRef({ modelPath, characterId, live2DPathA, live2DPathB, defaultLive2DPath })
  useEffect(() => {
    const changed = Object.keys(prevValuesRef.current).some(key => {
      return prevValuesRef.current[key as keyof typeof prevValuesRef.current] !== 
             { modelPath, characterId, live2DPathA, live2DPathB, defaultLive2DPath }[key as keyof typeof prevValuesRef.current]
    })
    if (changed) {
      console.log('Live2DComponent selectedLive2DPath dependencies changed', {
        characterId,
        prev: prevValuesRef.current,
        current: { modelPath, characterId, live2DPathA, live2DPathB, defaultLive2DPath }
      })
      prevValuesRef.current = { modelPath, characterId, live2DPathA, live2DPathB, defaultLive2DPath }
    }
  }, [modelPath, characterId, live2DPathA, live2DPathB, defaultLive2DPath])
  
  const selectedLive2DPath = useMemo(() => {
    // modelPathが指定されている場合はそれを優先
    if (modelPath && modelPath.trim() !== '') {
      return modelPath
    }
    
    // characterIdに応じてパスを選択
    let path: string | undefined
    if (characterId === 'A') {
      path = live2DPathA
    } else if (characterId === 'B') {
      path = live2DPathB
    } else {
      path = defaultLive2DPath
    }
    
    // パスが空文字列やundefinedの場合はundefinedを返す
    const result = (path && path.trim() !== '') ? path : undefined
    console.log('Live2DComponent selectedLive2DPath calculated', { characterId, modelPath, path, result })
    return result
  }, [modelPath, characterId, live2DPathA, live2DPathB, defaultLive2DPath])
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

  const initApp = useCallback(() => {
    if (!canvasContainerRef.current) return

    // コンテナの実際のサイズを取得（親要素のサイズを使用）
    const container = canvasContainerRef.current.parentElement
    let containerWidth = container?.clientWidth || canvasContainerRef.current.clientWidth || window.innerWidth / 2
    let containerHeight = container?.clientHeight || canvasContainerRef.current.clientHeight || window.innerHeight
    
    // サイズが0または未定義の場合はデフォルト値を使用
    if (!containerWidth || containerWidth <= 0) {
      containerWidth = window.innerWidth / 2
    }
    if (!containerHeight || containerHeight <= 0) {
      containerHeight = window.innerHeight
    }
    
    // 最小値を確保（PixiJSの要件）
    containerWidth = Math.max(containerWidth, 1)
    containerHeight = Math.max(containerHeight, 1)

    try {
      // 各Applicationインスタンスに独立したWebGLコンテキストを割り当てる
      // 各canvas要素は自動的に独立したWebGLコンテキストを持つ
      // PixiJSのApplicationは各canvasに対して自動的に独立したWebGLコンテキストを作成する
      const newApp = new Application({
        width: containerWidth,
        height: containerHeight,
        view: canvasContainerRef.current,
        backgroundAlpha: 0,
        antialias: true,
        autoDensity: true, // 高DPIディスプレイ対応
        // checkMaxIfStatementsInShader のエラーを回避するため、明示的に設定
        resolution: window.devicePixelRatio || 1,
        // WebGLコンテキストの設定を明示的に指定
        powerPreference: 'high-performance',
        preserveDrawingBuffer: false,
      })

      console.log('PixiJS Application created', { 
        characterId, 
        width: containerWidth, 
        height: containerHeight,
        canvas: canvasContainerRef.current,
        webglContext: newApp.renderer.gl
      })

      setApp(newApp)
    } catch (error) {
      console.error('Failed to initialize PixiJS Application:', error)
      // エラーが発生した場合は、デフォルトサイズで再試行
      setTimeout(() => {
        if (canvasContainerRef.current) {
          try {
            const fallbackApp = new Application({
              width: 800,
              height: 600,
              view: canvasContainerRef.current,
              backgroundAlpha: 0,
              antialias: true,
              autoDensity: true,
              resolution: window.devicePixelRatio || 1,
            })
            setApp(fallbackApp)
          } catch (fallbackError) {
            console.error('Failed to initialize fallback PixiJS Application:', fallbackError)
          }
        }
      }, 100)
    }
  }, [])

  // コンテナのサイズが確定してからアプリを初期化
  useLayoutEffect(() => {
    // コンテナのサイズが確定するまで待つ
    let retryCount = 0
    const MAX_RETRIES = 10
    
    const checkAndInit = () => {
      if (!canvasContainerRef.current) {
        if (retryCount < MAX_RETRIES) {
          retryCount++
          requestAnimationFrame(checkAndInit)
        }
        return
      }
      
      const container = canvasContainerRef.current.parentElement
      const containerWidth = container?.clientWidth || canvasContainerRef.current.clientWidth || window.innerWidth / 2
      const containerHeight = container?.clientHeight || canvasContainerRef.current.clientHeight || window.innerHeight
      
      // サイズが0の場合は少し待ってから再試行
      if (containerWidth <= 0 || containerHeight <= 0) {
        if (retryCount < MAX_RETRIES) {
          retryCount++
          requestAnimationFrame(checkAndInit)
        } else {
          // 最大リトライ回数に達した場合は、デフォルトサイズで初期化
          console.warn('Container size is still 0 after retries, using default size')
          initApp()
        }
        return
      }
      
      initApp()
    }
    
    // 初回実行を少し遅らせる（DOMが完全にレンダリングされるまで待つ）
    const timeoutId = setTimeout(() => {
      checkAndInit()
    }, 100)
    
    return () => {
      clearTimeout(timeoutId)
      if (modelRef.current) {
        modelRef.current.destroy()
        modelRef.current = null
      }
      if (app) {
        app.destroy(true)
      }
    }
  }, [initApp])

  // 現在読み込まれているモデルパスを追跡
  const loadedModelPathRef = useRef<string | null>(null)
  const isLoadingRef = useRef<boolean>(false)
  
  useEffect(() => {
    console.log('Live2DComponent useEffect triggered', { 
      characterId, 
      hasApp: !!app, 
      selectedLive2DPath, 
      hasModel: !!modelRef.current,
      loadedPath: loadedModelPathRef.current,
      isLoading: isLoadingRef.current
    })
    
    // selectedLive2DPathが空文字列やundefinedの場合はスキップ
    if (!app || !selectedLive2DPath || selectedLive2DPath.trim() === '') {
      console.log('Skipping: no app or invalid path', { characterId, hasApp: !!app, selectedLive2DPath })
      return
    }
    
    // 既に同じモデルが読み込まれている場合はスキップ
    if (modelRef.current && loadedModelPathRef.current === selectedLive2DPath) {
      console.log('Skipping: same model already loaded', { characterId, selectedLive2DPath })
      return
    }
    
    // 読み込み中の場合はスキップ
    if (isLoadingRef.current) {
      console.log('Skipping: model is already loading', { characterId, selectedLive2DPath })
      return
    }
    
    // 既存のモデルがある場合は先に削除
    if (modelRef.current) {
      console.log('Destroying existing model', { characterId, loadedPath: loadedModelPathRef.current })
      try {
        app.stage.removeChild(modelRef.current as unknown as DisplayObject)
        modelRef.current.destroy()
      } catch (error) {
        console.error('Error destroying model:', error)
      }
      modelRef.current = null
      setModel(null)
      loadedModelPathRef.current = null
    }
    
    // ステージをクリア
    try {
      app.stage.removeChildren()
    } catch (error) {
      console.error('Error clearing stage:', error)
    }
    
    // 新しいモデルを読み込む
    isLoadingRef.current = true
    loadedModelPathRef.current = selectedLive2DPath
    console.log('Starting to load Live2D model', { characterId, selectedLive2DPath })
    loadLive2DModel(app, selectedLive2DPath)
      .finally(() => {
        isLoadingRef.current = false
        console.log('Model loading finished', { characterId, selectedLive2DPath })
      })
  }, [app, selectedLive2DPath, characterId])

  const loadLive2DModel = async (
    currentApp: Application,
    modelPath: string
  ) => {
    if (!canvasContainerRef.current) {
      console.error('Canvas container not found')
      return
    }
    
    // 読み込み中のパスが変更された場合はスキップ
    if (loadedModelPathRef.current !== modelPath) {
      console.log('Model path changed during load, skipping...', { characterId, modelPath, loadedPath: loadedModelPathRef.current })
      return
    }
    
    const hs = homeStore.getState()

    try {
      console.log('Creating Live2D model...', { characterId, modelPath })
      // pixi-live2d-displayはTicker.sharedを要求するため、Ticker.sharedを使用
      // WebGLコンテキストの問題は、各Applicationインスタンスが独立したcanvasを持つことで解決される
      const newModel = await Live2DModel.fromSync(modelPath, {
        ticker: Ticker.shared,
        autoHitTest: false,
        autoFocus: false,
      })

      await new Promise((resolve, reject) => {
        newModel.once('load', () => {
          console.log('Live2D model loaded', { characterId, modelPath })
          resolve(true)
        })
        newModel.once('error', (e) => {
          console.error('Live2D model load error', { characterId, modelPath, error: e })
          reject(e)
        })
        setTimeout(() => reject(new Error('Model load timeout')), 10000)
      })

      // 読み込み中のパスが変更された場合はスキップ
      if (loadedModelPathRef.current !== modelPath) {
        console.log('Model path changed after load, skipping add...', { characterId, modelPath, loadedPath: loadedModelPathRef.current })
        newModel.destroy()
        return
      }

      // モデルが既にステージに追加されている場合はスキップ
      if (currentApp.stage.children.includes(newModel as unknown as DisplayObject)) {
        console.log('Model already in stage, skipping add...', { characterId, modelPath })
        return
      }

      currentApp.stage.addChild(newModel as unknown as DisplayObject)
      newModel.anchor.set(0.5, 0.5)
      setModelPosition(currentApp, newModel, characterId)

      modelRef.current = newModel
      setModel(newModel)
      loadedModelPathRef.current = modelPath
      console.log('Live2D model added to stage', { characterId, modelPath, stageChildren: currentApp.stage.children.length })
      
      // 定数
      const MODEL_CHECK_INTERVAL = 5000
      const MODEL_CHECK_DURATION = 30000

      // モデルが削除されないように保護（定期的にチェック）
      // パフォーマンス最適化: チェック間隔を延長してCPU負荷を軽減
      const checkModelInterval = setInterval(() => {
        if (modelRef.current && !currentApp.stage.children.includes(modelRef.current as unknown as DisplayObject)) {
          console.warn('Model was removed from stage, re-adding...', { characterId, modelPath })
          currentApp.stage.addChild(modelRef.current as unknown as DisplayObject)
        }
      }, MODEL_CHECK_INTERVAL)
      
      // クリーンアップ時にインターバルを削除
      // モデルが安定したら停止
      setTimeout(() => clearInterval(checkModelInterval), MODEL_CHECK_DURATION)
      
      // Don't set live2dViewer here, it will be set in the useEffect with position controls

      await Live2DHandler.resetToIdle(characterId)
    } catch (error) {
      console.error('Failed to load Live2D model:', error, { characterId, modelPath })
      loadedModelPathRef.current = null
      isLoadingRef.current = false
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
      if (isDragging && app) {
        // 画面全体にドラッグ可能（境界線なし、自由に移動可能）
        // 画面サイズを基準に、画面内で自由に移動できるようにする
        const canvasWidth = app.renderer.width
        const canvasHeight = app.renderer.height
        
        // 画面全体のサイズを取得（掛け合いモードでは画面全体）
        const screenWidth = window.innerWidth
        const screenHeight = window.innerHeight
        
        // モデルのサイズを考慮した移動範囲（画面内に収まるように）
        const modelWidth = model.width * model.scale.x
        const modelHeight = model.height * model.scale.y
        
        const minX = -modelWidth / 2
        const maxX = screenWidth + modelWidth / 2
        const minY = -modelHeight / 2
        const maxY = screenHeight + modelHeight / 2
        
        let newX = event.clientX - dragOffset.x
        let newY = event.clientY - dragOffset.y
        
        // 画面内に制限（ただしモデルが少しはみ出ても見えるように）
        newX = Math.max(minX, Math.min(maxX, newX))
        newY = Math.max(minY, Math.min(maxY, newY))
        
        model.x = newX
        model.y = newY
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
      
      // 親要素のサイズを取得
      const container = canvasContainerRef.current.parentElement
      const newWidth = container?.clientWidth || canvasContainerRef.current.clientWidth || window.innerWidth / 2
      const newHeight = container?.clientHeight || canvasContainerRef.current.clientHeight || window.innerHeight

      app.renderer.resize(newWidth, newHeight)

      setModelPosition(app, model, characterId)
    }, 250)

    window.addEventListener('resize', onResize)
    
    // 初回実行（マウント時に正しいサイズを設定）
    onResize()

    return () => {
      window.removeEventListener('resize', onResize)
      onResize.cancel() // クリーンアップ時にデバウンスをキャンセル
    }
  }, [app, model, characterId])

  // 各キャラクターに一意のIDを設定して、canvas要素を区別する
  const canvasId = `live2d-canvas-${characterId || 'default'}-${Date.now()}`
  
  return (
    <div className="w-full h-full">
      <canvas
        id={canvasId}
        ref={canvasContainerRef}
        className="w-full h-full"
        onContextMenu={(e) => e.preventDefault()}
      />
    </div>
  )
}

export default Live2DComponent
