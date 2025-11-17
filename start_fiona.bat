@echo off
echo ==============================
echo   AITuberKit - Fiona 起動
echo ==============================

echo ▼ Fiona 起動準備：キャッシュ削除...
rmdir /s /q .next-fiona 2>nul

echo ▼ Fiona 起動中...
start "Fiona" cmd /k "npm run dev:fiona"

echo ▼ Fionaページをブラウザで表示（数秒待機）...
timeout /t 3 >nul
start "" "C:\Program Files\Google\Chrome\Application\chrome.exe" http://localhost:3001

echo Fiona の単体起動が完了しました！
exit
