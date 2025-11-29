/**
 * メモリファイル操作の共通ユーティリティ
 */

import { writeFile, mkdir } from 'fs/promises'
import { join } from 'path'
import { existsSync } from 'fs'
import { Memory } from '@/features/memory/memoryTypes'

export const MEMORY_DIR = join(process.cwd(), 'data', 'memories')
export const MEMORY_FILE = join(MEMORY_DIR, 'memories.txt')
export const MEMORY_JSON_FILE = join(MEMORY_DIR, 'memories.json')

/**
 * 記憶をテキスト形式で保存
 */
export async function saveMemoriesToFile(memories: Memory[]): Promise<void> {
  try {
    // ディレクトリが存在しない場合は作成
    if (!existsSync(MEMORY_DIR)) {
      await mkdir(MEMORY_DIR, { recursive: true })
    }

    // 環境変数から名前を取得
    const streamerNickname = process.env.NEXT_PUBLIC_STREAMER_NICKNAME || 'ルピナス'
    const characterANickname = process.env.NEXT_PUBLIC_CHARACTER_A_NICKNAME || 'アイリス'
    const characterBNickname = process.env.NEXT_PUBLIC_CHARACTER_B_NICKNAME || 'フィオナ'

    // テキスト形式で保存（読みやすい形式）
    let textContent = `# LUNA-AI 記憶ファイル
# このファイルは会話から抽出された重要な記憶を保存しています
# 不要な記憶や人格を破壊するような記憶は削除してください
# 最終更新: ${new Date().toLocaleString('ja-JP')}

`

    // 記憶を種類ごとにグループ化
    const userMemories = memories.filter((m) => m.type === 'user')
    const characterAMemories = memories.filter((m) => m.type === 'characterA')
    const characterBMemories = memories.filter((m) => m.type === 'characterB')
    const listenerMemories = memories.filter((m) => m.type === 'listener')
    const otherMemories = memories.filter((m) => m.type === 'other')

    // 各カテゴリの記憶をテキスト形式に変換
    const formatMemorySection = (
      categoryMemories: Memory[],
      categoryName: string
    ): string => {
      if (categoryMemories.length === 0) return ''

      let section = `## ${categoryName}\n\n`
      categoryMemories.forEach((memory, index) => {
        section += `### 記憶 ${index + 1} (ID: ${memory.id})\n`
        if (memory.relatedName) {
          section += `- 関連名: ${memory.relatedName}\n`
        }
        section += `- 日時: ${new Date(memory.timestamp).toLocaleString('ja-JP')}\n`
        section += `- 内容: ${memory.content}\n`
        if (memory.keywords && memory.keywords.length > 0) {
          section += `- キーワード: ${memory.keywords.join(', ')}\n`
        }
        section += `- 削除可能: ${memory.canDelete ? 'はい' : 'いいえ'}\n`
        section += `\n`
      })
      return section
    }

    textContent += formatMemorySection(userMemories, streamerNickname)
    textContent += formatMemorySection(characterAMemories, characterANickname)
    textContent += formatMemorySection(characterBMemories, characterBNickname)
    textContent += formatMemorySection(listenerMemories, 'リスナー')
    textContent += formatMemorySection(otherMemories, 'その他')

    // JSON形式も保存（プログラムから読み込む用）
    const jsonContent = JSON.stringify(
      {
        memories,
        version: '1.0.0',
        lastUpdated: new Date().toISOString(),
      },
      null,
      2
    )

    await writeFile(MEMORY_FILE, textContent, 'utf-8')
    await writeFile(MEMORY_JSON_FILE, jsonContent, 'utf-8')

    console.log('[memoryFileUtils] ✅ 記憶をファイルに保存しました:', {
      textFile: MEMORY_FILE,
      jsonFile: MEMORY_JSON_FILE,
      memoryCount: memories.length,
    })
  } catch (error) {
    console.error('[memoryFileUtils] ファイル保存エラー:', error)
    throw error
  }
}




