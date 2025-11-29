/**
 * YouTube OAuth2 Refresh Token取得スクリプト
 * 
 * 使用方法:
 * 1. .envファイルにCLIENT_IDとCLIENT_SECRETを設定
 * 2. node scripts/get-refresh-token.js を実行
 * 3. ブラウザで認証URLが開きます
 * 4. 認証後、表示されるコードをコピーして入力
 * 5. 取得したREFRESH_TOKENを.envファイルに保存
 */

const https = require('https');
const http = require('http');
const { URL } = require('url');
const readline = require('readline');
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');

// .envファイルを読み込む
function loadEnvFile() {
  const envPath = path.join(__dirname, '..', '.env');
  if (!fs.existsSync(envPath)) {
    console.error('エラー: .envファイルが見つかりません。');
    console.error('example.envをコピーして.envファイルを作成してください。');
    process.exit(1);
  }

  const envContent = fs.readFileSync(envPath, 'utf-8');
  const env = {};
  
  envContent.split('\n').forEach(line => {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#')) {
      const [key, ...valueParts] = trimmed.split('=');
      if (key && valueParts.length > 0) {
        env[key.trim()] = valueParts.join('=').trim().replace(/^["']|["']$/g, '');
      }
    }
  });

  return env;
}

// .envファイルを更新する
function updateEnvFile(key, value) {
  const envPath = path.join(__dirname, '..', '.env');
  let envContent = fs.readFileSync(envPath, 'utf-8');
  
  const regex = new RegExp(`^${key}=.*$`, 'm');
  if (regex.test(envContent)) {
    envContent = envContent.replace(regex, `${key}=${value}`);
  } else {
    envContent += `\n${key}=${value}\n`;
  }
  
  fs.writeFileSync(envPath, envContent, 'utf-8');
  console.log(`\n✅ .envファイルに${key}を保存しました。`);
}

// 認証URLを生成
function generateAuthUrl(clientId, redirectUri) {
  const scopes = [
    'https://www.googleapis.com/auth/youtube.readonly',
    'https://www.googleapis.com/auth/youtube.force-ssl'
  ].join(' ');
  
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: scopes,
    access_type: 'offline',
    prompt: 'consent'
  });
  
  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}

// 認証コードをREFRESH_TOKENに交換
function exchangeCodeForToken(clientId, clientSecret, code, redirectUri) {
  return new Promise((resolve, reject) => {
    const postData = new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      code: code,
      grant_type: 'authorization_code',
      redirect_uri: redirectUri
    }).toString();

    const options = {
      hostname: 'oauth2.googleapis.com',
      path: '/token',
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': Buffer.byteLength(postData)
      }
    };

    const req = https.request(options, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          if (json.error) {
            reject(new Error(`エラー: ${json.error} - ${json.error_description || ''}`));
          } else {
            resolve(json);
          }
        } catch (e) {
          reject(new Error(`レスポンスの解析に失敗: ${data}`));
        }
      });
    });

    req.on('error', (e) => {
      reject(e);
    });

    req.write(postData);
    req.end();
    });
}

// ローカルサーバーを起動して認証コードを受け取る
function startLocalServer(port) {
  return new Promise((resolve, reject) => {
    const server = http.createServer((req, res) => {
      const url = new URL(req.url, `http://localhost:${port}`);
      
      if (url.pathname === '/oauth2callback') {
        const code = url.searchParams.get('code');
        const error = url.searchParams.get('error');
        
        if (error) {
          res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
          res.end(`
            <html>
              <head><title>認証エラー</title></head>
              <body>
                <h1>認証エラー</h1>
                <p>エラー: ${error}</p>
                <p>このウィンドウを閉じてください。</p>
              </body>
            </html>
          `);
          server.close();
          reject(new Error(`認証エラー: ${error}`));
          return;
        }
        
        if (code) {
          res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
          res.end(`
            <html>
              <head><title>認証成功</title></head>
              <body>
                <h1>認証成功！</h1>
                <p>認証コードを取得しました。このウィンドウを閉じてください。</p>
                <p>ターミナルに戻って処理を確認してください。</p>
              </body>
            </html>
          `);
          server.close();
          resolve(code);
        } else {
          res.writeHead(400, { 'Content-Type': 'text/html; charset=utf-8' });
          res.end(`
            <html>
              <head><title>エラー</title></head>
              <body>
                <h1>エラー</h1>
                <p>認証コードが取得できませんでした。</p>
                <p>このウィンドウを閉じてください。</p>
              </body>
            </html>
          `);
          server.close();
          reject(new Error('認証コードが取得できませんでした'));
        }
      } else {
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end('Not Found');
      }
    });

    server.listen(port, () => {
      console.log(`ローカルサーバーを起動しました: http://localhost:${port}`);
    });

    server.on('error', (e) => {
      if (e.code === 'EADDRINUSE') {
        reject(new Error(`ポート${port}は既に使用されています。`));
      } else {
        reject(e);
      }
    });
  });
}

// メイン処理
async function main() {
  console.log('========================================');
  console.log('  YouTube OAuth2 Refresh Token取得');
  console.log('========================================\n');

  // .envファイルを読み込む
  const env = loadEnvFile();
  
  const clientId = env.CLIENT_ID || env.NEXT_PUBLIC_CLIENT_ID;
  const clientSecret = env.CLIENT_SECRET || env.NEXT_PUBLIC_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    console.error('エラー: CLIENT_IDまたはCLIENT_SECRETが.envファイルに設定されていません。');
    console.error('以下の環境変数を.envファイルに設定してください:');
    console.error('  CLIENT_ID=your_client_id');
    console.error('  CLIENT_SECRET=your_client_secret');
    process.exit(1);
  }

  console.log('✅ CLIENT_IDとCLIENT_SECRETを読み込みました。\n');

  // リダイレクトURI
  const redirectUri = 'http://localhost:8080/oauth2callback';
  const port = 8080;

  // 認証URLを生成
  const authUrl = generateAuthUrl(clientId, redirectUri);
  
  console.log('認証URLを生成しました。');
  console.log('ブラウザで認証を行ってください。\n');
  console.log('認証URL:');
  console.log(authUrl);
  console.log('\n');

  // ローカルサーバーを起動
  const serverPromise = startLocalServer(port);

  // ブラウザで認証URLを開く
  const platform = process.platform;
  let command;
  
  if (platform === 'win32') {
    command = 'start';
  } else if (platform === 'darwin') {
    command = 'open';
  } else {
    command = 'xdg-open';
  }

  exec(`${command} "${authUrl}"`, (error) => {
    if (error) {
      console.error('ブラウザを自動で開けませんでした。上記のURLを手動でブラウザにコピーしてください。');
    }
  });

  // 認証コードを待つ
  let code;
  try {
    code = await serverPromise;
    console.log('✅ 認証コードを取得しました。\n');
  } catch (error) {
    console.error('❌ 認証コードの取得に失敗しました:', error.message);
    process.exit(1);
  }

  // 認証コードをREFRESH_TOKENに交換
  console.log('認証コードをREFRESH_TOKENに交換しています...\n');
  
  try {
    const tokenResponse = await exchangeCodeForToken(clientId, clientSecret, code, redirectUri);
    
    if (tokenResponse.refresh_token) {
      console.log('✅ REFRESH_TOKENを取得しました！\n');
      console.log('REFRESH_TOKEN:', tokenResponse.refresh_token);
      console.log('');
      
      // .envファイルに保存
      updateEnvFile('REFRESH_TOKEN', tokenResponse.refresh_token);
      
      if (tokenResponse.access_token) {
        console.log('アクセストークンも取得しました（有効期限あり）。');
      }
      
      console.log('\n✅ 完了しました！');
      console.log('REFRESH_TOKENは.envファイルに保存されました。');
    } else {
      console.warn('⚠️ 警告: REFRESH_TOKENがレスポンスに含まれていません。');
      console.warn('既に認証済みの場合は、以前のREFRESH_TOKENを再利用してください。');
      if (tokenResponse.access_token) {
        console.log('アクセストークンは取得できました:', tokenResponse.access_token);
      }
    }
  } catch (error) {
    console.error('❌ REFRESH_TOKENの取得に失敗しました:', error.message);
    process.exit(1);
  }
}

// 実行
main().catch((error) => {
  console.error('予期しないエラー:', error);
  process.exit(1);
});

