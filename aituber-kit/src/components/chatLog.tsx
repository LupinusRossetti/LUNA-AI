// ============================================================================
// ChatLog.tsx  — 完全最適化版
// env色・名前色・左右幅8/92調整・Keifont・スライドイン対応
// ============================================================================

import Image from 'next/image'
import { useEffect, useRef, useState } from 'react'
import { EMOTIONS } from '@/features/messages/messages'

import homeStore from '@/features/stores/home'
import settingsStore, { uiColors } from '@/features/stores/settings'
import { messageSelectors } from '@/features/messages/messageSelectors'

// ============================================================================
// ChatLog 本体
// ============================================================================

export const ChatLog = () => {
  const chatScrollRef = useRef<HTMLDivElement>(null)
  const resizeHandleRef = useRef<HTMLDivElement>(null)
  const chatLogRef = useRef<HTMLDivElement>(null)

  const characterName = settingsStore((s) => s.characterName)
  const characterAName = settingsStore((s) => s.characterAName)
  const characterBName = settingsStore((s) => s.characterBName)
  const chatLogWidth = settingsStore((s) => s.chatLogWidth)
  const messages = messageSelectors.getTextAndImageMessages(
    homeStore((s) => s.chatLog)
  )

  const [isDragging, setIsDragging] = useState<boolean>(false)

  // 初回スクロール
  useEffect(() => {
    chatScrollRef.current?.scrollIntoView({ behavior: 'auto', block: 'center' })
  }, [])

  // 新着時スクロール
  useEffect(() => {
    chatScrollRef.current?.scrollIntoView({
      behavior: 'smooth',
      block: 'center',
    })
  }, [messages])

  // 横幅リサイズ
  useEffect(() => {
    const handleMouseDown = () => setIsDragging(true)
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging) return
      const newWidth = e.clientX
      const constrainedWidth = Math.max(
        300,
        Math.min(newWidth, window.innerWidth * 0.8)
      )
      settingsStore.setState({ chatLogWidth: constrainedWidth })
    }
    const handleMouseUp = () => setIsDragging(false)

    const resizeHandle = resizeHandleRef.current
    if (resizeHandle) {
      resizeHandle.addEventListener('mousedown', handleMouseDown)
      document.addEventListener('mousemove', handleMouseMove)
      document.addEventListener('mouseup', handleMouseUp)
    }

    return () => {
      if (resizeHandle)
        resizeHandle.removeEventListener('mousedown', handleMouseDown)
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }
  }, [isDragging])

  return (
    <div
      ref={chatLogRef}
      className="absolute h-[100svh] pb-16 z-10 max-w-full"
      style={{ width: `${chatLogWidth}px` }}
    >
      <div className="max-h-full px-4 pt-24 pb-16 overflow-y-auto scroll-hidden">
        {messages.map((msg, i) => {
          const isYoutube = msg.youtube === true

          return (
            <div key={i} ref={messages.length - 1 === i ? chatScrollRef : null}>
              {typeof msg.content === 'string' ? (
                <Chat
                  role={msg.role}
                  message={msg.content}
                  characterName={characterName}
                  characterAName={characterAName}
                  characterBName={characterBName}
                  isYoutube={isYoutube}
                  msg={msg}
                />
              ) : (
                <>
                  <Chat
                    role={msg.role}
                    message={msg.content ? msg.content[0].text : ''}
                    characterName={characterName}
                    characterAName={characterAName}
                    characterBName={characterBName}
                    isYoutube={isYoutube}
                    msg={msg}
                  />
                  <ChatImage
                    role={msg.role}
                    imageUrl={msg.content ? msg.content[1].image : ''}
                  />
                </>
              )}
            </div>
          )
        })}
      </div>

      {/* 右の resize ハンドル */}
      <div
        ref={resizeHandleRef}
        className="absolute top-0 right-0 h-full w-4 cursor-ew-resize hover:bg-secondary hover:bg-opacity-20"
        style={{ cursor: isDragging ? 'grabbing' : 'ew-resize' }}
      >
        <div className="absolute top-1/2 right-1 h-16 w-1 bg-secondary bg-opacity-40 rounded-full transform -translate-y-1/2"></div>
      </div>
    </div>
  )
}

// ============================================================================
// Chat（テキスト）
// ============================================================================

const Chat = ({
  role,
  message,
  characterName,
  characterAName,
  characterBName,
  isYoutube,
  msg,
}: {
  role: string
  message: string
  characterName: string
  characterAName: string
  characterBName: string
  isYoutube: boolean
  msg: any // Message型（hasSearchGroundingを含む）
}) => {
  // 感情タグ除去
  const emotionPattern = new RegExp(`\\[(${EMOTIONS.join('|')})\\]\\s*`, 'gi')
  const processedMessage = message.replace(emotionPattern, '')

  // ---------- UI カラー ------------
  let ui
  let displayCharacterName = characterName

  if (role === 'user') {
    ui = isYoutube ? uiColors.listener : uiColors.streamer
  } else if (role === 'system') {
    // システムメッセージ用のグレー背景
    ui = {
      nameBg: '#808080', // グレー
      nameColor: '#ffffff',
      bg: '#f5f5f5',
      text: '#333333',
      name: 'システム',
    }
    displayCharacterName = 'システム'
  } else if (role === 'assistant-A') {
    ui = uiColors.characterA
    displayCharacterName = characterAName || 'アイリス・ロゼッティ'
  } else if (role === 'assistant-B') {
    ui = uiColors.characterB
    displayCharacterName = characterBName || 'フィオナ・ロゼッティ'
  } else if (role === 'assistant') {
    // fallback (legacy assistant)
    const APP_ID = process.env.NEXT_PUBLIC_APP_ID
    ui = APP_ID === 'A' ? uiColors.characterA : uiColors.characterB
    displayCharacterName = APP_ID === 'A' ? (characterAName || 'アイリス・ロゼッティ') : (characterBName || 'フィオナ・ロゼッティ')
  } else {
    // その他のroleの場合、デフォルトでAを使用
    ui = uiColors.characterA
    displayCharacterName = characterAName || 'アイリス・ロゼッティ'
  }
  
  // サーチグラウンディングが使用された場合、名前の後ろに「(サーチ)」を追加
  if (msg?.hasSearchGrounding && (role === 'assistant-A' || role === 'assistant-B')) {
    displayCharacterName = `${displayCharacterName}(サーチ)`
  }

  // ---------- スライドアニメ ----------
  const slideAnim =
    role === 'user' ? 'animate-slideInRight' : 'animate-slideInLeft'

  // ---------- 幅 8% / 92% 分岐 ----------
  const isUser = role === 'user'
  const wrapperStyle = isUser
    ? { marginLeft: '8%', marginRight: '0%', width: '92%' } // YOU = 右寄せ
    : { marginLeft: '0%', marginRight: '8%', width: '92%' } // AI = 左寄せ

  return (
    <div
      className={`my-4 font-kei ${slideAnim}`}
      style={{ ...wrapperStyle }}
    >
      {/* 名前ラベル */}
      <div
        className="px-6 py-2 rounded-t-lg tracking-wider font-kei"
        style={{
          backgroundColor: ui.nameBg,
          color: ui.nameColor,
        }}
      >
        {role === 'user' && isYoutube && msg?.listenerName
          ? msg.listenerName
          : role === 'user'
          ? ui.name
          : displayCharacterName}
      </div>

      {/* セリフ枠 */}
      <div
        className="px-6 py-4 rounded-b-lg font-kei"
        style={{
          backgroundColor: ui.bg,
          color: ui.text,
        }}
      >
        {processedMessage}
      </div>
    </div>
  )
}

// ============================================================================
// ChatImage（画像）
// ============================================================================

const ChatImage = ({
  role,
  imageUrl,
}: {
  role: string
  imageUrl: string
}) => {
  const slideAnim =
    role === 'user' ? 'animate-slideInRight' : 'animate-slideInLeft'

  // 画像も 8% / 92% に調整
  const isUser = role === 'user'
  const wrapperStyle = isUser
    ? { marginLeft: '8%', marginRight: '0%', width: '92%' }
    : { marginLeft: '0%', marginRight: '8%', width: '92%' }

  return (
    <div className={`my-4 font-kei ${slideAnim}`} style={{ ...wrapperStyle }}>
      <Image
        src={imageUrl}
        alt="Generated"
        className="rounded-lg"
        width={512}
        height={512}
      />
    </div>
  )
}
