import { useCallback, useEffect, useState } from 'react'
import settingsStore from '@/features/stores/settings'
import homeStore from '@/features/stores/home'
import menuStore from '@/features/stores/menu'
import slideStore from '@/features/stores/slide'
import { handleSendChatFn } from '../features/chat/handlers'
import { MessageInputContainer } from './messageInputContainer'
import { PresetQuestionButtons } from './presetQuestionButtons'
import { SlideText } from './slideText'
import { DraggableChatContainers } from './draggableChatContainers'

export const Form = () => {
  const modalImage = homeStore((s) => s.modalImage)
  const webcamStatus = homeStore((s) => s.webcamStatus)
  const captureStatus = homeStore((s) => s.captureStatus)
  const slideMode = settingsStore((s) => s.slideMode)
  const slideVisible = menuStore((s) => s.slideVisible)
  const slidePlaying = slideStore((s) => s.isPlaying)
  const chatProcessingCount = homeStore((s) => s.chatProcessingCount)
  const [delayedText, setDelayedText] = useState('')
  const handleSendChat = handleSendChatFn()
  
  // 掛け合いモード判定
  const isDialogueMode = process.env.NEXT_PUBLIC_DIALOGUE_MODE === 'true'
  const characterAName = settingsStore((s) => s.characterAName)
  const characterBName = settingsStore((s) => s.characterBName)

  useEffect(() => {
    // テキストと画像がそろったら、チャットを送信
    if (delayedText && modalImage) {
      handleSendChat(delayedText)
      setDelayedText('')
    }

    // コンポーネントがアンマウントされる際にpending操作をクリーンアップ
    return () => {
      if (delayedText) {
        setDelayedText('')
      }
    }
  }, [modalImage, delayedText, handleSendChat])

  const hookSendChatA = useCallback(
    (text: string) => {
      // キャラA用の送信処理
      handleSendChat(text, 'A')
    },
    [handleSendChat]
  )

  const hookSendChatB = useCallback(
    (text: string) => {
      // キャラB用の送信処理
      handleSendChat(text, 'B')
    },
    [handleSendChat]
  )

  return slideMode &&
    slideVisible &&
    slidePlaying &&
    chatProcessingCount !== 0 ? (
    <SlideText />
  ) : isDialogueMode ? (
    // 掛け合いモード: 2つのドラッグ可能なチャット欄を表示
    <DraggableChatContainers
      characterAName={characterAName}
      characterBName={characterBName}
      onChatProcessStartA={hookSendChatA}
      onChatProcessStartB={hookSendChatB}
    />
  ) : (
    // 単体モード: 1つのチャット欄を表示
    <>
      <PresetQuestionButtons onSelectQuestion={hookSendChatA} />
      <MessageInputContainer onChatProcessStart={hookSendChatA} />
    </>
  )
}
