// ============================================================================
// AssistantText.tsx — 完全最適化版
// env色・名前色対応 / Keifont / 感情タグ除去
// ============================================================================

import settingsStore from '@/features/stores/settings'
import { uiColors } from '@/features/stores/settings'

export const AssistantText = ({ message }: { message: string }) => {
  const characterName = settingsStore((s) => s.characterName)
  const showCharacterName = settingsStore((s) => s.showCharacterName)

  // ▼ キャラA/B の色選択
  const APP_ID = process.env.NEXT_PUBLIC_APP_ID // "A" or "B"
  const color = APP_ID === 'A' ? uiColors.characterA : uiColors.characterB

  // ▼ 感情タグ除去
  const cleaned = message.replace(/\[([a-zA-Z]*?)\]/g, '')

  return (
    <div className={`absolute bottom-0 left-0 mb-[120px] w-full z-10`}>
      <div className="mx-auto max-w-4xl w-full p-4 animate-scalePop">
        <div
          className="rounded-lg font-kei"
          style={{
            backgroundColor: color.bg,
          }}
        >
          {showCharacterName && (
            <div
              className="px-6 py-2 rounded-t-lg tracking-wider font-kei"
              style={{
                backgroundColor: color.nameBg,
                color: color.nameColor,
              }}
            >
              {characterName}
            </div>
          )}

          <div className="px-6 py-4">
            <div className="font-kei" style={{ color: color.text }}>
              {cleaned}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
