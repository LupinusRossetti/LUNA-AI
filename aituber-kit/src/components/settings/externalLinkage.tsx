import { useTranslation } from 'react-i18next'

const ExternalLinkage = () => {
  const { t } = useTranslation()

  return (
    <div className="mb-10">
      <div className="mb-4 text-xl font-bold">{t('ExternalLinkageMode')}</div>
      <div className="space-y-4 text-sm text-text2 leading-relaxed">
        <p>
          <strong>外部連携モード（External Linkage Mode）</strong>は、WebSocket経由で外部のAIシステム（例: Orchestrator）と接続する機能です。
        </p>
        <div>
          <strong>用途：</strong>
          <ul className="list-disc list-inside ml-4 mt-2 space-y-1">
            <li>外部AIからメッセージを受信し、AItuberKitで表示・音声合成・Live2Dアニメーションを実行</li>
            <li>外部システムからの指示を受け取り、キャラクターの動作を制御</li>
            <li>複数のAIシステムやサービスと連携して動作</li>
          </ul>
        </div>
        <div>
          <strong>現在の状態：</strong>
          <p className="mt-2">
            Pythonバックエンドが削除されたため、この機能は現在使用されていません。
            通常は<strong>内部AIモード</strong>（Gemini API直接呼び出し）を使用します。
          </p>
        </div>
        <div>
          <strong>必要な環境変数：</strong>
          <ul className="list-disc list-inside ml-4 mt-2 space-y-1">
            <li><code>NEXT_PUBLIC_EXTERNAL_WS_URL</code>: WebSocket接続URL</li>
            <li><code>NEXT_PUBLIC_APP_MODE</code>: アプリモード（A/B/AB）</li>
            <li><code>NEXT_PUBLIC_APP_ID</code>: アプリID（A/B）</li>
            <li><code>NEXT_PUBLIC_WS_PATH_A</code>, <code>NEXT_PUBLIC_WS_PATH_B</code>, <code>NEXT_PUBLIC_WS_PATH_AB</code>: WebSocketパス</li>
          </ul>
        </div>
        <div className="bg-yellow-100 border border-yellow-400 text-yellow-800 p-3 rounded">
          <strong>注意：</strong> 外部連携モードを使用する場合は、上記の環境変数を正しく設定する必要があります。
          通常の使用では、<code>NEXT_PUBLIC_EXTERNAL_LINKAGE_MODE="false"</code>に設定してください。
        </div>
      </div>
    </div>
  )
}

export default ExternalLinkage

