import { useTranslation } from 'react-i18next'

const ExternalLinkage = () => {
  const { t } = useTranslation()

  return (
    <div className="mb-10">
      <div className="mb-4 text-xl font-bold">{t('ExternalLinkageMode')}</div>
      <p className="text-sm text-text2 leading-relaxed">
        外部連携モードは常にオンで、Gemini-2.0-flash による検索グラウンディングを使ってるよ。
      </p>
    </div>
  )
}

export default ExternalLinkage

