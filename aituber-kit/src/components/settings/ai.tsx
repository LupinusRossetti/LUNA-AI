import Image from 'next/image'
import { useTranslation } from 'react-i18next'
import settingsStore from '@/features/stores/settings'
import { SaveButton } from './SaveButton'

const AI = () => {
  const { t } = useTranslation()
  const googleKey = settingsStore((s) => s.googleKey)
  const useSearchGrounding = settingsStore((s) => s.useSearchGrounding)
  const temperature = settingsStore((s) => s.temperature)
  const maxTokens = settingsStore((s) => s.maxTokens)

  return (
    <>
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center">
          <Image
            src="/images/setting-icons/ai-settings.svg"
            alt="AI Settings"
            width={24}
            height={24}
            className="mr-2"
          />
          <h2 className="text-2xl font-bold">{t('AISettings')}</h2>
        </div>
        <SaveButton settingsToSave={{
          GOOGLE_API_KEY: googleKey,
          NEXT_PUBLIC_USE_SEARCH_GROUNDING: useSearchGrounding ? 'true' : 'false',
          NEXT_PUBLIC_TEMPERATURE: temperature.toString(),
          NEXT_PUBLIC_MAX_TOKENS: maxTokens.toString(),
        }} />
      </div>
      
      <div className="mb-10 space-y-6">
        <div>
          <div className="mb-4 text-xl font-bold">Gemini API設定</div>
          <p className="text-sm text-text2 leading-relaxed mb-4">
            Gemini-2.0-flash を固定して使用するよ。検索グラウンディングは必要に応じて使用される。
          </p>
          <div className="mb-4">
            <label className="block text-sm font-medium mb-1">Google API Key（機密情報設定タブで設定）</label>
            <input
              type="text"
              value={googleKey ? '***' : ''}
              disabled
              className="px-4 py-2 w-full bg-gray-200 rounded-lg"
              placeholder="機密情報設定タブで設定してください"
            />
            <p className="text-xs text-gray-500 mt-1">
              機密情報設定タブでAPIキーを設定・変更できます
            </p>
          </div>
        </div>
        
        <div>
          <div className="mb-4 text-xl font-bold">検索グラウンディング設定</div>
          <div className="mb-4">
            <label className="flex items-center">
              <input
                type="checkbox"
                checked={useSearchGrounding}
                onChange={(e) => settingsStore.setState({ useSearchGrounding: e.target.checked })}
                className="mr-2"
              />
              <span>検索グラウンディングを使用する（必要に応じて自動的に使用されます）</span>
            </label>
          </div>
        </div>
        
        <div>
          <div className="mb-4 text-xl font-bold">AIパラメータ設定</div>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1">
                温度（Temperature）: {temperature.toFixed(2)}
              </label>
              <input
                type="range"
                min="0"
                max="2"
                step="0.1"
                value={temperature}
                onChange={(e) => settingsStore.setState({ temperature: parseFloat(e.target.value) })}
                className="w-full"
              />
              <p className="text-xs text-gray-500 mt-1">値が高いほどランダムな回答になります</p>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">
                最大トークン数（Max Tokens）: {maxTokens}
              </label>
              <input
                type="number"
                min="1"
                max="8192"
                value={maxTokens}
                onChange={(e) => settingsStore.setState({ maxTokens: parseInt(e.target.value) || 4096 })}
                className="px-4 py-2 w-full bg-white rounded-lg"
              />
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
export default AI
