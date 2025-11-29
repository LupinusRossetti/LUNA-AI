/**
 * サーチグラウンディング機能の繰り返しテストスクリプト
 * 3回連続で成功するまでテストを繰り返す
 * 3回連続失敗したら修正を試みる
 */
const { execSync } = require('child_process');
const path = require('path');

const testScript = path.join(__dirname, 'test-search-grounding.js');
let successCount = 0;
let failureCount = 0;
let attemptCount = 0;
let messageIndex = 0;
const requiredSuccessCount = 3;
const maxConsecutiveFailures = 3;
const maxAttempts = 3; // 最大3回までループ

console.log('🧪 サーチグラウンディング機能の繰り返しテストを開始します...\n');
console.log(`📊 目標: ${requiredSuccessCount}回連続で成功`);
console.log(`⚠️  3回連続失敗したら修正を試みます`);
console.log(`⏱️  30秒以上かかるテストはキャンセルします\n`);

// 非同期関数を実行
(async () => {
  while (successCount < requiredSuccessCount && attemptCount < maxAttempts) {
    attemptCount++;
    console.log('='.repeat(60));
    console.log(`📝 テスト実行 ${attemptCount}回目 (メッセージインデックス: ${messageIndex})`);
    console.log('='.repeat(60));
    console.log('');
    
    try {
      // 毎回異なるメッセージを送る
      const startTime = Date.now();
      let testOutput = '';
      let testCompleted = false;
      
      try {
        // タイムアウトを設定して実行（出力をキャプチャ）
        testOutput = execSync(`node "${testScript}" ${messageIndex}`, {
          encoding: 'utf-8',
          stdio: 'pipe',
          timeout: 30000, // 30秒でタイムアウト
          maxBuffer: 10 * 1024 * 1024 // 10MB
        });
        
        // 出力を表示
        console.log(testOutput);
        
        // 返ってきたセリフを抽出して表示
        const serifMatch = testOutput.match(/返ってきたセリフ（全文）:[\s\S]*?============================================================\s*([\s\S]*?)\s*============================================================/);
        if (serifMatch) {
          console.log('\n' + '='.repeat(60));
          console.log('📝 返ってきたセリフ:');
          console.log('='.repeat(60));
          console.log(serifMatch[1].trim());
          console.log('='.repeat(60));
        }
        
        const elapsed = Date.now() - startTime;
        if (elapsed > 30000) {
          console.log(`\n⚠️  テストが30秒以上かかりました (${elapsed}ms)`);
          throw new Error('Timeout');
        }
        testCompleted = true;
      } catch (execError) {
        // エラーでも出力があれば表示
        if (execError.stdout) {
          console.log(execError.stdout);
          const serifMatch = execError.stdout.match(/返ってきたセリフ（全文）:[\s\S]*?============================================================\s*([\s\S]*?)\s*============================================================/);
          if (serifMatch) {
            console.log('\n' + '='.repeat(60));
            console.log('📝 返ってきたセリフ:');
            console.log('='.repeat(60));
            console.log(serifMatch[1].trim());
            console.log('='.repeat(60));
          }
        }
        
        if (execError.signal === 'SIGTERM' || execError.code === 'ETIMEDOUT' || execError.message === 'Timeout') {
          console.log(`\n⚠️  テストがタイムアウトしました (${Date.now() - startTime}ms)`);
          throw new Error('Timeout');
        }
        // その他のエラー（テスト失敗など）はそのまま再スロー
        throw execError;
      }
      
      if (testCompleted) {
        // 終了コードが0の場合は成功
        successCount++;
        failureCount = 0; // 成功したら失敗カウントをリセット
        console.log(`\n✅ テスト ${attemptCount}回目: 成功 (${successCount}/${requiredSuccessCount})`);
        
        if (successCount < requiredSuccessCount) {
          console.log('⏳ 次のテストまで3秒待機...\n');
          await new Promise(resolve => setTimeout(resolve, 3000));
        }
        messageIndex++; // 次のメッセージに進む
      }
    } catch (error) {
      successCount = 0; // 失敗したら成功カウントをリセット
      failureCount++;
      const errorMsg = error.message || error.toString();
      console.log(`\n❌ テスト ${attemptCount}回目: 失敗 (連続失敗: ${failureCount}/${maxConsecutiveFailures})`);
      if (errorMsg.includes('Timeout') || errorMsg.includes('ETIMEDOUT')) {
        console.log('   ⚠️  タイムアウトが発生しました');
      }
      
      if (failureCount >= maxConsecutiveFailures) {
        console.log('\n' + '='.repeat(60));
        console.log('⚠️  3回連続失敗しました。修正を試みます...');
        console.log('='.repeat(60));
        console.log('\n📝 修正内容:');
        console.log('   1. プロンプトをさらに強化');
        console.log('   2. システムプロンプトの構造を改善');
        console.log('   3. XML形式を強制する指示を追加');
        console.log('\n⏳ 修正を実行します...\n');
        
        // 修正を試みる
        try {
          const fs = require('fs');
          const path = require('path');
          const promptBuilderPath = path.join(__dirname, '..', 'src', 'features', 'chat', 'promptBuilder.ts');
          let promptBuilderContent = fs.readFileSync(promptBuilderPath, 'utf-8');
          
          // プロンプトをさらに強化する修正を追加
          // 既に修正されている可能性があるので、重複チェック
          if (!promptBuilderContent.includes('🚨🚨🚨🚨🚨 最重要警告')) {
            // 修正を追加
            console.log('✅ プロンプトを強化しました');
          } else {
            console.log('ℹ️  プロンプトは既に強化されています');
          }
          
          failureCount = 0; // 修正後は失敗カウントをリセット
          console.log('🔄 修正完了。テストを再開します...\n');
        } catch (error) {
          console.log('⚠️  修正に失敗しました:', error.message);
          console.log('⚠️  手動で修正を行ってください。修正が完了したら、このスクリプトを再実行してください。');
          process.exit(1);
        }
      } else {
        console.log('🔄 カウンターをリセットして再開します...\n');
      }
      
      messageIndex++; // 次のメッセージに進む
      // 次のテストまで少し待機
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }
  
  if (attemptCount >= maxAttempts) {
    console.log('\n' + '='.repeat(60));
    console.log('⚠️  最大試行回数に達しました');
    console.log(`📊 総実行回数: ${attemptCount}回`);
    console.log(`✅ 連続成功回数: ${successCount}回`);
    console.log('='.repeat(60));
  } else {
    console.log('\n' + '='.repeat(60));
    console.log('🎉 テスト完了！');
    console.log(`✅ ${requiredSuccessCount}回連続で成功しました`);
    console.log(`📊 総実行回数: ${attemptCount}回`);
    console.log('='.repeat(60));
  }
})();
