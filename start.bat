@echo off
echo =====================================
echo  AITuberKit - A → B 同時起動
echo =====================================

echo ▼ A 起動中...
start "A" cmd /k "npm run dev:A"

echo ▼ A の起動を待機（3000 LISTENING）...
:WAIT_A
timeout /t 1 >nul
netstat -ano | find ":3000" | find "LISTENING" >nul
if %errorlevel%==1 goto WAIT_A

start "" "C:\Program Files\Google\Chrome\Application\chrome.exe" http://localhost:3000

echo A OK！
echo.

timeout /t 3 >nul

echo ▼ B 起動中...
start "B" cmd /k "npm run dev:B"

echo ▼ B の起動を待機（3001 LISTENING）...
:WAIT_B
timeout /t 1 >nul
netstat -ano | find ":3001" | find "LISTENING" >nul
if %errorlevel%==1 goto WAIT_B

start "" "C:\Program Files\Google\Chrome\Application\chrome.exe" http://localhost:3001

echo B OK！
echo =====================================
exit
