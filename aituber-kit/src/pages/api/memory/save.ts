import { NextRequest, NextResponse } from 'next/server'
import { writeFile, readFile, mkdir } from 'fs/promises'
import { join } from 'path'
import { existsSync } from 'fs'

const MEMORY_DIR = join(process.cwd(), 'data', 'memories')
const MEMORY_FILE = join(MEMORY_DIR, 'memories.txt')
const MEMORY_JSON_FILE = join(MEMORY_DIR, 'memories.json')

// 記憶をテキスト形式で保存
async function saveMemoriesToFile(memories: any[]) {
  try {
    // ディレクトリが存在しない場合は作成
    if (!existsSync(MEMORY_DIR)) {
      await mkdir(MEMORY_DIR, { recursive: true })
    }

    // テキスト形式で保存（読みやすい形式）
    let textContent = `# LUNA-AI 記憶ファイル
# このファイルは会話から抽出された重要な記憶を保存しています
# 不要な記憶や人格を破壊するような記憶は削除してください
# 最終更新: ${new Date().toLocaleString('ja-JP')}

`
    
    // 環境変数から名前を取得
    const streamerName = process.env.NEXT_PUBLIC_STREAMER_NAME || 'ルピナス・ロゼッティ'
    const characterAName = process.env.NEXT_PUBLIC_CHARACTER_A_NAME || 'アイリス・ロゼッティ'
    const characterBName = process.env.NEXT_PUBLIC_CHARACTER_B_NAME || 'フィオナ・ロゼッティ'
    const streamerNickname = process.env.NEXT_PUBLIC_STREAMER_NICKNAME || 'ルピナス'
    const characterANickname = process.env.NEXT_PUBLIC_CHARACTER_A_NICKNAME || 'アイリス'
    const characterBNickname = process.env.NEXT_PUBLIC_CHARACTER_B_NICKNAME || 'フィオナ'
    
    // 記憶を種類ごとにグループ化
    const userMemories = memories.filter(m => m.type === 'user')
    const characterAMemories = memories.filter(m => m.type === 'characterA')
    const characterBMemories = memories.filter(m => m.type === 'characterB')
    const listenerMemories = memories.filter(m => m.type === 'listener')
    const otherMemories = memories.filter(m => m.type === 'other')

    // ユーザー
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

    // キャラクターA
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

    // キャラクターB
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

    // リスナー
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

    // その他
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

    // JSON形式も保存（プログラムから読み込む用）
    const jsonContent = JSON.stringify({
      memories,
      version: '1.0.0',
      lastUpdated: new Date().toISOString()
    }, null, 2)

    await writeFile(MEMORY_FILE, textContent, 'utf-8')
    await writeFile(MEMORY_JSON_FILE, jsonContent, 'utf-8')
    
    console.log('[memory/save] ✅ 記憶をファイルに保存しました:', {
      textFile: MEMORY_FILE,
      jsonFile: MEMORY_JSON_FILE,
      memoryCount: memories.length
    })

    return true
  } catch (error) {
    console.error('[memory/save] ファイル保存エラー:', error)
    throw error
  }
}

export async function POST(req: NextRequest) {
  try {
    const { memories } = await req.json()
    
    if (!Array.isArray(memories)) {
      return NextResponse.json(
        { error: 'memories must be an array' },
        { status: 400 }
      )
    }

    await saveMemoriesToFile(memories)

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[memory/save] エラー:', error)
    return NextResponse.json(
      { error: 'Failed to save memories' },
      { status: 500 }
    )
  }
}

