@echo off
echo ==============================
echo    AITuberKit - A 起動
echo ==============================

echo ▼ A 起動準備：キャッシュ削除...
rmdir /s /q .next-iris 2>nul

echo ▼ A 起動中...
start "A" cmd /k "npm run dev:A"

echo ▼ Aページをブラウザで表示（数秒待機）...
timeout /t 3 >nul
start "" "C:\Program Files\Google\Chrome\Application\chrome.exe" http://localhost:3000

echo A の単体起動が完了しました！
exit
