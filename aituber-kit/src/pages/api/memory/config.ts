import { NextRequest, NextResponse } from 'next/server'
import { readFile, writeFile, mkdir } from 'fs/promises'
import { join } from 'path'
import { existsSync } from 'fs'

const MEMORY_DIR = join(process.cwd(), 'data', 'memories')
const MEMORY_CONFIG_FILE = join(MEMORY_DIR, 'memory-config.json')

export interface MemoryConfig {
  enabled: boolean
  extractSettings: {
    user: boolean
    characterA: boolean
    characterB: boolean
    listener: boolean
    other: boolean
  }
  extractionRules: {
    extractNames: boolean
    extractPreferences: boolean
    extractImportantInfo: boolean
    extractCharacterInfo: boolean
  }
}

const defaultConfig: MemoryConfig = {
  enabled: false,
  extractSettings: {
    user: true,
    characterA: true,
    characterB: true,
    listener: true,
    other: true,
  },
  extractionRules: {
    extractNames: true,
    extractPreferences: true,
    extractImportantInfo: true,
    extractCharacterInfo: true,
  },
}

export async function GET() {
  try {
    if (!existsSync(MEMORY_CONFIG_FILE)) {
      // デフォルト設定を返す
      return NextResponse.json(defaultConfig)
    }

    const fileContent = await readFile(MEMORY_CONFIG_FILE, 'utf-8')
    const config = JSON.parse(fileContent)
    
    // デフォルト値とマージ（後方互換性のため）
    return NextResponse.json({
      ...defaultConfig,
      ...config,
      extractSettings: {
        ...defaultConfig.extractSettings,
        ...config.extractSettings,
      },
      extractionRules: {
        ...defaultConfig.extractionRules,
        ...config.extractionRules,
      },
    })
  } catch (error) {
    console.error('[memory/config] 設定読み込みエラー:', error)
    return NextResponse.json(defaultConfig)
  }
}

export async function POST(req: NextRequest) {
  try {
    const config: MemoryConfig = await req.json()
    
    // ディレクトリが存在しない場合は作成
    if (!existsSync(MEMORY_DIR)) {
      await mkdir(MEMORY_DIR, { recursive: true })
    }

    // 設定を保存
    await writeFile(MEMORY_CONFIG_FILE, JSON.stringify(config, null, 2), 'utf-8')
    
    console.log('[memory/config] ✅ メモリ設定を保存しました:', config)

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[memory/config] 設定保存エラー:', error)
    return NextResponse.json(
      { error: 'Failed to save memory config' },
      { status: 500 }
    )
  }
}

