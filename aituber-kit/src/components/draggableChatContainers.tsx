import { useMemo } from 'react'
import { DraggableChatContainer } from './draggableChatContainer'
import settingsStore from '@/features/stores/settings'

type DraggableChatContainersProps = {
  characterAName: string
  characterBName: string
  onChatProcessStartA: (text: string) => void
  onChatProcessStartB: (text: string) => void
}

export const DraggableChatContainers = ({
  characterAName,
  characterBName,
  onChatProcessStartA,
  onChatProcessStartB,
}: DraggableChatContainersProps) => {
  // 2列で共有する幅（セリフ枠より長く、初期値は1000px）
  const sharedWidth = useMemo(() => {
    return 1000 // セリフ枠（max-w-4xl = 896px）より長い
  }, [])

  // 初期位置: 画面最下部中央に中央揃え、2列縦に並ぶ
  const screenWidth = typeof window !== 'undefined' ? window.innerWidth : 1920
  const screenHeight = typeof window !== 'undefined' ? window.innerHeight : 1080
  const containerHeight = 150 // チャット欄の高さ（細い状態）
  const gap = 8 // 2列の間隔

  const initialPositionA = useMemo(() => ({
    x: (screenWidth - sharedWidth) / 2, // 中央揃え
    bottom: '5rem', // 5rem
  }), [screenWidth, sharedWidth])

  const initialPositionB = useMemo(() => ({
    x: (screenWidth - sharedWidth) / 2, // 中央揃え
    bottom: 0, // 画面最下部
  }), [screenWidth, sharedWidth])

  return (
    <>
      <DraggableChatContainer
        characterId="A"
        characterName={characterAName}
        onChatProcessStart={onChatProcessStartA}
        initialPosition={initialPositionA}
        isTop={true}
        sharedWidth={sharedWidth}
      />
      <DraggableChatContainer
        characterId="B"
        characterName={characterBName}
        onChatProcessStart={onChatProcessStartB}
        initialPosition={initialPositionB}
        isTop={false}
        sharedWidth={sharedWidth}
      />
    </>
  )
}

