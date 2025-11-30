/**
 * キャラクター名取得ユーティリティ
 * 環境変数からキャラクター名とニックネームを取得する共通関数
 */

/**
 * フルネームからニックネームを抽出
 */
function extractNickname(fullName: string, defaultNickname: string): string {
  if (fullName.includes('・')) {
    return fullName.split('・')[0]
  }
  if (fullName.includes(' ')) {
    return fullName.split(' ')[0]
  }
  return defaultNickname
}

/**
 * キャラクター名情報の型定義
 */
export interface CharacterNameInfo {
  fullName: string
  nickname: string
}

/**
 * キャラクター名情報のセット
 */
export interface CharacterNames {
  streamer: CharacterNameInfo
  characterA: CharacterNameInfo
  characterB: CharacterNameInfo
}

/**
 * 環境変数からキャラクター名とニックネームを取得
 * クライアントサイドとサーバーサイドの両方で動作
 */
export function getCharacterNames(): CharacterNames {
  // フルネームを取得
  const streamerName = process.env.NEXT_PUBLIC_STREAMER_NAME || 'ルピナス・ロゼッティ'
  const characterAName = process.env.NEXT_PUBLIC_CHARACTER_A_NAME || 'アイリス・ロゼッティ'
  const characterBName = process.env.NEXT_PUBLIC_CHARACTER_B_NAME || 'フィオナ・ロゼッティ'
  
  // ニックネームを取得（環境変数が設定されていればそれを使用、なければフルネームから抽出）
  const streamerNickname = process.env.NEXT_PUBLIC_STREAMER_NICKNAME || 
    extractNickname(streamerName, 'ルピナス')
  const characterANickname = process.env.NEXT_PUBLIC_CHARACTER_A_NICKNAME || 
    extractNickname(characterAName, 'アイリス')
  const characterBNickname = process.env.NEXT_PUBLIC_CHARACTER_B_NICKNAME || 
    extractNickname(characterBName, 'フィオナ')
  
  return {
    streamer: {
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
 * キャラクターID（'A' | 'B'）からキャラクター名情報を取得
 */
export function getCharacterNameById(characterId: 'A' | 'B'): CharacterNameInfo {
  const names = getCharacterNames()
  return characterId === 'A' ? names.characterA : names.characterB
}

/**
 * キャラクターID（'A' | 'B'）からニックネームを取得
 */
export function getCharacterNicknameById(characterId: 'A' | 'B'): string {
  return getCharacterNameById(characterId).nickname
}

/**
 * キャラクターID（'A' | 'B'）からフルネームを取得
 */
export function getCharacterFullNameById(characterId: 'A' | 'B'): string {
  return getCharacterNameById(characterId).fullName
}


