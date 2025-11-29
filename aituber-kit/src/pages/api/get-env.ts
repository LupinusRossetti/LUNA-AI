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
    const envPath = path.join(process.cwd(), '.env')
    
    const env: Record<string, string> = {}
    
    if (fs.existsSync(envPath)) {
      const envContent = fs.readFileSync(envPath, 'utf8')
      
      envContent.split(/\r?\n/).forEach((line) => {
        const trimmed = line.trim()
        if (trimmed && !trimmed.startsWith('#')) {
          const equalIndex = trimmed.indexOf('=')
          if (equalIndex > 0) {
            const key = trimmed.substring(0, equalIndex).trim()
            const value = trimmed.substring(equalIndex + 1).trim().replace(/^["']|["']$/g, '')
            if (key) {
              env[key] = value || ''
            }
          }
        }
      })
    }

    // 機密情報設定で使用する環境変数のみを返す
    const credentials = {
      GOOGLE_API_KEY: env.GOOGLE_API_KEY || '',
      NEXT_PUBLIC_YOUTUBE_API_KEY: env.NEXT_PUBLIC_YOUTUBE_API_KEY || '',
      CLIENT_ID: env.CLIENT_ID || '',
      CLIENT_SECRET: env.CLIENT_SECRET || '',
      REFRESH_TOKEN: env.REFRESH_TOKEN || '',
      WINDOWS_USER: env.WINDOWS_USER || '',
    }

    return res.status(200).json(credentials)
  } catch (error) {
    console.error('Error reading .env file:', error)
    return res.status(500).json({ message: 'Failed to read environment variables', error: String(error) })
  }
}

