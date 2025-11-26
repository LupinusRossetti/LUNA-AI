import getConfig from 'next/config'

/**
 * github pagesに公開時にアセットを読み込めるようにするため、
 * 環境変数を見てURLにリポジトリ名を追加する
 */
export function buildUrl(path: string): string {
  try {
    const config = getConfig()
    const publicRuntimeConfig = config?.publicRuntimeConfig as { root?: string } | undefined

    // 空白などの特殊文字を含むパスを適切にエンコード
    // ただし、パス区切り文字（/）はエンコードしない
    const encodedPath = path
      .split('/')
      .map((segment) => encodeURIComponent(segment))
      .join('/')

    // publicRuntimeConfigが存在しない場合（静的ページ生成時など）は空文字列を使用
    const root = publicRuntimeConfig?.root || ''

    return root + encodedPath
  } catch (error) {
    // エラー時はパスをそのまま返す（開発モードや静的ページ生成時のフォールバック）
    console.warn('buildUrl error:', error)
    return path
  }
}
