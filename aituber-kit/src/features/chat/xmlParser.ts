/**
 * Gemini XML出力形式のパーサー
 * 
 * 形式: <A emotion="happy">...</A><B emotion="relaxed">...</B>
 */

export type ParsedDialogue = {
  character: 'A' | 'B'
  emotion: string
  text: string
  hasSearchGrounding?: boolean // サーチグラウンディングが使用されたかどうか
}

/**
 * XMLタグをパースして、キャラクターA/Bのセリフを抽出
 * 
 * @param xmlText XML形式のテキスト
 * @returns パースされた対話の配列
 */
export function parseDialogueXML(xmlText: string): ParsedDialogue[] {
  const results: ParsedDialogue[] = []

  // 1. XML形式のパース (<A>...</A>)
  const xmlTagPattern = /<(A|B)(?:\s+emotion=["']([^"']+)["'])?(?:\s+search=["']([^"']+)["'])?>(.*?)<\/\1>/gs
  let match
  while ((match = xmlTagPattern.exec(xmlText)) !== null) {
    const character = match[1] as 'A' | 'B'
    const emotion = match[2] || 'neutral'
    const searchAttr = match[3] || ''
    const text = match[4] || ''
    const hasSearchGrounding = searchAttr === 'true' || searchAttr === '1'

    if (text.trim()) {
      results.push({
        character,
        emotion,
        text: text.trim(),
        hasSearchGrounding,
      })
    }
  }

  // 2. LINE形式のパース (CHARACTER_A_NAME: [emotion] message)
  // サーチグラウンディング時にXMLが崩れるため、この形式もサポート
  if (results.length === 0) {
    const { getCharacterNames } = require('@/utils/characterNames')
    const characterNames = getCharacterNames()
    const characterAUpper = characterNames.characterA.nickname.toUpperCase()
    const characterBUpper = characterNames.characterB.nickname.toUpperCase()
    const linePattern = new RegExp(`(${characterAUpper}|${characterBUpper}):\\s*(?:\\[(.*?)\\])?\\s*(.*)`, 'g')
    let lineMatch
    while ((lineMatch = linePattern.exec(xmlText)) !== null) {
      const charName = lineMatch[1]
      const character = charName === characterAUpper ? 'A' : 'B'
      const emotion = lineMatch[2] || 'neutral'
      const text = lineMatch[3] || ''

      if (text.trim()) {
        results.push({
          character,
          emotion,
          text: text.trim(),
          hasSearchGrounding: true, // LINE形式はサーチグラウンディング時のみ使用されるためtrue
        })
      }
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

  // エスケープされた引用符を処理
  // \\"を"に変換（ただし、XML属性内のエスケープは正しく処理）
  let processedText = text
  // まず、emotion属性内のエスケープされた引用符を処理
  // emotion=\\"neutral\\"> のような形式を emotion="neutral"> に変換
  // パターン1: emotion=\\"neutral\\">
  processedText = processedText.replace(/emotion=\\"([^"]+)\\"\\>/g, 'emotion="$1">')
  // パターン2: emotion=\\"neutral\\" 
  processedText = processedText.replace(/emotion=\\"([^"]+)\\"\\s/g, 'emotion="$1" ')
  // パターン3: <A emotion=\\"neutral\\"> または <B emotion=\\"neutral\\">
  processedText = processedText.replace(/<(A|B)\s+emotion=\\"([^"]+)\\"\\>/g, '<$1 emotion="$2">')
  // search属性のエスケープも処理
  processedText = processedText.replace(/search=\\"([^"]+)\\"\\>/g, 'search="$1">')
  processedText = processedText.replace(/search=\\"([^"]+)\\"\\s/g, 'search="$1" ')
  // その他のエスケープされた引用符も処理
  // ただし、XMLタグ内のものは既に処理済みなので、残りの\\"を処理
  processedText = processedText.replace(/\\\\"/g, '"')
  // バックスラッシュのエスケープを処理（\\を\に変換、ただし\\\\は\\のまま）
  // まず、\\\\\\を\\に変換（3つのバックスラッシュを2つに）
  processedText = processedText.replace(/\\\\\\/g, '\\\\')
  // 次に、\\を\に変換（ただし、\\\\は\\のまま）
  processedText = processedText.replace(/(?<!\\)\\(?!\\)/g, '')

  // 完全なタグを順次抽出（search属性も検出）
  const tagPattern = /<(A|B)(?:\s+emotion=["']([^"']+)["'])?(?:\s+search=["']([^"']+)["'])?>(.*?)<\/\1>/gs

  let lastIndex = 0
  let match
  while ((match = tagPattern.exec(processedText)) !== null) {
    const character = match[1] as 'A' | 'B'
    const emotion = match[2] || 'neutral'
    const searchAttr = match[3] || ''
    const textContent = match[4] || ''
    const hasSearchGrounding = searchAttr === 'true' || searchAttr === '1'

    if (textContent.trim()) {
      results.push({
        character,
        emotion,
        text: textContent.trim(),
        hasSearchGrounding,
      })
    }

    lastIndex = match.index + match[0].length
  }

  // XMLが見つからない場合、LINE形式を試す
  if (results.length === 0) {
    const { getCharacterNames } = require('@/utils/characterNames')
    const characterNames = getCharacterNames()
    const characterAUpper = characterNames.characterA.nickname.toUpperCase()
    const characterBUpper = characterNames.characterB.nickname.toUpperCase()
    const linePattern = new RegExp(`(${characterAUpper}|${characterBUpper}):\\s*(?:\\[(.*?)\\])?\\s*(.*?)(?=(?:${characterAUpper}:|${characterBUpper}:|$))`, 'gs')
    // 注意: ストリーム処理なので、最後の行が不完全な可能性がある
    // 改行で区切られていると仮定するか、次のCHARACTER_A/CHARACTER_Bが来るまで待つ

    // シンプルなアプローチ: 改行で分割して処理
    const lines = processedText.split('\n')
    let currentPos = 0

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]
      const lineMatchRegex = new RegExp(`^(${characterAUpper}|${characterBUpper}):\\s*(?:\\[(.*?)\\])?\\s*(.*)`)
      const lineMatch = line.match(lineMatchRegex)

      if (lineMatch) {
        // 最後の行の場合、まだ続きがあるかもしれないのでスキップ（ただし改行で終わっていればOKだが...）
        // 安全のため、最後の行は処理しない（次のチャンクで改行が来るのを待つ）
        if (i === lines.length - 1 && !processedText.endsWith('\n')) {
          break
        }

        const charName = lineMatch[1]
        const character = charName === characterAUpper ? 'A' : 'B'
        const emotion = lineMatch[2] || 'neutral'
        const text = lineMatch[3] || ''

        if (text.trim()) {
          results.push({
            character,
            emotion,
            text: text.trim(),
            hasSearchGrounding: true,
          })
        }
        lastIndex += line.length + 1 // +1 for newline
      } else {
        // マッチしない行も進める（ゴミデータとして無視するか、前の行の続きとするか...）
        // ここでは単純に進める
        lastIndex += line.length + 1
      }
    }
  } else {
    // 最後にマッチした位置以降を残りのテキストとして保持
    remainingText = processedText.substring(lastIndex)
    return {
      completeTags: results,
      remainingText,
    }
  }

  // LINE形式の場合の残りテキスト
  remainingText = processedText.substring(lastIndex)

  return {
    completeTags: results,
    remainingText,
  }
}
