/**
 * 記憶システムの設定管理
 * 環境変数から名前と愛称を取得
 */

import { MemoryType } from './memoryTypes'

/**
 * キャラクター名と愛称を取得
 * クライアントサイドとサーバーサイドの両方で動作
 */
export function getCharacterNames() {
  // クライアントサイドでは window が存在する
  const isClient = typeof window !== 'undefined'
  
  // 環境変数から取得（NEXT_PUBLIC_プレフィックスはクライアントサイドでも利用可能）
  const streamerName = process.env.NEXT_PUBLIC_STREAMER_NAME || 'ルピナス・ロゼッティ'
  const characterAName = process.env.NEXT_PUBLIC_CHARACTER_A_NAME || 'アイリス・ロゼッティ'
  const characterBName = process.env.NEXT_PUBLIC_CHARACTER_B_NAME || 'フィオナ・ロゼッティ'
  
  // 愛称（ニックネーム）の環境変数（デフォルト値は名前から抽出）
  // デフォルト値: フルネームから最初の部分を抽出（例: "ルピナス・ロゼッティ" → "ルピナス"）
  const streamerNickname = process.env.NEXT_PUBLIC_STREAMER_NICKNAME || 
    (streamerName.includes('・') ? streamerName.split('・')[0] : streamerName.split(' ')[0] || 'ルピナス')
  const characterANickname = process.env.NEXT_PUBLIC_CHARACTER_A_NICKNAME || 
    (characterAName.includes('・') ? characterAName.split('・')[0] : characterAName.split(' ')[0] || 'アイリス')
  const characterBNickname = process.env.NEXT_PUBLIC_CHARACTER_B_NICKNAME || 
    (characterBName.includes('・') ? characterBName.split('・')[0] : characterBName.split(' ')[0] || 'フィオナ')
  
  return {
    user: {
      fullName: streamerName,
      nickname: streamerNickname,
    },
    characterA: {
      fullName: characterAName,
      nickname: characterANickname,
    },
    characterB: {
      fullName: characterBName,
      nickname: characterBNickname,
    },
  }
}

/**
 * メッセージに含まれる名前を検出してMemoryTypeを返す
 */
export function detectMemoryTypeFromMessage(
  message: string,
  characterNames: ReturnType<typeof getCharacterNames>
): MemoryType | null {
  const lowerMessage = message.toLowerCase()
  
  // ユーザー（フルネームまたは愛称）
  if (
    lowerMessage.includes(characterNames.user.fullName.toLowerCase()) ||
    lowerMessage.includes(characterNames.user.nickname.toLowerCase())
  ) {
    return 'user'
  }
  
  // キャラクターA（フルネームまたは愛称）
  if (
    lowerMessage.includes(characterNames.characterA.fullName.toLowerCase()) ||
    lowerMessage.includes(characterNames.characterA.nickname.toLowerCase())
  ) {
    return 'characterA'
  }
  
  // キャラクターB（フルネームまたは愛称）
  if (
    lowerMessage.includes(characterNames.characterB.fullName.toLowerCase()) ||
    lowerMessage.includes(characterNames.characterB.nickname.toLowerCase())
  ) {
    return 'characterB'
  }
  
  return null
}

/**
 * MemoryTypeに対応する名前と愛称を取得
 */
export function getNamesForMemoryType(
  type: MemoryType,
  characterNames: ReturnType<typeof getCharacterNames>
): { fullName: string; nickname: string } | null {
  switch (type) {
    case 'user':
      return characterNames.user
    case 'characterA':
      return characterNames.characterA
    case 'characterB':
      return characterNames.characterB
    case 'listener':
    case 'other':
      return null
  }
}

