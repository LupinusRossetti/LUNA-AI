import { NextRequest, NextResponse } from 'next/server'
import { Memory } from '@/features/memory/memoryTypes'
import { saveMemoriesToFile } from './memoryFileUtils'

export async function POST(req: NextRequest) {
  try {
    const { memories } = await req.json()

    if (!Array.isArray(memories)) {
      return NextResponse.json(
        { error: 'memories must be an array' },
        { status: 400 }
      )
    }

    // 型チェック
    const typedMemories: Memory[] = memories.filter(
      (m): m is Memory =>
        typeof m === 'object' &&
        m !== null &&
        'id' in m &&
        'type' in m &&
        'content' in m &&
        'timestamp' in m
    )

    await saveMemoriesToFile(typedMemories)

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[memory/save] エラー:', error)
    return NextResponse.json(
      { error: 'Failed to save memories' },
      { status: 500 }
    )
  }
}

