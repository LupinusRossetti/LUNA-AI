// ============================================================================
// AssistantText.tsx — 完全最適化版
// env色・名前色対応 / Keifont / 感情タグ除去 / 掛け合いモード対応
// ============================================================================

import settingsStore from '@/features/stores/settings'
import { uiColors } from '@/features/stores/settings'

type AssistantTextProps = {
  message: string
  role?: 'assistant' | 'assistant-A' | 'assistant-B' | null
}

export const AssistantText = ({ message, role }: AssistantTextProps) => {
  const characterAName = settingsStore((s) => s.characterAName)
  const characterBName = settingsStore((s) => s.characterBName)
  const characterName = settingsStore((s) => s.characterName) // レガシー対応
  const showCharacterName = settingsStore((s) => s.showCharacterName)

  // ▼ 掛け合いモード対応: roleに応じて色と名前を選択
  const isDialogueMode = process.env.NEXT_PUBLIC_DIALOGUE_MODE === 'true'
  let color
  let displayName: string

  if (isDialogueMode && role) {
    // 掛け合いモード: roleに応じて色と名前を決定
    if (role === 'assistant-A') {
      color = uiColors.characterA
      displayName = characterAName
    } else if (role === 'assistant-B') {
      color = uiColors.characterB
      displayName = characterBName
    } else {
      // fallback: assistant（レガシー）
      const APP_ID = process.env.NEXT_PUBLIC_APP_ID
      color = APP_ID === 'A' ? uiColors.characterA : uiColors.characterB
      displayName = characterName
    }
  } else {
    // 単体モード: APP_IDに応じて色と名前を決定
    const APP_ID = process.env.NEXT_PUBLIC_APP_ID
    color = APP_ID === 'A' ? uiColors.characterA : uiColors.characterB
    displayName = characterName
  }

  // ▼ 感情タグ除去
  const cleaned = message.replace(/\[([a-zA-Z]*?)\]/g, '')

  // 同時表示モードの場合は、会話ログの右側に表示するため位置を調整
  const showSimultaneousDisplay = settingsStore((s) => s.showSimultaneousDisplay || false)
  const chatLogWidth = settingsStore((s) => s.chatLogWidth || 0)
  
  // セリフ枠のbottomは10rem
  return (
    <div 
      className={`absolute bottom-0 left-0 w-full z-10`}
      style={{
        bottom: '10rem', // 10rem
        ...(showSimultaneousDisplay ? { 
          left: `${chatLogWidth}px`,
          width: `calc(100% - ${chatLogWidth}px)`
        } : {})
      }}
    >
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
              {displayName}
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
