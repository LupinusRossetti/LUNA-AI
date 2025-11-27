import { NextRequest, NextResponse } from 'next/server'
import { readFile } from 'fs/promises'
import { join } from 'path'
import { existsSync } from 'fs'
import { writeFile, mkdir } from 'fs/promises'

const MEMORY_DIR = join(process.cwd(), 'data', 'memories')
const MEMORY_FILE = join(MEMORY_DIR, 'memories.txt')

// 記憶をテキスト形式で保存（delete.ts用）
async function saveMemoriesToFile(memories: any[]) {
  try {
    if (!existsSync(MEMORY_DIR)) {
      await mkdir(MEMORY_DIR, { recursive: true })
    }

    let textContent = `# LUNA-AI 記憶ファイル
# このファイルは会話から抽出された重要な記憶を保存しています
# 不要な記憶や人格を破壊するような記憶は削除してください
# 最終更新: ${new Date().toLocaleString('ja-JP')}

`
    
    // 環境変数から名前を取得
    const streamerNickname = process.env.NEXT_PUBLIC_STREAMER_NICKNAME || 'ルピナス'
    const characterANickname = process.env.NEXT_PUBLIC_CHARACTER_A_NICKNAME || 'アイリス'
    const characterBNickname = process.env.NEXT_PUBLIC_CHARACTER_B_NICKNAME || 'フィオナ'
    
    const userMemories = memories.filter(m => m.type === 'user')
    const characterAMemories = memories.filter(m => m.type === 'characterA')
    const characterBMemories = memories.filter(m => m.type === 'characterB')
    const listenerMemories = memories.filter(m => m.type === 'listener')
    const otherMemories = memories.filter(m => m.type === 'other')

    if (userMemories.length > 0) {
      textContent += `## ${streamerNickname}\n\n`
      userMemories.forEach((memory, index) => {
        textContent += `### 記憶 ${index + 1} (ID: ${memory.id})\n`
        textContent += `- 日時: ${new Date(memory.timestamp).toLocaleString('ja-JP')}\n`
        textContent += `- 内容: ${memory.content}\n`
        if (memory.keywords && memory.keywords.length > 0) {
          textContent += `- キーワード: ${memory.keywords.join(', ')}\n`
        }
        textContent += `- 削除可能: ${memory.canDelete ? 'はい' : 'いいえ'}\n`
        textContent += `\n`
      })
    }

    if (characterAMemories.length > 0) {
      textContent += `## ${characterANickname}\n\n`
      characterAMemories.forEach((memory, index) => {
        textContent += `### 記憶 ${index + 1} (ID: ${memory.id})\n`
        textContent += `- 日時: ${new Date(memory.timestamp).toLocaleString('ja-JP')}\n`
        textContent += `- 内容: ${memory.content}\n`
        if (memory.keywords && memory.keywords.length > 0) {
          textContent += `- キーワード: ${memory.keywords.join(', ')}\n`
        }
        textContent += `- 削除可能: ${memory.canDelete ? 'はい' : 'いいえ'}\n`
        textContent += `\n`
      })
    }

    if (characterBMemories.length > 0) {
      textContent += `## ${characterBNickname}\n\n`
      characterBMemories.forEach((memory, index) => {
        textContent += `### 記憶 ${index + 1} (ID: ${memory.id})\n`
        textContent += `- 日時: ${new Date(memory.timestamp).toLocaleString('ja-JP')}\n`
        textContent += `- 内容: ${memory.content}\n`
        if (memory.keywords && memory.keywords.length > 0) {
          textContent += `- キーワード: ${memory.keywords.join(', ')}\n`
        }
        textContent += `- 削除可能: ${memory.canDelete ? 'はい' : 'いいえ'}\n`
        textContent += `\n`
      })
    }

    if (listenerMemories.length > 0) {
      textContent += `## リスナー\n\n`
      listenerMemories.forEach((memory, index) => {
        textContent += `### 記憶 ${index + 1} (ID: ${memory.id})\n`
        textContent += `- リスナー名: ${memory.relatedName || '不明'}\n`
        textContent += `- 日時: ${new Date(memory.timestamp).toLocaleString('ja-JP')}\n`
        textContent += `- 内容: ${memory.content}\n`
        if (memory.keywords && memory.keywords.length > 0) {
          textContent += `- キーワード: ${memory.keywords.join(', ')}\n`
        }
        textContent += `- 削除可能: ${memory.canDelete ? 'はい' : 'いいえ'}\n`
        textContent += `\n`
      })
    }

    if (otherMemories.length > 0) {
      textContent += `## その他\n\n`
      otherMemories.forEach((memory, index) => {
        textContent += `### 記憶 ${index + 1} (ID: ${memory.id})\n`
        textContent += `- 日時: ${new Date(memory.timestamp).toLocaleString('ja-JP')}\n`
        textContent += `- 内容: ${memory.content}\n`
        if (memory.keywords && memory.keywords.length > 0) {
          textContent += `- キーワード: ${memory.keywords.join(', ')}\n`
        }
        textContent += `- 削除可能: ${memory.canDelete ? 'はい' : 'いいえ'}\n`
        textContent += `\n`
      })
    }

    const jsonContent = JSON.stringify({
      memories,
      version: '1.0.0',
      lastUpdated: new Date().toISOString()
    }, null, 2)

    await writeFile(MEMORY_FILE, textContent, 'utf-8')
    await writeFile(join(MEMORY_DIR, 'memories.json'), jsonContent, 'utf-8')

    return true
  } catch (error) {
    console.error('[memory] ファイル保存エラー:', error)
    throw error
  }
}

const MEMORY_DIR = join(process.cwd(), 'data', 'memories')
const MEMORY_JSON_FILE = join(MEMORY_DIR, 'memories.json')

export async function POST(req: NextRequest) {
  try {
    const { memoryId } = await req.json()
    
    if (!memoryId) {
      return NextResponse.json(
        { error: 'memoryId is required' },
        { status: 400 }
      )
    }

    // 既存の記憶を読み込む
    if (!existsSync(MEMORY_JSON_FILE)) {
      return NextResponse.json({ success: true, deleted: false })
    }

    const fileContent = await readFile(MEMORY_JSON_FILE, 'utf-8')
    const data = JSON.parse(fileContent)
    const memories = data.memories || []

    // 指定されたIDの記憶を削除
    const filteredMemories = memories.filter((m: any) => m.id !== memoryId)
    
    if (filteredMemories.length === memories.length) {
      // 削除する記憶が見つからなかった
      return NextResponse.json({ success: true, deleted: false })
    }

    // ファイルに保存
    await saveMemoriesToFile(filteredMemories)

    return NextResponse.json({ success: true, deleted: true })
  } catch (error) {
    console.error('[memory/delete] エラー:', error)
    return NextResponse.json(
      { error: 'Failed to delete memory' },
      { status: 500 }
    )
  }
}

