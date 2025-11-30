/**
 * JSON結果をパースして、バッチファイル用に出力するスクリプト
 */

const fs = require('fs');
const path = require('path');

const resultFile = path.join(__dirname, '..', 'temp_result.json');

if (!fs.existsSync(resultFile)) {
  process.exit(1);
}

const content = fs.readFileSync(resultFile, 'utf-8');
const jsonLine = content.split(/\r?\n/).find(line => line.trim().match(/^\s*\{/));

if (!jsonLine) {
  process.exit(1);
}

try {
  const obj = JSON.parse(jsonLine.trim());
  
  // バッチファイル用に出力（各行に1つの値）
  console.log(obj.liveStreamId || '');
  console.log(obj.isLive ? 'True' : 'False');
  console.log(obj.latestVideoId || '');
  console.log(obj.channelId || '');
} catch (e) {
  process.exit(1);
}



