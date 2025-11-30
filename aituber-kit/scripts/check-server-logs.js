/**
 * サーバー側のログを確認するスクリプト
 * 開発サーバーのログファイルを読み取る
 */
const fs = require('fs');
const path = require('path');

// ログファイルのパス（Next.jsのログは通常、ターミナルに出力される）
// ここでは、.nextディレクトリ内のログファイルを探す
const logPaths = [
  path.join(__dirname, '..', '.next', 'server-logs.txt'),
  path.join(__dirname, '..', 'server-logs.txt'),
  path.join(__dirname, '..', 'logs', 'server.log'),
];

console.log('🔍 サーバー側のログを確認中...\n');

let foundLogs = false;
for (const logPath of logPaths) {
  if (fs.existsSync(logPath)) {
    console.log(`📋 ログファイルが見つかりました: ${logPath}\n`);
    const logContent = fs.readFileSync(logPath, 'utf-8');
    const lines = logContent.split('\n');
    
    // サーチグラウンディング関連のログを抽出
    const searchGroundingLogs = lines.filter(line => 
      line.includes('サーチグラウンディング') || 
      line.includes('searchGrounding') ||
      line.includes('vercel.ts')
    );
    
    if (searchGroundingLogs.length > 0) {
      console.log('📊 サーチグラウンディング関連のログ:');
      searchGroundingLogs.slice(-20).forEach(line => {
        console.log('   ' + line);
      });
      foundLogs = true;
    } else {
      console.log('⚠️ サーチグラウンディング関連のログが見つかりませんでした。');
    }
    break;
  }
}

if (!foundLogs) {
  console.log('⚠️ ログファイルが見つかりませんでした。');
  console.log('📋 開発サーバーのターミナルで以下のログを確認してください:');
  console.log('   - [vercel.ts] 🔍 サーチグラウンディング判定:');
  console.log('   - [vercel.ts] ✅ キーワード検出:');
  console.log('   - [vercel.ts] ✅ サーチグラウンディング必要と判定、dynamicRetrievalConfigを削除');
  console.log('   - [vercel.ts] 📊 最終的なoptions:');
  console.log('   - [vercel.ts] 🔍 サーチグラウンディング検出詳細:');
}


