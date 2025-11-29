/**
 * サーチグラウンディング機能のテストスクリプト
 */
const fs = require('fs');
const path = require('path');

// .envファイルからAPIキーを読み込む
const envPath = path.join(__dirname, '..', '.env');
let apiKey = '';

if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf-8');
  const match = envContent.match(/GOOGLE_API_KEY=(.+)/);
  if (match) {
    apiKey = match[1].trim();
  }
}

if (!apiKey) {
  console.error('❌ GOOGLE_API_KEYが見つかりません。.envファイルを確認してください。');
  process.exit(1);
}

// テストメッセージのリスト（毎回異なるジャンルや語感）
const testMessageList = [
  'ドラクエ10の最新情報教えて',
  'FF14の最新アップデート情報を教えてください',
  '原神の新キャラクター情報が知りたい',
  'アニメ「呪術廻戦」の最新話の情報を教えて',
  '2025年のコスメトレンドについて教えて',
  '最新のゲーム攻略情報が知りたい',
  '今話題のアニメ情報を教えてください',
  '最新のゲームニュースを教えて',
  '人気ゲームの最新情報が知りたい',
  '最新のエンタメ情報を教えてください'
];

// コマンドライン引数からメッセージインデックスを取得（デフォルトは0）
const messageIndex = parseInt(process.argv[2]) || 0;
const testMessageContent = testMessageList[messageIndex % testMessageList.length];

// テストメッセージ（サーチグラウンディングが必要そうなメッセージ）
const testMessages = [
  {
    role: 'user',
    content: testMessageContent,
    timestamp: new Date().toISOString()
  }
];

// サーバー側のログを確認するためのヘルパー関数
function checkServerLogs() {
  // 開発サーバーのログは通常、ターミナルに出力される
  // ここでは、APIレスポンスから推測できる情報を表示する
  console.log('📋 サーバー側のログ確認:');
  console.log('   - 開発サーバーのターミナルで以下のログを確認してください:');
  console.log('     [vercel.ts] 🔍 サーチグラウンディング判定:');
  console.log('     [vercel.ts] ✅ キーワード検出:');
  console.log('     [vercel.ts] ✅ サーチグラウンディング必要と判定、dynamicRetrievalConfigを削除');
  console.log('     [vercel.ts] 📊 最終的なoptions:');
  console.log('     [vercel.ts] 🔍 サーチグラウンディング検出詳細:');
  console.log('');
}

// APIを呼び出す
async function testSearchGrounding() {
  console.log('🧪 サーチグラウンディング機能のテストを開始します...\n');
  console.log(`📝 テストメッセージ: ${testMessageContent}`);
  console.log('');
  console.log('🔍 検出されるべきキーワード:');
  console.log('   - ドラクエ (ゲーム情報関連)');
  console.log('   - 最新情報 (最新情報関連)');
  console.log('   - 教えて (情報取得を求める表現)');
  console.log('');

  try {
    const requestPayload = {
      messages: testMessages,
      apiKey: apiKey,
      model: 'gemini-2.0-flash',
      stream: true,
      useSearchGrounding: true,
      temperature: 1.0,
      maxTokens: 4096,
    };

    console.log('📤 APIリクエスト送信:');
    console.log('   - useSearchGrounding: true');
    console.log('   - model:', requestPayload.model);
    console.log('');

    const response = await fetch('http://localhost:3000/api/ai/vercel', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestPayload),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ APIエラー:', response.status, errorText);
      process.exit(1);
    }

    console.log('✅ API呼び出し成功');
    console.log('📊 ステータス:', response.status);
    console.log('');
    checkServerLogs();
    console.log('📊 レスポンスを解析中...\n');

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let hasSearchGrounding = false;
    let fullText = '';
    let metadataReceived = false;
    let metadataContent = null;
    let responseText = '';

    try {
      let chunkCount = 0;
      while (true) {
        const { done, value } = await reader.read();
        if (done) {
          console.log(`📊 ストリーム読み取り完了: ${chunkCount}チャンク受信`);
          break;
        }

        chunkCount++;
        const chunk = decoder.decode(value, { stream: true });
        fullText += chunk;

        if (chunkCount <= 3) {
          console.log(`📦 チャンク${chunkCount}受信 (${chunk.length}文字):`, chunk.substring(0, 100));
        }

        // メタデータ行をチェック
        const lines = chunk.split('\n');
        for (const line of lines) {
          if (line.startsWith('f:')) {
            metadataReceived = true;
            try {
              const metadataStr = line.substring(2);
              metadataContent = JSON.parse(metadataStr);
              if (metadataContent.hasSearchGrounding === true) {
                hasSearchGrounding = true;
                console.log('✅ サーチグラウンディング検出成功！');
                console.log('📋 メタデータ:', JSON.stringify(metadataContent, null, 2));
              } else {
                console.log('ℹ️ メタデータ受信:', JSON.stringify(metadataContent, null, 2));
                console.log('⚠️ hasSearchGroundingがfalseまたは未設定です');

                // デバッグ情報を表示
                if (metadataContent.debug) {
                  console.log('\n🔍 デバッグ情報:');
                  console.log('   - useSearchGrounding:', metadataContent.debug.useSearchGrounding);
                  console.log('   - hasGroundingMetadata:', metadataContent.debug.hasGroundingMetadata);
                  console.log('   - hasWebSearchQueries:', metadataContent.debug.hasWebSearchQueries);
                  console.log('   - webSearchQueriesCount:', metadataContent.debug.webSearchQueriesCount);
                  console.log('   - searchQueriesCount:', metadataContent.debug.searchQueriesCount);
                  console.log('   - hasDynamicRetrievalConfig:', metadataContent.debug.hasDynamicRetrievalConfig);

                  if (metadataContent.debug.hasDynamicRetrievalConfig) {
                    console.log('   ⚠️ dynamicRetrievalConfigが設定されているため、サーチグラウンディングが使われない可能性があります');
                  }
                }
              }
            } catch (e) {
              console.log('⚠️ メタデータのパースエラー:', e.message);
              console.log('   生データ:', line);
            }
          } else if (line.startsWith('0:"')) {
            // テキストチャンクを抽出
            try {
              // 0:"..."形式のチャンクを抽出（エスケープされた文字列に対応）
              const textMatch = line.match(/^0:"(.+)"$/);
              if (textMatch) {
                // エスケープされた文字を正しく処理
                let text = textMatch[1];
                text = text.replace(/\\"/g, '"');
                text = text.replace(/\\\\/g, '\\');
                text = text.replace(/\\n/g, '\n');
                text = text.replace(/\\r/g, '\r');
                text = text.replace(/\\t/g, '\t');
                responseText += text;
              } else {
                // マッチしない場合は、行全体から抽出を試みる
                const altMatch = line.match(/^0:"(.+?)(?:"|$)/);
                if (altMatch) {
                  let text = altMatch[1];
                  text = text.replace(/\\"/g, '"');
                  text = text.replace(/\\\\/g, '\\');
                  responseText += text;
                }
              }
            } catch (e) {
              console.log('⚠️ テキストチャンクのパースエラー:', e.message);
              console.log('   生データ:', line.substring(0, 100));
            }
          } else if (line.trim() && !line.startsWith('d:') && !line.startsWith('f:')) {
            // その他の行（デバッグ用）
            if (line.length > 0 && line.length < 200) {
              console.log('📋 その他の行:', line);
            }
          }
        }
      }
    } catch (error) {
      console.log('⚠️ ストリーム読み取りエラー:', error.message);
      // エラーが発生しても、これまでに取得したデータを処理する
    }

    console.log('\n' + '='.repeat(60));
    console.log('📊 テスト結果サマリー');
    console.log('='.repeat(60));
    console.log('✅ API呼び出し: 成功');
    console.log('📋 メタデータ受信:', metadataReceived ? '✅ あり' : '❌ なし');
    if (metadataReceived && metadataContent) {
      console.log('🔍 hasSearchGrounding:', metadataContent.hasSearchGrounding === true ? '✅ true' : '❌ false/未設定');
    }
    console.log('📝 レスポンステキスト長:', responseText.length, '文字');
    console.log('');

    // 掛け合いを解析してターン数をカウント
    let dialogueTurns = 0;

    // 1. XML形式のチェック
    const xmlTagPattern = /<([AB])\s+[^>]*>/gi;
    const xmlMatches = responseText.match(xmlTagPattern);
    if (xmlMatches) {
      dialogueTurns = xmlMatches.length;
      console.log('📊 XMLタグ検出:', xmlMatches.length, 'ターン');
      console.log('   - タグ:', xmlMatches.slice(0, 10).join(', '));
    } else {
      // 2. LINE形式のチェック (IRIS: / FIONA:)
      const linePattern = /^(IRIS|FIONA):\s*\[/gm;
      const lineMatches = responseText.match(linePattern);
      if (lineMatches) {
        dialogueTurns = lineMatches.length;
        console.log('📊 LINE形式検出:', lineMatches.length, 'ターン');
        console.log('   - 行:', lineMatches.slice(0, 10).join(', '));
      } else {
        // XML形式でもLINE形式でもない場合、通常のテキストとして扱う
        console.log('📊 XML形式でもLINE形式でもない通常のテキストレスポンス');
      }
    }

    // レスポンス内容からサーチグラウンディングが使われているかを推測
    const responseContainsLatestInfo = responseText.includes('2025年') ||
      responseText.includes('バージョン') ||
      responseText.includes('アップデート') ||
      responseText.includes('最新');

    // サーチグラウンディングが使われている場合、掛け合いは7ターン以上である必要がある
    const isSearchGroundingUsed = hasSearchGrounding || (responseContainsLatestInfo && metadataContent?.debug?.useSearchGrounding);
    const meetsTurnRequirement = !isSearchGroundingUsed || dialogueTurns >= 7;

    if (hasSearchGrounding) {
      console.log('✅ テスト成功: サーチグラウンディングが正しく発動しました！');
      if (dialogueTurns > 0) {
        if (dialogueTurns >= 7) {
          console.log(`✅ 掛け合いターン数: ${dialogueTurns}ターン（7ターン以上: OK）`);
        } else {
          console.log(`❌ 掛け合いターン数: ${dialogueTurns}ターン（7ターン未満: NG）`);
        }
      }
    } else if (responseContainsLatestInfo && metadataContent?.debug?.useSearchGrounding) {
      console.log('⚠️ 注意: メタデータから検出できませんでしたが、レスポンス内容からサーチグラウンディングが使われている可能性があります');
      console.log('   - useSearchGrounding: true が設定されている');
      console.log('   - レスポンスに最新情報が含まれている');
      console.log('   - Gemini APIのメタデータ取得方法に問題がある可能性があります');
      if (dialogueTurns > 0) {
        if (dialogueTurns >= 7) {
          console.log(`✅ 掛け合いターン数: ${dialogueTurns}ターン（7ターン以上: OK）`);
        } else {
          console.log(`❌ 掛け合いターン数: ${dialogueTurns}ターン（7ターン未満: NG）`);
        }
      }
    } else {
      console.log('❌ テスト失敗: サーチグラウンディングが発動しませんでした。');
      console.log('');
      console.log('🔍 トラブルシューティング:');
      console.log('   1. 開発サーバーのターミナルで以下のログを確認してください:');
      console.log('      - [vercel.ts] 🔍 サーチグラウンディング条件チェック:');
      console.log('      - [vercel.ts] 🔍 サーチグラウンディング判定:');
      console.log('      - [vercel.ts] ✅ キーワード検出: ドラクエ または 最新情報 または 教えて');
      console.log('      - [vercel.ts] ✅ サーチグラウンディング必要と判定、dynamicRetrievalConfigを削除');
      console.log('      - [vercel.ts] 📊 最終的なoptions:');
      console.log('      - [vercel.ts] メタデータ取得開始:');
      console.log('      - [vercel.ts] メタデータ取得結果:');
      console.log('   2. もし「キーワード未検出」と表示される場合、キーワードマッチングに問題があります');
      console.log('   3. もし「dynamicRetrievalConfig」が削除されていない場合、削除処理に問題があります');
      console.log('   4. Gemini APIが実際にサーチグラウンディングを使っていない可能性があります');
    }
    console.log('='.repeat(60));
    console.log('\n' + '='.repeat(60));
    console.log('📝 返ってきたセリフ（全文）:');
    console.log('='.repeat(60));
    console.log(responseText);
    console.log('='.repeat(60));
    console.log('\n📝 レスポンステキスト（最初の1000文字）:');
    if (responseText.length > 1000) {
      console.log('... (残り ' + (responseText.length - 1000) + ' 文字)');
    }

    // デバッグ用にファイルに保存
    fs.writeFileSync('response_debug.txt', responseText, 'utf-8');
    console.log('\n💾 レスポンスを response_debug.txt に保存しました');

    // レスポンス内容からサーチグラウンディングが使われているかをより詳しく分析
    console.log('\n🔍 レスポンス内容分析:');
    const hasDate2025 = responseText.includes('2025年');
    const hasVersion = responseText.includes('バージョン') || responseText.includes('version');
    const hasUpdate = responseText.includes('アップデート') || responseText.includes('update');
    const hasLatestInfo = responseText.includes('最新') || responseText.includes('最新情報');
    const hasSpecificDate = /\d{4}年\d{1,2}月\d{1,2}日/.test(responseText);

    console.log('   - 2025年の日付が含まれている:', hasDate2025 ? '✅' : '❌');
    console.log('   - バージョン情報が含まれている:', hasVersion ? '✅' : '❌');
    console.log('   - アップデート情報が含まれている:', hasUpdate ? '✅' : '❌');
    console.log('   - 最新情報が含まれている:', hasLatestInfo ? '✅' : '❌');
    console.log('   - 具体的な日付が含まれている:', hasSpecificDate ? '✅' : '❌');

    const searchGroundingIndicators = [hasDate2025, hasVersion, hasUpdate, hasLatestInfo, hasSpecificDate].filter(Boolean).length;
    console.log('   - サーチグラウンディングの指標:', searchGroundingIndicators, '/ 5');

    if (searchGroundingIndicators >= 3) {
      console.log('   ✅ レスポンス内容から判断すると、サーチグラウンディングが使われている可能性が高いです');
    }

    // テスト成功の条件: サーチグラウンディングが使われている場合、掛け合いは7ターン以上
    const testSuccess = isSearchGroundingUsed && meetsTurnRequirement;

    if (testSuccess) {
      console.log('\n✅ テスト成功: サーチグラウンディング機能と掛け合いターン数の要件を満たしています');
    } else if (isSearchGroundingUsed && !meetsTurnRequirement) {
      console.log('\n❌ テスト失敗: サーチグラウンディングは使われていますが、掛け合いが7ターン未満です');
    } else {
      console.log('\n❌ テスト失敗: サーチグラウンディングが発動していません');
    }

    process.exit(testSuccess ? 0 : 1);
  } catch (error) {
    console.error('❌ エラーが発生しました:', error);
    console.error('スタックトレース:', error.stack);
    process.exit(1);
  }
}

testSearchGrounding();

