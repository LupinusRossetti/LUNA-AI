export type Message = {
  id?: string
  role: string // "assistant" | "system" | "user";
  content?:
    | string
    | [{ type: 'text'; text: string }, { type: 'image'; image: string }] // マルチモーダル拡張
  audio?: { id: string }
  timestamp?: string
  type?: string
  youtube?: boolean
  hasSearchGrounding?: boolean // サーチグラウンディングが使用されたかどうか
  listenerName?: string // YouTubeコメントからのリスナー名
}

export const EMOTIONS = [
  'neutral',
  'happy',
  'angry',
  'sad',
  'relaxed',
  'surprised',
] as const
export type EmotionType = (typeof EMOTIONS)[number]

export type Talk = {
  emotion: EmotionType
  message: string
  buffer?: ArrayBuffer
  characterId?: 'A' | 'B' // 掛け合いモード用: キャラクターID
}

export const splitSentence = (text: string): string[] => {
  const splitMessages = text.split(/(?<=[。．！？\n])/g)
  return splitMessages.filter((msg) => msg !== '')
}
