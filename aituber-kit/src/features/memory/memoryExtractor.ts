/**
 * 会話から記憶を抽出する機能
 * ルピナス、リスナー、キャラクター情報のみを抽出
 */

import { Memory, MemoryType, MemorySource, legacyMemoryTypeMap, getLegacyMemoryTypeMap } from './memoryTypes'
import { saveMemory } from './memoryManager'
import { getCharacterNames, getNamesForMemoryType } from './memoryConfig'

/**
 * ユーザーとの会話から記憶を抽出する
 */
export function extractMemoriesFromUserConversation(
  userMessage: string,
  assistantMessage: string
): Promise<Memory[]> {
  const extractedMemories: Promise<Memory>[] = []
  const characterNames = getCharacterNames()
  const userNames = characterNames.user
  
  // ユーザーの名前や重要な情報を抽出
  // フルネームまたは愛称で検出
  
  // 名前の抽出（フルネームまたは愛称）
  const namePatterns = [
    /(?:私|わたし|ぼく|おれ|わたくし)は(.+?)です/,
    /(?:名前|なまえ)は(.+?)(?:です|だ|だよ|だね)/,
    /(.+?)と(?:申します|いいます)/,
  ]
  
  for (const pattern of namePatterns) {
    const match = userMessage.match(pattern)
    if (match && match[1]) {
      const name = match[1].trim()
      // フルネームまたは愛称に一致するかチェック
      if (
        name === userNames.fullName ||
        name === userNames.nickname ||
        userNames.fullName.includes(name) ||
        userNames.nickname.includes(name)
      ) {
        if (name.length > 0 && name.length < 50) {
          extractedMemories.push(
            saveMemory({
              type: 'user',
              source: 'chat',
              content: `${userNames.nickname}の名前は${name}です`,
              relatedName: userNames.nickname,
              keywords: [name, userNames.fullName, userNames.nickname, '名前'],
            })
          )
        }
      }
    }
  }
  
  // 好みや重要な情報の抽出
  const preferencePatterns = [
    /(?:好き|すき|好み|このみ)な(?:もの|こと|の)は(.+?)(?:です|だ|だよ|だね|です)/,
    /(.+?)(?:が|を)(?:好き|すき|好み)/,
  ]
  
  for (const pattern of preferencePatterns) {
    const match = userMessage.match(pattern)
    if (match && match[1]) {
      const preference = match[1].trim()
      if (preference.length > 0 && preference.length < 100) {
        extractedMemories.push(
          saveMemory({
            type: 'user',
            source: 'chat',
            content: `${userNames.nickname}の好みや興味: ${preference}`,
            relatedName: userNames.nickname,
            keywords: [preference, userNames.fullName, userNames.nickname, '好み'],
          })
        )
      }
    }
  }
  
  return Promise.all(extractedMemories)
}

/**
 * リスナー（YouTubeコメント）との会話から記憶を抽出する
 */
export function extractMemoriesFromListenerConversation(
  listenerName: string,
  listenerMessage: string,
  assistantMessage: string
): Promise<Memory[]> {
  const extractedMemories: Promise<Memory>[] = []
  
  // リスナー名と結び付けて記憶
  // リスナーの好みや重要な情報を抽出
  
  // 好みや重要な情報の抽出
  const preferencePatterns = [
    /(?:好き|すき|好み|このみ)な(?:もの|こと|の)は(.+?)(?:です|だ|だよ|だね|です)/,
    /(.+?)(?:が|を)(?:好き|すき|好み)/,
  ]
  
  for (const pattern of preferencePatterns) {
    const match = listenerMessage.match(pattern)
    if (match && match[1]) {
      const preference = match[1].trim()
      if (preference.length > 0 && preference.length < 100) {
      extractedMemories.push(
        saveMemory({
          type: 'listener',
          source: 'youtube',
          content: `${listenerName}さんの好みや興味: ${preference}`,
          relatedName: listenerName,
          keywords: [preference, listenerName, 'リスナー'],
        })
      )
      }
    }
  }
  
  return Promise.all(extractedMemories)
}

/**
 * キャラクター（キャラクターAまたはキャラクターB）についての情報を抽出する
 */
export function extractMemoriesFromCharacterInfo(
  characterType: 'A' | 'B',
  message: string,
  assistantMessage: string
): Promise<Memory[]> {
  const extractedMemories: Promise<Memory>[] = []
  const characterNames = getCharacterNames()
  const characterInfo = characterType === 'A' ? characterNames.characterA : characterNames.characterB
  const memoryType: MemoryType = characterType === 'A' ? 'characterA' : 'characterB'
  
  // キャラクターについて話している内容を抽出
  // フルネームまたは愛称で検出
  
  // キャラクター名を含む文を抽出（フルネームまたは愛称）
  const fullNamePattern = new RegExp(`${characterInfo.fullName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?:ちゃん|さん)?(?:は|が|の)(.+?)(?:です|だ|だよ|だね|です)`, 'g')
  const nicknamePattern = new RegExp(`${characterInfo.nickname.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?:ちゃん|さん)?(?:は|が|の)(.+?)(?:です|だ|だよ|だね|です)`, 'g')
  
  let match
  while ((match = fullNamePattern.exec(message)) !== null || (match = nicknamePattern.exec(message)) !== null) {
    if (match && match[1]) {
      const info = match[1].trim()
      if (info.length > 0 && info.length < 100) {
        extractedMemories.push(
          saveMemory({
            type: memoryType,
            source: 'chat',
            content: `${characterInfo.nickname}について: ${info}`,
            relatedName: characterInfo.nickname,
            keywords: [characterInfo.fullName, characterInfo.nickname, info],
          })
        )
      }
    }
  }
  
  return Promise.all(extractedMemories)
}

/**
 * 会話から記憶を抽出する（統合関数）
 */
export async function extractMemoriesFromConversation(
  userMessage: string,
  assistantMessage: string,
  source: MemorySource = 'chat',
  relatedName?: string
): Promise<Memory[]> {
  // ソースに応じて適切な抽出関数を呼び出す
  if (source === 'youtube' && relatedName) {
    // YouTubeコメントの場合
    return extractMemoriesFromListenerConversation(relatedName, userMessage, assistantMessage)
  } else if (source === 'chat') {
    // チャット欄の場合（ユーザーとの会話）
    return extractMemoriesFromUserConversation(userMessage, assistantMessage)
  }
  
  return []
}

/**
 * 記憶をシステムプロンプト形式にフォーマットする
 */
export function formatMemoriesForPrompt(memories: Memory[]): string {
  if (memories.length === 0) {
    console.log('[memoryExtractor] ℹ️ 関連記憶なし: システムプロンプトに記憶を注入しません')
    return ''
  }
  
  const memoryTexts = memories.map((memory, index) => {
    // 後方互換性: 古いタイプを新しいタイプに変換
    let memoryType = memory.type
    const dynamicMemoryTypeMap = getLegacyMemoryTypeMap()
    if (dynamicMemoryTypeMap[memoryType as string] || legacyMemoryTypeMap[memoryType as string]) {
      memoryType = dynamicMemoryTypeMap[memoryType as string] || legacyMemoryTypeMap[memoryType as string]
    }
    
    // 環境変数から名前を取得
    const characterNames = getCharacterNames()
    
    const typeLabels: Record<MemoryType, string> = {
      user: characterNames.user.nickname,
      characterA: characterNames.characterA.nickname,
      characterB: characterNames.characterB.nickname,
      listener: 'リスナー',
      other: 'その他',
    }
    
    let label = `${index + 1}. [${typeLabels[memoryType as MemoryType] || 'その他'}]`
    if (memory.relatedName) {
      label += ` (${memory.relatedName})`
    }
    label += ` ${memory.content}`
    
    return label
  })
  
  const formattedPrompt = `
[関連記憶]
以下の情報は、過去の会話から抽出された重要な記憶です。これらの情報を参考にして、より自然で個人的な会話をしてください。

${memoryTexts.join('\n')}

[記憶の使い方]
- これらの記憶は、会話をより自然で個人的なものにするために使用してください
- 記憶に基づいて、ユーザーとの関係性を深めるような会話をしてください
- ただし、記憶が古い場合や、現在の会話と矛盾する場合は、現在の会話を優先してください
`
  
  console.log('[memoryExtractor] 📋 記憶をシステムプロンプト形式にフォーマット:', {
    memoryCount: memories.length,
    formattedLength: formattedPrompt.length,
    memoryTypes: memories.map(m => m.type)
  })
  
  return formattedPrompt
}
