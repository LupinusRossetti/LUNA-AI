export type AIVoice = 'voicevox' | 'aivis_speech'

export type Language = (typeof LANGUAGES)[number]

export const LANGUAGES = [
  'en',
  'ja',
  'ko',
  'zh',
  'vi',
  'fr',
  'es',
  'pt',
  'de',
  'ru',
  'it',
  'ar',
  'hi',
  'pl',
  'th',
] as const

export const isLanguageSupported = (language: string): language is Language =>
  LANGUAGES.includes(language as Language)

export type VoiceLanguage =
  | 'en-US'
  | 'ja-JP'
  | 'ko-KR'
  | 'zh-TW'
  | 'vi-VN'
  | 'fr-FR'
  | 'es-ES'
  | 'pt-PT'
  | 'de-DE'
  | 'ru-RU'
  | 'it-IT'
  | 'ar-SA'
  | 'hi-IN'
  | 'pl-PL'
  | 'th-TH'

