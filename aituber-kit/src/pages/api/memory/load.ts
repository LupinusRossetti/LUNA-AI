import { NextResponse } from 'next/server'
import { readFile } from 'fs/promises'
import { existsSync } from 'fs'
import { MEMORY_JSON_FILE } from './memoryFileUtils'

export async function GET() {
  try {
    // JSONファイルが存在しない場合は空の配列を返す
    if (!existsSync(MEMORY_JSON_FILE)) {
      console.log('[memory/load] ℹ️ 記憶ファイルが存在しません。空の配列を返します。')
      return NextResponse.json({
        memories: [],
        version: '1.0.0',
        lastUpdated: new Date().toISOString()
      })
    }

    const fileContent = await readFile(MEMORY_JSON_FILE, 'utf-8')
    const data = JSON.parse(fileContent)

    return NextResponse.json(data)
  } catch (error) {
    console.error('[memory/load] ファイル読み込みエラー:', error)
    // エラー時は空の配列を返す
    return NextResponse.json({
      memories: [],
      version: '1.0.0',
      lastUpdated: new Date().toISOString()
    })
  }
}

