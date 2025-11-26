import { NextApiRequest, NextApiResponse } from 'next'
import fs from 'fs'
import path from 'path'

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Method not allowed' })
  }

  try {
    const { filePath } = req.query as { filePath: string }

    if (!filePath || typeof filePath !== 'string') {
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

    // ファイルが存在しない場合は空文字列を返す
    if (!fs.existsSync(fullPath)) {
      return res.status(200).json({ content: '' })
    }

    // ファイルを読み込む
    const content = fs.readFileSync(fullPath, 'utf8')

    return res.status(200).json({ content })
  } catch (error) {
    console.error('Error loading prompt file:', error)
    return res.status(500).json({ message: 'Failed to load prompt file', error: String(error) })
  }
}


