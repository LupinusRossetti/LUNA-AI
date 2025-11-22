import '@charcoal-ui/icons'
import type { AppProps } from 'next/app'
import React, { useEffect } from 'react'
import { Analytics } from '@vercel/analytics/react'

import { isLanguageSupported } from '@/features/constants/settings'
import homeStore from '@/features/stores/home'
import settingsStore from '@/features/stores/settings'
import '@/styles/globals.css'
import '@/styles/themes.css'
import migrateStore from '@/utils/migrateStore'
import i18n from '../lib/i18n'

export default function App({ Component, pageProps }: AppProps) {
  useEffect(() => {
    const hs = homeStore.getState()
    const ss = settingsStore.getState()

    // ===== python の設定を取得 =====
    async function loadPythonWsConfig() {
      try {
        const res = await fetch("http://localhost:9000/ws_config")
        const data = await res.json()

        settingsStore.setState({
          wsUrlA: data.WS_URL_A,
          wsUrlB: data.WS_URL_B,
          wsUrlAB: data.WS_URL_AB,
          charPrefixA: data.CHAR_PREFIX_A,
          charPrefixB: data.CHAR_PREFIX_B,
        })

        console.log("[Config] Loaded from python:", data)
      } catch (e) {
        console.error("[Config] python から URL 読み込み失敗", e)
      }
    }

    loadPythonWsConfig()


    if (hs.userOnboarded) {
      i18n.changeLanguage(ss.selectLanguage)
      // 保存されたテーマを適用
      document.documentElement.setAttribute('data-theme', ss.colorTheme)
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

    // 初期テーマを適用
    document.documentElement.setAttribute('data-theme', ss.colorTheme)

    homeStore.setState({ userOnboarded: true })
  }, [])

  return (
    <>
      <Component {...pageProps} />
      <Analytics />
    </>
  )
}
