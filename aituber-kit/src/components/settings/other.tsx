import { useTranslation } from 'react-i18next'
import Image from 'next/image'

import AdvancedSettings from './advancedSettings'
import MessageReceiverSetting from './messageReceiver'
import PresetQuestions from './presetQuestions'
import { SaveButton } from './SaveButton'
import settingsStore from '@/features/stores/settings'

const Other = () => {
  const { t } = useTranslation()
  const messageReceiverEnabled = settingsStore((s) => s.messageReceiverEnabled)

  // .envに保存する設定を生成
  const getOtherSettingsForEnv = () => {
    return {
      NEXT_PUBLIC_MESSAGE_RECEIVER_ENABLED: messageReceiverEnabled ? 'true' : 'false',
    }
  }

  return (
    <>
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center">
          <Image
            src="/images/setting-icons/other-settings.svg"
            alt="Other Settings"
            width={24}
            height={24}
            className="mr-2"
          />
          <h2 className="text-2xl font-bold">{t('OtherSettings')}</h2>
        </div>
        <SaveButton settingsToSave={getOtherSettingsForEnv()} />
      </div>

      <AdvancedSettings />
      <PresetQuestions />
      <MessageReceiverSetting />
    </>
  )
}
export default Other
