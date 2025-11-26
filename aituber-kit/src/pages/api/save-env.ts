import { NextApiRequest, NextApiResponse } from 'next'
import fs from 'fs'
import path from 'path'

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' })
  }

  try {
    const { settings } = req.body as { settings: Record<string, any> }

    if (!settings || typeof settings !== 'object') {
      return res.status(400).json({ message: 'Invalid settings data' })
    }

    const envPath = path.join(process.cwd(), '.env')
    const exampleEnvPath = path.join(process.cwd(), 'example.env')

    // 既存の.envファイルを読み込む（存在する場合）
    let envLines: string[] = []
    let existingEnv: Record<string, { value: string; lineIndex: number }> = {}
    
    if (fs.existsSync(envPath)) {
      const envContent = fs.readFileSync(envPath, 'utf8')
      envLines = envContent.split('\n')
      
      // 既存の環境変数を記録
      envLines.forEach((line, index) => {
        const trimmedLine = line.trim()
        if (trimmedLine && !trimmedLine.startsWith('#')) {
          const match = trimmedLine.match(/^([^=]+)=(.*)$/)
          if (match) {
            const key = match[1].trim()
            const value = match[2].trim().replace(/^["']|["']$/g, '')
            existingEnv[key] = { value, lineIndex: index }
          }
        }
      })
    } else if (fs.existsSync(exampleEnvPath)) {
      // .envが存在しない場合はexample.envをコピー
      const exampleContent = fs.readFileSync(exampleEnvPath, 'utf8')
      envLines = exampleContent.split('\n')
    }

    // 新しい設定で既存の設定を更新
    const updatedLines = [...envLines]
    
    for (const [key, value] of Object.entries(settings)) {
      if (value === null || value === undefined) {
        continue
      }

      const stringValue = String(value)
      
      // 既存の環境変数を更新
      if (existingEnv[key]) {
        const lineIndex = existingEnv[key].lineIndex
        const needsQuotes = stringValue.includes(' ') || stringValue.includes('=') || stringValue.includes('#')
        const formattedValue = needsQuotes ? `"${stringValue}"` : stringValue
        updatedLines[lineIndex] = `${key}=${formattedValue}`
      } else {
        // 新しい環境変数を追加（ファイルの最後に追加）
        const needsQuotes = stringValue.includes(' ') || stringValue.includes('=') || stringValue.includes('#')
        const formattedValue = needsQuotes ? `"${stringValue}"` : stringValue
        updatedLines.push(`${key}=${formattedValue}`)
      }
    }

    // .envファイルに書き込む
    fs.writeFileSync(envPath, updatedLines.join('\n'), 'utf8')

    return res.status(200).json({ message: 'Settings saved successfully' })
  } catch (error) {
    console.error('Error saving .env file:', error)
    return res.status(500).json({ message: 'Failed to save settings', error: String(error) })
  }
}

