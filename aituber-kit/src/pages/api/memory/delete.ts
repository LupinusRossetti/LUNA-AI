import { NextRequest, NextResponse } from 'next/server'
import { readFile } from 'fs/promises'
import { existsSync } from 'fs'
import { Memory } from '@/features/memory/memoryTypes'
import { MEMORY_JSON_FILE, saveMemoriesToFile } from './memoryFileUtils'

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
    const filteredMemories = memories.filter((m: Memory) => m.id !== memoryId)
    
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

