/**
 * 記憶システムの型定義
 */

export type MemoryType = 
  | 'user'       // ユーザー（NEXT_PUBLIC_STREAMER_NAME）
  | 'characterA' // キャラクターA（NEXT_PUBLIC_CHARACTER_A_NAME）
  | 'characterB' // キャラクターB（NEXT_PUBLIC_CHARACTER_B_NAME）
  | 'listener'   // リスナー（YouTubeコメント）
  | 'other'      // その他

// 後方互換性のためのマッピング（環境変数から動的に生成）
export function getLegacyMemoryTypeMap(): Record<string, MemoryType> {
  const { getCharacterNames } = require('@/utils/characterNames')
  const characterNames = getCharacterNames()
  const streamerNickname = characterNames.streamer.nickname
  const characterANickname = characterNames.characterA.nickname
  const characterBNickname = characterNames.characterB.nickname
  
  return {
    'rupinus_conversation': 'user',
    'rupinus': 'user',
    [streamerNickname.toLowerCase()]: 'user',
    [streamerNickname.toLowerCase() + '_conversation']: 'user',
    'iris': 'characterA', // 後方互換性のため残す
    [characterANickname.toLowerCase()]: 'characterA',
    [characterANickname.toLowerCase() + '_conversation']: 'characterA',
    'fiona': 'characterB', // 後方互換性のため残す
    [characterBNickname.toLowerCase()]: 'characterB',
    [characterBNickname.toLowerCase() + '_conversation']: 'characterB',
    'listener_conversation': 'listener',
    'character_info': 'other',
  }
}

// 後方互換性のためのマッピング（静的定義、後方互換性のため残す）
export const legacyMemoryTypeMap: Record<string, MemoryType> = {
  'rupinus_conversation': 'user',
  'rupinus': 'user',
  'iris': 'characterA',
  'fiona': 'characterB',
  'listener_conversation': 'listener',
  'character_info': 'other',
}

export type MemorySource = 
  | 'chat'      // チャット欄から送信
  | 'youtube'   // YouTubeコメント

export interface Memory {
  id: string
  type: MemoryType
  source: MemorySource      // 記憶の出所
  content: string           // 記憶の内容（日本語で読みやすい形式）
  relatedName?: string      // 関連する名前（ルピナス、リスナー名、アイリス、フィオナなど）
  keywords: string[]        // 検索用キーワード
  timestamp: string         // 記憶が作成された日時
  relevanceScore?: number   // 関連度スコア（検索時に使用）
  canDelete: boolean        // 削除可能かどうか（デフォルト: true）
}

export interface MemoryStorage {
  memories: Memory[]
  version: string           // 記憶ファイルのバージョン
  lastUpdated: string       // 最終更新日時
}

