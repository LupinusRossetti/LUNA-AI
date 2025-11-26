import homeStore from '@/features/stores/home'
import settingsStore from '@/features/stores/settings'
import { AIVoice } from '@/features/constants/settings'
import { wait } from '@/utils/wait'
import { Talk } from './messages'
import { synthesizeVoiceVoicevoxApi } from './synthesizeVoiceVoicevox'
import { synthesizeVoiceAivisSpeechApi } from './synthesizeVoiceAivisSpeech'
import toastStore from '@/features/stores/toast'
import i18next from 'i18next'
import { SpeakQueue } from './speakQueue'
import { Live2DHandler } from './live2dHandler'
import {
  asyncConvertEnglishToJapaneseReading,
  containsEnglish,
} from '@/utils/textProcessing'

const speakQueue = SpeakQueue.getInstance()

export function preprocessMessage(
  message: string,
  settings: ReturnType<typeof settingsStore.getState>
): string | null {
  // 前後の空白を削除
  let processed: string | null = message.trim()
  if (!processed) return null

  // 絵文字を削除 (これを先に行うことで変換対象のテキスト量を減らす)
  processed = processed.replace(
    /[\u{1F300}-\u{1F9FF}]|[\u{1F600}-\u{1F64F}]|[\u{1F680}-\u{1F6FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]|[\u{1F900}-\u{1F9FF}]|[\u{1F1E0}-\u{1F1FF}]/gu,
    ''
  )

  // 発音として不適切な記号のみで構成されているかチェック
  // 感嘆符、疑問符、句読点、括弧類、引用符、数学記号、その他一般的な記号を含む
  const isOnlySymbols: boolean =
    /^[!?.,。、．，'"(){}[\]<>+=\-*\/\\|;:@#$%^&*_~！？（）「」『』【】〔〕［］｛｝〈〉《》｢｣。、．，：；＋－＊／＝＜＞％＆＾｜～＠＃＄＿"　]+$/.test(
      processed
    )

  // 空文字列の場合はnullを返す
  if (processed === '' || isOnlySymbols) return null

  // 英語から日本語への変換は次の条件のみ実行
  // 1. 設定でオンになっている
  // 2. 言語が日本語
  // 3. テキストに英語のような文字が含まれている場合のみ
  if (
    settings.changeEnglishToJapanese &&
    settings.selectLanguage === 'ja' &&
    containsEnglish(processed)
  ) {
    // この時点で処理済みのテキストを返す（後で非同期で変換処理を完了する）
    return processed
  }

  // 変換不要な場合はそのまま返す
  return processed
}

async function synthesizeVoice(
  talk: Talk,
  voiceType: AIVoice,
  characterId?: 'A' | 'B'
): Promise<ArrayBuffer | null> {
  const ss = settingsStore.getState()

  try {
    switch (voiceType) {
      case 'voicevox':
        // 掛け合いモード: characterIdに応じてA/B別々の設定を使用
        const voicevoxSpeaker = characterId === 'A' ? ss.voicevoxSpeakerA : characterId === 'B' ? ss.voicevoxSpeakerB : ss.voicevoxSpeaker
        const voicevoxSpeed = characterId === 'A' ? ss.voicevoxSpeedA : characterId === 'B' ? ss.voicevoxSpeedB : ss.voicevoxSpeed
        const voicevoxPitch = characterId === 'A' ? ss.voicevoxPitchA : characterId === 'B' ? ss.voicevoxPitchB : ss.voicevoxPitch
        const voicevoxIntonation = characterId === 'A' ? ss.voicevoxIntonationA : characterId === 'B' ? ss.voicevoxIntonationB : ss.voicevoxIntonation
        return await synthesizeVoiceVoicevoxApi(
          talk,
          voicevoxSpeaker,
          voicevoxSpeed,
          voicevoxPitch,
          voicevoxIntonation,
          ss.voicevoxServerUrl
        )
      case 'aivis_speech':
        // 掛け合いモード: characterIdに応じてA/B別々の設定を使用
        const aivisSpeaker = characterId === 'A' ? ss.aivisSpeechSpeakerA : characterId === 'B' ? ss.aivisSpeechSpeakerB : ss.aivisSpeechSpeaker
        const aivisSpeed = characterId === 'A' ? ss.aivisSpeechSpeedA : characterId === 'B' ? ss.aivisSpeechSpeedB : ss.aivisSpeechSpeed
        const aivisPitch = characterId === 'A' ? ss.aivisSpeechPitchA : characterId === 'B' ? ss.aivisSpeechPitchB : ss.aivisSpeechPitch
        const aivisIntonation = characterId === 'A' ? ss.aivisSpeechIntonationScaleA : characterId === 'B' ? ss.aivisSpeechIntonationScaleB : ss.aivisSpeechIntonationScale
        const aivisTempo = characterId === 'A' ? ss.aivisSpeechTempoDynamicsA : characterId === 'B' ? ss.aivisSpeechTempoDynamicsB : ss.aivisSpeechTempoDynamics
        const aivisPrePhoneme = characterId === 'A' ? ss.aivisSpeechPrePhonemeLengthA : characterId === 'B' ? ss.aivisSpeechPrePhonemeLengthB : ss.aivisSpeechPrePhonemeLength
        const aivisPostPhoneme = characterId === 'A' ? ss.aivisSpeechPostPhonemeLengthA : characterId === 'B' ? ss.aivisSpeechPostPhonemeLengthB : ss.aivisSpeechPostPhonemeLength
        return await synthesizeVoiceAivisSpeechApi(
          talk,
          aivisSpeaker,
          aivisSpeed,
          aivisPitch,
          aivisIntonation,
          ss.aivisSpeechServerUrl,
          aivisTempo,
          aivisPrePhoneme,
          aivisPostPhoneme
        )
      default:
        return null
    }
  } catch (error) {
    handleTTSError(error, voiceType)
    return null
  }
}

const createSpeakCharacter = () => {
  let lastTime = 0
  let prevFetchPromise: Promise<unknown> = Promise.resolve()

  return (
    sessionId: string,
    talk: Talk,
    onStart?: () => void,
    onComplete?: () => void
  ) => {
    // characterIdをtalkから取得（掛け合いモード対応）
    const characterId = talk.characterId
    let called = false
    const ss = settingsStore.getState()
    onStart?.()

    const initialToken = SpeakQueue.currentStopToken

    speakQueue.checkSessionId(sessionId)

    // 停止後なら即完了
    if (SpeakQueue.currentStopToken !== initialToken) {
      if (onComplete && !called) {
        called = true
        onComplete()
      }
      return
    }

    const processedMessage = preprocessMessage(talk.message, ss)
    if (!processedMessage && !talk.buffer) {
      if (onComplete && !called) {
        called = true
        onComplete()
      }
      return
    }

    if (processedMessage) {
      talk.message = processedMessage
    } else if (talk.buffer) {
      talk.message = ''
    }

    let isNeedDecode = true

    const processAndSynthesizePromise = prevFetchPromise.then(async () => {
      const now = Date.now()
      if (now - lastTime < 1000) {
        await wait(1000 - (now - lastTime))
      }

      // ボタン停止でキャンセルされた場合はここで終了
      if (SpeakQueue.currentStopToken !== initialToken) {
        return null
      }

      if (
        processedMessage &&
        ss.changeEnglishToJapanese &&
        ss.selectLanguage === 'ja' &&
        containsEnglish(processedMessage)
      ) {
        try {
          const convertedText =
            await asyncConvertEnglishToJapaneseReading(processedMessage)
          talk.message = convertedText
        } catch (error) {
          console.error('Error converting English to Japanese:', error)
        }
      }

      let buffer
      try {
        if (talk.message == '' && talk.buffer) {
          buffer = talk.buffer
          isNeedDecode = false
        } else if (talk.message !== '') {
          // 掛け合いモード: characterIdに応じてA/B別々の音声エンジンを選択
          const voiceType = characterId === 'A' ? ss.selectVoiceA : characterId === 'B' ? ss.selectVoiceB : ss.selectVoice
          buffer = await synthesizeVoice(talk, voiceType, characterId)
        } else {
          buffer = null
        }
      } catch (error) {
        handleTTSError(error, ss.selectVoice)
        return null
      } finally {
        lastTime = Date.now()
      }

      // 合成開始前に取得した initialToken をそのまま保持する
      const tokenAtStart = initialToken
      return { buffer, isNeedDecode, tokenAtStart }
    })

    prevFetchPromise = processAndSynthesizePromise.catch((err) => {
      console.error('Speak chain error (swallowed):', err)
      // 後続処理を止めないために resolve で返す
      return null
    })

    processAndSynthesizePromise
      .then((result) => {
        if (!result || !result.buffer) {
          if (onComplete && !called) {
            called = true
            onComplete()
          }
          return
        }

        // Stop ボタン後に生成された音声でないか確認
        if (result.tokenAtStart !== SpeakQueue.currentStopToken) {
          // 生成中に Stop された => 破棄
          if (onComplete && !called) {
            called = true
            onComplete()
          }
          return
        }

        // Wrap the onComplete passed to speakQueue.addTask
        const guardedOnComplete = () => {
          if (onComplete && !called) {
            called = true
            onComplete()
          }
        }

        speakQueue.addTask({
          sessionId,
          audioBuffer: result.buffer,
          talk,
          isNeedDecode: result.isNeedDecode,
          onComplete: guardedOnComplete, // Pass the guarded function
        })
      })
      .catch((error) => {
        console.error('Error in processAndSynthesizePromise chain:', error)
        if (onComplete && !called) {
          called = true
          onComplete()
        }
      })
  }
}

export function handleTTSError(error: unknown, serviceName: string): void {
  let message: string
  if (error instanceof Error) {
    message = error.message
  } else if (typeof error === 'string') {
    message = error
  } else {
    message = i18next.t('Errors.UnexpectedError')
  }
  const errorMessage = i18next.t('Errors.TTSServiceError', {
    serviceName,
    message,
  })

  toastStore.getState().addToast({
    message: errorMessage,
    type: 'error',
    duration: 5000,
    tag: 'tts-error',
  })

  console.error(errorMessage)
}

export const speakCharacter = createSpeakCharacter()

export const testVoiceVox = async (customText?: string) => {
  await testVoice('voicevox', customText)
}

export const testAivisSpeech = async (customText?: string) => {
  await testVoice('aivis_speech', customText)
}

export const testVoice = async (voiceType: AIVoice, customText?: string) => {
  const ss = settingsStore.getState()

  const defaultMessages: Record<AIVoice, string> = {
    voicevox: 'ボイスボックスを使用します',
    aivis_speech: 'AivisSpeechを使用します',
  }

  const message = customText || defaultMessages[voiceType]

  const talk: Talk = {
    message,
    emotion: 'neutral',
  }

  try {
    const currentVoice = ss.selectVoice
    settingsStore.setState({ selectVoice: voiceType })

    const buffer = await synthesizeVoice(talk, voiceType)

    settingsStore.setState({ selectVoice: currentVoice })

    if (buffer) {
      if (ss.modelType === 'vrm') {
        const hs = homeStore.getState()
        await hs.viewer.model?.speak(buffer, talk)
      } else if (ss.modelType === 'live2d') {
        Live2DHandler.speak(buffer, talk)
      }
    }
  } catch (error) {
    console.error(`Error testing ${voiceType} voice:`, error)
    handleTTSError(error, voiceType)
  }
}
