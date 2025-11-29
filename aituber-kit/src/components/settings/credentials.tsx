import { useTranslation } from 'react-i18next'
import { useState, useEffect } from 'react'
import Image from 'next/image'
import settingsStore from '@/features/stores/settings'
import { PasswordInput } from './PasswordInput'
import { SaveButton } from './SaveButton'

const Credentials = () => {
  const { t } = useTranslation()
  
  // 環境変数から読み込む（settingsStoreには保存されない機密情報）
  const [googleKey, setGoogleKey] = useState('')
  const [youtubeApiKey, setYoutubeApiKey] = useState('')
  const [clientId, setClientId] = useState('')
  const [clientSecret, setClientSecret] = useState('')
  const [refreshToken, setRefreshToken] = useState('')
  const [windowsUser, setWindowsUser] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  
  // 環境変数を.envファイルから読み込む
  useEffect(() => {
    const loadCredentials = async () => {
      try {
        const response = await fetch('/api/get-env')
        if (response.ok) {
          const credentials = await response.json()
          setGoogleKey(credentials.GOOGLE_API_KEY || '')
          setYoutubeApiKey(credentials.NEXT_PUBLIC_YOUTUBE_API_KEY || '')
          setClientId(credentials.CLIENT_ID || '')
          setClientSecret(credentials.CLIENT_SECRET || '')
          setRefreshToken(credentials.REFRESH_TOKEN || '')
          setWindowsUser(credentials.WINDOWS_USER || '')
        }
      } catch (error) {
        console.error('Error loading credentials:', error)
      } finally {
        setIsLoading(false)
      }
    }
    
    loadCredentials()
  }, [])
  
  // 注意: これらの値は.envファイルに保存されますが、settingsStoreには保存されません
  // 保存ボタンを押すと.envファイルに書き込まれます

  // 機密情報設定を.env形式に変換
  const getCredentialsForEnv = () => {
    return {
      GOOGLE_API_KEY: googleKey || '',
      NEXT_PUBLIC_YOUTUBE_API_KEY: youtubeApiKey || '',
      CLIENT_ID: clientId || '',
      CLIENT_SECRET: clientSecret || '',
      REFRESH_TOKEN: refreshToken || '',
      WINDOWS_USER: windowsUser || '',
    }
  }

  return (
    <div className="mb-10">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center">
          <Image
            src="/images/setting-icons/other-settings.svg"
            alt="Credentials Settings"
            width={24}
            height={24}
            className="mr-2"
          />
          <h2 className="text-2xl font-bold">機密情報設定</h2>
        </div>
        <SaveButton settingsToSave={getCredentialsForEnv()} />
      </div>

      <div className="space-y-6">
        <div>
          <div className="font-bold mb-2">Google Gemini API Key（必須）</div>
          <div className="text-sm text-text2 mb-2">
            Google Gemini APIを使用するために必要なAPIキーです。
          </div>
          <PasswordInput
            value={googleKey}
            onChange={setGoogleKey}
            placeholder="AIza..."
          />
        </div>

        <div>
          <div className="font-bold mb-2">YouTube API Key</div>
          <div className="text-sm text-text2 mb-2">
            YouTubeモードを使用する場合に必要なAPIキーです。
          </div>
          <PasswordInput
            value={youtubeApiKey}
            onChange={setYoutubeApiKey}
            placeholder="AIza..."
          />
        </div>

        <div>
          <div className="font-bold mb-2">YouTube OAuth - Client ID</div>
          <div className="text-sm text-text2 mb-2">
            YouTube OAuth認証に使用するClient IDです。
          </div>
          <PasswordInput
            value={clientId}
            onChange={setClientId}
            placeholder="..."
          />
        </div>

        <div>
          <div className="font-bold mb-2">YouTube OAuth - Client Secret</div>
          <div className="text-sm text-text2 mb-2">
            YouTube OAuth認証に使用するClient Secretです。
          </div>
          <PasswordInput
            value={clientSecret}
            onChange={setClientSecret}
            placeholder="..."
          />
        </div>

        <div>
          <div className="font-bold mb-2">YouTube OAuth - Refresh Token</div>
          <div className="text-sm text-text2 mb-2">
            YouTube OAuth認証に使用するRefresh Tokenです。
          </div>
          <PasswordInput
            value={refreshToken}
            onChange={setRefreshToken}
            placeholder="..."
          />
        </div>

        <div>
          <div className="font-bold mb-2">Windows User Name</div>
          <div className="text-sm text-text2 mb-2">
            パス作成に必要なWindowsユーザー名です（C:\Users\(****)）。
          </div>
          <PasswordInput
            value={windowsUser}
            onChange={setWindowsUser}
            placeholder="username"
          />
        </div>
      </div>
    </div>
  )
}

export default Credentials

