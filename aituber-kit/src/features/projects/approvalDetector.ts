/**
 * ルピナスの承認判定ロジック
 */

/**
 * 肯定キーワード一覧（拡張版）
 */
const AFFIRMATIVE_KEYWORDS = [
  // 日本語
  'はい', 'いい', 'やる', 'やります', 'やろう', 'やるよ', 'やるね',
  'ok', 'オーケー', '了解', '了解です', '了解しました',
  '承認', '承認します', '承認しました',
  'いいよ', 'いいね', 'いいです', 'いいですね',
  '賛成', '賛成です', '賛成します',
  'お願いします', 'お願い', '頼む',
  'ぜひ', 'ぜひとも', 'ぜひお願いします',
  '楽しみ', '楽しみです', '楽しみにしてます',
  // 英語
  'yes', 'yeah', 'yep', 'yup', 'ok', 'okay', 'sure', 'alright', 'go', "let's go",
  // 音声認識の誤認識も考慮
  'はーい', 'はー', 'やーる', 'やー', 'おーけー',
]

/**
 * 否定キーワード一覧
 */
const NEGATIVE_KEYWORDS = [
  // 日本語
  'いいえ', 'いや', 'だめ', 'だめです', 'だめだ',
  'やらない', 'やめとく', 'やめます', 'やめます',
  '断る', '断ります', 'お断りします',
  '今回はやめとく', '今回はやめます',
  // 英語
  'no', 'nope', 'nah', 'not', "don't", 'stop',
]

/**
 * メッセージが肯定かどうかを判定
 */
export const isAffirmative = (message: string): boolean => {
  const normalizedMessage = message.trim().toLowerCase()
  
  // 肯定キーワードが含まれているかチェック
  for (const keyword of AFFIRMATIVE_KEYWORDS) {
    if (normalizedMessage.includes(keyword.toLowerCase())) {
      return true
    }
  }
  
  return false
}

/**
 * メッセージが否定かどうかを判定
 */
export const isNegative = (message: string): boolean => {
  const normalizedMessage = message.trim().toLowerCase()
  
  // 否定キーワードが含まれているかチェック
  for (const keyword of NEGATIVE_KEYWORDS) {
    if (normalizedMessage.includes(keyword.toLowerCase())) {
      return true
    }
  }
  
  return false
}

/**
 * メッセージが承認関連かどうかを判定（肯定または否定）
 */
export const isApprovalRelated = (message: string): boolean => {
  return isAffirmative(message) || isNegative(message)
}

