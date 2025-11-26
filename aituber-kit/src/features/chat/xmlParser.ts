/**
 * Gemini XML出力形式のパーサー
 * 
 * 形式: <A emotion="happy">...</A><B emotion="relaxed">...</B>
 */

export type ParsedDialogue = {
  character: 'A' | 'B'
  emotion: string
  text: string
}

/**
 * XMLタグをパースして、キャラクターA/Bのセリフを抽出
 * 
 * @param xmlText XML形式のテキスト
 * @returns パースされた対話の配列
 */
export function parseDialogueXML(xmlText: string): ParsedDialogue[] {
  const results: ParsedDialogue[] = []
  
  // <A> または <B> タグを検索
  const tagPattern = /<(A|B)(?:\s+emotion=["']([^"']+)["'])?>(.*?)<\/\1>/gs
  
  let match
  while ((match = tagPattern.exec(xmlText)) !== null) {
    const character = match[1] as 'A' | 'B'
    const emotion = match[2] || 'neutral'
    const text = match[3] || ''
    
    if (text.trim()) {
      results.push({
        character,
        emotion,
        text: text.trim(),
      })
    }
  }
  
  return results
}

/**
 * 不完全なXMLタグを検出（ストリーム処理用）
 * 
 * @param text 現在のテキスト
 * @returns 不完全なタグがあるかどうか
 */
export function hasIncompleteXMLTag(text: string): boolean {
  // 開始タグはあるが、終了タグがない場合を検出
  const openATag = /<A(?:\s+[^>]*)?>/i.test(text)
  const closeATag = /<\/A>/i.test(text)
  const openBTag = /<B(?:\s+[^>]*)?>/i.test(text)
  const closeBTag = /<\/B>/i.test(text)
  
  // Aタグが開いているが閉じていない、またはBタグが開いているが閉じていない
  if (openATag && !closeATag) return true
  if (openBTag && !closeBTag) return true
  
  // 終了タグがあるが、開始タグがない（不完全な状態）
  if (closeATag && !openATag) return true
  if (closeBTag && !openBTag) return true
  
  return false
}

/**
 * テキストからXMLタグを抽出（ストリーム処理用）
 * 不完全なタグがある場合は、完全になるまで待つ
 * 
 * @param text 現在のテキスト
 * @returns 完全なXMLタグの配列と、残りのテキスト
 */
export function extractCompleteXMLTags(text: string): {
  completeTags: ParsedDialogue[]
  remainingText: string
} {
  const results: ParsedDialogue[] = []
  let remainingText = text
  
  // 完全なタグを順次抽出
  const tagPattern = /<(A|B)(?:\s+emotion=["']([^"']+)["'])?>(.*?)<\/\1>/gs
  
  let lastIndex = 0
  let match
  while ((match = tagPattern.exec(text)) !== null) {
    const character = match[1] as 'A' | 'B'
    const emotion = match[2] || 'neutral'
    const textContent = match[3] || ''
    
    if (textContent.trim()) {
      results.push({
        character,
        emotion,
        text: textContent.trim(),
      })
    }
    
    lastIndex = match.index + match[0].length
  }
  
  // 最後にマッチした位置以降を残りのテキストとして保持
  remainingText = text.substring(lastIndex)
  
  return {
    completeTags: results,
    remainingText,
  }
}

