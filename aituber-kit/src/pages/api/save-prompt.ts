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
    const { filePath, content } = req.body as { filePath: string; content: string }

    if (!filePath || typeof content !== 'string') {
      return res.status(400).json({ message: 'Invalid request data' })
    }

    // セキュリティチェック: プロンプトファイルのパスのみ許可
    const normalizedPath = path.normalize(filePath)
    const promptsDir = path.join(process.cwd(), 'prompts')
    const fullPath = path.join(process.cwd(), normalizedPath)

    // promptsディレクトリ内のファイルのみ許可
    if (!fullPath.startsWith(promptsDir)) {
      return res.status(403).json({ message: 'Invalid file path' })
    }

    // ディレクトリが存在しない場合は作成
    const dir = path.dirname(fullPath)
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true })
    }

    // ファイルに書き込む
    fs.writeFileSync(fullPath, content, 'utf8')

    return res.status(200).json({ message: 'Prompt file saved successfully' })
  } catch (error) {
    console.error('Error saving prompt file:', error)
    return res.status(500).json({ message: 'Failed to save prompt file', error: String(error) })
  }
}


