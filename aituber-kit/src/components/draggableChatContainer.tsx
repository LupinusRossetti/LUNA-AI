import { useState, useRef, useEffect, useCallback } from 'react'
import { MessageInputContainer } from './messageInputContainer'
import { PresetQuestionButtons } from './presetQuestionButtons'
import settingsStore from '@/features/stores/settings'

type DraggableChatContainerProps = {
  characterId: 'A' | 'B'
  characterName: string
  onChatProcessStart: (text: string) => void
  initialPosition?: { x: number; y: number }
  isTop?: boolean // キャラAは上、キャラBは下
  sharedWidth?: number // 2列で共有する幅
}

export const DraggableChatContainer = ({
  characterId,
  characterName,
  onChatProcessStart,
  initialPosition,
  isTop = false,
  sharedWidth,
}: DraggableChatContainerProps) => {
  // 2列で共有する幅を計算（セリフ枠より若干長く、初期値は900px）
  const calculatedWidth = sharedWidth || 900
  const [width, setWidth] = useState(calculatedWidth)
  
  // sharedWidthが変更されたときにwidthも更新
  useEffect(() => {
    if (sharedWidth) {
      setWidth(sharedWidth)
    }
  }, [sharedWidth])
  
  // リサイズ用の状態
  const [isResizing, setIsResizing] = useState(false)
  const [resizeStartX, setResizeStartX] = useState(0)
  const [resizeStartWidth, setResizeStartWidth] = useState(0)
  const [resizeStartRight, setResizeStartRight] = useState(0) // リサイズ開始時の右端位置
  const [resizeSide, setResizeSide] = useState<'left' | 'right' | null>(null)
  
  const [position, setPosition] = useState(() => {
    // 初期位置が指定されている場合はそれを使用、なければデフォルト位置
    if (initialPosition) {
      return initialPosition
    }
    // デフォルト位置: 画面下部に2列縦に並ぶ（bottomで設定）
    const screenWidth = typeof window !== 'undefined' ? window.innerWidth : 1920
    const containerHeight = 150 // チャット欄の高さ
    
    if (characterId === 'A') {
      // キャラA: bottomが5rem
      return {
        x: (screenWidth - (sharedWidth || 1000)) / 2, // 中央揃え
        bottom: '5rem',
      }
    } else {
      // キャラB: bottomが0
      return {
        x: (screenWidth - (sharedWidth || 1000)) / 2, // 中央揃え
        bottom: 0,
      }
    }
  })
  
  const [isDragging, setIsDragging] = useState(false)
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 })
  const containerRef = useRef<HTMLDivElement>(null)
  const leftResizeHandleRef = useRef<HTMLDivElement>(null)
  const rightResizeHandleRef = useRef<HTMLDivElement>(null)
  const initialPositionRef = useRef(position) // 元の位置を保存
  const hasBeenMovedRef = useRef(false) // ドラッグやリサイズが行われたかどうか
  const hasBeenResizedRef = useRef(false) // リサイズが行われたかどうか

  // リサイズ開始
  const handleResizeStart = useCallback((e: React.MouseEvent, side: 'left' | 'right') => {
    e.stopPropagation()
    setIsResizing(true)
    setResizeSide(side)
    setResizeStartX(e.clientX)
    setResizeStartWidth(width)
    hasBeenResizedRef.current = true // リサイズが行われたことを記録
    // リサイズ開始時の右端位置を保存（左端リサイズ時に使用）
    if (containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect()
      setResizeStartRight(rect.right)
    }
  }, [width])

  // リサイズ中
  const handleResizeMove = useCallback((e: MouseEvent) => {
    if (isResizing && containerRef.current) {
      const deltaX = e.clientX - resizeStartX
      const minWidth = 300 // 最小幅
      const maxWidth = 2000 // 最大幅
      
      let newWidth = resizeStartWidth
      
      if (resizeSide === 'left') {
        // 左側をリサイズする場合も右端と同じ挙動（幅だけ変更、右端を固定）
        newWidth = resizeStartWidth - deltaX
        newWidth = Math.max(minWidth, Math.min(maxWidth, newWidth))
        // 右端を固定するため、保存した右端位置から新しい幅を引いて左端の位置を計算
        setPosition(prev => {
          const newX = resizeStartRight - newWidth
          // bottomで設定されている場合はbottomを維持
          if (typeof prev.bottom === 'number') {
            return {
              x: newX,
              bottom: prev.bottom,
            }
          } else {
            return {
              x: newX,
              y: prev.y,
            }
          }
        })
      } else if (resizeSide === 'right') {
        newWidth = resizeStartWidth + deltaX
        newWidth = Math.max(minWidth, Math.min(maxWidth, newWidth))
      }
      
      setWidth(newWidth)
    }
  }, [isResizing, resizeStartX, resizeStartWidth, resizeSide])

  // リサイズ終了
  const handleResizeEnd = useCallback(() => {
    setIsResizing(false)
    setResizeSide(null)
  }, [])

  useEffect(() => {
    if (isResizing) {
      window.addEventListener('mousemove', handleResizeMove)
      window.addEventListener('mouseup', handleResizeEnd)
      return () => {
        window.removeEventListener('mousemove', handleResizeMove)
        window.removeEventListener('mouseup', handleResizeEnd)
      }
    }
  }, [isResizing, handleResizeMove, handleResizeEnd])

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    // リサイズ中またはリサイズハンドルをクリックした場合はドラッグを無効化
    if (isResizing || e.target === leftResizeHandleRef.current || e.target === rightResizeHandleRef.current) {
      return
    }
    if (containerRef.current) {
      setIsDragging(true)
      hasBeenMovedRef.current = true // ドラッグが行われたことを記録
      const rect = containerRef.current.getBoundingClientRect()
      setDragOffset({
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
      })
    }
  }, [isResizing])

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (isDragging && containerRef.current) {
      const screenWidth = window.innerWidth
      const screenHeight = window.innerHeight
      const containerWidth = containerRef.current.offsetWidth
      const containerHeight = containerRef.current.offsetHeight
      
      let newX = e.clientX - dragOffset.x
      let newY = e.clientY - dragOffset.y
      
      // 画面内に制限
      newX = Math.max(0, Math.min(newX, screenWidth - containerWidth))
      newY = Math.max(0, Math.min(newY, screenHeight - containerHeight))
      
      // bottomで設定されている場合はbottomを維持、そうでなければyを使用
      if (typeof position.bottom === 'number') {
        // bottomで設定されている場合、bottomを計算（画面高さからyを引く）
        const newBottom = screenHeight - newY - containerHeight
        setPosition({ x: newX, bottom: Math.max(0, newBottom) })
      } else {
        setPosition({ x: newX, y: newY })
      }
    }
  }, [isDragging, dragOffset])

  const handleMouseUp = useCallback(() => {
    setIsDragging(false)
  }, [])

  useEffect(() => {
    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove)
      window.addEventListener('mouseup', handleMouseUp)
      return () => {
        window.removeEventListener('mousemove', handleMouseMove)
        window.removeEventListener('mouseup', handleMouseUp)
      }
    }
  }, [isDragging, handleMouseMove, handleMouseUp])

  const handleResetPosition = useCallback(() => {
    setPosition(initialPositionRef.current)
    hasBeenMovedRef.current = false // 位置をリセットしたので、フラグもリセット
    hasBeenResizedRef.current = false
  }, [])

  // ウィンドウリサイズ時に、ドラッグやリサイズが行われていない場合は中央に再配置
  useEffect(() => {
    const handleResize = () => {
      // ドラッグやリサイズが一度も行われていない場合のみ中央に再配置
      if (!hasBeenMovedRef.current && !hasBeenResizedRef.current && containerRef.current) {
        const screenWidth = window.innerWidth
        const newX = (screenWidth - width) / 2 // 中央揃え
        
        setPosition(prev => {
          // bottomを維持しつつ、xのみ更新
          if (typeof prev.bottom === 'number') {
            return { x: newX, bottom: prev.bottom }
          } else if (typeof prev.bottom === 'string') {
            return { x: newX, bottom: prev.bottom }
          } else {
            return { x: newX, y: prev.y }
          }
        })
        
        // 初期位置も更新
        initialPositionRef.current = {
          x: newX,
          bottom: typeof position.bottom === 'number' ? position.bottom : typeof position.bottom === 'string' ? position.bottom : undefined,
        }
      }
    }

    window.addEventListener('resize', handleResize)
    return () => {
      window.removeEventListener('resize', handleResize)
    }
  }, [width, position.bottom])

  return (
    <div
      ref={containerRef}
      style={{
        position: 'fixed',
        left: `${position.x}px`,
        bottom: typeof position.bottom === 'number' ? `${position.bottom}px` : typeof position.bottom === 'string' ? position.bottom : undefined,
        top: typeof position.y === 'number' ? `${position.y}px` : undefined, // レガシー対応
        zIndex: characterId === 'B' ? 2 : 1, // キャラBを少し前面に（ドラッグ可能にするため）、Live2D（z-0）より前面、会話ログ・セリフ枠（z-10）より背面
        cursor: isDragging ? 'grabbing' : 'grab',
        display: 'flex',
        flexDirection: 'row',
        width: `${width}px`,
        pointerEvents: 'auto', // ドラッグとフォーカスを有効化
      }}
      onMouseDown={handleMouseDown}
      className="shadow-lg"
    >
      {/* 左側のリサイズハンドル */}
      <div
        ref={leftResizeHandleRef}
        className="bg-pink-200 bg-opacity-70 rounded-l-lg flex-shrink-0 cursor-ew-resize hover:bg-pink-300 transition-colors"
        style={{ width: '8px', alignSelf: 'stretch' }}
        onMouseDown={(e) => handleResizeStart(e, 'left')}
      ></div>
      
      {/* チャット欄コンテンツ（薄いピンク色の背景） */}
      <div className="flex-1 min-w-0 bg-pink-100 bg-opacity-90 flex flex-col" style={{ width: `${width - 16}px`, pointerEvents: 'auto' }}>
        <PresetQuestionButtons onSelectQuestion={onChatProcessStart} />
        <MessageInputContainer 
          onChatProcessStart={onChatProcessStart} 
          onResetPosition={handleResetPosition}
          characterName={characterName}
          containerWidth={width - 16} // 左右のリサイズハンドルを引く
        />
      </div>
      
      {/* 右側のリサイズハンドル */}
      <div
        ref={rightResizeHandleRef}
        className="bg-pink-200 bg-opacity-70 rounded-r-lg flex-shrink-0 cursor-ew-resize hover:bg-pink-300 transition-colors"
        style={{ width: '8px', alignSelf: 'stretch' }}
        onMouseDown={(e) => handleResizeStart(e, 'right')}
      ></div>
    </div>
  )
}

