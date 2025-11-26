import { useEffect } from 'react'
import { MessageInput } from '@/components/messageInput'
import homeStore from '@/features/stores/home'
import settingsStore from '@/features/stores/settings'
import { useVoiceRecognition } from '@/hooks/useVoiceRecognition'

// 無音検出用の状態と変数を追加
type Props = {
  onChatProcessStart: (text: string) => void
  onResetPosition?: () => void // 元の位置に戻すボタン（掛け合いモード用）
  characterName?: string // キャラクター名（掛け合いモード用）
  containerWidth?: number // コンテナの幅（掛け合いモード用）
}

export const MessageInputContainer = ({ onChatProcessStart, onResetPosition, characterName, containerWidth }: Props) => {
  const isSpeaking = homeStore((s) => s.isSpeaking)
  const continuousMicListeningMode = settingsStore(
    (s) => s.continuousMicListeningMode
  )
  const speechRecognitionMode = settingsStore((s) => s.speechRecognitionMode)

  // 音声認識フックを使用
  const {
    userMessage,
    isListening,
    silenceTimeoutRemaining,
    handleInputChange,
    handleSendMessage,
    toggleListening,
    handleStopSpeaking,
    startListening,
    stopListening,
  } = useVoiceRecognition({ onChatProcessStart })

  // 常時マイク入力モードの切り替え
  const toggleContinuousMode = () => {
    // Whisperモードの場合は常時マイク入力モードを使用できない
    if (speechRecognitionMode === 'whisper') return

    // 現在のモードを反転して設定
    settingsStore.setState({
      continuousMicListeningMode: !continuousMicListeningMode,
    })
  }

  return (
    <MessageInput
      userMessage={userMessage}
      isMicRecording={isListening}
      onChangeUserMessage={handleInputChange}
      onClickMicButton={toggleListening}
      onClickSendButton={handleSendMessage}
      onClickStopButton={handleStopSpeaking}
      isSpeaking={isSpeaking}
      silenceTimeoutRemaining={silenceTimeoutRemaining}
      continuousMicListeningMode={
        continuousMicListeningMode && speechRecognitionMode === 'browser'
      }
      onToggleContinuousMode={toggleContinuousMode}
      onResetPosition={onResetPosition}
      characterName={characterName}
      containerWidth={containerWidth}
    />
  )
}
