/**
 * 記憶システムの設定管理
 * 環境変数から名前と愛称を取得
 */

import { MemoryType } from './memoryTypes'
import { getCharacterNames as getCharacterNamesUtil, CharacterNames } from '@/utils/characterNames'

/**
 * キャラクター名と愛称を取得
 * クライアントサイドとサーバーサイドの両方で動作
 * @deprecated この関数は後方互換性のため残しています。新しいコードでは @/utils/characterNames の getCharacterNames を使用してください。
 */
export function getCharacterNames(): {
  user: { fullName: string; nickname: string }
  characterA: { fullName: string; nickname: string }
  characterB: { fullName: string; nickname: string }
} {
  const names = getCharacterNamesUtil()
  return {
    user: names.streamer,
    characterA: names.characterA,
    characterB: names.characterB,
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

