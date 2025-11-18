@echo off
echo ==============================
echo   AITuberKit - B 起動
echo ==============================

echo ▼ B 起動準備：キャッシュ削除...
rmdir /s /q .next-B 2>nul

echo ▼ B 起動中...
start "B" cmd /k "npm run dev:B"

echo ▼ Bページをブラウザで表示（数秒待機）...
timeout /t 3 >nul
start "" "C:\Program Files\Google\Chrome\Application\chrome.exe" http://localhost:3001

echo B の単体起動が完了しました！
exit
