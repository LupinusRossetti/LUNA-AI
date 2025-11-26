import { useTranslation } from 'react-i18next'
import { useState, useEffect, useCallback } from 'react'
import Image from 'next/image'

import settingsStore from '@/features/stores/settings'
import { testVoiceVox, testAivisSpeech } from '@/features/messages/speakCharacter'
import { TextButton } from '../textButton'
import { Link } from '../link'
import speakers from '../speakers.json'

const Voice = () => {
  const selectVoice = settingsStore((s) => s.selectVoice)
  const voicevoxSpeaker = settingsStore((s) => s.voicevoxSpeaker)
  const voicevoxSpeed = settingsStore((s) => s.voicevoxSpeed)
  const voicevoxPitch = settingsStore((s) => s.voicevoxPitch)
  const voicevoxIntonation = settingsStore((s) => s.voicevoxIntonation)
  const voicevoxServerUrl = settingsStore((s) => s.voicevoxServerUrl)

  const aivisSpeechSpeaker = settingsStore((s) => s.aivisSpeechSpeaker)
  const aivisSpeechSpeed = settingsStore((s) => s.aivisSpeechSpeed)
  const aivisSpeechPitch = settingsStore((s) => s.aivisSpeechPitch)
  const aivisSpeechIntonationScale = settingsStore(
    (s) => s.aivisSpeechIntonationScale
  )
  const aivisSpeechServerUrl = settingsStore((s) => s.aivisSpeechServerUrl)
  const aivisSpeechTempoDynamics = settingsStore(
    (s) => s.aivisSpeechTempoDynamics
  )
  const aivisSpeechPrePhonemeLength = settingsStore(
    (s) => s.aivisSpeechPrePhonemeLength
  )
  const aivisSpeechPostPhonemeLength = settingsStore(
    (s) => s.aivisSpeechPostPhonemeLength
  )

  const { t } = useTranslation()
  const [customVoiceText, setCustomVoiceText] = useState('')
  const [aivisSpeakers, setAivisSpeakers] = useState<
    { speaker: string; id: number }[]
  >([])

  const fetchAivisSpeakers = useCallback(async () => {
    try {
      const response = await fetch('/speakers_aivis.json')
      if (!response.ok) throw new Error('Failed to load AivisSpeech speakers')
      const data = await response.json()
      setAivisSpeakers(data)
    } catch (error) {
      console.error('Failed to fetch AivisSpeech speakers:', error)
    }
  }, [])

  useEffect(() => {
    fetchAivisSpeakers()
  }, [fetchAivisSpeakers])

  const handleVoiceChange = (voice: 'voicevox' | 'aivis_speech') => {
    settingsStore.setState({ selectVoice: voice })
  }

  const handleTestVoice = () => {
    if (selectVoice === 'voicevox') {
      testVoiceVox(customVoiceText || undefined)
    } else {
      testAivisSpeech(customVoiceText || undefined)
    }
  }

  return (
    <div className="mb-10">
      <div className="flex items-center mb-6">
        <Image
          src="/images/setting-icons/voice-settings.svg"
          alt="Voice Settings"
          width={24}
          height={24}
          className="mr-2"
        />
        <h2 className="text-2xl font-bold">{t('VoiceSettings')}</h2>
      </div>

      <div className="mb-4 text-xl font-bold">
        {t('SyntheticVoiceEngineChoice')}
      </div>

      <div className="flex flex-wrap gap-3 items-center">
        <select
          value={selectVoice}
          onChange={(e) =>
            handleVoiceChange(e.target.value as 'voicevox' | 'aivis_speech')
          }
          className="px-4 py-2 bg-white hover:bg-white-hover rounded-lg"
        >
          <option value="voicevox">{t('UsingVoiceVox')}</option>
          <option value="aivis_speech">{t('UsingAivisSpeech')}</option>
        </select>
        <TextButton onClick={handleTestVoice}>{t('TestVoiceSettings')}</TextButton>
      </div>

      <div className="text-sm text-text2 mt-2">
        {selectVoice === 'voicevox' ? t('VoiceVoxInfo') : t('AivisSpeechInfo')}
      </div>

      {selectVoice === 'voicevox' ? (
        <div className="mt-6 space-y-6">
          <div>
            <div className="text-lg font-bold">{t('UsingVoiceVox')}</div>
            <div className="text-sm text-text2">
              {t('VoicevoxInfo')}
              <br />
              <Link url="https://voicevox.hiroshiba.jp/" label="VOICEVOX" />
            </div>
          </div>

          <div>
            <div className="font-bold">{t('VoicevoxServerUrl')}</div>
            <input
              className="text-ellipsis px-4 py-2 w-full bg-white hover:bg-white-hover rounded-lg"
              type="text"
              placeholder="http://localhost:50021"
              value={voicevoxServerUrl}
              onChange={(e) =>
                settingsStore.setState({ voicevoxServerUrl: e.target.value })
              }
            />
          </div>

          <div>
            <div className="font-bold">{t('SpeakerSelection')}</div>
            <select
              value={voicevoxSpeaker}
              onChange={(e) =>
                settingsStore.setState({ voicevoxSpeaker: e.target.value })
              }
              className="px-4 py-2 bg-white hover:bg-white-hover rounded-lg w-full"
            >
              <option value="">{t('Select')}</option>
              {speakers.map((speaker) => (
                <option key={speaker.id} value={String(speaker.id)}>
                  {speaker.speaker}
                </option>
              ))}
            </select>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <div className="font-bold">
                {t('VoicevoxSpeed')}: {voicevoxSpeed.toFixed(2)}
              </div>
              <input
                type="range"
                min={0.5}
                max={2}
                step={0.01}
                value={voicevoxSpeed}
                className="mt-2 mb-4 input-range"
                onChange={(e) =>
                  settingsStore.setState({
                    voicevoxSpeed: Number(e.target.value),
                  })
                }
              />
            </div>
            <div>
              <div className="font-bold">
                {t('VoicevoxPitch')}: {voicevoxPitch.toFixed(2)}
              </div>
              <input
                type="range"
                min={-0.15}
                max={0.15}
                step={0.01}
                value={voicevoxPitch}
                className="mt-2 mb-4 input-range"
                onChange={(e) =>
                  settingsStore.setState({
                    voicevoxPitch: Number(e.target.value),
                  })
                }
              />
            </div>
            <div>
              <div className="font-bold">
                {t('VoicevoxIntonation')}: {voicevoxIntonation.toFixed(2)}
              </div>
              <input
                type="range"
                min={0.0}
                max={2.0}
                step={0.01}
                value={voicevoxIntonation}
                className="mt-2 mb-4 input-range"
                onChange={(e) =>
                  settingsStore.setState({
                    voicevoxIntonation: Number(e.target.value),
                  })
                }
              />
            </div>
          </div>
        </div>
      ) : (
        <div className="mt-6 space-y-6">
          <div>
            <div className="text-lg font-bold">{t('UsingAivisSpeech')}</div>
            <div className="text-sm text-text2">
              {t('AivisSpeechInfo')}
              <br />
              <Link url="https://aivis-ai.github.io" label="AivisSpeech" />
            </div>
          </div>

          <div>
            <div className="font-bold">{t('AivisSpeechSpeaker')}</div>
            <select
              value={aivisSpeechSpeaker}
              onChange={(e) =>
                settingsStore.setState({ aivisSpeechSpeaker: e.target.value })
              }
              className="px-4 py-2 bg-white hover:bg-white-hover rounded-lg w-full"
            >
              {aivisSpeakers.map((speaker) => (
                <option key={speaker.id} value={String(speaker.id)}>
                  {speaker.speaker}
                </option>
              ))}
            </select>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <div className="font-bold">
                {t('SpeechSpeed')}: {aivisSpeechSpeed.toFixed(2)}
              </div>
              <input
                type="range"
                min={0.5}
                max={2}
                step={0.01}
                value={aivisSpeechSpeed}
                className="mt-2 mb-4 input-range"
                onChange={(e) =>
                  settingsStore.setState({
                    aivisSpeechSpeed: Number(e.target.value),
                  })
                }
              />
            </div>
            <div>
              <div className="font-bold">
                {t('Pitch')}: {aivisSpeechPitch.toFixed(2)}
              </div>
              <input
                type="range"
                min={-0.15}
                max={0.15}
                step={0.01}
                value={aivisSpeechPitch}
                className="mt-2 mb-4 input-range"
                onChange={(e) =>
                  settingsStore.setState({
                    aivisSpeechPitch: Number(e.target.value),
                  })
                }
              />
            </div>
            <div>
              <div className="font-bold">
                {t('TempoDynamics')}: {aivisSpeechTempoDynamics.toFixed(2)}
              </div>
              <input
                type="range"
                min={0.5}
                max={2.0}
                step={0.01}
                value={aivisSpeechTempoDynamics}
                className="mt-2 mb-4 input-range"
                onChange={(e) =>
                  settingsStore.setState({
                    aivisSpeechTempoDynamics: Number(e.target.value),
                  })
                }
              />
            </div>
            <div>
              <div className="font-bold">
                {t('AivisSpeechIntonationScale')}:{' '}
                {aivisSpeechIntonationScale.toFixed(2)}
              </div>
              <input
                type="range"
                min={0.0}
                max={2.0}
                step={0.01}
                value={aivisSpeechIntonationScale}
                className="mt-2 mb-4 input-range"
                onChange={(e) =>
                  settingsStore.setState({
                    aivisSpeechIntonationScale: Number(e.target.value),
                  })
                }
              />
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <div className="font-bold">
                {t('PreSilenceDuration')}: {aivisSpeechPrePhonemeLength.toFixed(2)}
              </div>
              <input
                type="range"
                min={0.0}
                max={1.0}
                step={0.01}
                value={aivisSpeechPrePhonemeLength}
                className="mt-2 mb-4 input-range"
                onChange={(e) =>
                  settingsStore.setState({
                    aivisSpeechPrePhonemeLength: Number(e.target.value),
                  })
                }
              />
            </div>
            <div>
              <div className="font-bold">
                {t('PostSilenceDuration')}:{' '}
                {aivisSpeechPostPhonemeLength.toFixed(2)}
              </div>
              <input
                type="range"
                min={0.0}
                max={1.0}
                step={0.01}
                value={aivisSpeechPostPhonemeLength}
                className="mt-2 mb-4 input-range"
                onChange={(e) =>
                  settingsStore.setState({
                    aivisSpeechPostPhonemeLength: Number(e.target.value),
                  })
                }
              />
            </div>
          </div>

          <div>
            <div className="font-bold">{t('AivisSpeechServerUrl')}</div>
            <input
              className="text-ellipsis px-4 py-2 w-full bg-white hover:bg-white-hover rounded-lg"
              type="text"
              placeholder="https://aivis.ddns.net"
              value={aivisSpeechServerUrl}
              onChange={(e) =>
                settingsStore.setState({ aivisSpeechServerUrl: e.target.value })
              }
            />
          </div>
        </div>
      )}

      <div className="mt-6">
        <div className="font-bold mb-2">{t('CustomVoiceTextPlaceholder')}</div>
        <textarea
          className="w-full px-4 py-2 bg-white hover:bg-white-hover rounded-lg"
          rows={3}
          placeholder={t('CustomVoiceTextPlaceholder')}
          value={customVoiceText}
          onChange={(e) => setCustomVoiceText(e.target.value)}
        />
      </div>
    </div>
  )
}

export default Voice

