import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import Image from 'next/image'
import { SaveButton } from './SaveButton'
import settingsStore from '@/features/stores/settings'

interface MemoryConfig {
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

const Memory = () => {
  const { t } = useTranslation()
  const [config, setConfig] = useState<MemoryConfig>({
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
  })
  const [isLoading, setIsLoading] = useState(true)

  // 設定を読み込む
  useEffect(() => {
    const loadConfig = async () => {
      try {
        const response = await fetch('/api/memory/config')
        if (response.ok) {
          const data = await response.json()
          setConfig(data)
        }
      } catch (error) {
        console.error('メモリ設定の読み込みに失敗:', error)
      } finally {
        setIsLoading(false)
      }
    }
    loadConfig()
  }, [])

  // 愛称の設定を取得（settingsStoreから）
  const streamerNickname = settingsStore((s) => s.streamerNickname) || process.env.NEXT_PUBLIC_STREAMER_NICKNAME || 'ルピナス'
  const characterANickname = settingsStore((s) => s.characterANickname) || process.env.NEXT_PUBLIC_CHARACTER_A_NICKNAME || 'アイリス'
  const characterBNickname = settingsStore((s) => s.characterBNickname) || process.env.NEXT_PUBLIC_CHARACTER_B_NICKNAME || 'フィオナ'
  
  const [nicknames, setNicknames] = useState({
    streamer: streamerNickname,
    characterA: characterANickname,
    characterB: characterBNickname,
  })

  // .envに保存する設定を生成
  const getMemorySettingsForEnv = () => {
    return {
      NEXT_PUBLIC_MEMORY_ENABLED: config.enabled ? 'true' : 'false',
      NEXT_PUBLIC_STREAMER_NICKNAME: nicknames.streamer,
      NEXT_PUBLIC_CHARACTER_A_NICKNAME: nicknames.characterA,
      NEXT_PUBLIC_CHARACTER_B_NICKNAME: nicknames.characterB,
    }
  }

  // メモリ設定を保存
  const handleSaveConfig = async () => {
    try {
      const response = await fetch('/api/memory/config', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(config),
      })

      if (!response.ok) {
        throw new Error('Failed to save memory config')
      }

      alert('メモリ設定を保存しました')
    } catch (error) {
      console.error('メモリ設定の保存に失敗:', error)
      alert('メモリ設定の保存に失敗しました')
    }
  }

  if (isLoading) {
    return <div>読み込み中...</div>
  }

  return (
    <>
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center">
          <Image
            src="/images/setting-icons/other-settings.svg"
            alt="Memory Settings"
            width={24}
            height={24}
            className="mr-2"
          />
          <h2 className="text-2xl font-bold">記憶システム設定</h2>
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleSaveConfig}
            className="px-4 py-2 bg-primary text-theme rounded hover:bg-primary/80"
          >
            メモリ設定を保存
          </button>
          <SaveButton settingsToSave={getMemorySettingsForEnv()} />
        </div>
      </div>

      <div className="space-y-6">
        {/* メモリ機能の有効/無効 */}
        <div className="bg-white p-4 rounded-lg">
          <label className="flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={config.enabled}
              onChange={(e) => setConfig({ ...config, enabled: e.target.checked })}
              className="mr-2 w-5 h-5"
            />
            <span className="text-lg font-semibold">記憶機能を有効にする</span>
          </label>
          <p className="text-sm text-gray-600 mt-2">
            記憶機能を有効にすると、会話から重要な情報を抽出して保存します。
          </p>
        </div>

        {/* 記憶する対象 */}
        <div className="bg-white p-4 rounded-lg">
          <h3 className="text-lg font-semibold mb-4">記憶する対象</h3>
          <div className="space-y-2">
            {(['user', 'characterA', 'characterB', 'listener', 'other'] as const).map((key) => {
              let label = ''
              if (key === 'user') label = `ユーザー (${nicknames.streamer})`
              else if (key === 'characterA') label = `キャラクターA (${nicknames.characterA})`
              else if (key === 'characterB') label = `キャラクターB (${nicknames.characterB})`
              else if (key === 'listener') label = 'リスナー'
              else if (key === 'other') label = 'その他'
              
              return (
                <label key={key} className="flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={config.extractSettings[key]}
                    onChange={(e) =>
                      setConfig({
                        ...config,
                        extractSettings: {
                          ...config.extractSettings,
                          [key]: e.target.checked,
                        },
                      })
                    }
                    className="mr-2 w-5 h-5"
                  />
                  <span>{label}</span>
                </label>
              )
            })}
          </div>
        </div>

        {/* 抽出ルール */}
        <div className="bg-white p-4 rounded-lg">
          <h3 className="text-lg font-semibold mb-4">抽出ルール</h3>
          <div className="space-y-2">
            <label className="flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={config.extractionRules.extractNames}
                onChange={(e) =>
                  setConfig({
                    ...config,
                    extractionRules: {
                      ...config.extractionRules,
                      extractNames: e.target.checked,
                    },
                  })
                }
                className="mr-2 w-5 h-5"
              />
              <span>名前を抽出する</span>
            </label>
            <label className="flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={config.extractionRules.extractPreferences}
                onChange={(e) =>
                  setConfig({
                    ...config,
                    extractionRules: {
                      ...config.extractionRules,
                      extractPreferences: e.target.checked,
                    },
                  })
                }
                className="mr-2 w-5 h-5"
              />
              <span>好みや興味を抽出する</span>
            </label>
            <label className="flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={config.extractionRules.extractImportantInfo}
                onChange={(e) =>
                  setConfig({
                    ...config,
                    extractionRules: {
                      ...config.extractionRules,
                      extractImportantInfo: e.target.checked,
                    },
                  })
                }
                className="mr-2 w-5 h-5"
              />
              <span>重要な情報を抽出する</span>
            </label>
            <label className="flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={config.extractionRules.extractCharacterInfo}
                onChange={(e) =>
                  setConfig({
                    ...config,
                    extractionRules: {
                      ...config.extractionRules,
                      extractCharacterInfo: e.target.checked,
                    },
                  })
                }
                className="mr-2 w-5 h-5"
              />
              <span>キャラクター情報を抽出する</span>
            </label>
          </div>
        </div>

        {/* 愛称の設定 */}
        <div className="bg-white p-4 rounded-lg">
          <h3 className="text-lg font-semibold mb-4">愛称（ニックネーム）の設定</h3>
          <p className="text-sm text-gray-600 mb-4">
            記憶システムで使用される愛称を設定します。フルネームでも愛称でも記憶できます。
          </p>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2">
                ユーザー（配信者）の愛称
              </label>
              <input
                type="text"
                value={nicknames.streamer}
                onChange={(e) => setNicknames({ ...nicknames, streamer: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
                placeholder="ルピナス"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">
                キャラクターAの愛称
              </label>
              <input
                type="text"
                value={nicknames.characterA}
                onChange={(e) => setNicknames({ ...nicknames, characterA: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
                placeholder="アイリス"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">
                キャラクターBの愛称
              </label>
              <input
                type="text"
                value={nicknames.characterB}
                onChange={(e) => setNicknames({ ...nicknames, characterB: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
                placeholder="フィオナ"
              />
            </div>
          </div>
        </div>

        {/* 記憶ファイルの編集 */}
        <div className="bg-white p-4 rounded-lg">
          <h3 className="text-lg font-semibold mb-4">記憶ファイルの編集</h3>
          <p className="text-sm text-gray-600 mb-4">
            記憶ファイルは以下の場所に保存されています:
            <code className="ml-2 bg-gray-100 px-2 py-1 rounded">data/memories/memories.json</code>
          </p>
          <button
            onClick={async () => {
              try {
                const response = await fetch('/api/memory/load')
                if (response.ok) {
                  const data = await response.json()
                  const memories = data.memories || []
                  
                  // カテゴリごとにグループ化
                  const streamerNickname = settingsStore((s) => s.streamerNickname) || process.env.NEXT_PUBLIC_STREAMER_NICKNAME || 'ルピナス'
                  const characterANickname = settingsStore((s) => s.characterANickname) || process.env.NEXT_PUBLIC_CHARACTER_A_NICKNAME || 'アイリス'
                  const characterBNickname = settingsStore((s) => s.characterBNickname) || process.env.NEXT_PUBLIC_CHARACTER_B_NICKNAME || 'フィオナ'
                  
                  const categorized: Record<string, typeof memories> = {
                    [streamerNickname.toLowerCase()]: [],
                    rupinus: [], // 後方互換性のため残す
                    [characterANickname.toLowerCase()]: [],
                    iris: [], // 後方互換性のため残す
                    [characterBNickname.toLowerCase()]: [],
                    fiona: [], // 後方互換性のため残す
                    listener: [],
                    other: [],
                  }
                  
                  memories.forEach((memory: any) => {
                    const type = memory.type || 'other'
                    if (categorized[type]) {
                      categorized[type].push(memory)
                    } else {
                      categorized.other.push(memory)
                    }
                  })
                  
                  // テキストエリアに表示（簡易版）
                  const text = JSON.stringify(categorized, null, 2)
                  const newWindow = window.open()
                  if (newWindow) {
                    newWindow.document.write(`<pre>${text}</pre>`)
                  }
                }
              } catch (error) {
                console.error('記憶ファイルの読み込みに失敗:', error)
                alert('記憶ファイルの読み込みに失敗しました')
              }
            }}
            className="px-4 py-2 bg-gray-200 text-gray-800 rounded hover:bg-gray-300"
          >
            記憶ファイルを表示
          </button>
        </div>
      </div>
    </>
  )
}

export default Memory

