import '@charcoal-ui/icons'
import type { AppProps } from 'next/app'
import React, { useEffect } from 'react'
import Head from 'next/head'        // ★ 追加
import { Analytics } from '@vercel/analytics/react'

import { isLanguageSupported } from '@/features/constants/settings'
import homeStore from '@/features/stores/home'
import settingsStore from '@/features/stores/settings'
import migrateStore from '@/utils/migrateStore'
import i18n from '../lib/i18n'

import useExternalLinkage from '@/components/useExternalLinkage'
import { handleReceiveTextFromWsFn } from '@/features/chat/handlers'

import '@/styles/globals.css'
import '@/styles/themes.css'

export default function App({ Component, pageProps }: AppProps) {
  const [isLoading, setIsLoading] = React.useState(true)

  useEffect(() => {
    const hs = homeStore.getState()
    const ss = settingsStore.getState()

    if (hs.userOnboarded) {
      i18n.changeLanguage(ss.selectLanguage)
      document.documentElement.setAttribute('data-theme', ss.colorTheme)
      setIsLoading(false)
      return
    }

    migrateStore()

    const browserLanguage = navigator.language
    const languageCode = browserLanguage.match(/^zh/i)
      ? 'zh'
      : browserLanguage.split('-')[0].toLowerCase()

    let language = ss.selectLanguage
    if (!language) {
      language = isLanguageSupported(languageCode) ? languageCode : 'ja'
    }

    i18n.changeLanguage(language)
    settingsStore.setState({ selectLanguage: language })

    document.documentElement.setAttribute('data-theme', ss.colorTheme)
    homeStore.setState({ userOnboarded: true })
    
    // 少し遅延させてからローディングを解除（画面が安定するまで）
    setTimeout(() => {
      setIsLoading(false)
    }, 100)
  }, [])

  // ローディング中は白い画面を表示
  if (isLoading) {
    return (
      <div style={{ 
        position: 'fixed', 
        top: 0, 
        left: 0, 
        width: '100%', 
        height: '100%', 
        backgroundColor: '#ffffff',
        zIndex: 9999
      }} />
    )
  }

  return (
    <>
      <Component {...pageProps} />
      <Analytics />
    </>
  )
}
