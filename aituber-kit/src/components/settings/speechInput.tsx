import { useTranslation } from 'react-i18next'
import settingsStore from '@/features/stores/settings'
import { TextButton } from '../textButton'
import Image from 'next/image'
import { useEffect } from 'react'
import { Link } from '../link'
import { SaveButton } from './SaveButton'

const SpeechInput = () => {
  const noSpeechTimeout = settingsStore((s) => s.noSpeechTimeout)
  const showSilenceProgressBar = settingsStore((s) => s.showSilenceProgressBar)
  const speechRecognitionMode = settingsStore((s) => s.speechRecognitionMode)
  const continuousMicListeningMode = settingsStore(
    (s) => s.continuousMicListeningMode
  )
  const initialSpeechTimeout = settingsStore((s) => s.initialSpeechTimeout)

  const { t } = useTranslation()

  // realtimeAPIモードかaudioモードがオンの場合はボタンを無効化
  const isSpeechModeSwitchDisabled = false

  // .envに保存する設定を生成
  const getSpeechInputSettingsForEnv = () => {
    return {
      NEXT_PUBLIC_SPEECH_RECOGNITION_MODE: speechRecognitionMode,
      NEXT_PUBLIC_CONTINUOUS_MIC_LISTENING_MODE: continuousMicListeningMode ? 'true' : 'false',
      NEXT_PUBLIC_NO_SPEECH_TIMEOUT: noSpeechTimeout.toString(),
      NEXT_PUBLIC_INITIAL_SPEECH_TIMEOUT: initialSpeechTimeout.toString(),
      NEXT_PUBLIC_SHOW_SILENCE_PROGRESS_BAR: showSilenceProgressBar ? 'true' : 'false',
    }
  }

  return (
    <div className="mb-10">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center">
          <Image
            src="/images/setting-icons/microphone-settings.svg"
            alt="Microphone Settings"
            width={24}
            height={24}
            className="mr-2"
          />
          <h2 className="text-2xl font-bold">{t('SpeechInputSettings')}</h2>
        </div>
        <SaveButton settingsToSave={getSpeechInputSettingsForEnv()} />
      </div>
      <div className="my-6">
        <div className="my-4 text-xl font-bold">
          {t('SpeechRecognitionMode')}
        </div>
        <div className="my-4 whitespace-pre-line">
          {t('SpeechRecognitionModeInfo')}
        </div>
        {isSpeechModeSwitchDisabled && (
          <div className="my-4 text-sm text-orange-500 whitespace-pre-line">
            {t('SpeechRecognitionModeDisabledInfo')}
          </div>
        )}
        <div className="mt-2">
          <TextButton disabled={isSpeechModeSwitchDisabled}>
            {t('BrowserSpeechRecognition')}
          </TextButton>
        </div>
      </div>
      {speechRecognitionMode === 'browser' && (
        <>
          <div className="my-6">
            <div className="my-4 text-xl font-bold">
              {t('InitialSpeechTimeout')}
            </div>
            <div className="my-4 whitespace-pre-line">
              {t('InitialSpeechTimeoutInfo')}
            </div>
            <div className="mt-6 font-bold">
              <div className="select-none">
                {t('InitialSpeechTimeout')}: {initialSpeechTimeout.toFixed(1)}秒
              </div>
              <input
                type="range"
                min="0"
                max="60"
                step="0.5"
                value={initialSpeechTimeout}
                onChange={(e) =>
                  settingsStore.setState({
                    initialSpeechTimeout: parseFloat(e.target.value),
                  })
                }
                className="mt-2 mb-4 input-range"
              />
            </div>
          </div>
          <div className="my-6">
            <div className="my-4 text-xl font-bold">{t('NoSpeechTimeout')}</div>
            <div className="my-4 whitespace-pre-line">
              {t('NoSpeechTimeoutInfo')}
            </div>
            <div className="mt-6 font-bold">
              <div className="select-none">
                {t('NoSpeechTimeout')}: {noSpeechTimeout.toFixed(1)}秒
              </div>
              <input
                type="range"
                min="0"
                max="10"
                step="0.5"
                value={noSpeechTimeout}
                onChange={(e) =>
                  settingsStore.setState({
                    noSpeechTimeout: parseFloat(e.target.value),
                  })
                }
                className="mt-2 mb-4 input-range"
              />
            </div>
            <div className="mt-6">
              <div className="font-bold mb-2">
                {t('ShowSilenceProgressBar')}
              </div>
              <TextButton
                onClick={() =>
                  settingsStore.setState({
                    showSilenceProgressBar: !showSilenceProgressBar,
                  })
                }
              >
                {showSilenceProgressBar ? t('StatusOn') : t('StatusOff')}
              </TextButton>
            </div>
          </div>
          <div className="my-6">
            <div className="my-4 text-xl font-bold">{t('ContinuousMic')}</div>
            <div className="my-4 whitespace-pre-line">
              {t('ContinuousMicInfo')}
            </div>
            <TextButton
              onClick={() =>
                settingsStore.setState({
                  continuousMicListeningMode: !continuousMicListeningMode,
                })
              }
            >
              {continuousMicListeningMode ? t('StatusOn') : t('StatusOff')}
            </TextButton>
          </div>
        </>
      )}
    </div>
  )
}

export default SpeechInput
