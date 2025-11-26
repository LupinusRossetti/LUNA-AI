import { useTranslation } from 'react-i18next'
import { useState, useEffect, useCallback } from 'react'
import Image from 'next/image'

import settingsStore from '@/features/stores/settings'
import { testVoiceVox, testAivisSpeech } from '@/features/messages/speakCharacter'
import { TextButton } from '../textButton'
import { Link } from '../link'
import { SaveButton } from './SaveButton'
import speakers from '../speakers.json'

// キャラクター別の音声設定コンポーネント
const CharacterVoiceSettings = ({
  characterId,
  characterName,
}: {
  characterId: 'A' | 'B'
  characterName: string
}) => {
  const { t } = useTranslation()
  const [customVoiceText, setCustomVoiceText] = useState('')
  const [aivisSpeakers, setAivisSpeakers] = useState<
    { speaker: string; id: number }[]
  >([])

  // キャラクター別の設定を取得
  const selectVoice = settingsStore(
    (s) => (characterId === 'A' ? s.selectVoiceA : s.selectVoiceB) || 'aivis_speech'
  )
  const voicevoxSpeaker = settingsStore(
    (s) => (characterId === 'A' ? s.voicevoxSpeakerA : s.voicevoxSpeakerB) || '46'
  )
  const voicevoxSpeed = settingsStore(
    (s) => (characterId === 'A' ? s.voicevoxSpeedA : s.voicevoxSpeedB) || 1.0
  )
  const voicevoxPitch = settingsStore(
    (s) => (characterId === 'A' ? s.voicevoxPitchA : s.voicevoxPitchB) || 0.0
  )
  const voicevoxIntonation = settingsStore(
    (s) => (characterId === 'A' ? s.voicevoxIntonationA : s.voicevoxIntonationB) || 1.0
  )
  const voicevoxServerUrl = settingsStore((s) => s.voicevoxServerUrl)

  const aivisSpeechSpeaker = settingsStore(
    (s) => (characterId === 'A' ? s.aivisSpeechSpeakerA : s.aivisSpeechSpeakerB) || '997152320'
  )
  const aivisSpeechSpeed = settingsStore(
    (s) => (characterId === 'A' ? s.aivisSpeechSpeedA : s.aivisSpeechSpeedB) || 1.0
  )
  const aivisSpeechPitch = settingsStore(
    (s) => (characterId === 'A' ? s.aivisSpeechPitchA : s.aivisSpeechPitchB) || 0.0
  )
  const aivisSpeechIntonationScale = settingsStore(
    (s) => (characterId === 'A' ? s.aivisSpeechIntonationScaleA : s.aivisSpeechIntonationScaleB) || 1.0
  )
  const aivisSpeechServerUrl = settingsStore((s) => s.aivisSpeechServerUrl)
  const aivisSpeechTempoDynamics = settingsStore(
    (s) => (characterId === 'A' ? s.aivisSpeechTempoDynamicsA : s.aivisSpeechTempoDynamicsB) || 1.0
  )
  const aivisSpeechPrePhonemeLength = settingsStore(
    (s) => (characterId === 'A' ? s.aivisSpeechPrePhonemeLengthA : s.aivisSpeechPrePhonemeLengthB) || 0.1
  )
  const aivisSpeechPostPhonemeLength = settingsStore(
    (s) => (characterId === 'A' ? s.aivisSpeechPostPhonemeLengthA : s.aivisSpeechPostPhonemeLengthB) || 0.1
  )

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
    if (characterId === 'A') {
      settingsStore.setState({ selectVoiceA: voice })
    } else {
      settingsStore.setState({ selectVoiceB: voice })
    }
  }

  const handleTestVoice = () => {
    if (selectVoice === 'voicevox') {
      testVoiceVox(customVoiceText || undefined, characterId)
    } else {
      testAivisSpeech(customVoiceText || undefined, characterId)
    }
  }

  return (
    <div className="mb-8 p-4 border border-gray-300 rounded-lg bg-white bg-opacity-50">
      <div className="text-xl font-bold mb-4">{characterName} の音声設定</div>

      <div className="mb-4 text-lg font-bold">
        {t('SyntheticVoiceEngineChoice')}
      </div>

      <div className="flex flex-wrap gap-3 items-center mb-4">
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

      <div className="text-sm text-text2 mb-4">
        {selectVoice === 'voicevox' ? t('VoiceVoxInfo') : t('AivisSpeechInfo')}
      </div>

      {selectVoice === 'voicevox' ? (
        <div className="space-y-6">
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
              onChange={(e) => {
                if (characterId === 'A') {
                  settingsStore.setState({ voicevoxSpeakerA: e.target.value })
                } else {
                  settingsStore.setState({ voicevoxSpeakerB: e.target.value })
                }
              }}
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
                onChange={(e) => {
                  if (characterId === 'A') {
                    settingsStore.setState({
                      voicevoxSpeedA: Number(e.target.value),
                    })
                  } else {
                    settingsStore.setState({
                      voicevoxSpeedB: Number(e.target.value),
                    })
                  }
                }}
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
                onChange={(e) => {
                  if (characterId === 'A') {
                    settingsStore.setState({
                      voicevoxPitchA: Number(e.target.value),
                    })
                  } else {
                    settingsStore.setState({
                      voicevoxPitchB: Number(e.target.value),
                    })
                  }
                }}
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
                onChange={(e) => {
                  if (characterId === 'A') {
                    settingsStore.setState({
                      voicevoxIntonationA: Number(e.target.value),
                    })
                  } else {
                    settingsStore.setState({
                      voicevoxIntonationB: Number(e.target.value),
                    })
                  }
                }}
              />
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-6">
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
              onChange={(e) => {
                if (characterId === 'A') {
                  settingsStore.setState({ aivisSpeechSpeakerA: e.target.value })
                } else {
                  settingsStore.setState({ aivisSpeechSpeakerB: e.target.value })
                }
              }}
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
                onChange={(e) => {
                  if (characterId === 'A') {
                    settingsStore.setState({
                      aivisSpeechSpeedA: Number(e.target.value),
                    })
                  } else {
                    settingsStore.setState({
                      aivisSpeechSpeedB: Number(e.target.value),
                    })
                  }
                }}
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
                onChange={(e) => {
                  if (characterId === 'A') {
                    settingsStore.setState({
                      aivisSpeechPitchA: Number(e.target.value),
                    })
                  } else {
                    settingsStore.setState({
                      aivisSpeechPitchB: Number(e.target.value),
                    })
                  }
                }}
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
                onChange={(e) => {
                  if (characterId === 'A') {
                    settingsStore.setState({
                      aivisSpeechTempoDynamicsA: Number(e.target.value),
                    })
                  } else {
                    settingsStore.setState({
                      aivisSpeechTempoDynamicsB: Number(e.target.value),
                    })
                  }
                }}
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
                onChange={(e) => {
                  if (characterId === 'A') {
                    settingsStore.setState({
                      aivisSpeechIntonationScaleA: Number(e.target.value),
                    })
                  } else {
                    settingsStore.setState({
                      aivisSpeechIntonationScaleB: Number(e.target.value),
                    })
                  }
                }}
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
                onChange={(e) => {
                  if (characterId === 'A') {
                    settingsStore.setState({
                      aivisSpeechPrePhonemeLengthA: Number(e.target.value),
                    })
                  } else {
                    settingsStore.setState({
                      aivisSpeechPrePhonemeLengthB: Number(e.target.value),
                    })
                  }
                }}
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
                onChange={(e) => {
                  if (characterId === 'A') {
                    settingsStore.setState({
                      aivisSpeechPostPhonemeLengthA: Number(e.target.value),
                    })
                  } else {
                    settingsStore.setState({
                      aivisSpeechPostPhonemeLengthB: Number(e.target.value),
                    })
                  }
                }}
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
              onChange={(e) => {
                settingsStore.setState({ aivisSpeechServerUrl: e.target.value })
              }}
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

const Voice = () => {
  const { t } = useTranslation()
  const characterAName = settingsStore((s) => s.characterAName)
  const characterBName = settingsStore((s) => s.characterBName)
  
  // 音声設定を.env形式に変換
  const getVoiceSettingsForEnv = () => {
    const ss = settingsStore.getState()
    return {
      NEXT_PUBLIC_SELECT_VOICE_A: ss.selectVoiceA || 'aivis_speech',
      NEXT_PUBLIC_SELECT_VOICE_B: ss.selectVoiceB || 'aivis_speech',
      VOICEVOX_SERVER_URL: ss.voicevoxServerUrl || 'http://localhost:50021',
      NEXT_PUBLIC_VOICEVOX_SPEAKER_A: ss.voicevoxSpeakerA || '46',
      NEXT_PUBLIC_VOICEVOX_SPEAKER_B: ss.voicevoxSpeakerB || '46',
      NEXT_PUBLIC_VOICEVOX_SPEED_A: String(ss.voicevoxSpeedA || 1.0),
      NEXT_PUBLIC_VOICEVOX_SPEED_B: String(ss.voicevoxSpeedB || 1.0),
      NEXT_PUBLIC_VOICEVOX_PITCH_A: String(ss.voicevoxPitchA || 0.0),
      NEXT_PUBLIC_VOICEVOX_PITCH_B: String(ss.voicevoxPitchB || 0.0),
      NEXT_PUBLIC_VOICEVOX_INTONATION_A: String(ss.voicevoxIntonationA || 1.0),
      NEXT_PUBLIC_VOICEVOX_INTONATION_B: String(ss.voicevoxIntonationB || 1.0),
      AIVIS_SPEECH_SERVER_URL: ss.aivisSpeechServerUrl || 'http://localhost:10101',
      NEXT_PUBLIC_AIVIS_SPEECH_SPEAKER_A: ss.aivisSpeechSpeakerA || '997152320',
      NEXT_PUBLIC_AIVIS_SPEECH_SPEAKER_B: ss.aivisSpeechSpeakerB || '1132029248',
      NEXT_PUBLIC_AIVIS_SPEECH_SPEED_A: String(ss.aivisSpeechSpeedA || 1.0),
      NEXT_PUBLIC_AIVIS_SPEECH_SPEED_B: String(ss.aivisSpeechSpeedB || 1.0),
      NEXT_PUBLIC_AIVIS_SPEECH_PITCH_A: String(ss.aivisSpeechPitchA || 0.0),
      NEXT_PUBLIC_AIVIS_SPEECH_PITCH_B: String(ss.aivisSpeechPitchB || 0.0),
      NEXT_PUBLIC_AIVIS_SPEECH_INTONATION_SCALE_A: String(ss.aivisSpeechIntonationScaleA || 1.0),
      NEXT_PUBLIC_AIVIS_SPEECH_INTONATION_SCALE_B: String(ss.aivisSpeechIntonationScaleB || 1.0),
      NEXT_PUBLIC_AIVIS_SPEECH_TEMPO_DYNAMICS_A: String(ss.aivisSpeechTempoDynamicsA || 1.0),
      NEXT_PUBLIC_AIVIS_SPEECH_TEMPO_DYNAMICS_B: String(ss.aivisSpeechTempoDynamicsB || 1.0),
      NEXT_PUBLIC_AIVIS_SPEECH_PRE_PHONEME_LENGTH_A: String(ss.aivisSpeechPrePhonemeLengthA || 0.1),
      NEXT_PUBLIC_AIVIS_SPEECH_PRE_PHONEME_LENGTH_B: String(ss.aivisSpeechPrePhonemeLengthB || 0.1),
      NEXT_PUBLIC_AIVIS_SPEECH_POST_PHONEME_LENGTH_A: String(ss.aivisSpeechPostPhonemeLengthA || 0.1),
      NEXT_PUBLIC_AIVIS_SPEECH_POST_PHONEME_LENGTH_B: String(ss.aivisSpeechPostPhonemeLengthB || 0.1),
    }
  }

  return (
    <div className="mb-10">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center">
          <Image
            src="/images/setting-icons/voice-settings.svg"
            alt="Voice Settings"
            width={24}
            height={24}
            className="mr-2"
          />
          <h2 className="text-2xl font-bold">{t('VoiceSettings')}</h2>
        </div>
        <SaveButton settingsToSave={getVoiceSettingsForEnv()} />
      </div>

      <CharacterVoiceSettings characterId="A" characterName={characterAName} />
      <CharacterVoiceSettings characterId="B" characterName={characterBName} />
    </div>
  )
}

export default Voice
