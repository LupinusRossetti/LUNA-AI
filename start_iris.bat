@echo off
echo ==============================
echo    AITuberKit - Iris 起動
echo ==============================

echo ▼ Iris 起動準備：キャッシュ削除...
rmdir /s /q .next-iris 2>nul

echo ▼ Iris 起動中...
start "Iris" cmd /k "npm run dev:iris"

echo ▼ Irisページをブラウザで表示（数秒待機）...
timeout /t 3 >nul
start "" "C:\Program Files\Google\Chrome\Application\chrome.exe" http://localhost:3000

echo Iris の単体起動が完了しました！
exit
