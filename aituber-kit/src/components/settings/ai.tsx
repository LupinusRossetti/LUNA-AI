import ExternalLinkage from './externalLinkage'
import Image from 'next/image'
import { useTranslation } from 'react-i18next'

const AI = () => {
  const { t } = useTranslation()
  return (
    <>
      <div className="flex items-center mb-6">
        <Image
          src="/images/setting-icons/ai-settings.svg"
          alt="AI Settings"
          width={24}
          height={24}
          className="mr-2"
        />
        <h2 className="text-2xl font-bold">{t('AISettings')}</h2>
      </div>
      <ExternalLinkage />
      <div className="mb-10">
        <p className="text-sm text-text2 leading-relaxed">
          Gemini-2.0-flash を固定して使用するよ。外部連携モードと検索グラウンディングは常に有効化されてる。その他のAIサービスやリアルタイム/オーディオモードの設定は削除したよ。
        </p>
      </div>
    </>
  )
}
export default AI
