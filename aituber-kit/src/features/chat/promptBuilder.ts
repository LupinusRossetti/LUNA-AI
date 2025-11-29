/**
 * システムプロンプト構築ユーティリティ
 */

import { SYSTEM_PROMPT } from '@/features/constants/systemPromptConstants'
import settingsStore from '@/features/stores/settings'
import { getCharacterNames } from '@/utils/characterNames'

/**
 * 掛け合いモード用のXML指示プロンプトを生成
 */
export function buildDialogueModePrompt(
  characterId?: 'A' | 'B',
  forceSearchGrounding?: boolean
): string {
  const startCharacter = characterId === 'B' ? 'B' : 'A'
  const characterNames = getCharacterNames()
  const characterAName = characterNames.characterA.fullName
  const characterBName = characterNames.characterB.fullName
  const characterANickname = characterNames.characterA.nickname
  const characterBNickname = characterNames.characterB.nickname
  const startCharacterName = characterId === 'B' ? characterBNickname : characterANickname

  return `
[Dialogue Mode Rules]
1.  **Roleplay**: You are acting as ${characterAName} (A) and ${characterBName} (B).
2.  **Turn-taking**: Speak alternately. ${startCharacterName} (${startCharacter}) MUST speak first.
3.  **Format**: Output **ONLY** the XML dialogue. No introductory text.

[Character Styles]
- **${characterANickname} (A)**: Energetic, high-tension, casual speech (Tame-guchi).
- **${characterBNickname} (B)**: Gentle, polite, formal speech (Keigo).

${forceSearchGrounding ? `
[Search Grounding Integration]
- Incorporate the search results naturally into their conversation.
- ${characterANickname} should be excited about new info, while ${characterBNickname} explains details calmly.
- **DO NOT** just summarize the search results. Make them talk about it.
` : ''}

[Final Output Check]
Ensure your response starts immediately with: <${startCharacter} emotion="..."${forceSearchGrounding ? ' search="true"' : ''}>
`
}

/**
 * Self-Reflectionプロンプトを生成
 */
export function buildSelfReflectionPrompt(): string {
  return `
<self_reflection>
- まず、最大限自信が持てるまで、タスク解決に向けたrubricについて十分に考えましょう
- 次に、タスクの出力品質を世界最高にするために、あらゆる構成要素について深く考えましょう。
- 最後に、rubricを活用して、最良の解決策を内部で検討し、反復改善を重ねましょう…
</self_reflection>

[思考プロセスの重要性]
上記の<self_reflection>に従い、回答を生成する前に必ず以下を実行してください：
1. **Rubric（評価基準）の設定**: この会話で何が成功かを明確に定義する
2. **構成要素の深い考察**: キャラクター性、会話の流れ、情報の正確性、楽しさなど、すべての要素を考慮する
3. **内部での反復改善**: 最初の回答案を批判的に検討し、より良い回答を生成する

この思考プロセスを経ることで、より質の高い、正確で、自然な会話を生成できます。
`
}

/**
 * メモリプロンプトを追加
 */
export async function addMemoryPrompt(
  systemPrompt: string,
  userMessage: string
): Promise<string> {
  const ss = settingsStore.getState()
  const isMemoryEnabled =
    ss.memoryEnabled || process.env.NEXT_PUBLIC_MEMORY_ENABLED === 'true'

  if (typeof window === 'undefined' || !isMemoryEnabled) {
    return systemPrompt
  }

  try {
    const { searchRelevantMemories } = await import(
      '@/features/memory/memoryManager'
    )
    const { formatMemoriesForPrompt } = await import(
      '@/features/memory/memoryExtractor'
    )

    const userMessageText =
      typeof userMessage === 'string' ? userMessage : userMessage

    const relevantMemories = await searchRelevantMemories(userMessageText, 5)

    if (relevantMemories.length > 0) {
      const memoryPrompt = formatMemoriesForPrompt(relevantMemories)
      return systemPrompt + '\n\n' + memoryPrompt
    }
  } catch (error) {
    console.error('[promptBuilder] 記憶システムの読み込みに失敗:', error)
  }

  return systemPrompt
}

/**
 * サーチグラウンディング用のシステム警告を生成
 */
/**
 * サーチグラウンディング用のシステム警告を生成
 * (Deprecated: Now integrated into buildDialogueModePrompt)
 */
function buildSearchGroundingSystemWarning(forceSearchGrounding: boolean): string {
  // 警告は buildDialogueModePrompt に統合されたため、ここでは空文字を返すか、
  // 最小限のコンテキストのみを提供する
  return ''
}

/**
 * システムプロンプトを構築
 */
export async function buildSystemPrompt(
  characterId?: 'A' | 'B',
  forceSearchGrounding?: boolean,
  userMessage?: string
): Promise<string> {
  const ss = settingsStore.getState()
  let systemPrompt = ss.systemPrompt || SYSTEM_PROMPT

  // 掛け合いモード判定
  const isDialogueMode = process.env.NEXT_PUBLIC_DIALOGUE_MODE === 'true'

  // 掛け合いモード時はアイリスとフィオナの両方のプロンプトを使用
  if (isDialogueMode) {
    const systemPromptA =
      ss.systemPromptA ||
      process.env.NEXT_PUBLIC_SYSTEM_PROMPT_A ||
      SYSTEM_PROMPT
    const systemPromptB =
      ss.systemPromptB ||
      process.env.NEXT_PUBLIC_SYSTEM_PROMPT_B ||
      SYSTEM_PROMPT

    const characterNames = getCharacterNames()
    
    systemPrompt = `
[${characterNames.characterA.fullName}（A）の設定]
${systemPromptA}

[${characterNames.characterB.fullName}（B）の設定]
${systemPromptB}
`
  }

  // メモリプロンプトを追加
  if (userMessage) {
    systemPrompt = await addMemoryPrompt(systemPrompt, userMessage)
  }

  // Self-Reflectionプロンプトを追加
  systemPrompt += '\n\n' + buildSelfReflectionPrompt()

  // 掛け合いモード時はXML指示を追加 (これが最後に来るようにする)
  if (isDialogueMode) {
    systemPrompt += '\n\n' + buildDialogueModePrompt(characterId, forceSearchGrounding)
  }

  return systemPrompt
}

